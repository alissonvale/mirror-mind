import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

export interface Entry {
  id: string;
  session_id: string;
  parent_id: string | null;
  type: string;
  data: string;
  timestamp: number;
}

export interface LoadedMessage {
  /** The entries row id — used by the delete-turn surface. */
  id: string;
  data: Record<string, unknown>;
  meta: Record<string, unknown>;
}

/**
 * Load messages for the Agent. Strips internal metadata fields (prefix `_`)
 * so they don't leak into the LLM context.
 */
export function loadMessages(
  db: Database.Database,
  sessionId: string,
): unknown[] {
  const rows = db
    .prepare(
      "SELECT data FROM entries WHERE session_id = ? AND type = 'message' ORDER BY timestamp",
    )
    .all(sessionId) as { data: string }[];
  return rows.map((r) => {
    const parsed = JSON.parse(r.data) as Record<string, unknown>;
    return stripInternalFields(parsed);
  });
}

/**
 * Load messages with their metadata attached separately. Useful for UI
 * rendering where metadata (e.g., persona) needs to show alongside the
 * message, and for delete-turn flows where the entry id is needed.
 */
export function loadMessagesWithMeta(
  db: Database.Database,
  sessionId: string,
): LoadedMessage[] {
  const rows = db
    .prepare(
      "SELECT id, data FROM entries WHERE session_id = ? AND type = 'message' ORDER BY timestamp",
    )
    .all(sessionId) as { id: string; data: string }[];
  return rows.map((r) => {
    const parsed = JSON.parse(r.data) as Record<string, unknown>;
    const meta: Record<string, unknown> = {};
    const data: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (key.startsWith("_")) meta[key.slice(1)] = value;
      else data[key] = value;
    }
    return { id: r.id, data, meta };
  });
}

function stripInternalFields(
  obj: Record<string, unknown>,
): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (!key.startsWith("_")) clean[key] = value;
  }
  return clean;
}

/**
 * Read the most recent assistant entry's stamped scope (`_organization`,
 * `_journey`) for a session. Returns `{ organization: null, journey: null }`
 * when no prior assistant turn exists, or when the latest one carried no
 * scope. Used by the streaming pipeline to compute the bubble badge
 * transition for the in-flight turn (server-computed so the client and
 * the SSR render share one rule).
 */
export function getLastAssistantScopeMeta(
  db: Database.Database,
  sessionId: string,
): { organization: string | null; journey: string | null } {
  const row = db
    .prepare(
      `SELECT data FROM entries
       WHERE session_id = ? AND type = 'message'
         AND json_extract(data, '$.role') = 'assistant'
       ORDER BY timestamp DESC LIMIT 1`,
    )
    .get(sessionId) as { data: string } | undefined;
  if (!row) return { organization: null, journey: null };
  const parsed = JSON.parse(row.data) as Record<string, unknown>;
  return {
    organization:
      typeof parsed._organization === "string" ? parsed._organization : null,
    journey: typeof parsed._journey === "string" ? parsed._journey : null,
  };
}

export function appendEntry(
  db: Database.Database,
  sessionId: string,
  parentId: string | null,
  type: string,
  data: unknown,
  timestamp?: number,
): string {
  const id = randomUUID();
  db.prepare(
    "INSERT INTO entries (id, session_id, parent_id, type, data, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(id, sessionId, parentId, type, JSON.stringify(data), timestamp ?? Date.now());
  return id;
}

export interface ForgetTurnResult {
  /** Entry ids that were actually deleted (1 or 2). */
  deleted: string[];
  /** Session the turn belonged to — the caller's redirect lands here. */
  sessionId: string;
}

/**
 * Deletes the turn (user+assistant pair) that contains the given entry.
 * CV1.E7 delete-turn surface.
 *
 * The unit of delete is the turn, not the individual message — removing
 * only one half would break the user↔assistant alternation that the
 * main Agent expects from history on the next turn.
 *
 * Resolution:
 * - If the target entry is `user` → find the assistant child (the one
 *   whose parent_id = user.id). Delete both. If there is no assistant
 *   (the user sent a message that never got a reply), delete just the
 *   user entry.
 * - If the target entry is `assistant` → use its parent_id to find the
 *   user entry. Delete both.
 *
 * Adjacent turns — those that had parent_id pointing at the deleted pair
 * — are re-parented to the deleted user entry's parent, so the linked
 * structure stays connected. Order (ORDER BY timestamp) is what drives
 * history replay, so the re-parent is a maintenance nicety; missing it
 * wouldn't break the Agent, but leaving dangling parent ids would rot
 * over time.
 *
 * Ownership is enforced through a JOIN against sessions.user_id.
 * Returns null when the entry does not belong to the authenticated
 * user (or does not exist) so the route can 404 without leaking.
 */
export function forgetTurn(
  db: Database.Database,
  entryId: string,
  userId: string,
): ForgetTurnResult | null {
  const row = db
    .prepare(
      `SELECT e.id, e.session_id, e.parent_id, e.data
       FROM entries e
       JOIN sessions s ON s.id = e.session_id
       WHERE e.id = ? AND s.user_id = ? AND e.type = 'message'`,
    )
    .get(entryId, userId) as
    | { id: string; session_id: string; parent_id: string | null; data: string }
    | undefined;
  if (!row) return null;

  const parsed = JSON.parse(row.data) as { role?: string };
  const role = parsed.role;

  let userEntry: { id: string; parent_id: string | null };
  let assistantEntry: { id: string } | null = null;

  if (role === "user") {
    userEntry = { id: row.id, parent_id: row.parent_id };
    const child = db
      .prepare(
        `SELECT id, data FROM entries
         WHERE session_id = ? AND parent_id = ? AND type = 'message'
         ORDER BY timestamp ASC
         LIMIT 1`,
      )
      .get(row.session_id, row.id) as
      | { id: string; data: string }
      | undefined;
    if (child) {
      const childParsed = JSON.parse(child.data) as { role?: string };
      if (childParsed.role === "assistant") {
        assistantEntry = { id: child.id };
      }
    }
  } else if (role === "assistant") {
    if (!row.parent_id) {
      // Orphan assistant with no parent user entry — treat as a single-
      // entry delete. Uncommon but possible (e.g., future event types
      // that landed as "message" without a user pair).
      assistantEntry = { id: row.id };
      userEntry = { id: row.id, parent_id: null }; // delete this one, no pair
    } else {
      const parent = db
        .prepare(
          `SELECT id, parent_id, data FROM entries
           WHERE id = ? AND session_id = ? AND type = 'message'`,
        )
        .get(row.parent_id, row.session_id) as
        | { id: string; parent_id: string | null; data: string }
        | undefined;
      if (!parent) {
        // Parent missing (shouldn't happen under normal use) — fall
        // back to deleting just this assistant entry.
        userEntry = { id: row.id, parent_id: null };
        assistantEntry = { id: row.id };
      } else {
        userEntry = { id: parent.id, parent_id: parent.parent_id };
        assistantEntry = { id: row.id };
      }
    }
  } else {
    // Unknown role — refuse to delete. Safer than guessing pair shape.
    return null;
  }

  const deleted: string[] = [];
  const deleteStmt = db.prepare("DELETE FROM entries WHERE id = ?");
  const reparentStmt = db.prepare(
    "UPDATE entries SET parent_id = ? WHERE session_id = ? AND parent_id = ?",
  );

  const tx = db.transaction(() => {
    // Re-parent any child entries that pointed at the pair we're about
    // to delete, so downstream turns stay linked to the turn above.
    const nextParent = userEntry.parent_id;
    if (assistantEntry && assistantEntry.id !== userEntry.id) {
      reparentStmt.run(nextParent, row.session_id, assistantEntry.id);
    }
    reparentStmt.run(nextParent, row.session_id, userEntry.id);

    if (assistantEntry && assistantEntry.id !== userEntry.id) {
      deleteStmt.run(assistantEntry.id);
      deleted.push(assistantEntry.id);
    }
    // When userEntry is the lone orphan-assistant fallback, this is
    // the same row as assistantEntry — guard against double-delete.
    if (!deleted.includes(userEntry.id)) {
      deleteStmt.run(userEntry.id);
      deleted.push(userEntry.id);
    }

    // CV1.E15 follow-up: drop the session row when this delete left
    // it empty. Prevents orphan sessions accumulating from "delete
    // every turn" flows. Same transaction so the cleanup is atomic
    // with the deletes; if the session still has entries (deletes
    // not catastrophic), the row stays.
    const remaining = db
      .prepare(
        "SELECT COUNT(*) AS c FROM entries WHERE session_id = ?",
      )
      .get(row.session_id) as { c: number };
    if (remaining.c === 0) {
      // Cascade scope/junction rows first — same shape as
      // pruneEmptySessionsForUser. Inline here because forgetTurn
      // lives in entries.ts and we don't want a circular import.
      db.prepare("DELETE FROM session_personas WHERE session_id = ?").run(
        row.session_id,
      );
      db.prepare(
        "DELETE FROM session_organizations WHERE session_id = ?",
      ).run(row.session_id);
      db.prepare("DELETE FROM session_journeys WHERE session_id = ?").run(
        row.session_id,
      );
      db.prepare("DELETE FROM sessions WHERE id = ?").run(row.session_id);
    }
  });
  tx();

  return { deleted, sessionId: row.session_id };
}
