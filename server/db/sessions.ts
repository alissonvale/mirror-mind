import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

export interface Session {
  id: string;
  user_id: string;
  created_at: number;
}

export function getOrCreateSession(
  db: Database.Database,
  userId: string,
): string {
  const row = db
    .prepare(
      "SELECT id FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1",
    )
    .get(userId) as { id: string } | undefined;

  if (row) return row.id;

  const id = randomUUID();
  db.prepare(
    "INSERT INTO sessions (id, user_id, created_at) VALUES (?, ?, ?)",
  ).run(id, userId, Date.now());
  return id;
}
