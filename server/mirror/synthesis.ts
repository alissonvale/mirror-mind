import type Database from "better-sqlite3";

/**
 * Synthesizes the state behind /espelho (CV1.E12.S2). The page reads
 * top-to-bottom as a single self-portrait — "Sou X. Estou em Y. Vivo Z."
 * — and this module computes the structured data that the page renders.
 *
 * Pure: no i18n, no rendering. The page consumes the typed result and
 * does its own templating via the locale layer.
 *
 * Update model (decision recorded 2026-05-03):
 *   - Sou: lazy in spirit (layers change rarely). For the first cut we
 *     just recompute on every visit — queries are cheap at this scale,
 *     and a cache table can be added later if it ever matters.
 *   - Estou: fresh every visit (territory shifts in days/weeks).
 *   - Vivo: fresh every visit (record changes daily).
 */

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// --- Public types -----------------------------------------------------

/**
 * A voice that the user spoke through this week — either Alma or a
 * specific persona. Renders in /espelho's Vivo pane as a tag list:
 * "Vozes ativas: ♔ Voz da Alma, ◇ Pensadora, ◇ Mentora".
 */
export type ActiveVoice =
  | { type: "alma" }
  | { type: "persona"; key: string };

export interface MirrorState {
  shifts: ShiftMarker[];
  vivo: VivoState;
  estou: EstouState;
  sou: SouState;
}

export interface SouState {
  soulSummary: string | null;
  identitySummary: string | null;
  expressionSummary: string | null;
}

export interface EstouState {
  /** Active journeys, ordered by name. */
  activeJourneys: { key: string; name: string }[];
  /** Organization with most sessions in the last 7 days. Null if none. */
  dominantOrg: { key: string; name: string } | null;
  activeSceneCount: number;
  /** Scene linked to the most recent session in the last 7 days. */
  mostRecentScene: { key: string; title: string } | null;
}

export interface VivoState {
  /**
   * Voices that spoke this week: Alma (if any session was alma) plus
   * personas tagged in any session, ordered by activity (count desc).
   * Capped at 4 items so the rendered tag stays scannable.
   */
  activeVoices: ActiveVoice[];
  /** Journey with the most sessions in the last 7 days. Null if none. */
  focusJourney: { key: string; name: string } | null;
  /**
   * Scene/org/journey that appears in ≥2 sessions over the last 7 days.
   * Up to 2 themes, ordered by repetition count desc.
   */
  recurringThemes: { type: "scene" | "org" | "journey"; name: string }[];
  weekConversationCount: number;
  /** Distinct days (in last 7) on which the user had ≥1 session. */
  weekDayCount: number;
  /** Title of the most recent session this week, if it has one. */
  lastSessionTitle: string | null;
}

export type ShiftMarker =
  | { type: "soul-updated"; daysAgo: number }
  | { type: "scene-reopened"; name: string }
  | { type: "new-journey"; name: string }
  | { type: "many-conversations"; count: number };

// --- Orchestrator -----------------------------------------------------

export function composeMirrorState(
  db: Database.Database,
  userId: string,
  now: number = Date.now(),
  lastVisit: number | null = null,
): MirrorState {
  const sou = composeSou(db, userId);
  const estou = composeEstou(db, userId, now);
  const vivo = composeVivo(db, userId, now);
  const shifts = computeShifts(db, userId, lastVisit, now);
  return { shifts, vivo, estou, sou };
}

// --- Sou (cognitive identity) -----------------------------------------

export function composeSou(
  db: Database.Database,
  userId: string,
): SouState {
  const soulRow = db
    .prepare(
      "SELECT summary, content FROM identity WHERE user_id = ? AND layer = 'self' AND key = 'soul'",
    )
    .get(userId) as { summary: string | null; content: string } | undefined;
  const identityRow = db
    .prepare(
      "SELECT summary, content FROM identity WHERE user_id = ? AND layer = 'ego' AND key = 'identity'",
    )
    .get(userId) as { summary: string | null; content: string } | undefined;
  const expressionRow = db
    .prepare(
      "SELECT summary, content FROM identity WHERE user_id = ? AND layer = 'ego' AND key = 'expression'",
    )
    .get(userId) as { summary: string | null; content: string } | undefined;

  return {
    soulSummary: pickSummaryOrFirstSentence(soulRow),
    identitySummary: pickSummaryOrFirstSentence(identityRow),
    expressionSummary: pickSummaryOrFirstSentence(expressionRow),
  };
}

// --- Estou (territory) ------------------------------------------------

export function composeEstou(
  db: Database.Database,
  userId: string,
  now: number = Date.now(),
): EstouState {
  const journeysRows = db
    .prepare(
      "SELECT key, name FROM journeys WHERE user_id = ? AND status = 'active' ORDER BY name",
    )
    .all(userId) as { key: string; name: string }[];

  const dominantOrg = queryDominantOrg(db, userId, now);
  const activeSceneCount = (
    db
      .prepare(
        "SELECT COUNT(*) as c FROM scenes WHERE user_id = ? AND status = 'active'",
      )
      .get(userId) as { c: number }
  ).c;

  const mostRecentScene = queryMostRecentScene(db, userId, now);

  return {
    activeJourneys: journeysRows,
    dominantOrg,
    activeSceneCount,
    mostRecentScene,
  };
}

// --- Vivo (recent record) ---------------------------------------------

export function composeVivo(
  db: Database.Database,
  userId: string,
  now: number = Date.now(),
): VivoState {
  const since = now - WEEK_MS;

  const sessionsThisWeek = db
    .prepare(
      `SELECT id, title, created_at
       FROM sessions
       WHERE user_id = ? AND created_at > ?
       ORDER BY created_at DESC`,
    )
    .all(userId, since) as { id: string; title: string | null; created_at: number }[];

  const weekConversationCount = sessionsThisWeek.length;
  const dayKeys = new Set(
    sessionsThisWeek.map((s) => Math.floor(s.created_at / (24 * 60 * 60 * 1000))),
  );
  const weekDayCount = dayKeys.size;

  // Most recent session with a non-empty title.
  const lastWithTitle = sessionsThisWeek.find(
    (s) => s.title && s.title.trim().length > 0,
  );
  const lastSessionTitle = lastWithTitle ? lastWithTitle.title : null;

  return {
    activeVoices: queryActiveVoices(db, userId, now),
    focusJourney: queryFocusJourney(db, userId, now),
    recurringThemes: queryRecurringThemes(db, userId, since),
    weekConversationCount,
    weekDayCount,
    lastSessionTitle,
  };
}

// --- Shifts (since last visit) ----------------------------------------

export function computeShifts(
  db: Database.Database,
  userId: string,
  lastVisit: number | null,
  now: number = Date.now(),
): ShiftMarker[] {
  // No previous visit → no diff to compute. The first ever /espelho
  // visit shows no shifts; the second one starts comparing.
  if (lastVisit === null) return [];

  const markers: ShiftMarker[] = [];

  // Soul layer touched since last visit
  const soulRow = db
    .prepare(
      "SELECT updated_at FROM identity WHERE user_id = ? AND layer = 'self' AND key = 'soul'",
    )
    .get(userId) as { updated_at: number } | undefined;
  if (soulRow && soulRow.updated_at > lastVisit) {
    const daysAgo = Math.floor((now - soulRow.updated_at) / (24 * 60 * 60 * 1000));
    markers.push({ type: "soul-updated", daysAgo });
  }

  // New journeys created since last visit (cap at 1 marker — the most recent)
  const newJourney = db
    .prepare(
      `SELECT name FROM journeys
       WHERE user_id = ? AND status = 'active' AND created_at > ?
       ORDER BY created_at DESC LIMIT 1`,
    )
    .get(userId, lastVisit) as { name: string } | undefined;
  if (newJourney) {
    markers.push({ type: "new-journey", name: newJourney.name });
  }

  // Cena reopened: a scene whose most recent session is after lastVisit
  // AND that has at least one earlier session (otherwise it'd be a new
  // scene, not "reopened"). Cap at 1 marker, the most recently active.
  const reopened = db
    .prepare(
      `SELECT sc.title AS title, MAX(s.created_at) AS last_session
       FROM scenes sc
       JOIN sessions s ON s.scene_id = sc.id
       WHERE sc.user_id = ? AND s.created_at > ?
       GROUP BY sc.id
       HAVING (
         SELECT COUNT(*) FROM sessions s2
         WHERE s2.scene_id = sc.id AND s2.created_at <= ?
       ) > 0
       ORDER BY last_session DESC
       LIMIT 1`,
    )
    .get(userId, lastVisit, lastVisit) as { title: string } | undefined;
  if (reopened) {
    markers.push({ type: "scene-reopened", name: reopened.title });
  }

  // Conversations since last visit
  const newConvCount = (
    db
      .prepare(
        "SELECT COUNT(*) as c FROM sessions WHERE user_id = ? AND created_at > ?",
      )
      .get(userId, lastVisit) as { c: number }
  ).c;
  if (newConvCount > 0) {
    markers.push({ type: "many-conversations", count: newConvCount });
  }

  return markers;
}

// --- Internal queries -------------------------------------------------

function pickSummaryOrFirstSentence(
  row: { summary: string | null; content: string } | undefined,
): string | null {
  if (!row) return null;
  if (row.summary && row.summary.trim().length > 0) {
    return row.summary.trim();
  }
  if (!row.content || row.content.trim().length === 0) return null;
  // First sentence, capped at 200 chars.
  const trimmed = row.content.trim();
  const dot = trimmed.search(/[.!?](\s|$)/);
  const sentence = dot > 0 ? trimmed.slice(0, dot + 1) : trimmed;
  return sentence.length > 200 ? sentence.slice(0, 197) + "…" : sentence;
}

/**
 * Voices the user spoke through this week: Alma (if any session
 * had voice='alma') plus each persona tagged in any session,
 * ordered by activity. Capped at 4 entries so the rendered list
 * stays scannable in a single line.
 */
function queryActiveVoices(
  db: Database.Database,
  userId: string,
  now: number,
): ActiveVoice[] {
  const since = now - WEEK_MS;

  const almaRow = db
    .prepare(
      `SELECT COUNT(*) as c
       FROM sessions
       WHERE user_id = ? AND created_at > ? AND voice = 'alma'`,
    )
    .get(userId, since) as { c: number };

  const personaRows = db
    .prepare(
      `SELECT sp.persona_key AS key, COUNT(DISTINCT sp.session_id) AS c
       FROM session_personas sp
       JOIN sessions s ON sp.session_id = s.id
       WHERE s.user_id = ? AND s.created_at > ?
       GROUP BY sp.persona_key
       ORDER BY c DESC, sp.persona_key ASC`,
    )
    .all(userId, since) as { key: string; c: number }[];

  const result: ActiveVoice[] = [];
  if (almaRow.c > 0) result.push({ type: "alma" });
  for (const row of personaRows) {
    result.push({ type: "persona", key: row.key });
  }
  return result.slice(0, 4);
}

function queryFocusJourney(
  db: Database.Database,
  userId: string,
  now: number,
): { key: string; name: string } | null {
  const since = now - WEEK_MS;
  const row = db
    .prepare(
      `SELECT sj.journey_key AS key, COUNT(DISTINCT sj.session_id) AS c
       FROM session_journeys sj
       JOIN sessions s ON sj.session_id = s.id
       WHERE s.user_id = ? AND s.created_at > ?
       GROUP BY sj.journey_key
       ORDER BY c DESC
       LIMIT 1`,
    )
    .get(userId, since) as { key: string; c: number } | undefined;
  if (!row) return null;
  const journey = db
    .prepare("SELECT key, name FROM journeys WHERE user_id = ? AND key = ?")
    .get(userId, row.key) as { key: string; name: string } | undefined;
  return journey ?? null;
}

function queryDominantOrg(
  db: Database.Database,
  userId: string,
  now: number,
): { key: string; name: string } | null {
  const since = now - WEEK_MS;
  const row = db
    .prepare(
      `SELECT so.organization_key AS key, COUNT(DISTINCT so.session_id) AS c
       FROM session_organizations so
       JOIN sessions s ON so.session_id = s.id
       WHERE s.user_id = ? AND s.created_at > ?
       GROUP BY so.organization_key
       ORDER BY c DESC
       LIMIT 1`,
    )
    .get(userId, since) as { key: string; c: number } | undefined;
  if (!row) return null;
  const org = db
    .prepare("SELECT key, name FROM organizations WHERE user_id = ? AND key = ?")
    .get(userId, row.key) as { key: string; name: string } | undefined;
  return org ?? null;
}

function queryMostRecentScene(
  db: Database.Database,
  userId: string,
  now: number,
): { key: string; title: string } | null {
  const since = now - WEEK_MS;
  const row = db
    .prepare(
      `SELECT sc.key AS key, sc.title AS title
       FROM sessions s
       JOIN scenes sc ON s.scene_id = sc.id
       WHERE s.user_id = ? AND s.created_at > ?
       ORDER BY s.created_at DESC
       LIMIT 1`,
    )
    .get(userId, since) as { key: string; title: string } | undefined;
  return row ?? null;
}

function queryRecurringThemes(
  db: Database.Database,
  userId: string,
  since: number,
): { type: "scene" | "org" | "journey"; name: string }[] {
  // Scenes (counted via sessions.scene_id)
  const sceneRows = db
    .prepare(
      `SELECT sc.title AS name, COUNT(*) AS c
       FROM sessions s
       JOIN scenes sc ON s.scene_id = sc.id
       WHERE s.user_id = ? AND s.created_at > ?
       GROUP BY sc.id
       HAVING c >= 2
       ORDER BY c DESC`,
    )
    .all(userId, since) as { name: string; c: number }[];

  // Orgs (counted via session_organizations)
  const orgRows = db
    .prepare(
      `SELECT o.name AS name, COUNT(*) AS c
       FROM session_organizations so
       JOIN sessions s ON so.session_id = s.id
       JOIN organizations o ON o.user_id = s.user_id AND o.key = so.organization_key
       WHERE s.user_id = ? AND s.created_at > ?
       GROUP BY so.organization_key
       HAVING c >= 2
       ORDER BY c DESC`,
    )
    .all(userId, since) as { name: string; c: number }[];

  // Journeys (counted via session_journeys)
  const journeyRows = db
    .prepare(
      `SELECT j.name AS name, COUNT(*) AS c
       FROM session_journeys sj
       JOIN sessions s ON sj.session_id = s.id
       JOIN journeys j ON j.user_id = s.user_id AND j.key = sj.journey_key
       WHERE s.user_id = ? AND s.created_at > ?
       GROUP BY sj.journey_key
       HAVING c >= 2
       ORDER BY c DESC`,
    )
    .all(userId, since) as { name: string; c: number }[];

  // Merge, sorted by count desc, take top 2.
  const merged: { type: "scene" | "org" | "journey"; name: string; c: number }[] = [
    ...sceneRows.map((r) => ({ type: "scene" as const, name: r.name, c: r.c })),
    ...orgRows.map((r) => ({ type: "org" as const, name: r.name, c: r.c })),
    ...journeyRows.map((r) => ({ type: "journey" as const, name: r.name, c: r.c })),
  ];
  merged.sort((a, b) => b.c - a.c);
  return merged.slice(0, 2).map(({ type, name }) => ({ type, name }));
}

