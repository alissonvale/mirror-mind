import type Database from "better-sqlite3";
import { getIdentityLayers } from "./db.js";

export interface ComposedSnapshot {
  layers: string[];
  persona: string | null;
}

/**
 * A snapshot of what was composed into the system prompt for a turn.
 * Reflects composition (what the LLM actually saw), not reception's
 * raw classification output. Used by the Context Rail in the web
 * adapter — see docs/product/memory-taxonomy.md for the framing.
 *
 * For v1, covers only identity layers + persona. Journey and
 * attachments join when those mechanisms exist.
 */
export function composedSnapshot(
  db: Database.Database,
  userId: string,
  personaKey: string | null,
): ComposedSnapshot {
  const layers = getIdentityLayers(db, userId)
    .filter((l) => l.layer === "self" || l.layer === "ego")
    .map((l) => `${l.layer}.${l.key}`);

  return { layers, persona: personaKey };
}
