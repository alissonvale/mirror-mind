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

export function loadMessages(
  db: Database.Database,
  sessionId: string,
): unknown[] {
  const rows = db
    .prepare(
      "SELECT data FROM entries WHERE session_id = ? AND type = 'message' ORDER BY timestamp",
    )
    .all(sessionId) as { data: string }[];
  return rows.map((r) => JSON.parse(r.data));
}

export function appendEntry(
  db: Database.Database,
  sessionId: string,
  parentId: string | null,
  type: string,
  data: unknown,
): string {
  const id = randomUUID();
  db.prepare(
    "INSERT INTO entries (id, session_id, parent_id, type, data, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(id, sessionId, parentId, type, JSON.stringify(data), Date.now());
  return id;
}
