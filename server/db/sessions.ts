import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import {
  isResponseMode,
  isResponseLength,
  type ResponseMode,
  type ResponseLength,
} from "../expression.js";

/**
 * Session-level voice override (CV1.E9.S6). Currently only "alma" —
 * extensible to other named voices later (e.g., a forced specific
 * persona shaped as a voice). NULL means "no override" (the cast
 * pool drives persona selection; reception can detect Alma per-turn).
 */
export type SessionVoice = "alma";

export function isSessionVoice(value: unknown): value is SessionVoice {
  return value === "alma";
}

export interface Session {
  id: string;
  user_id: string;
  title: string | null;
  response_mode: ResponseMode | null;
  response_length: ResponseLength | null;
  voice: SessionVoice | null;
  scene_id: string | null;
  created_at: number;
}

function rowToSession(row: {
  id: string;
  user_id: string;
  title: string | null;
  response_mode: string | null;
  response_length: string | null;
  voice: string | null;
  scene_id: string | null;
  created_at: number;
}): Session {
  return {
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    response_mode: isResponseMode(row.response_mode) ? row.response_mode : null,
    response_length: isResponseLength(row.response_length)
      ? row.response_length
      : null,
    voice: isSessionVoice(row.voice) ? row.voice : null,
    scene_id: row.scene_id,
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
 *
 * Optional `sceneId` (CV1.E11.S7) lets the caller link the new session
 * to a cena in one INSERT — used by the cena form's
 * [Salvar e iniciar conversa] flow to chain create-cena → create-session
 * → redirect atomically. Default null preserves the pre-S7 behavior.
 */
export function createFreshSession(
  db: Database.Database,
  userId: string,
  sceneId: string | null = null,
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
    "INSERT INTO sessions (id, user_id, scene_id, created_at) VALUES (?, ?, ?, ?)",
  ).run(id, userId, sceneId, createdAt);
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
      "SELECT id, user_id, title, response_mode, response_length, voice, scene_id, created_at FROM sessions WHERE id = ? AND user_id = ?",
    )
    .get(sessionId, userId) as
    | {
        id: string;
        user_id: string;
        title: string | null;
        response_mode: string | null;
        response_length: string | null;
        voice: string | null;
        scene_id: string | null;
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
 * Returns the session's response_length override, or null when the
 * session has none (the caller treats null as "auto" — let mode dictate
 * length naturally). CV1.E10.S2. Ownership check mirrors the mode helper.
 */
export function getSessionResponseLength(
  db: Database.Database,
  sessionId: string,
  userId: string,
): ResponseLength | null {
  const row = db
    .prepare(
      "SELECT response_length FROM sessions WHERE id = ? AND user_id = ?",
    )
    .get(sessionId, userId) as
    | { response_length: string | null }
    | undefined;
  if (!row) return null;
  return isResponseLength(row.response_length) ? row.response_length : null;
}

/**
 * Writes the session's response_length override, or clears it (null).
 * CV1.E10.S2. Ownership enforced — UPDATE is a no-op for foreign sessions.
 */
export function setSessionResponseLength(
  db: Database.Database,
  sessionId: string,
  userId: string,
  length: ResponseLength | null,
): void {
  db.prepare(
    "UPDATE sessions SET response_length = ? WHERE id = ? AND user_id = ?",
  ).run(length, sessionId, userId);
}

/**
 * CV1.E15.S3: per-session model override. Sits between the scene-level
 * fallback (S2) and the global default. Both fields nullable; null on
 * either means "inherit". Ownership enforced — UPDATE is a no-op for
 * foreign sessions.
 */
export interface SessionModel {
  provider: string | null;
  id: string | null;
}

export function getSessionModel(
  db: Database.Database,
  sessionId: string,
  userId: string,
): SessionModel {
  const row = db
    .prepare(
      "SELECT model_provider, model_id FROM sessions WHERE id = ? AND user_id = ?",
    )
    .get(sessionId, userId) as
    | { model_provider: string | null; model_id: string | null }
    | undefined;
  if (!row) return { provider: null, id: null };
  return { provider: row.model_provider, id: row.model_id };
}

export function setSessionModel(
  db: Database.Database,
  sessionId: string,
  userId: string,
  model: SessionModel,
): void {
  const provider = normalizeNullable(model.provider);
  const id = normalizeNullable(model.id);
  db.prepare(
    "UPDATE sessions SET model_provider = ?, model_id = ? WHERE id = ? AND user_id = ?",
  ).run(provider, id, sessionId, userId);
}

function normalizeNullable(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Returns the session's voice override, or null when no override is
 * set. CV1.E9.S6. Ownership enforced. The streaming pipeline reads
 * this and forces `isAlma=true` when the value is "alma", regardless
 * of reception's per-turn `is_self_moment` verdict.
 */
export function getSessionVoice(
  db: Database.Database,
  sessionId: string,
  userId: string,
): SessionVoice | null {
  const row = db
    .prepare("SELECT voice FROM sessions WHERE id = ? AND user_id = ?")
    .get(sessionId, userId) as { voice: string | null } | undefined;
  if (!row) return null;
  return isSessionVoice(row.voice) ? row.voice : null;
}

/**
 * Writes the session's voice override, or clears it (null). CV1.E9.S6.
 * **Mutual exclusion with the persona pool:** when voice is set to
 * "alma", `session_personas` is cleared in the same transaction — Cast
 * is either a pool of personas OR Alma, never both. The persona pool
 * is not restored when voice is later cleared (the user re-convokes
 * personas explicitly via the cast `+` picker).
 */
export function setSessionVoice(
  db: Database.Database,
  sessionId: string,
  userId: string,
  voice: SessionVoice | null,
): void {
  const txn = db.transaction(() => {
    db.prepare(
      "UPDATE sessions SET voice = ? WHERE id = ? AND user_id = ?",
    ).run(voice, sessionId, userId);
    if (voice === "alma") {
      // Verify ownership before wiping personas. The UPDATE above
      // would no-op for foreign sessions, but the DELETE has no such
      // implicit guard, so we filter by an EXISTS check on the
      // ownership condition.
      db.prepare(
        `DELETE FROM session_personas
         WHERE session_id = ?
           AND EXISTS (
             SELECT 1 FROM sessions s WHERE s.id = ? AND s.user_id = ?
           )`,
      ).run(sessionId, sessionId, userId);
    }
  });
  txn();
}

/**
 * Returns the cena id this session was started from, or null if the
 * session is unscoped (started from the free input). CV1.E11.S4.
 * Ownership-checked.
 */
export function getSessionScene(
  db: Database.Database,
  sessionId: string,
  userId: string,
): string | null {
  const row = db
    .prepare("SELECT scene_id FROM sessions WHERE id = ? AND user_id = ?")
    .get(sessionId, userId) as { scene_id: string | null } | undefined;
  return row?.scene_id ?? null;
}

/**
 * Sets the session's cena link, or clears it (pass null). CV1.E11.S4.
 * Ownership-enforced — UPDATE is a no-op for foreign sessions.
 * Note: passing a sceneId that doesn't belong to the same user is the
 * caller's responsibility to validate; this helper only enforces the
 * session's own ownership.
 */
export function setSessionScene(
  db: Database.Database,
  sessionId: string,
  userId: string,
  sceneId: string | null,
): void {
  db.prepare(
    "UPDATE sessions SET scene_id = ? WHERE id = ? AND user_id = ?",
  ).run(sceneId, sessionId, userId);
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
  // Sessions with zero entries are filtered out — those are usually
  // ghosts left behind by a `createFreshSession` call whose follow-up
  // never landed (failed LLM call, abandoned mid-stream, etc.). They
  // have no useful content for the user to recognize, and showing
  // them here while filtering them out of /conversations created the
  // inconsistency the user surfaced (record-in-Recentes-but-not-in-list).
  const rows = db
    .prepare(
      `SELECT s.id, s.title, s.created_at,
              MAX(e.timestamp) AS lastActivityAt
       FROM sessions s
       INNER JOIN entries e ON e.session_id = s.id
       WHERE s.user_id = ?
       GROUP BY s.id
       ORDER BY MAX(e.timestamp) DESC
       LIMIT ?`,
    )
    .all(userId, limit) as Array<{
      id: string;
      title: string | null;
      created_at: number;
      lastActivityAt: number;
    }>;
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    created_at: r.created_at,
    lastActivityAt: r.lastActivityAt,
    hasEntries: true,
  }));
}
