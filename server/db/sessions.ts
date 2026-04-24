import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { isResponseMode, type ResponseMode } from "../expression.js";

export interface Session {
  id: string;
  user_id: string;
  title: string | null;
  response_mode: ResponseMode | null;
  created_at: number;
}

function rowToSession(row: {
  id: string;
  user_id: string;
  title: string | null;
  response_mode: string | null;
  created_at: number;
}): Session {
  return {
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    response_mode: isResponseMode(row.response_mode) ? row.response_mode : null,
    created_at: row.created_at,
  };
}

/**
 * Resolves the user's "current" session — the one `/conversation`
 * (default URL) opens. Definition: the session whose most recent entry
 * is newest. Falls back to `created_at` for sessions that have no
 * entries yet (a freshly-created session via Begin again).
 *
 * Crucially: opening a different session via `/conversation/<sessionId>`
 * does NOT change which session is current. Reading is read; current
 * follows behavior (sending a message), not attention (clicking).
 * If the user opens an old session and sends a message there, the new
 * entry's timestamp makes that session current naturally.
 */
export function getOrCreateSession(
  db: Database.Database,
  userId: string,
): string {
  const row = db
    .prepare(
      `SELECT s.id
       FROM sessions s
       LEFT JOIN entries e ON e.session_id = s.id AND e.type = 'message'
       WHERE s.user_id = ?
       GROUP BY s.id
       ORDER BY COALESCE(MAX(e.timestamp), s.created_at) DESC
       LIMIT 1`,
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
 * Returns the named session if it belongs to the user, undefined otherwise.
 * Used by `/conversation/:sessionId` (CV1.E4.S5) — non-owned sessions
 * return undefined so the route can 404 without leaking existence.
 */
export function getSessionById(
  db: Database.Database,
  sessionId: string,
  userId: string,
): Session | undefined {
  const row = db
    .prepare(
      "SELECT id, user_id, title, response_mode, created_at FROM sessions WHERE id = ? AND user_id = ?",
    )
    .get(sessionId, userId) as
    | {
        id: string;
        user_id: string;
        title: string | null;
        response_mode: string | null;
        created_at: number;
      }
    | undefined;
  return row ? rowToSession(row) : undefined;
}

/**
 * Returns the session's response_mode override, or null when the session
 * has none (in which case the caller falls back to reception's mode).
 * CV1.E7.S1. Ownership check included so callers can't peek at foreign
 * sessions even indirectly via the mode field.
 */
export function getSessionResponseMode(
  db: Database.Database,
  sessionId: string,
  userId: string,
): ResponseMode | null {
  const row = db
    .prepare(
      "SELECT response_mode FROM sessions WHERE id = ? AND user_id = ?",
    )
    .get(sessionId, userId) as { response_mode: string | null } | undefined;
  if (!row) return null;
  return isResponseMode(row.response_mode) ? row.response_mode : null;
}

/**
 * Writes the session's response_mode override, or clears it (pass null).
 * CV1.E7.S1. Ownership is enforced — the UPDATE is a no-op if the
 * session belongs to another user.
 */
export function setSessionResponseMode(
  db: Database.Database,
  sessionId: string,
  userId: string,
  mode: ResponseMode | null,
): void {
  db.prepare(
    "UPDATE sessions SET response_mode = ? WHERE id = ? AND user_id = ?",
  ).run(mode, sessionId, userId);
}

/**
 * Creates a session with explicit title and created_at timestamp. Used by
 * the conversation importer (CV0.E3.S9) to materialize sessions whose
 * apparent creation moment is the import run, while guaranteeing a strictly
 * monotonic ordering across sessions imported in the same batch — the
 * caller passes a `createdAt` that's already been bumped past any sibling.
 */
export function createSessionAt(
  db: Database.Database,
  userId: string,
  title: string | null,
  createdAt: number,
): string {
  const id = randomUUID();
  db.prepare(
    "INSERT INTO sessions (id, user_id, title, created_at) VALUES (?, ?, ?, ?)",
  ).run(id, userId, title, createdAt);
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
