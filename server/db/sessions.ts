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
  // Guarantee the new session's created_at is strictly greater than any
  // existing session for this user — otherwise a same-millisecond collision
  // with an earlier session would let ORDER BY created_at DESC return the
  // older row and break "Begin again" determinism.
  const { maxTs } = db
    .prepare(
      "SELECT COALESCE(MAX(created_at), 0) as maxTs FROM sessions WHERE user_id = ?",
    )
    .get(userId) as { maxTs: number };
  const createdAt = Math.max(Date.now(), maxTs + 1);
  db.prepare(
    "INSERT INTO sessions (id, user_id, created_at) VALUES (?, ?, ?)",
  ).run(id, userId, createdAt);
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
  // Cascade scope tag tables (CV1.E4.S4).
  db.prepare("DELETE FROM session_personas WHERE session_id = ?").run(sessionId);
  db.prepare("DELETE FROM session_organizations WHERE session_id = ?").run(
    sessionId,
  );
  db.prepare("DELETE FROM session_journeys WHERE session_id = ?").run(sessionId);
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

export interface RecentSession {
  id: string;
  title: string | null;
  created_at: number;
  lastActivityAt: number;
  hasEntries: boolean;
}

/**
 * Returns up to `limit` sessions for the user, ordered by most recent
 * activity first. `lastActivityAt` is the latest entry timestamp or,
 * if the session has no entries yet, the session's `created_at`.
 * Used by the home page's Continue band (CV0.E4.S1).
 */
export function listRecentSessionsForUser(
  db: Database.Database,
  userId: string,
  limit: number,
): RecentSession[] {
  const rows = db
    .prepare(
      `SELECT s.id, s.title, s.created_at,
              COALESCE(MAX(e.timestamp), s.created_at) AS lastActivityAt,
              CASE WHEN MAX(e.timestamp) IS NULL THEN 0 ELSE 1 END AS hasEntries
       FROM sessions s
       LEFT JOIN entries e ON e.session_id = s.id
       WHERE s.user_id = ?
       GROUP BY s.id
       ORDER BY COALESCE(MAX(e.timestamp), s.created_at) DESC
       LIMIT ?`,
    )
    .all(userId, limit) as Array<{
      id: string;
      title: string | null;
      created_at: number;
      lastActivityAt: number;
      hasEntries: number;
    }>;
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    created_at: r.created_at,
    lastActivityAt: r.lastActivityAt,
    hasEntries: r.hasEntries === 1,
  }));
}
