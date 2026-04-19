import type Database from "better-sqlite3";
import { getIdentityLayers } from "./db.js";
import { adapters } from "./config/adapters.js";

/**
 * Composition order (distinct from the map's display order):
 *
 *   self/soul → ego/identity → [persona] → ego/behavior → ego/expression → [adapter]
 *
 * Rationale: the "who" cluster (soul, identity, persona-as-lens) comes first,
 * then the "how" cluster (behavior = conduct/method, expression = form).
 * Expression sits last inside the identity stack so its rules get recency
 * weight over any persona content above.
 */
export function composeSystemPrompt(
  db: Database.Database,
  userId: string,
  personaKey?: string | null,
  adapter?: string,
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
