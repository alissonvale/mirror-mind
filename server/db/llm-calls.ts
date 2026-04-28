import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

/**
 * CV1.E8.S1 — full prompt + response capture per LLM invocation.
 *
 * Companion to `usage_log`: that table is cost-only (lean rows for
 * budget reconciliation queries); this one carries the prompts and
 * responses themselves so admin can read what was actually sent and
 * received. Toggle via `llm_logging_enabled` setting (see
 * server/db/settings.ts).
 */

export type LlmRole =
  | "reception"
  | "main"
  | "expression"
  | "title"
  | "summary";

export interface LlmCallRow {
  id: string;
  role: LlmRole;
  provider: string;
  model: string;
  system_prompt: string;
  user_message: string;
  response: string | null;
  tokens_in: number | null;
  tokens_out: number | null;
  cost_usd: number | null;
  latency_ms: number | null;
  session_id: string | null;
  entry_id: string | null;
  user_id: string | null;
  env: string;
  error: string | null;
  created_at: number;
}

export interface InsertLlmCallInput {
  role: LlmRole;
  provider: string;
  model: string;
  system_prompt: string;
  user_message: string;
  response?: string | null;
  tokens_in?: number | null;
  tokens_out?: number | null;
  cost_usd?: number | null;
  latency_ms?: number | null;
  session_id?: string | null;
  entry_id?: string | null;
  user_id?: string | null;
  env: string;
  error?: string | null;
}

/**
 * Insert one llm_calls row. Returns the new row's id so the caller
 * can later UPDATE entry_id (main path: row is written before the
 * assistant entry exists).
 */
export function insertLlmCall(
  db: Database.Database,
  input: InsertLlmCallInput,
): string {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO llm_calls (
       id, role, provider, model, system_prompt, user_message, response,
       tokens_in, tokens_out, cost_usd, latency_ms,
       session_id, entry_id, user_id, env, error, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.role,
    input.provider,
    input.model,
    input.system_prompt,
    input.user_message,
    input.response ?? null,
    input.tokens_in ?? null,
    input.tokens_out ?? null,
    input.cost_usd ?? null,
    input.latency_ms ?? null,
    input.session_id ?? null,
    input.entry_id ?? null,
    input.user_id ?? null,
    input.env,
    input.error ?? null,
    Date.now(),
  );
  return id;
}

/**
 * Update entry_id on an existing row. Used by the main pipeline so a
 * call logged before the assistant entry is appended can be linked
 * back once the entry id is known.
 */
export function setLlmCallEntryId(
  db: Database.Database,
  callId: string,
  entryId: string,
): void {
  db.prepare("UPDATE llm_calls SET entry_id = ? WHERE id = ?").run(
    entryId,
    callId,
  );
}

export interface ListLlmCallsFilters {
  role?: LlmRole;
  session_id?: string;
  model?: string;
  /** Inclusive lower bound on created_at (ms epoch). */
  since?: number;
  /** Exclusive upper bound on created_at (ms epoch). */
  until?: number;
  /** Substring match against system_prompt OR response. Case-sensitive. */
  search?: string;
}

export interface ListLlmCallsOptions extends ListLlmCallsFilters {
  limit?: number;
  offset?: number;
}

interface FilterClause {
  where: string;
  params: unknown[];
}

function buildFilters(filters: ListLlmCallsFilters): FilterClause {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (filters.role) {
    conditions.push("role = ?");
    params.push(filters.role);
  }
  if (filters.session_id) {
    conditions.push("session_id = ?");
    params.push(filters.session_id);
  }
  if (filters.model) {
    conditions.push("model = ?");
    params.push(filters.model);
  }
  if (typeof filters.since === "number") {
    conditions.push("created_at >= ?");
    params.push(filters.since);
  }
  if (typeof filters.until === "number") {
    conditions.push("created_at < ?");
    params.push(filters.until);
  }
  if (filters.search) {
    conditions.push("(system_prompt LIKE ? OR response LIKE ?)");
    const like = `%${filters.search}%`;
    params.push(like, like);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  return { where, params };
}

export function listLlmCalls(
  db: Database.Database,
  options: ListLlmCallsOptions = {},
): LlmCallRow[] {
  const { where, params } = buildFilters(options);
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;
  return db
    .prepare(
      `SELECT * FROM llm_calls ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    )
    .all(...params, limit, offset) as LlmCallRow[];
}

export function countLlmCalls(
  db: Database.Database,
  filters: ListLlmCallsFilters = {},
): number {
  const { where, params } = buildFilters(filters);
  const row = db
    .prepare(`SELECT COUNT(*) as c FROM llm_calls ${where}`)
    .get(...params) as { c: number };
  return row.c;
}

export function getLlmCall(
  db: Database.Database,
  id: string,
): LlmCallRow | undefined {
  return db
    .prepare("SELECT * FROM llm_calls WHERE id = ?")
    .get(id) as LlmCallRow | undefined;
}

/**
 * Distinct model strings observed in the table. Drives the model
 * filter dropdown in the admin UI without requiring a config lookup
 * (rows survive model-roster changes).
 */
export function listLlmCallModels(db: Database.Database): string[] {
  const rows = db
    .prepare(
      "SELECT DISTINCT model FROM llm_calls ORDER BY model",
    )
    .all() as { model: string }[];
  return rows.map((r) => r.model);
}

/**
 * Delete every row. Returns the number of rows removed.
 */
export function deleteAllLlmCalls(db: Database.Database): number {
  const info = db.prepare("DELETE FROM llm_calls").run();
  return info.changes;
}

/**
 * Delete rows older than a cutoff (ms epoch). Returns rows removed.
 */
export function deleteLlmCallsOlderThan(
  db: Database.Database,
  cutoffMs: number,
): number {
  const info = db
    .prepare("DELETE FROM llm_calls WHERE created_at < ?")
    .run(cutoffMs);
  return info.changes;
}
