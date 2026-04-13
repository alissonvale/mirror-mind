import type Database from "better-sqlite3";
import { getIdentityLayers } from "./db.js";

export function composeSystemPrompt(
  db: Database.Database,
  userId: string,
): string {
  const layers = getIdentityLayers(db, userId);
  if (layers.length === 0) return "";
  return layers.map((l) => l.content).join("\n\n---\n\n");
}
