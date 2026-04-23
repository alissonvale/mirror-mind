import type Database from "better-sqlite3";

/**
 * Cross-scope conversations browse (CV1.E6.S1). Returns sessions for a
 * user, optionally filtered by persona / organization / journey, ordered
 * by last activity (most recent first), paginated.
 *
 * Same meta-based source-of-truth as the per-scope helpers in
 * scope-sessions.ts (S5/S7) — assistant messages carry `_persona`,
 * `_organization`, `_journey` keys; this helper extracts and filters on
 * them. The parallel-mechanism debt (junction tables exist but aggregations
 * still query meta) stays parked, consistent with everything around it.
 *
 * Each row also returns the session's first organization/journey keys so
 * the cross-scope view can show scope badges (the user is no longer on a
 * single scope page; they need the context inline).
 */

export interface ConversationListRow {
  sessionId: string;
  title: string | null;
  lastActivityAt: number;
  personaKey: string | null;
  organizationKey: string | null;
  journeyKey: string | null;
  firstUserPreview: string | null;
}

export interface ConversationListResult {
  rows: ConversationListRow[];
  total: number;
}

export interface ConversationListOptions {
  personaKey?: string;
  organizationKey?: string;
  journeyKey?: string;
  limit?: number;
  offset?: number;
}

const DEFAULT_LIMIT = 50;
const PREVIEW_MAX_CHARS = 140;

export function getConversationsList(
  db: Database.Database,
  userId: string,
  opts: ConversationListOptions = {},
): ConversationListResult {
  const limit = opts.limit ?? DEFAULT_LIMIT;
  const offset = opts.offset ?? 0;

  // Sessions are eligible if they have at least one assistant message
  // with at least one of the meta keys we care about. Filters narrow
  // further when supplied.
  const filterClauses: string[] = ["s.user_id = ?"];
  const filterParams: unknown[] = [userId];

  // We always require at least one assistant message in the session so
  // we have a row to source meta from. Without this, fresh empty sessions
  // would surface with no metadata and pollute the list.
  filterClauses.push(`EXISTS (
    SELECT 1 FROM entries e
    WHERE e.session_id = s.id
      AND e.type = 'message'
      AND json_extract(e.data, '$.role') = 'assistant'
  )`);

  if (opts.personaKey) {
    filterClauses.push(`EXISTS (
      SELECT 1 FROM entries e
      WHERE e.session_id = s.id
        AND e.type = 'message'
        AND json_extract(e.data, '$._persona') = ?
    )`);
    filterParams.push(opts.personaKey);
  }
  if (opts.organizationKey) {
    filterClauses.push(`EXISTS (
      SELECT 1 FROM entries e
      WHERE e.session_id = s.id
        AND e.type = 'message'
        AND json_extract(e.data, '$._organization') = ?
    )`);
    filterParams.push(opts.organizationKey);
  }
  if (opts.journeyKey) {
    filterClauses.push(`EXISTS (
      SELECT 1 FROM entries e
      WHERE e.session_id = s.id
        AND e.type = 'message'
        AND json_extract(e.data, '$._journey') = ?
    )`);
    filterParams.push(opts.journeyKey);
  }

  const where = filterClauses.join(" AND ");

  const totalRow = db
    .prepare(`SELECT COUNT(*) AS total FROM sessions s WHERE ${where}`)
    .get(...filterParams) as { total: number };
  const total = totalRow.total;

  const rows = db
    .prepare(
      `
      WITH eligible AS (
        SELECT s.id AS session_id, s.title, s.created_at AS session_created_at
        FROM sessions s
        WHERE ${where}
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
      first_assistant_meta AS (
        SELECT session_id, persona, organization, journey FROM (
          SELECT
            session_id,
            json_extract(data, '$._persona') AS persona,
            json_extract(data, '$._organization') AS organization,
            json_extract(data, '$._journey') AS journey,
            ROW_NUMBER() OVER (
              PARTITION BY session_id
              ORDER BY timestamp ASC
            ) AS rn
          FROM entries
          WHERE type = 'message'
            AND json_extract(data, '$.role') = 'assistant'
        ) WHERE rn = 1
      )
      SELECT
        ee.session_id AS sessionId,
        ee.title AS title,
        COALESCE(la.ts, ee.session_created_at) AS lastActivityAt,
        fam.persona AS personaKey,
        fam.organization AS organizationKey,
        fam.journey AS journeyKey,
        fu.preview AS firstUserPreview
      FROM eligible ee
      LEFT JOIN last_activity la ON la.session_id = ee.session_id
      LEFT JOIN first_user fu ON fu.session_id = ee.session_id
      LEFT JOIN first_assistant_meta fam ON fam.session_id = ee.session_id
      ORDER BY lastActivityAt DESC
      LIMIT ? OFFSET ?
      `,
    )
    .all(...filterParams, limit, offset) as ConversationListRow[];

  return {
    rows: rows.map((r) => ({
      ...r,
      firstUserPreview: truncatePreview(r.firstUserPreview),
    })),
    total,
  };
}

function truncatePreview(text: string | null): string | null {
  if (!text) return null;
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (collapsed.length <= PREVIEW_MAX_CHARS) return collapsed;
  return collapsed.slice(0, PREVIEW_MAX_CHARS - 1).trimEnd() + "…";
}
