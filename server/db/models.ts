import type Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Model configuration lives in the DB as of CV0.E3.S1. The `models` table is
 * seeded from `config/models.json` on first boot; from then on, the DB is the
 * live source of truth. Admin edits update rows via the admin UI; revert-to-
 * default reloads a single role from the JSON.
 */

export type AuthType = "env" | "oauth";

export interface ModelConfig {
  role: string;
  provider: string;
  model: string; // exposed as "model" for callers; stored as "model_id"
  timeout_ms?: number;
  price_brl_per_1m_input?: number;
  price_brl_per_1m_output?: number;
  purpose: string;
  auth_type: AuthType;
}

interface ModelRow {
  role: string;
  provider: string;
  model_id: string;
  timeout_ms: number | null;
  price_brl_per_1m_input: number | null;
  price_brl_per_1m_output: number | null;
  purpose: string | null;
  auth_type: string | null;
  updated_at: number;
}

function rowToConfig(row: ModelRow): ModelConfig {
  return {
    role: row.role,
    provider: row.provider,
    model: row.model_id,
    timeout_ms: row.timeout_ms ?? undefined,
    price_brl_per_1m_input: row.price_brl_per_1m_input ?? undefined,
    price_brl_per_1m_output: row.price_brl_per_1m_output ?? undefined,
    purpose: row.purpose ?? "",
    auth_type: row.auth_type === "oauth" ? "oauth" : "env",
  };
}

export function getModels(
  db: Database.Database,
): Record<string, ModelConfig> {
  const rows = db.prepare("SELECT * FROM models").all() as ModelRow[];
  const out: Record<string, ModelConfig> = {};
  for (const r of rows) {
    out[r.role] = rowToConfig(r);
  }
  return out;
}

export function getModel(
  db: Database.Database,
  role: string,
): ModelConfig | undefined {
  const row = db
    .prepare("SELECT * FROM models WHERE role = ?")
    .get(role) as ModelRow | undefined;
  return row ? rowToConfig(row) : undefined;
}

export interface ModelUpdate {
  provider?: string;
  model?: string;
  timeout_ms?: number | null;
  price_brl_per_1m_input?: number | null;
  price_brl_per_1m_output?: number | null;
  purpose?: string;
  auth_type?: AuthType;
}

export function updateModel(
  db: Database.Database,
  role: string,
  update: ModelUpdate,
): void {
  const current = getModel(db, role);
  if (!current) {
    throw new Error(`Model role not found: ${role}`);
  }
  const merged = {
    provider: update.provider ?? current.provider,
    model_id: update.model ?? current.model,
    timeout_ms:
      update.timeout_ms === undefined
        ? current.timeout_ms ?? null
        : update.timeout_ms,
    price_brl_per_1m_input:
      update.price_brl_per_1m_input === undefined
        ? current.price_brl_per_1m_input ?? null
        : update.price_brl_per_1m_input,
    price_brl_per_1m_output:
      update.price_brl_per_1m_output === undefined
        ? current.price_brl_per_1m_output ?? null
        : update.price_brl_per_1m_output,
    purpose: update.purpose ?? current.purpose,
    auth_type: update.auth_type ?? current.auth_type,
  };
  db.prepare(
    `UPDATE models
     SET provider = ?, model_id = ?, timeout_ms = ?,
         price_brl_per_1m_input = ?, price_brl_per_1m_output = ?,
         purpose = ?, auth_type = ?, updated_at = ?
     WHERE role = ?`,
  ).run(
    merged.provider,
    merged.model_id,
    merged.timeout_ms,
    merged.price_brl_per_1m_input,
    merged.price_brl_per_1m_output,
    merged.purpose,
    merged.auth_type,
    Date.now(),
    role,
  );
}

/** Path to the shipped seed file. Overridable for tests. */
const MODELS_SEED_PATH = path.resolve(
  process.cwd(),
  "config",
  "models.json",
);

interface SeedEntry {
  provider: string;
  model: string;
  timeout_ms?: number;
  price_brl_per_1m_input?: number;
  price_brl_per_1m_output?: number;
  purpose: string;
  auth_type?: AuthType;
}

function readSeed(): Record<string, SeedEntry> {
  const raw = readFileSync(MODELS_SEED_PATH, "utf-8");
  return JSON.parse(raw) as Record<string, SeedEntry>;
}

/**
 * Seed the models table from config/models.json if it's empty. Called by
 * the migration after the table is created. Idempotent — if rows exist,
 * does nothing.
 */
export function seedModelsIfEmpty(db: Database.Database): void {
  const row = db
    .prepare("SELECT COUNT(*) as c FROM models")
    .get() as { c: number };
  if (row.c > 0) return;
  const seed = readSeed();
  const now = Date.now();
  const insert = db.prepare(
    `INSERT INTO models (role, provider, model_id, timeout_ms, price_brl_per_1m_input, price_brl_per_1m_output, purpose, auth_type, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const [role, cfg] of Object.entries(seed)) {
    insert.run(
      role,
      cfg.provider,
      cfg.model,
      cfg.timeout_ms ?? null,
      cfg.price_brl_per_1m_input ?? null,
      cfg.price_brl_per_1m_output ?? null,
      cfg.purpose,
      cfg.auth_type ?? "env",
      now,
    );
  }
}

/**
 * Inserts any seed role that isn't present in the DB yet, without
 * touching existing rows. Called from the migration on every boot so
 * new roles (e.g. `expression` added in CV1.E7.S1) land in databases
 * that were seeded before the role existed. Admin customization of
 * existing roles is preserved.
 */
export function addMissingModelRoles(db: Database.Database): void {
  const seed = readSeed();
  const insert = db.prepare(
    `INSERT OR IGNORE INTO models (role, provider, model_id, timeout_ms, price_brl_per_1m_input, price_brl_per_1m_output, purpose, auth_type, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const now = Date.now();
  for (const [role, cfg] of Object.entries(seed)) {
    insert.run(
      role,
      cfg.provider,
      cfg.model,
      cfg.timeout_ms ?? null,
      cfg.price_brl_per_1m_input ?? null,
      cfg.price_brl_per_1m_output ?? null,
      cfg.purpose,
      cfg.auth_type ?? "env",
      now,
    );
  }
}

/**
 * Overwrite a single role with its shipped seed values. Used by the
 * "Revert to default" action in the admin UI.
 */
export function resetModelToDefault(
  db: Database.Database,
  role: string,
): void {
  const seed = readSeed();
  const cfg = seed[role];
  if (!cfg) {
    throw new Error(`No seed entry for role: ${role}`);
  }
  db.prepare(
    `INSERT INTO models (role, provider, model_id, timeout_ms, price_brl_per_1m_input, price_brl_per_1m_output, purpose, auth_type, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (role) DO UPDATE SET
       provider = excluded.provider,
       model_id = excluded.model_id,
       timeout_ms = excluded.timeout_ms,
       price_brl_per_1m_input = excluded.price_brl_per_1m_input,
       price_brl_per_1m_output = excluded.price_brl_per_1m_output,
       purpose = excluded.purpose,
       auth_type = excluded.auth_type,
       updated_at = excluded.updated_at`,
  ).run(
    role,
    cfg.provider,
    cfg.model,
    cfg.timeout_ms ?? null,
    cfg.price_brl_per_1m_input ?? null,
    cfg.price_brl_per_1m_output ?? null,
    cfg.purpose,
    cfg.auth_type ?? "env",
    Date.now(),
  );
}
