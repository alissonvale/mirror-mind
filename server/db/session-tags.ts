import type Database from "better-sqlite3";

/**
 * Session-scope junction tables (CV1.E4.S4). A session declares a **pool**
 * of contexts it's operating in — personas, organizations, journeys. When
 * tags exist for a type, reception picks within the pool; the composer
 * injects all tagged scopes (orgs + journeys) into the prompt. Persona
 * stays singular per turn (the mirror has one voice).
 *
 * All three tables use string keys (not FKs to the scope rows). Keys
 * are stable in practice; if a key is edited (rare), the corresponding
 * row here is a no-op and the tag goes dormant — acceptable trade-off
 * for the simpler schema.
 */

export interface SessionTags {
  personaKeys: string[];
  organizationKeys: string[];
  journeyKeys: string[];
}

export function getSessionTags(
  db: Database.Database,
  sessionId: string,
): SessionTags {
  const personas = db
    .prepare(
      "SELECT persona_key FROM session_personas WHERE session_id = ? ORDER BY persona_key",
    )
    .all(sessionId) as Array<{ persona_key: string }>;
  const orgs = db
    .prepare(
      "SELECT organization_key FROM session_organizations WHERE session_id = ? ORDER BY organization_key",
    )
    .all(sessionId) as Array<{ organization_key: string }>;
  const journeys = db
    .prepare(
      "SELECT journey_key FROM session_journeys WHERE session_id = ? ORDER BY journey_key",
    )
    .all(sessionId) as Array<{ journey_key: string }>;
  return {
    personaKeys: personas.map((r) => r.persona_key),
    organizationKeys: orgs.map((r) => r.organization_key),
    journeyKeys: journeys.map((r) => r.journey_key),
  };
}

export function addSessionPersona(
  db: Database.Database,
  sessionId: string,
  key: string,
): void {
  db.prepare(
    "INSERT OR IGNORE INTO session_personas (session_id, persona_key) VALUES (?, ?)",
  ).run(sessionId, key);
}

export function removeSessionPersona(
  db: Database.Database,
  sessionId: string,
  key: string,
): void {
  db.prepare(
    "DELETE FROM session_personas WHERE session_id = ? AND persona_key = ?",
  ).run(sessionId, key);
}

export function addSessionOrganization(
  db: Database.Database,
  sessionId: string,
  key: string,
): void {
  db.prepare(
    "INSERT OR IGNORE INTO session_organizations (session_id, organization_key) VALUES (?, ?)",
  ).run(sessionId, key);
}

export function removeSessionOrganization(
  db: Database.Database,
  sessionId: string,
  key: string,
): void {
  db.prepare(
    "DELETE FROM session_organizations WHERE session_id = ? AND organization_key = ?",
  ).run(sessionId, key);
}

export function addSessionJourney(
  db: Database.Database,
  sessionId: string,
  key: string,
): void {
  db.prepare(
    "INSERT OR IGNORE INTO session_journeys (session_id, journey_key) VALUES (?, ?)",
  ).run(sessionId, key);
}

export function removeSessionJourney(
  db: Database.Database,
  sessionId: string,
  key: string,
): void {
  db.prepare(
    "DELETE FROM session_journeys WHERE session_id = ? AND journey_key = ?",
  ).run(sessionId, key);
}

/**
 * Destructively removes all scope tags for a session. Called by
 * `forgetSession` so the junction tables don't accumulate rows
 * referencing dead sessions.
 */
export function clearSessionTags(
  db: Database.Database,
  sessionId: string,
): void {
  db.prepare("DELETE FROM session_personas WHERE session_id = ?").run(sessionId);
  db.prepare("DELETE FROM session_organizations WHERE session_id = ?").run(
    sessionId,
  );
  db.prepare("DELETE FROM session_journeys WHERE session_id = ?").run(sessionId);
}
