import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";

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
  const resolvedPath =
    dbPath ?? process.env.MIRROR_DB_PATH ?? path.join(process.cwd(), "data", "mirror.db");

  if (!dbPath && !process.env.MIRROR_DB_PATH) {
    mkdirSync(path.dirname(resolvedPath), { recursive: true });
  }

  const db = new Database(resolvedPath);
  db.pragma("journal_mode = WAL");
  db.exec(SCHEMA);
  return db;
}

// --- Re-exports ---

export { type User, createUser, getUserByTokenHash, getUserByName } from "./db/users.js";
export { type IdentityLayer, setIdentityLayer, deleteIdentityLayer, getIdentityLayers } from "./db/identity.js";
export { type Session, getOrCreateSession } from "./db/sessions.js";
export { type Entry, type LoadedMessage, loadMessages, loadMessagesWithMeta, appendEntry } from "./db/entries.js";
export { linkTelegramUser, getUserByTelegramId } from "./db/telegram.js";
