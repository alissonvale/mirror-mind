import type Database from "better-sqlite3";

/**
 * "Last conversation" readout per scope (CV0.E4.S7). Scans assistant
 * message entries for the `_organization` and `_journey` meta keys that
 * reception writes on every web turn, and returns the most recent
 * session per scope key with its title and timestamp.
 *
 * Telegram and API adapters currently only stamp `_persona` — scope
 * signals are web-only until those adapters are updated. That's fine:
 * this helper only needs *some* coverage, not total.
 */

export interface LatestScopeSession {
  sessionId: string;
  title: string | null;
  lastActivityAt: number;
}

function queryLatestByScope(
  db: Database.Database,
  userId: string,
  metaKey: "_organization" | "_journey",
): Map<string, LatestScopeSession> {
  const rows = db
    .prepare(
      `
      WITH scoped AS (
        SELECT
          json_extract(e.data, '$.${metaKey}') AS scope_key,
          e.session_id AS session_id,
          e.timestamp AS ts,
          s.title AS title,
          ROW_NUMBER() OVER (
            PARTITION BY json_extract(e.data, '$.${metaKey}')
            ORDER BY e.timestamp DESC
          ) AS rn
        FROM entries e
        JOIN sessions s ON e.session_id = s.id
        WHERE s.user_id = ?
          AND e.type = 'message'
          AND json_extract(e.data, '$.${metaKey}') IS NOT NULL
      )
      SELECT scope_key, session_id, ts, title
      FROM scoped
      WHERE rn = 1
      `,
    )
    .all(userId) as Array<{
      scope_key: string;
      session_id: string;
      ts: number;
      title: string | null;
    }>;

  const out = new Map<string, LatestScopeSession>();
  for (const r of rows) {
    out.set(r.scope_key, {
      sessionId: r.session_id,
      title: r.title,
      lastActivityAt: r.ts,
    });
  }
  return out;
}

export function getLatestOrganizationSessions(
  db: Database.Database,
  userId: string,
): Map<string, LatestScopeSession> {
  return queryLatestByScope(db, userId, "_organization");
}

export function getLatestJourneySessions(
  db: Database.Database,
  userId: string,
): Map<string, LatestScopeSession> {
  return queryLatestByScope(db, userId, "_journey");
}

/**
 * Full session list for one scope, ordered by last activity (most recent
 * first). Powers the scope ateliê surface (CV1.E4.S5). Same meta-based
 * approach as the "latest" helpers above — shares the parallel-mechanism
 * debt with S7 but stays consistent with it.
 *
 * Each row carries enough to render a session card: title, last activity
 * timestamp, persona key (singular per assistant message in practice
 * today), and a preview of the first user message.
 */

export interface ScopeSessionRow {
  sessionId: string;
  title: string | null;
  lastActivityAt: number;
  personaKey: string | null;
  firstUserPreview: string | null;
}

const PREVIEW_MAX_CHARS = 140;

function queryScopeSessions(
  db: Database.Database,
  userId: string,
  metaKey: "_organization" | "_journey",
  scopeKey: string,
): ScopeSessionRow[] {
  const rows = db
    .prepare(
      `
      WITH session_scope AS (
        SELECT DISTINCT
          e.session_id AS session_id,
          s.title AS title,
          s.created_at AS session_created_at
        FROM entries e
        JOIN sessions s ON e.session_id = s.id
        WHERE s.user_id = ?
          AND e.type = 'message'
          AND json_extract(e.data, '$.${metaKey}') = ?
      ),
      last_activity AS (
        SELECT session_id, MAX(timestamp) AS ts
        FROM entries
        WHERE type = 'message'
        GROUP BY session_id
      ),
      first_user AS (
        SELECT session_id, preview FROM (
          SELECT
            session_id,
            json_extract(data, '$.content[0].text') AS preview,
            ROW_NUMBER() OVER (
              PARTITION BY session_id
              ORDER BY timestamp ASC
            ) AS rn
          FROM entries
          WHERE type = 'message'
            AND json_extract(data, '$.role') = 'user'
        ) WHERE rn = 1
      ),
      first_persona AS (
        SELECT session_id, persona FROM (
          SELECT
            session_id,
            json_extract(data, '$._persona') AS persona,
            ROW_NUMBER() OVER (
              PARTITION BY session_id
              ORDER BY timestamp ASC
            ) AS rn
          FROM entries
          WHERE type = 'message'
            AND json_extract(data, '$.role') = 'assistant'
            AND json_extract(data, '$._persona') IS NOT NULL
        ) WHERE rn = 1
      )
      SELECT
        ss.session_id AS sessionId,
        ss.title,
        COALESCE(la.ts, ss.session_created_at) AS lastActivityAt,
        fp.persona AS personaKey,
        fu.preview AS firstUserPreview
      FROM session_scope ss
      LEFT JOIN last_activity la ON la.session_id = ss.session_id
      LEFT JOIN first_user fu ON fu.session_id = ss.session_id
      LEFT JOIN first_persona fp ON fp.session_id = ss.session_id
      ORDER BY lastActivityAt DESC
      `,
    )
    .all(userId, scopeKey) as ScopeSessionRow[];

  return rows.map((r) => ({
    ...r,
    firstUserPreview: truncatePreview(r.firstUserPreview),
  }));
}

function truncatePreview(text: string | null): string | null {
  if (!text) return null;
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (collapsed.length <= PREVIEW_MAX_CHARS) return collapsed;
  return collapsed.slice(0, PREVIEW_MAX_CHARS - 1).trimEnd() + "…";
}

export function getOrganizationSessions(
  db: Database.Database,
  userId: string,
  organizationKey: string,
): ScopeSessionRow[] {
  return queryScopeSessions(db, userId, "_organization", organizationKey);
}

export function getJourneySessions(
  db: Database.Database,
  userId: string,
  journeyKey: string,
): ScopeSessionRow[] {
  return queryScopeSessions(db, userId, "_journey", journeyKey);
}
