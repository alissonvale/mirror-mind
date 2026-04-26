import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

/**
 * CV1.E7.S8: Out-of-pool divergent runs.
 *
 * Each row is a one-turn response that was generated through a
 * persona/scope outside the session's canonical pool. The user
 * opted in by clicking the rail's suggestion card; the server ran
 * the pipeline with the override, and the result lives here —
 * separate from `entries` so the canonical conversation history
 * (which feeds the agent's next turn) stays clean.
 *
 * Pinned to a parent assistant entry via `parent_entry_id`. On
 * "forget turn" of the parent, the divergent runs cascade.
 */
export type DivergentOverrideType = "persona" | "organization" | "journey";

export interface DivergentRun {
  id: string;
  parent_entry_id: string;
  override_type: DivergentOverrideType;
  override_key: string;
  content: string;
  meta: Record<string, unknown> | null;
  created_at: number;
}

interface DivergentRunRow {
  id: string;
  parent_entry_id: string;
  override_type: string;
  override_key: string;
  content: string;
  meta: string | null;
  created_at: number;
}

function rowToDivergent(row: DivergentRunRow): DivergentRun {
  return {
    id: row.id,
    parent_entry_id: row.parent_entry_id,
    override_type: row.override_type as DivergentOverrideType,
    override_key: row.override_key,
    content: row.content,
    meta: row.meta ? JSON.parse(row.meta) : null,
    created_at: row.created_at,
  };
}

/**
 * Insert a new divergent run. Returns the inserted row's id.
 */
export function insertDivergentRun(
  db: Database.Database,
  input: {
    parent_entry_id: string;
    override_type: DivergentOverrideType;
    override_key: string;
    content: string;
    meta?: Record<string, unknown> | null;
    created_at?: number;
  },
): string {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO divergent_runs
       (id, parent_entry_id, override_type, override_key, content, meta, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.parent_entry_id,
    input.override_type,
    input.override_key,
    input.content,
    input.meta ? JSON.stringify(input.meta) : null,
    input.created_at ?? Date.now(),
  );
  return id;
}

/**
 * Load all divergent runs for a single parent entry, ordered by
 * created_at (oldest first). Used when rendering a single bubble's
 * sub-bubbles.
 */
export function loadDivergentRunsByParent(
  db: Database.Database,
  parentEntryId: string,
): DivergentRun[] {
  const rows = db
    .prepare(
      `SELECT id, parent_entry_id, override_type, override_key, content, meta, created_at
       FROM divergent_runs
       WHERE parent_entry_id = ?
       ORDER BY created_at ASC`,
    )
    .all(parentEntryId) as DivergentRunRow[];
  return rows.map(rowToDivergent);
}

/**
 * Load all divergent runs for an entire session, indexed by parent
 * entry id so the page renderer can inject sub-bubbles after each
 * canonical entry that has divergent siblings.
 */
export function loadDivergentRunsBySession(
  db: Database.Database,
  sessionId: string,
): Map<string, DivergentRun[]> {
  const rows = db
    .prepare(
      `SELECT dr.id, dr.parent_entry_id, dr.override_type, dr.override_key,
              dr.content, dr.meta, dr.created_at
       FROM divergent_runs dr
       JOIN entries e ON e.id = dr.parent_entry_id
       WHERE e.session_id = ?
       ORDER BY dr.created_at ASC`,
    )
    .all(sessionId) as DivergentRunRow[];
  const byParent = new Map<string, DivergentRun[]>();
  for (const row of rows) {
    const dr = rowToDivergent(row);
    const list = byParent.get(dr.parent_entry_id) ?? [];
    list.push(dr);
    byParent.set(dr.parent_entry_id, list);
  }
  return byParent;
}

/**
 * Delete a single divergent run by id. Used by an explicit "discard"
 * affordance (deferred to follow-up — not part of S8 MVP).
 */
export function deleteDivergentRun(
  db: Database.Database,
  id: string,
): void {
  db.prepare("DELETE FROM divergent_runs WHERE id = ?").run(id);
}
