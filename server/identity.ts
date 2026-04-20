import type Database from "better-sqlite3";
import { getIdentityLayers, getOrganizationByKey, getJourneyByKey } from "./db.js";
import { adapters } from "./config/adapters.js";
import type { Organization } from "./db/organizations.js";
import type { Journey } from "./db/journeys.js";

export interface ComposeScopes {
  organization?: string | null;
  journey?: string | null;
}

/**
 * Composition order (distinct from the map's display order):
 *
 *   self/soul → ego/identity → [persona] → [organization] → [journey] → ego/behavior → ego/expression → [adapter]
 *
 * Rationale: the "who" cluster (soul, identity, persona-as-lens) opens the
 * prompt. Organization and journey — situational scopes — follow the who
 * cluster, broader (org) before narrower (journey), still inside the
 * identity cluster. Then the form cluster (behavior = conduct/method,
 * expression = form). Expression sits last so its absolute rules get
 * recency weight over any persona or scope content above.
 *
 * See docs/product/journey-map.md §Composition order and
 * docs/project/decisions.md 2026-04-20 (Journey Map as a peer surface).
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

  // Scope cluster: where I am. Broader before narrower.
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

  // Form cluster: how I act, how I speak. Expression last on purpose.
  const behavior = get("ego", "behavior");
  if (behavior) parts.push(behavior.content);

  const expression = get("ego", "expression");
  if (expression) parts.push(expression.content);

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
