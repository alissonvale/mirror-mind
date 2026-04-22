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
 * rendering where metadata (e.g., persona) needs to show alongside the message.
 */
export function loadMessagesWithMeta(
  db: Database.Database,
  sessionId: string,
): LoadedMessage[] {
  const rows = db
    .prepare(
      "SELECT data FROM entries WHERE session_id = ? AND type = 'message' ORDER BY timestamp",
    )
    .all(sessionId) as { data: string }[];
  return rows.map((r) => {
    const parsed = JSON.parse(r.data) as Record<string, unknown>;
    const meta: Record<string, unknown> = {};
    const data: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (key.startsWith("_")) meta[key.slice(1)] = value;
      else data[key] = value;
    }
    return { data, meta };
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
