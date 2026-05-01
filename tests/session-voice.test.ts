import { describe, it, expect, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import {
  openDb,
  createUser,
  getOrCreateSession,
  getSessionVoice,
  setSessionVoice,
  isSessionVoice,
  addSessionPersona,
  getSessionTags,
} from "../server/db.js";

describe("session voice helpers (CV1.E9.S6)", () => {
  let db: Database.Database;
  let userId: string;
  let sessionId: string;

  beforeEach(() => {
    db = openDb(":memory:");
    const user = createUser(db, "alissonvale", "hash");
    userId = user.id;
    sessionId = getOrCreateSession(db, userId);
  });

  it("returns null for a fresh session (no override)", () => {
    expect(getSessionVoice(db, sessionId, userId)).toBeNull();
  });

  it("set + get round-trips alma", () => {
    setSessionVoice(db, sessionId, userId, "alma");
    expect(getSessionVoice(db, sessionId, userId)).toBe("alma");
  });

  it("set null clears the override", () => {
    setSessionVoice(db, sessionId, userId, "alma");
    setSessionVoice(db, sessionId, userId, null);
    expect(getSessionVoice(db, sessionId, userId)).toBeNull();
  });

  it("setSessionVoice('alma') clears session_personas (mutual exclusion)", () => {
    addSessionPersona(db, sessionId, "mentora");
    addSessionPersona(db, sessionId, "terapeuta");
    expect(getSessionTags(db, sessionId).personaKeys.length).toBe(2);

    setSessionVoice(db, sessionId, userId, "alma");

    expect(getSessionVoice(db, sessionId, userId)).toBe("alma");
    expect(getSessionTags(db, sessionId).personaKeys).toEqual([]);
  });

  it("clearing voice does NOT restore previously cleared personas", () => {
    addSessionPersona(db, sessionId, "mentora");
    setSessionVoice(db, sessionId, userId, "alma");
    setSessionVoice(db, sessionId, userId, null);
    // Pool stays empty after the clear — the user re-convokes
    // personas explicitly via the cast picker.
    expect(getSessionTags(db, sessionId).personaKeys).toEqual([]);
  });

  it("setSessionVoice on a foreign session is a no-op (ownership)", () => {
    const other = createUser(db, "veronica", "hash2");
    setSessionVoice(db, sessionId, other.id, "alma");
    expect(getSessionVoice(db, sessionId, userId)).toBeNull();
  });

  it("foreign setSessionVoice('alma') does NOT delete the owner's personas", () => {
    addSessionPersona(db, sessionId, "mentora");
    const other = createUser(db, "veronica", "hash2");
    setSessionVoice(db, sessionId, other.id, "alma");
    // Owner's personas are intact — the EXISTS-guarded DELETE matched
    // zero rows because the foreign user_id check failed.
    expect(getSessionTags(db, sessionId).personaKeys).toEqual(["mentora"]);
  });

  it("getSessionVoice on a foreign session returns null", () => {
    setSessionVoice(db, sessionId, userId, "alma");
    const other = createUser(db, "veronica", "hash2");
    expect(getSessionVoice(db, sessionId, other.id)).toBeNull();
  });

  it("isSessionVoice accepts 'alma' and rejects everything else", () => {
    expect(isSessionVoice("alma")).toBe(true);
    expect(isSessionVoice("persona")).toBe(false);
    expect(isSessionVoice("Alma")).toBe(false);
    expect(isSessionVoice(null)).toBe(false);
    expect(isSessionVoice(undefined)).toBe(false);
    expect(isSessionVoice("")).toBe(false);
    expect(isSessionVoice(42)).toBe(false);
  });

  it("voice column survives across openDb (idempotent migration)", () => {
    setSessionVoice(db, sessionId, userId, "alma");
    const sameDb = openDb(":memory:");
    const cols = sameDb
      .prepare("PRAGMA table_info(sessions)")
      .all() as Array<{ name: string }>;
    expect(cols.some((c) => c.name === "voice")).toBe(true);
  });
});
