import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

export interface IdentityLayer {
  id: string;
  user_id: string;
  layer: string;
  key: string;
  content: string;
  updated_at: number;
}

export function setIdentityLayer(
  db: Database.Database,
  userId: string,
  layer: string,
  key: string,
  content: string,
): IdentityLayer {
  const id = randomUUID();
  const now = Date.now();
  db.prepare(`
    INSERT INTO identity (id, user_id, layer, key, content, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT (user_id, layer, key)
    DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at
  `).run(id, userId, layer, key, content, now);

  return db
    .prepare("SELECT * FROM identity WHERE user_id = ? AND layer = ? AND key = ?")
    .get(userId, layer, key) as IdentityLayer;
}

export function deleteIdentityLayer(
  db: Database.Database,
  userId: string,
  layer: string,
  key: string,
): boolean {
  const result = db
    .prepare("DELETE FROM identity WHERE user_id = ? AND layer = ? AND key = ?")
    .run(userId, layer, key);
  return result.changes > 0;
}

export function getIdentityLayers(
  db: Database.Database,
  userId: string,
): IdentityLayer[] {
  // Ordered by psychic depth, not alphabetically.
  // self (essence) → ego (operational) → persona (specialized voice) → anything else.
  return db
    .prepare(
      `SELECT * FROM identity
       WHERE user_id = ?
       ORDER BY
         CASE layer
           WHEN 'self' THEN 1
           WHEN 'ego' THEN 2
           WHEN 'persona' THEN 3
           ELSE 4
         END,
         key`,
    )
    .all(userId) as IdentityLayer[];
}
