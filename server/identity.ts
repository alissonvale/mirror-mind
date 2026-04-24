import type Database from "better-sqlite3";
import {
  getIdentityLayers,
  getOrganizationByKey,
  getJourneyByKey,
  type SessionTags,
} from "./db.js";
import { adapters } from "./config/adapters.js";
import type { Organization } from "./db/organizations.js";
import type { Journey } from "./db/journeys.js";

export interface ComposeScopes {
  /**
   * Reception's single pick per type. Used when the session has no
   * tags of that type (backward-compatible singular path).
   */
  organization?: string | null;
  journey?: string | null;
  /**
   * Session-level tag pool (CV1.E4.S4). When non-empty for a type,
   * ALL tagged scopes of that type render into the prompt — the
   * conversation operates across multiple scopes at once. Persona
   * stays singular even when tagged (the mirror has one voice).
   */
  sessionTags?: SessionTags;
}

/**
 * Composition order (distinct from the map's display order):
 *
 *   self/soul → ego/identity → [persona] → [organization] → [journey] → ego/behavior → [adapter]
 *
 * Rationale: the "who" cluster (soul, identity, persona-as-lens) opens the
 * prompt. Organization and journey — situational scopes — follow the who
 * cluster, broader (org) before narrower (journey), still inside the
 * identity cluster. Then the form cluster (behavior = conduct/method).
 *
 * `ego/expression` is deliberately absent here. Starting with CV1.E7.S1,
 * expression is no longer a prompt layer — it is input to a dedicated
 * post-generation LLM pass that reshapes the draft (server/expression.ts).
 * Keeping form rules out of the main prompt frees substance from
 * competing with form for the model's attention budget.
 *
 * See docs/product/journey-map.md §Composition order,
 * docs/project/decisions.md 2026-04-20 (Journey Map as a peer surface),
 * and docs/project/decisions.md 2026-04-24 (Response intelligence moves
 * from prompt to pipeline).
 */
export function composeSystemPrompt(
  db: Database.Database,
  userId: string,
  personaKey?: string | null,
  adapter?: string,
  scopes?: ComposeScopes,
): string {
  const allLayers = getIdentityLayers(db, userId);
  const get = (layer: string, key: string) =>
    allLayers.find((l) => l.layer === layer && l.key === key);

  const parts: string[] = [];

  // Identity cluster: who I am.
  const soul = get("self", "soul");
  if (soul) parts.push(soul.content);

  const identity = get("ego", "identity");
  if (identity) parts.push(identity.content);

  if (personaKey) {
    const persona = get("persona", personaKey);
    if (persona) parts.push(persona.content);
  }

  // Scope cluster: where I am. Broader before narrower. When the
  // session carries tags of a type, render ALL tagged scopes of that
  // type. Otherwise fall back to reception's single pick.
  const tags = scopes?.sessionTags;

  const orgKeys =
    tags && tags.organizationKeys.length > 0
      ? tags.organizationKeys
      : scopes?.organization
      ? [scopes.organization]
      : [];
  for (const key of orgKeys) {
    const org = getOrganizationByKey(db, userId, key);
    const block = renderScope(org);
    if (block) parts.push(block);
  }

  const journeyKeys =
    tags && tags.journeyKeys.length > 0
      ? tags.journeyKeys
      : scopes?.journey
      ? [scopes.journey]
      : [];
  for (const key of journeyKeys) {
    const journey = getJourneyByKey(db, userId, key);
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
function renderScope(scope: Organization | Journey | undefined): string | null {
  if (!scope) return null;
  if (scope.status !== "active") return null;

  const briefing = scope.briefing.trim();
  const situation = scope.situation.trim();

  if (!briefing && !situation) return null;
  if (briefing && !situation) return briefing;
  if (!briefing && situation) return `Current situation:\n${situation}`;

  return `${briefing}\n\n---\n\nCurrent situation:\n${situation}`;
}
