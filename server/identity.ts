import type Database from "better-sqlite3";
import {
  getIdentityLayers,
  getOrganizationByKey,
  getJourneyByKey,
} from "./db.js";
import { adapters } from "./config/adapters.js";
import type { Organization } from "./db/organizations.js";
import type { Journey } from "./db/journeys.js";
import type { ResponseMode } from "./expression.js";

export interface ComposeScopes {
  /**
   * Reception's pick per axis. Source of truth for which scope content
   * composes (CV1.E7.S3). When null, the scope is omitted from the
   * prompt even if the session has tags of that type — session tags
   * constrain reception's candidate pool, not composition.
   */
  organization?: string | null;
  journey?: string | null;
  /**
   * Whether `self/soul` and `ego/identity` should compose this turn
   * (CV1.E7.S4). When `true`, both deep identity layers render in the
   * prompt's identity cluster. When `false`, both are skipped — the
   * prompt opens directly with persona (if any) or the form cluster.
   * `undefined` defaults to `true` for back-compat with callers that
   * pre-date S4; the canonical path is reception's classification,
   * which always provides an explicit boolean.
   */
  touchesIdentity?: boolean;
  /**
   * Response mode for this turn. When provided, a shape-guidance block
   * tail-loads onto the system prompt so the main pass produces a draft
   * already in the right register — the expression pass downstream then
   * polishes instead of having to undo essayistic bloat in conversational
   * turns. `undefined` skips the block (back-compat for callers that
   * pre-date this addition).
   */
  mode?: ResponseMode;
}

/**
 * Shape-guidance block appended at the end of the system prompt when the
 * caller passes a mode. Brief on purpose — the main model already carries
 * the substance via personas/identity/scope; this block only adjusts the
 * register of the reply. Mirrors the post-generation expression guides
 * (server/expression.ts MODE_GUIDES), written for the generating model
 * rather than the rewriter.
 */
const SHAPE_GUIDES: Record<ResponseMode, string> = {
  conversational:
    "Reply in conversational register: one to three sentences, plain prose, no headers, no bullet lists, no preamble. Match the weight of what the user wrote — short user, short reply. Don't expand beyond what they brought.",
  compositional:
    "Reply in compositional register: structured but tight. Use headers or bullet lists only when the content is genuinely list-shaped (steps, comparisons, enumerations). Short paragraphs over long ones.",
  essayistic:
    "Reply in essayistic register: develop the thought across paragraphs with connective tissue. Prose over lists. Depth over summary.",
};

/**
 * Composition order (distinct from the map's display order):
 *
 *   self/soul → self/doctrine → ego/identity → [personas...] → [organization] → [journey] → ego/behavior → [adapter]
 *
 * Rationale: the "who" cluster (soul, doctrine, identity, personas-as-
 * lenses) opens the prompt. Within the identity cluster, broadest to
 * narrowest: soul (essence) → doctrine (adopted framework / mental
 * models) → identity (operational positioning). Personas follow as
 * lenses. Organization and journey — situational scopes — follow the
 * who cluster, broader (org) before narrower (journey). Then the form
 * cluster (behavior = conduct/method).
 *
 * `ego/expression` is deliberately absent here. Starting with CV1.E7.S1,
 * expression is no longer a prompt layer — it is input to a dedicated
 * post-generation LLM pass that reshapes the draft (server/expression.ts).
 * Keeping form rules out of the main prompt frees substance from
 * competing with form for the model's attention budget.
 *
 * **Multi-persona (CV1.E7.S5).** When `personaKeys` carries more than
 * one key, all persona blocks render into the prompt simultaneously,
 * preceded by a shared instruction: *"Multiple persona lenses are
 * active simultaneously. Speak with one coherent voice that integrates
 * all of them; do not label segments."* The order of the array is
 * preserved — the first persona is the **leading lens** whose voice
 * frames the opening of the reply. Single-persona behavior is
 * identical to the previous singular code path (no prefix, one block).
 *
 * **Conditional scope (CV1.E7.S3).** Organization and journey blocks
 * compose only when reception activates them for this turn. Session
 * tags constrain reception's candidate pool, not composition — a
 * pinned scope absent from reception's pick is omitted from the
 * prompt. Reception is the single source of truth for what scope
 * content reaches the LLM.
 *
 * **Conditional identity layers (CV1.E7.S4 + CV1.E9.S1).** `self/soul`,
 * `self/doctrine`, and `ego/identity` compose only when reception flags
 * the turn as touching identity / purpose / values. The trio is gated
 * together (single boolean from reception); split per layer is parked
 * behind S4b. Conservative default — anything other than an explicit
 * `true` skips all three. `self/doctrine` (CV1.E9.S1) carries the
 * user's adopted framework — principles, doctrines, mental models — and
 * sits between soul (essence) and identity (positioning) so the
 * composed prompt reads broadest-to-narrowest within the cluster.
 * Empty doctrine (no row) silently skips. ego/behavior keeps composing
 * always (form is transversally relevant; the cost of stripping it is
 * too high).
 *
 * See docs/product/prompt-composition/index.md for the full pipeline,
 * docs/project/decisions.md 2026-04-20 (Journey Map as a peer surface),
 * 2026-04-24 (Response intelligence moves from prompt to pipeline),
 * 2026-04-25 (Conditional scope activation), and 2026-04-26
 * (Conditional identity layers).
 */
export function composeSystemPrompt(
  db: Database.Database,
  userId: string,
  personaKeys?: string[] | null,
  adapter?: string,
  scopes?: ComposeScopes,
): string {
  const allLayers = getIdentityLayers(db, userId);
  const get = (layer: string, key: string) =>
    allLayers.find((l) => l.layer === layer && l.key === key);

  const parts: string[] = [];

  // Identity cluster: who I am.
  // CV1.E7.S4: gated by `touchesIdentity` from reception. When the
  // turn doesn't invite depth on identity / purpose / values, both
  // self/soul and ego/identity are skipped — the prompt's identity
  // cluster opens directly at the persona block (if any). Default
  // is `true` for back-compat with callers that don't pass the flag;
  // the canonical caller (reception result) provides an explicit
  // boolean and the conservative default in NULL_RESULT is `false`.
  const includeIdentity = scopes?.touchesIdentity ?? true;
  if (includeIdentity) {
    const soul = get("self", "soul");
    if (soul) parts.push(soul.content);

    // CV1.E9.S1: doctrine sits between soul and identity. Empty/missing
    // is silently skipped — most users have no declared framework, and
    // the cluster reads naturally without it.
    const doctrine = get("self", "doctrine");
    if (doctrine) parts.push(doctrine.content);

    const identity = get("ego", "identity");
    if (identity) parts.push(identity.content);
  }

  // Personas cluster. Skip when the list is empty/undefined (base ego
  // voice answers). Single persona: render its content as-is. Multiple:
  // render each in order, prefixed by the shared multi-lens instruction.
  if (personaKeys && personaKeys.length > 0) {
    const personaBlocks: string[] = [];
    for (const key of personaKeys) {
      const persona = get("persona", key);
      if (persona) personaBlocks.push(persona.content);
    }
    if (personaBlocks.length === 1) {
      parts.push(personaBlocks[0]);
    } else if (personaBlocks.length > 1) {
      const prefix =
        "Multiple persona lenses are active simultaneously for this turn. Speak with one coherent voice that integrates all of them — each lens contributes its depth to the reply, but the voice is unified. Do not label segments or mark transitions between lenses inside the text; weave them into a single answer.";
      parts.push([prefix, ...personaBlocks].join("\n\n"));
    }
  }

  // Scope cluster: where I am. Broader before narrower. Reception is
  // the source of truth (CV1.E7.S3) — a scope composes only when
  // reception activated it for this turn. Session tags continue to
  // constrain reception's candidate pool, but they no longer force
  // composition. A pinned scope absent from this turn's pick produces
  // an empty block.
  if (scopes?.organization) {
    const org = getOrganizationByKey(db, userId, scopes.organization);
    const block = renderScope(org);
    if (block) parts.push(block);
  }

  if (scopes?.journey) {
    const journey = getJourneyByKey(db, userId, scopes.journey);
    const block = renderScope(journey);
    if (block) parts.push(block);
  }

  // Form cluster: how I act. Expression handled by the post-generation
  // pass (CV1.E7.S1) — not appended here.
  const behavior = get("ego", "behavior");
  if (behavior) parts.push(behavior.content);

  if (adapter && adapters[adapter]?.instruction) {
    parts.push(adapters[adapter].instruction);
  }

  // Shape guidance — last so recency biases the model toward honoring it.
  // Skipped when the caller didn't pass a mode (back-compat for tests and
  // any pre-mode callers).
  if (scopes?.mode) {
    parts.push(SHAPE_GUIDES[scopes.mode]);
  }

  if (parts.length === 0) return "";
  return parts.join("\n\n---\n\n");
}

/**
 * Render a scope (organization or journey) as a prompt block.
 *
 * Both fields present → `briefing\n\n---\n\nCurrent situation:\nsituation`.
 * Only briefing → just briefing.
 * Only situation → just the situation block (edge; rare in practice).
 * Neither → null (skip entirely).
 * Archived → null (archived scopes never compose, even if the key
 *   was passed in — reception is supposed to exclude them, but this
 *   is a second layer of defense).
 * Missing scope (unknown key) → null.
 */
/**
 * CV1.E10.S1: third compose path — the "minimal" weight class.
 *
 * Engaged by reception when `is_trivial: true` (greeting, acknow-
 * ledgment, casual ping). Returns ONLY the adapter instruction — no
 * identity, no persona, no scope, no behavior. The model receives
 * the user's text and replies in its default voice.
 *
 * Pure function of the adapter parameter; no DB access. Falls back
 * to empty string when the adapter is unknown or absent.
 *
 * Sibling to `composeSystemPrompt` (canonical) and `composeAlmaPrompt`
 * (heavy). Pipeline branches on reception:
 *   is_trivial      → composeMinimalPrompt
 *   is_self_moment  → composeAlmaPrompt
 *   default         → composeSystemPrompt
 *
 * The three are mutually exclusive at the trigger level (reception
 * forces is_trivial=false when is_self_moment=true).
 */
export function composeMinimalPrompt(adapter?: string): string {
  if (adapter && adapters[adapter]?.instruction) {
    return adapters[adapter].instruction;
  }
  return "";
}

export function renderScope(scope: Organization | Journey | undefined): string | null {
  if (!scope) return null;
  if (scope.status !== "active") return null;

  const briefing = scope.briefing.trim();
  const situation = scope.situation.trim();

  if (!briefing && !situation) return null;
  if (briefing && !situation) return briefing;
  if (!briefing && situation) return `Current situation:\n${situation}`;

  return `${briefing}\n\n---\n\nCurrent situation:\n${situation}`;
}
