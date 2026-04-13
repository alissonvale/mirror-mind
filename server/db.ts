import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";

// --- Types ---

export interface User {
  id: string;
  name: string;
  token_hash: string;
  created_at: number;
}

export interface IdentityLayer {
  id: string;
  user_id: string;
  layer: string;
  key: string;
  content: string;
  updated_at: number;
}

export interface Session {
  id: string;
  user_id: string;
  created_at: number;
}

export interface Entry {
  id: string;
  session_id: string;
  parent_id: string | null;
  type: string;
  data: string;
  timestamp: number;
}

// --- Schema ---

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  token_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS identity (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  layer TEXT NOT NULL,
  key TEXT NOT NULL,
  content TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(user_id, layer, key)
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS entries (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  parent_id TEXT,
  type TEXT NOT NULL,
  data TEXT NOT NULL,
  timestamp INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS telegram_users (
  telegram_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_identity_user ON identity(user_id);
CREATE INDEX IF NOT EXISTS idx_entries_session ON entries(session_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
`;

// --- Database lifecycle ---

export function openDb(dbPath?: string): Database.Database {
  const resolvedPath = dbPath ?? path.join(process.cwd(), "data", "mirror.db");

  if (!dbPath) {
    mkdirSync(path.dirname(resolvedPath), { recursive: true });
  }

  const db = new Database(resolvedPath);
  db.pragma("journal_mode = WAL");
  db.exec(SCHEMA);
  return db;
}

// --- User helpers ---

export function createUser(
  db: Database.Database,
  name: string,
  tokenHash: string,
): User {
  const user: User = {
    id: randomUUID(),
    name,
    token_hash: tokenHash,
    created_at: Date.now(),
  };
  db.prepare(
    "INSERT INTO users (id, name, token_hash, created_at) VALUES (?, ?, ?, ?)",
  ).run(user.id, user.name, user.token_hash, user.created_at);
  return user;
}

export function getUserByTokenHash(
  db: Database.Database,
  tokenHash: string,
): User | undefined {
  return db
    .prepare("SELECT * FROM users WHERE token_hash = ?")
    .get(tokenHash) as User | undefined;
}

export function getUserByName(
  db: Database.Database,
  name: string,
): User | undefined {
  return db
    .prepare("SELECT * FROM users WHERE name = ?")
    .get(name) as User | undefined;
}

// --- Identity helpers ---

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

export function getIdentityLayers(
  db: Database.Database,
  userId: string,
): IdentityLayer[] {
  return db
    .prepare("SELECT * FROM identity WHERE user_id = ? ORDER BY layer, key")
    .all(userId) as IdentityLayer[];
}

// --- Session helpers ---

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

// --- Entry helpers ---

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
