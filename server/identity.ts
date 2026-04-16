import type Database from "better-sqlite3";
import { getIdentityLayers } from "./db.js";
import { adapters } from "./config/adapters.js";

export function composeSystemPrompt(
  db: Database.Database,
  userId: string,
  personaKey?: string | null,
  adapter?: string,
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

  if (adapter && adapters[adapter]?.instruction) {
    parts.push(adapters[adapter].instruction);
  }

  if (parts.length === 0) return "";
  return parts.join("\n\n---\n\n");
}
