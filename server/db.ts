import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { seedModelsIfEmpty, addMissingModelRoles } from "./db/models.js";
import { hashPersonaColor } from "./personas/colors.js";

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
  color TEXT,
  sort_order INTEGER,
  show_in_sidebar INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL,
  UNIQUE(user_id, layer, key)
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  title TEXT,
  response_mode TEXT,
  response_length TEXT,
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
  auth_type TEXT NOT NULL DEFAULT 'env',
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS oauth_credentials (
  provider TEXT PRIMARY KEY,
  credentials TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS usage_log (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  session_id TEXT,
  role TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost_usd REAL,
  generation_id TEXT,
  env TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  briefing TEXT NOT NULL DEFAULT '',
  situation TEXT NOT NULL DEFAULT '',
  summary TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  sort_order INTEGER,
  show_in_sidebar INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(user_id, key)
);

CREATE TABLE IF NOT EXISTS journeys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  organization_id TEXT REFERENCES organizations(id),
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  briefing TEXT NOT NULL DEFAULT '',
  situation TEXT NOT NULL DEFAULT '',
  summary TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  sort_order INTEGER,
  show_in_sidebar INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(user_id, key)
);

CREATE TABLE IF NOT EXISTS session_personas (
  session_id TEXT NOT NULL REFERENCES sessions(id),
  persona_key TEXT NOT NULL,
  PRIMARY KEY (session_id, persona_key)
);

CREATE TABLE IF NOT EXISTS session_organizations (
  session_id TEXT NOT NULL REFERENCES sessions(id),
  organization_key TEXT NOT NULL,
  PRIMARY KEY (session_id, organization_key)
);

CREATE TABLE IF NOT EXISTS session_journeys (
  session_id TEXT NOT NULL REFERENCES sessions(id),
  journey_key TEXT NOT NULL,
  PRIMARY KEY (session_id, journey_key)
);

-- CV1.E7.S8: out-of-pool divergent runs. Each row is a one-turn
-- response generated through a persona/scope that the canonical
-- session pool didn't include - opt-in via the rail suggestion
-- card. Pinned to a parent assistant entry; cascades on parent
-- delete (forget-turn). Lives outside the entries table so the
-- agent canonical history feed (loadMessages) is unaffected.
CREATE TABLE IF NOT EXISTS divergent_runs (
  id TEXT PRIMARY KEY,
  parent_entry_id TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  override_type TEXT NOT NULL,
  override_key TEXT NOT NULL,
  content TEXT NOT NULL,
  meta TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_divergent_runs_parent ON divergent_runs(parent_entry_id);

-- CV1.E8.S1: full prompt + response capture for every LLM invocation.
-- Companion to usage_log (cost reconciliation, no prompts) — this
-- table carries the prompts and responses themselves so admin can
-- inspect what was actually sent and received. Toggle via the
-- llm_logging_enabled settings key. Default ON; admin clears
-- manually (no automatic retention).
CREATE TABLE IF NOT EXISTS llm_calls (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  user_message TEXT NOT NULL,
  response TEXT,
  tokens_in INTEGER,
  tokens_out INTEGER,
  cost_usd REAL,
  latency_ms INTEGER,
  session_id TEXT,
  entry_id TEXT,
  user_id TEXT REFERENCES users(id),
  env TEXT NOT NULL,
  error TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_identity_user ON identity(user_id);
CREATE INDEX IF NOT EXISTS idx_entries_session ON entries(session_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_organizations_user ON organizations(user_id, status);
CREATE INDEX IF NOT EXISTS idx_journeys_user ON journeys(user_id, status);
CREATE INDEX IF NOT EXISTS idx_journeys_org ON journeys(organization_id);
CREATE INDEX IF NOT EXISTS idx_usage_log_created ON usage_log(created_at);
CREATE INDEX IF NOT EXISTS idx_usage_log_role ON usage_log(role, created_at);
CREATE INDEX IF NOT EXISTS idx_usage_log_env ON usage_log(env, created_at);
CREATE INDEX IF NOT EXISTS idx_llm_calls_role_created ON llm_calls(role, created_at);
CREATE INDEX IF NOT EXISTS idx_llm_calls_session_created ON llm_calls(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_llm_calls_created ON llm_calls(created_at);
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

  // sessions.response_mode added in CV1.E7.S1 — per-session override of
  // the response mode the expression pass applies. NULL means "follow
  // reception" (auto). The rail's mode selector writes one of the three
  // literals; clearing writes NULL. Existing rows stay NULL.
  if (!sessionCols.some((c) => c.name === "response_mode")) {
    db.exec("ALTER TABLE sessions ADD COLUMN response_mode TEXT");
  }

  // sessions.response_length added in CV1.E10.S2 — per-session override
  // of the target response length. Orthogonal to response_mode (mode is
  // register/structure, length is target size). NULL means "auto" —
  // let the mode's natural length stand. The header's Advanced control
  // writes one of the three literals (brief/standard/full); clearing
  // writes NULL. Existing rows stay NULL.
  if (!sessionCols.some((c) => c.name === "response_length")) {
    db.exec("ALTER TABLE sessions ADD COLUMN response_length TEXT");
  }

  // identity.summary added as part of the generated-summary improvement.
  // Older rows stay NULL; consumers (cards, reception descriptor) fall back
  // to the first line of content. Generation is triggered fire-and-forget
  // on Save, or on demand via the workshop's Regenerate button.
  const identityCols = db.prepare("PRAGMA table_info(identity)").all() as { name: string }[];
  if (!identityCols.some((c) => c.name === "summary")) {
    db.exec("ALTER TABLE identity ADD COLUMN summary TEXT");
  }

  // identity.color added in the persona-colors improvement. Persisted
  // per-persona visual identity; consumers fall back to a deterministic
  // hash of the key when NULL. Backfilled below so existing personas
  // keep the same color they had under the hash-only era.
  if (!identityCols.some((c) => c.name === "color")) {
    db.exec("ALTER TABLE identity ADD COLUMN color TEXT");
  }
  // Backfill existing personas with their hash-derived color so the
  // visual doesn't shift on upgrade. We do this in JS because the hash
  // logic is a moving hash (Horner-style *31) — cleaner than a CTE.
  const uncoloredPersonas = db
    .prepare(
      "SELECT id, key FROM identity WHERE layer = 'persona' AND color IS NULL",
    )
    .all() as { id: string; key: string }[];
  if (uncoloredPersonas.length > 0) {
    const update = db.prepare("UPDATE identity SET color = ? WHERE id = ?");
    for (const row of uncoloredPersonas) {
      update.run(hashPersonaColor(row.key), row.id);
    }
  }

  // models.auth_type added in CV0.E3.S8. Existing rows default to 'env' —
  // the same behavior they had before this column existed (read API key from
  // process.env.OPENROUTER_API_KEY). New rows configured against an OAuth
  // provider in /admin/models save 'oauth' and route through resolveApiKey.
  const modelCols = db.prepare("PRAGMA table_info(models)").all() as { name: string }[];
  if (!modelCols.some((c) => c.name === "auth_type")) {
    db.exec("ALTER TABLE models ADD COLUMN auth_type TEXT NOT NULL DEFAULT 'env'");
  }

  // users.show_brl_conversion added in CV0.E3.S6. Per-admin display preference
  // for the BRL conversion on top of USD. Default 1 (show BRL) preserves the
  // pre-S6 behavior of the Context Rail surfacing BRL cost.
  const usersColsForBrl = db.prepare("PRAGMA table_info(users)").all() as { name: string }[];
  if (!usersColsForBrl.some((c) => c.name === "show_brl_conversion")) {
    db.exec("ALTER TABLE users ADD COLUMN show_brl_conversion INTEGER NOT NULL DEFAULT 1");
  }

  // users.locale added in CV2.E1.S3. Per-user UI language preference.
  // Default 'en' preserves the pre-S3 behavior (English chrome) for every
  // existing user; new users start in English unless an admin sets it.
  const usersColsForLocale = db
    .prepare("PRAGMA table_info(users)")
    .all() as { name: string }[];
  if (!usersColsForLocale.some((c) => c.name === "locale")) {
    db.exec("ALTER TABLE users ADD COLUMN locale TEXT NOT NULL DEFAULT 'en'");
  }

  // Seed the USD→BRL rate on first boot. The rate is global (one per install)
  // and admin-editable on /admin/budget. 5.00 is a reasonable starting point;
  // any admin can adjust.
  const rateRow = db
    .prepare("SELECT 1 FROM settings WHERE key = 'usd_to_brl_rate'")
    .get();
  if (!rateRow) {
    db.prepare(
      "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)",
    ).run("usd_to_brl_rate", "5.00", Date.now());
  }

  // sort_order + show_in_sidebar on identity — only personas use these,
  // seed sort_order for existing persona rows using alphabetical
  // position so the sidebar does not shuffle on first boot.
  const identityColsForOrder = db.prepare("PRAGMA table_info(identity)").all() as { name: string }[];
  if (!identityColsForOrder.some((c) => c.name === "sort_order")) {
    db.exec("ALTER TABLE identity ADD COLUMN sort_order INTEGER");
    db.exec(
      `UPDATE identity SET sort_order = (
         SELECT COUNT(*) FROM identity i2
         WHERE i2.user_id = identity.user_id AND i2.layer = 'persona' AND i2.key < identity.key
       ) WHERE layer = 'persona' AND sort_order IS NULL`,
    );
  }
  if (!identityColsForOrder.some((c) => c.name === "show_in_sidebar")) {
    db.exec(
      "ALTER TABLE identity ADD COLUMN show_in_sidebar INTEGER NOT NULL DEFAULT 1",
    );
  }

  // sort_order + show_in_sidebar on organizations and journeys —
  // sidebar-ordering-and-visibility improvement. Existing rows receive a
  // seeded sort_order matching their alphabetical position so the sidebar
  // doesn't shuffle on first boot; show_in_sidebar defaults to 1 so every
  // currently-visible scope stays visible.
  const orgCols = db.prepare("PRAGMA table_info(organizations)").all() as { name: string }[];
  if (!orgCols.some((c) => c.name === "sort_order")) {
    db.exec("ALTER TABLE organizations ADD COLUMN sort_order INTEGER");
    db.exec(
      `UPDATE organizations SET sort_order = (
         SELECT COUNT(*) FROM organizations o2
         WHERE o2.user_id = organizations.user_id AND o2.name < organizations.name
       ) WHERE sort_order IS NULL`,
    );
  }
  if (!orgCols.some((c) => c.name === "show_in_sidebar")) {
    db.exec(
      "ALTER TABLE organizations ADD COLUMN show_in_sidebar INTEGER NOT NULL DEFAULT 1",
    );
  }

  const journeyCols = db.prepare("PRAGMA table_info(journeys)").all() as { name: string }[];
  if (!journeyCols.some((c) => c.name === "sort_order")) {
    db.exec("ALTER TABLE journeys ADD COLUMN sort_order INTEGER");
    db.exec(
      `UPDATE journeys SET sort_order = (
         SELECT COUNT(*) FROM journeys j2
         WHERE j2.user_id = journeys.user_id AND j2.name < journeys.name
       ) WHERE sort_order IS NULL`,
    );
  }
  if (!journeyCols.some((c) => c.name === "show_in_sidebar")) {
    db.exec(
      "ALTER TABLE journeys ADD COLUMN show_in_sidebar INTEGER NOT NULL DEFAULT 1",
    );
  }

  // models table added in CV0.E3.S1 — seed from config/models.json on first
  // boot. After seed, the DB is the live source of truth; edits in /admin/models
  // override JSON, and "revert to default" per role reloads from JSON.
  seedModelsIfEmpty(db);

  // Roles added after the initial seed (e.g. `expression` in CV1.E7.S1)
  // get inserted here if missing. Existing roles are never overwritten —
  // admin customizations survive upgrades.
  addMissingModelRoles(db);
}

// --- Re-exports ---

export { type User, type UserRole, createUser, getUserByTokenHash, getUserByName, updateUserName, updateUserRole, updateShowBrlConversion, updateUserLocale, deleteUser } from "./db/users.js";
export { type IdentityLayer, setIdentityLayer, setIdentitySummary, setPersonaColor, deleteIdentityLayer, getIdentityLayers, setPersonaShowInSidebar, movePersona } from "./db/identity.js";
export { type Session, type RecentSession, getOrCreateSession, getUserSessionStats, createFreshSession, createSessionAt, getSessionById, getSessionResponseMode, setSessionResponseMode, getSessionResponseLength, setSessionResponseLength, forgetSession, setSessionTitle, listRecentSessionsForUser } from "./db/sessions.js";
export {
  type SessionTags,
  getSessionTags,
  addSessionPersona,
  removeSessionPersona,
  addSessionOrganization,
  removeSessionOrganization,
  addSessionJourney,
  removeSessionJourney,
  clearSessionTags,
} from "./db/session-tags.js";
export { type Entry, type LoadedMessage, type ForgetTurnResult, loadMessages, loadMessagesWithMeta, appendEntry, forgetTurn, getLastAssistantScopeMeta } from "./db/entries.js";
export { linkTelegramUser, getUserByTelegramId } from "./db/telegram.js";
export { type ModelConfig, type ModelUpdate, type AuthType, getModels, getModel, updateModel, resetModelToDefault } from "./db/models.js";
export {
  type OAuthCredentials,
  type StoredOAuthCredentials,
  setOAuthCredentials,
  getOAuthCredentials,
  getAllOAuthCredentials,
  listOAuthCredentials,
  deleteOAuthCredentials,
} from "./db/oauth-credentials.js";
export {
  type UsageLogInsert,
  type UsageLogPatch,
  type UsageLogRow,
  type UsageTotals,
  type UsageBreakdownRow,
  insertUsageLog,
  updateUsageLog,
  getUsageLog,
  getUsageTotals,
  getUsageByRole,
  getUsageByEnv,
  getUsageByModel,
  getUsageByDay,
} from "./db/usage-log.js";
export {
  getSetting,
  setSetting,
  listSettings,
  getUsdToBrlRate,
  setUsdToBrlRate,
  getLlmLoggingEnabled,
  setLlmLoggingEnabled,
  LLM_LOGGING_ENABLED_KEY,
  DEFAULT_LLM_LOGGING_ENABLED,
} from "./db/settings.js";
export {
  type LlmRole,
  type LlmCallRow,
  type InsertLlmCallInput,
  type ListLlmCallsFilters,
  type ListLlmCallsOptions,
  insertLlmCall,
  setLlmCallEntryId,
  listLlmCalls,
  countLlmCalls,
  getLlmCall,
  listLlmCallModels,
  deleteAllLlmCalls,
  deleteLlmCallsOlderThan,
} from "./db/llm-calls.js";
export {
  type Organization,
  type OrganizationStatus,
  type OrganizationFields,
  type GetOrganizationsOptions,
  createOrganization,
  updateOrganization,
  setOrganizationSummary,
  archiveOrganization,
  unarchiveOrganization,
  concludeOrganization,
  reopenOrganization,
  deleteOrganization,
  getOrganizations,
  getOrganizationByKey,
  setOrganizationShowInSidebar,
  moveOrganization,
} from "./db/organizations.js";
export {
  type Journey,
  type JourneyStatus,
  type JourneyFields,
  type GetJourneysOptions,
  createJourney,
  updateJourney,
  setJourneySummary,
  linkJourneyOrganization,
  archiveJourney,
  unarchiveJourney,
  concludeJourney,
  reopenJourney,
  deleteJourney,
  getJourneys,
  getJourneyByKey,
  setJourneyShowInSidebar,
  moveJourney,
} from "./db/journeys.js";
export {
  type DivergentRun,
  type DivergentOverrideType,
  insertDivergentRun,
  loadDivergentRunsByParent,
  loadDivergentRunsBySession,
  deleteDivergentRun,
} from "./db/divergent-runs.js";
