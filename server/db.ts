import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { seedModelsIfEmpty } from "./db/models.js";

// --- Schema ---

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  token_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS identity (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  layer TEXT NOT NULL,
  key TEXT NOT NULL,
  content TEXT NOT NULL,
  summary TEXT,
  updated_at INTEGER NOT NULL,
  UNIQUE(user_id, layer, key)
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  title TEXT,
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

CREATE TABLE IF NOT EXISTS models (
  role TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  model_id TEXT NOT NULL,
  timeout_ms INTEGER,
  price_brl_per_1m_input REAL,
  price_brl_per_1m_output REAL,
  purpose TEXT,
  updated_at INTEGER NOT NULL
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
  migrate(db);
  return db;
}

function migrate(db: Database.Database) {
  const userCols = db.prepare("PRAGMA table_info(users)").all() as { name: string }[];
  if (!userCols.some((c) => c.name === "role")) {
    db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'");
  }

  const { c: adminCount } = db
    .prepare("SELECT COUNT(*) as c FROM users WHERE role = 'admin'")
    .get() as { c: number };
  if (adminCount === 0) {
    const oldest = db
      .prepare("SELECT id FROM users ORDER BY created_at ASC LIMIT 1")
      .get() as { id: string } | undefined;
    if (oldest) {
      db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(oldest.id);
    }
  }

  // sessions.title added in CV1.E3.S4 — older rows stay NULL; the listing
  // surface treats NULL as "Untitled conversation".
  const sessionCols = db.prepare("PRAGMA table_info(sessions)").all() as { name: string }[];
  if (!sessionCols.some((c) => c.name === "title")) {
    db.exec("ALTER TABLE sessions ADD COLUMN title TEXT");
  }

  // identity.summary added as part of the generated-summary improvement.
  // Older rows stay NULL; consumers (cards, reception descriptor) fall back
  // to the first line of content. Generation is triggered fire-and-forget
  // on Save, or on demand via the workshop's Regenerate button.
  const identityCols = db.prepare("PRAGMA table_info(identity)").all() as { name: string }[];
  if (!identityCols.some((c) => c.name === "summary")) {
    db.exec("ALTER TABLE identity ADD COLUMN summary TEXT");
  }

  // models table added in CV0.E3.S1 — seed from config/models.json on first
  // boot. After seed, the DB is the live source of truth; edits in /admin/models
  // override JSON, and "revert to default" per role reloads from JSON.
  seedModelsIfEmpty(db);
}

// --- Re-exports ---

export { type User, type UserRole, createUser, getUserByTokenHash, getUserByName, updateUserName, updateUserRole, deleteUser } from "./db/users.js";
export { type IdentityLayer, setIdentityLayer, setIdentitySummary, deleteIdentityLayer, getIdentityLayers } from "./db/identity.js";
export { type Session, getOrCreateSession, getUserSessionStats, createFreshSession, forgetSession, setSessionTitle } from "./db/sessions.js";
export { type Entry, type LoadedMessage, loadMessages, loadMessagesWithMeta, appendEntry } from "./db/entries.js";
export { linkTelegramUser, getUserByTelegramId } from "./db/telegram.js";
export { type ModelConfig, type ModelUpdate, getModels, getModel, updateModel, resetModelToDefault } from "./db/models.js";
