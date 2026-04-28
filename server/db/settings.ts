import type Database from "better-sqlite3";

/**
 * Install-wide key/value settings store (CV0.E3.S6). Holds global config
 * that's admin-editable at runtime — currently the USD→BRL exchange rate,
 * plausibly other global tunables later (alert thresholds, maintenance
 * windows, feature flags scoped to this install).
 *
 * Values are stored as TEXT; callers that need numbers or booleans
 * coerce at read time.
 */

interface SettingRow {
  key: string;
  value: string;
  updated_at: number;
}

export function getSetting(
  db: Database.Database,
  key: string,
): string | undefined {
  const row = db
    .prepare("SELECT value FROM settings WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return row?.value;
}

export function setSetting(
  db: Database.Database,
  key: string,
  value: string,
): void {
  db.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT (key) DO UPDATE SET
       value = excluded.value,
       updated_at = excluded.updated_at`,
  ).run(key, value, Date.now());
}

export function listSettings(db: Database.Database): SettingRow[] {
  return db
    .prepare("SELECT key, value, updated_at FROM settings ORDER BY key")
    .all() as SettingRow[];
}

// --- Typed accessors for the settings S6 actually uses ---

export const USD_TO_BRL_RATE_KEY = "usd_to_brl_rate";
export const DEFAULT_USD_TO_BRL_RATE = 5.0;

export function getUsdToBrlRate(db: Database.Database): number {
  const raw = getSetting(db, USD_TO_BRL_RATE_KEY);
  if (!raw) return DEFAULT_USD_TO_BRL_RATE;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_USD_TO_BRL_RATE;
}

export function setUsdToBrlRate(db: Database.Database, rate: number): void {
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error(`Invalid exchange rate: ${rate}`);
  }
  setSetting(db, USD_TO_BRL_RATE_KEY, String(rate));
}

// --- CV1.E8.S1: LLM call logging toggle ---

export const LLM_LOGGING_ENABLED_KEY = "llm_logging_enabled";
export const DEFAULT_LLM_LOGGING_ENABLED = true;

/**
 * Whether the logging service writes a row per LLM invocation. Default
 * `true` — admins can flip it off via /admin/llm-logs to stop paying
 * storage when not actively investigating. Reads tolerate missing /
 * non-boolean strings by falling back to the default.
 */
export function getLlmLoggingEnabled(db: Database.Database): boolean {
  const raw = getSetting(db, LLM_LOGGING_ENABLED_KEY);
  if (raw === undefined) return DEFAULT_LLM_LOGGING_ENABLED;
  if (raw === "true") return true;
  if (raw === "false") return false;
  return DEFAULT_LLM_LOGGING_ENABLED;
}

export function setLlmLoggingEnabled(
  db: Database.Database,
  enabled: boolean,
): void {
  setSetting(db, LLM_LOGGING_ENABLED_KEY, enabled ? "true" : "false");
}
