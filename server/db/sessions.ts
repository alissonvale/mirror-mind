import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

export interface Session {
  id: string;
  user_id: string;
  title: string | null;
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

export function getUserSessionStats(
  db: Database.Database,
  userId: string,
): { total: number; lastCreatedAt: number | null } {
  const row = db
    .prepare(
      "SELECT COUNT(*) as total, MAX(created_at) as last FROM sessions WHERE user_id = ?",
    )
    .get(userId) as { total: number; last: number | null };
  return { total: row.total, lastCreatedAt: row.last };
}

/**
 * Always inserts a new session. Unlike getOrCreateSession, does not reuse
 * the latest existing session. Used by the manual "Begin again" action to
 * force a fresh thread while preserving the previous one in the DB.
 */
export function createFreshSession(
  db: Database.Database,
  userId: string,
): string {
  const id = randomUUID();
  db.prepare(
    "INSERT INTO sessions (id, user_id, created_at) VALUES (?, ?, ?)",
  ).run(id, userId, Date.now());
  return id;
}

/**
 * Destructively removes a session and all of its entries. Used by the
 * "Forget this conversation" action. Irrecoverable by design.
 */
export function forgetSession(
  db: Database.Database,
  sessionId: string,
): void {
  db.prepare("DELETE FROM entries WHERE session_id = ?").run(sessionId);
  db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
}

/**
 * Sets the title for a session. Called asynchronously by the title
 * generator after a session ends (Begin again).
 */
export function setSessionTitle(
  db: Database.Database,
  sessionId: string,
  title: string,
): void {
  db.prepare("UPDATE sessions SET title = ? WHERE id = ?").run(title, sessionId);
}
