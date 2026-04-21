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
