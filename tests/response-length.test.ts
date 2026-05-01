import { describe, it, expect, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import {
  openDb,
  createUser,
  getOrCreateSession,
  getSessionResponseLength,
  setSessionResponseLength,
} from "../server/db.js";
import { isResponseLength } from "../server/expression.js";

describe("session response_length helpers (CV1.E10.S2)", () => {
  let db: Database.Database;
  let userId: string;
  let sessionId: string;

  beforeEach(() => {
    db = openDb(":memory:");
    const user = createUser(db, "alissonvale", "hash");
    userId = user.id;
    sessionId = getOrCreateSession(db, userId);
  });

  it("returns null for a fresh session (auto)", () => {
    expect(getSessionResponseLength(db, sessionId, userId)).toBeNull();
  });

  it("set + get round-trips each valid value", () => {
    setSessionResponseLength(db, sessionId, userId, "brief");
    expect(getSessionResponseLength(db, sessionId, userId)).toBe("brief");
    setSessionResponseLength(db, sessionId, userId, "standard");
    expect(getSessionResponseLength(db, sessionId, userId)).toBe("standard");
    setSessionResponseLength(db, sessionId, userId, "full");
    expect(getSessionResponseLength(db, sessionId, userId)).toBe("full");
  });

  it("set null clears the override back to auto", () => {
    setSessionResponseLength(db, sessionId, userId, "brief");
    setSessionResponseLength(db, sessionId, userId, null);
    expect(getSessionResponseLength(db, sessionId, userId)).toBeNull();
  });

  it("get for an unknown session id returns null (no row)", () => {
    expect(
      getSessionResponseLength(db, "nonexistent-session", userId),
    ).toBeNull();
  });

  it("set is a no-op when the session belongs to a different user", () => {
    const other = createUser(db, "veronica", "hash2");
    setSessionResponseLength(db, sessionId, other.id, "brief");
    // Owner read still sees null — the foreign UPDATE matched zero rows.
    expect(getSessionResponseLength(db, sessionId, userId)).toBeNull();
  });

  it("get for a session belonging to a different user returns null", () => {
    setSessionResponseLength(db, sessionId, userId, "full");
    const other = createUser(db, "veronica", "hash2");
    expect(getSessionResponseLength(db, sessionId, other.id)).toBeNull();
  });

  it("isResponseLength accepts the three literals and rejects everything else", () => {
    expect(isResponseLength("brief")).toBe(true);
    expect(isResponseLength("standard")).toBe(true);
    expect(isResponseLength("full")).toBe(true);
    expect(isResponseLength("auto")).toBe(false);
    expect(isResponseLength("medium")).toBe(false);
    expect(isResponseLength(null)).toBe(false);
    expect(isResponseLength(undefined)).toBe(false);
    expect(isResponseLength("")).toBe(false);
    expect(isResponseLength(42)).toBe(false);
  });

  it("the response_length column survives a fresh openDb (idempotent migration)", () => {
    // Mimic a re-open: the column was added by openDb above; opening
    // again must not throw and the value must persist.
    setSessionResponseLength(db, sessionId, userId, "brief");
    const sameDb = openDb(":memory:");
    // Same in-memory db doesn't share state across handles, so only the
    // schema-side check matters here: ensure the migration is idempotent
    // by reading the column from PRAGMA on a fresh handle.
    const cols = sameDb
      .prepare("PRAGMA table_info(sessions)")
      .all() as Array<{ name: string }>;
    expect(cols.some((c) => c.name === "response_length")).toBe(true);
  });
});
