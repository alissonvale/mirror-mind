import type Database from "better-sqlite3";
import { getIdentityLayers } from "./db.js";

/**
 * Compose the system prompt from identity layers.
 *
 * Base layers (self/*, ego/*) form the core voice. If a persona is
 * specified, its layer is appended as a lens on top of the base —
 * enriching the voice, not replacing it.
 *
 * Persona layers are excluded from the base composition and only
 * included when explicitly selected by reception.
 */
export function composeSystemPrompt(
  db: Database.Database,
  userId: string,
  personaKey?: string | null,
): string {
  const allLayers = getIdentityLayers(db, userId);
  const baseLayers = allLayers.filter(
    (l) => l.layer === "self" || l.layer === "ego",
  );

  const parts = baseLayers.map((l) => l.content);

  if (personaKey) {
    const persona = allLayers.find(
      (l) => l.layer === "persona" && l.key === personaKey,
    );
    if (persona) parts.push(persona.content);
  }

  if (parts.length === 0) return "";
  return parts.join("\n\n---\n\n");
}
