import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

/**
 * Per-call LLM usage tracking (CV0.E3.S6). One row per LLM call across every
 * role (main, reception, title, summary). cost_usd is the real cost OpenRouter
 * charged, resolved asynchronously via /api/v1/generation/{id} after the call
 * completes. Rows without a resolved cost carry cost_usd = NULL — diagnostic
 * signal, not an error; the LLM call itself already returned to the user.
 *
 * Aggregations (per-role, per-env, per-model, per-day) are read directly from
 * this table by /admin/budget; no materialized summary tables for v1.
 */

export interface UsageLogInsert {
  user_id?: string | null;
  session_id?: string | null;
  role: string;
  provider: string;
  model: string;
  input_tokens?: number | null;
  output_tokens?: number | null;
  cost_usd?: number | null;
  generation_id?: string | null;
  env: string;
}

export interface UsageLogRow {
  id: string;
  user_id: string | null;
  session_id: string | null;
  role: string;
  provider: string;
  model: string;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_usd: number | null;
  generation_id: string | null;
  env: string;
  created_at: number;
}

export function insertUsageLog(
  db: Database.Database,
  entry: UsageLogInsert,
): string {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO usage_log
       (id, user_id, session_id, role, provider, model,
        input_tokens, output_tokens, cost_usd, generation_id, env, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    entry.user_id ?? null,
    entry.session_id ?? null,
    entry.role,
    entry.provider,
    entry.model,
    entry.input_tokens ?? null,
    entry.output_tokens ?? null,
    entry.cost_usd ?? null,
    entry.generation_id ?? null,
    entry.env,
    Date.now(),
  );
  return id;
}

/**
 * Update an existing log row with real cost/token data resolved later
 * (e.g. after fetching /generation/{id}). Only touches the columns whose
 * values are non-undefined on the patch, so partial reconciliation works.
 */
export interface UsageLogPatch {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cost_usd?: number | null;
  generation_id?: string | null;
}

export function updateUsageLog(
  db: Database.Database,
  id: string,
  patch: UsageLogPatch,
): void {
  const fields: string[] = [];
  const values: unknown[] = [];
  if (patch.input_tokens !== undefined) {
    fields.push("input_tokens = ?");
    values.push(patch.input_tokens);
  }
  if (patch.output_tokens !== undefined) {
    fields.push("output_tokens = ?");
    values.push(patch.output_tokens);
  }
  if (patch.cost_usd !== undefined) {
    fields.push("cost_usd = ?");
    values.push(patch.cost_usd);
  }
  if (patch.generation_id !== undefined) {
    fields.push("generation_id = ?");
    values.push(patch.generation_id);
  }
  if (fields.length === 0) return;
  values.push(id);
  db.prepare(`UPDATE usage_log SET ${fields.join(", ")} WHERE id = ?`).run(
    ...values,
  );
}

export function getUsageLog(
  db: Database.Database,
  id: string,
): UsageLogRow | undefined {
  return db
    .prepare("SELECT * FROM usage_log WHERE id = ?")
    .get(id) as UsageLogRow | undefined;
}

// --- Aggregations for /admin/budget ---

export interface UsageTotals {
  total_usd: number;
  total_calls: number;
  resolved_calls: number;
}

/** Total cost and call count between [from, to) (ms epoch). Ignores rows whose cost_usd is still NULL. */
export function getUsageTotals(
  db: Database.Database,
  from: number,
  to: number,
): UsageTotals {
  const row = db
    .prepare(
      `SELECT
         COALESCE(SUM(cost_usd), 0) AS total_usd,
         COUNT(*) AS total_calls,
         SUM(CASE WHEN cost_usd IS NOT NULL THEN 1 ELSE 0 END) AS resolved_calls
       FROM usage_log
       WHERE created_at >= ? AND created_at < ?`,
    )
    .get(from, to) as {
    total_usd: number;
    total_calls: number;
    resolved_calls: number;
  };
  return row;
}

export interface UsageBreakdownRow {
  key: string;
  total_usd: number;
  calls: number;
}

export function getUsageByRole(
  db: Database.Database,
  from: number,
  to: number,
): UsageBreakdownRow[] {
  return db
    .prepare(
      `SELECT role AS key,
              COALESCE(SUM(cost_usd), 0) AS total_usd,
              COUNT(*) AS calls
         FROM usage_log
        WHERE created_at >= ? AND created_at < ?
     GROUP BY role
     ORDER BY total_usd DESC`,
    )
    .all(from, to) as UsageBreakdownRow[];
}

export function getUsageByEnv(
  db: Database.Database,
  from: number,
  to: number,
): UsageBreakdownRow[] {
  return db
    .prepare(
      `SELECT env AS key,
              COALESCE(SUM(cost_usd), 0) AS total_usd,
              COUNT(*) AS calls
         FROM usage_log
        WHERE created_at >= ? AND created_at < ?
     GROUP BY env
     ORDER BY total_usd DESC`,
    )
    .all(from, to) as UsageBreakdownRow[];
}

export function getUsageByModel(
  db: Database.Database,
  from: number,
  to: number,
): UsageBreakdownRow[] {
  return db
    .prepare(
      `SELECT (provider || '/' || model) AS key,
              COALESCE(SUM(cost_usd), 0) AS total_usd,
              COUNT(*) AS calls
         FROM usage_log
        WHERE created_at >= ? AND created_at < ?
     GROUP BY key
     ORDER BY total_usd DESC`,
    )
    .all(from, to) as UsageBreakdownRow[];
}

/** Returns per-day totals between [from, to), with a row for each day that has at least one call. */
export function getUsageByDay(
  db: Database.Database,
  from: number,
  to: number,
): Array<{ day: string; total_usd: number; calls: number }> {
  return db
    .prepare(
      `SELECT strftime('%Y-%m-%d', created_at / 1000, 'unixepoch') AS day,
              COALESCE(SUM(cost_usd), 0) AS total_usd,
              COUNT(*) AS calls
         FROM usage_log
        WHERE created_at >= ? AND created_at < ?
     GROUP BY day
     ORDER BY day`,
    )
    .all(from, to) as Array<{ day: string; total_usd: number; calls: number }>;
}
