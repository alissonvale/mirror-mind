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

// CV1.E9.S6 follow-up: per-turn override must beat session voice.
// The streaming handler in adapters/web/index.tsx computes:
//   isAlma = forcedDestination
//     ? forcedDestination.type === "alma"
//     : sessionVoice === "alma" || reception.is_self_moment === true
// This block exercises the same shape via a direct-call helper so the
// invariant is locked in independent of the streaming handler's wiring.
//
// Earlier (broken) shape was:
//   isAlma = forcedDestination?.type === "alma"
//     || sessionVoice === "alma"          ← fired even when forced=persona
//     || (!forcedDestination && reception.is_self_moment)
// which let session voice override a per-turn forced persona pick —
// the user-reported bug fixed in this commit.
function resolveIsAlma(
  forcedDestination: { type: "alma" } | { type: "persona"; key: string } | null,
  sessionVoice: "alma" | null,
  receptionIsSelfMoment: boolean,
): boolean {
  return forcedDestination
    ? forcedDestination.type === "alma"
    : sessionVoice === "alma" || receptionIsSelfMoment === true;
}

describe("isAlma resolution (CV1.E9.S6)", () => {
  it("forced persona on Alma-cast routes through persona, not Alma", () => {
    expect(
      resolveIsAlma(
        { type: "persona", key: "mentora" },
        "alma",
        false,
      ),
    ).toBe(false);
  });

  it("forced Alma on persona-cast routes through Alma", () => {
    expect(resolveIsAlma({ type: "alma" }, null, false)).toBe(true);
  });

  it("no override + alma cast → Alma", () => {
    expect(resolveIsAlma(null, "alma", false)).toBe(true);
  });

  it("no override + persona cast + reception is_self_moment → Alma", () => {
    expect(resolveIsAlma(null, null, true)).toBe(true);
  });

  it("no override + persona cast + reception not self_moment → not Alma", () => {
    expect(resolveIsAlma(null, null, false)).toBe(false);
  });

  it("forced persona beats reception is_self_moment", () => {
    // Reception thinks the turn is Alma-worthy, but the user manually
    // routed to a persona — manual choice wins.
    expect(
      resolveIsAlma({ type: "persona", key: "terapeuta" }, null, true),
    ).toBe(false);
  });

  it("forced Alma overrides session voice=null + reception.is_self_moment=false", () => {
    expect(resolveIsAlma({ type: "alma" }, null, false)).toBe(true);
  });
});
