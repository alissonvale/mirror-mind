import { describe, it, expect, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import {
  openDb,
  createUser,
  getOrCreateSession,
  forgetSession,
  getSessionTags,
  addSessionPersona,
  removeSessionPersona,
  addSessionOrganization,
  removeSessionOrganization,
  addSessionJourney,
  removeSessionJourney,
  clearSessionTags,
} from "../server/db.js";

describe("session tags (CV1.E4.S4)", () => {
  let db: Database.Database;
  let sessionId: string;

  beforeEach(() => {
    db = openDb(":memory:");
    const user = createUser(db, "tagger", "hash");
    sessionId = getOrCreateSession(db, user.id);
  });

  it("returns empty tags for a fresh session", () => {
    const tags = getSessionTags(db, sessionId);
    expect(tags.personaKeys).toEqual([]);
    expect(tags.organizationKeys).toEqual([]);
    expect(tags.journeyKeys).toEqual([]);
  });

  it("adds and reads back personas, orgs, journeys", () => {
    addSessionPersona(db, sessionId, "terapeuta");
    addSessionPersona(db, sessionId, "estrategista");
    addSessionOrganization(db, sessionId, "software-zen");
    addSessionJourney(db, sessionId, "vida-economica");

    const tags = getSessionTags(db, sessionId);
    expect(tags.personaKeys).toEqual(["estrategista", "terapeuta"]); // ORDER BY
    expect(tags.organizationKeys).toEqual(["software-zen"]);
    expect(tags.journeyKeys).toEqual(["vida-economica"]);
  });

  it("add is idempotent (INSERT OR IGNORE)", () => {
    addSessionPersona(db, sessionId, "terapeuta");
    addSessionPersona(db, sessionId, "terapeuta");
    const tags = getSessionTags(db, sessionId);
    expect(tags.personaKeys).toEqual(["terapeuta"]);
  });

  it("remove drops the matching row", () => {
    addSessionPersona(db, sessionId, "terapeuta");
    addSessionPersona(db, sessionId, "estrategista");
    removeSessionPersona(db, sessionId, "terapeuta");
    expect(getSessionTags(db, sessionId).personaKeys).toEqual(["estrategista"]);
  });

  it("remove on a missing row is a no-op", () => {
    expect(() =>
      removeSessionPersona(db, sessionId, "nonexistent"),
    ).not.toThrow();
  });

  it("clearSessionTags wipes all three tables for the session", () => {
    addSessionPersona(db, sessionId, "terapeuta");
    addSessionOrganization(db, sessionId, "software-zen");
    addSessionJourney(db, sessionId, "vida-economica");
    clearSessionTags(db, sessionId);
    const tags = getSessionTags(db, sessionId);
    expect(tags.personaKeys).toEqual([]);
    expect(tags.organizationKeys).toEqual([]);
    expect(tags.journeyKeys).toEqual([]);
  });

  it("forgetSession cascades to the junction tables", () => {
    addSessionPersona(db, sessionId, "terapeuta");
    addSessionOrganization(db, sessionId, "software-zen");
    addSessionJourney(db, sessionId, "vida-economica");
    forgetSession(db, sessionId);
    const orphans = db
      .prepare(
        "SELECT COUNT(*) as c FROM (SELECT 1 FROM session_personas WHERE session_id = ? UNION ALL SELECT 1 FROM session_organizations WHERE session_id = ? UNION ALL SELECT 1 FROM session_journeys WHERE session_id = ?)",
      )
      .get(sessionId, sessionId, sessionId) as { c: number };
    expect(orphans.c).toBe(0);
  });

  it("tags for one session don't bleed into another", () => {
    const user2 = createUser(db, "another", "hash2");
    const otherSession = getOrCreateSession(db, user2.id);
    addSessionPersona(db, sessionId, "terapeuta");
    addSessionOrganization(db, otherSession, "software-zen");
    expect(getSessionTags(db, sessionId).organizationKeys).toEqual([]);
    expect(getSessionTags(db, otherSession).personaKeys).toEqual([]);
  });
});

describe("session tags migration (existing installations)", () => {
  it("openDb creates the three junction tables on fresh DBs", () => {
    const db = openDb(":memory:");
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
      )
      .all() as Array<{ name: string }>;
    const names = tables.map((t) => t.name);
    expect(names).toContain("session_personas");
    expect(names).toContain("session_organizations");
    expect(names).toContain("session_journeys");
  });
});
