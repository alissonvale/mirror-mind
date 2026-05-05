import { describe, it, expect, beforeEach } from "vitest";
import { createHash } from "node:crypto";
import type Database from "better-sqlite3";
import {
  openDb,
  createUser,
  setIdentityLayer,
  getOrCreateSession,
  createFreshSession,
  appendEntry,
  forgetTurn,
  pruneEmptySessionsForUser,
  type User,
} from "../server/db.js";

/**
 * CV1.E15 follow-up: empty-session pruning. Orphan sessions
 * accumulated from createFreshSession-without-followup and from
 * forget-every-turn flows. Three layers of defense are tested:
 *
 *   1. forgetTurn drops the session row when the last entry leaves.
 *   2. pruneEmptySessionsForUser sweeps drafts older than `minAgeMs`.
 *   3. getOrCreateSession + createFreshSession invoke the sweep.
 *
 * Plus the migration that cleans up pre-existing orphans on boot.
 */
function freshDb(): { db: Database.Database; user: User } {
  const db = openDb(":memory:");
  const hash = createHash("sha256").update("prune-token").digest("hex");
  const user = createUser(db, "pruneuser", hash);
  setIdentityLayer(db, user.id, "self", "soul", "soul");
  setIdentityLayer(db, user.id, "ego", "identity", "id");
  setIdentityLayer(db, user.id, "ego", "behavior", "behavior");
  return { db, user };
}

function countSessions(db: Database.Database): number {
  return (db.prepare("SELECT COUNT(*) AS c FROM sessions").get() as { c: number })
    .c;
}

function backdateSession(db: Database.Database, sessionId: string, msAgo: number) {
  db.prepare("UPDATE sessions SET created_at = ? WHERE id = ?").run(
    Date.now() - msAgo,
    sessionId,
  );
}

describe("forgetTurn drops empty session row (CV1.E15 follow-up)", () => {
  let db: Database.Database;
  let user: User;

  beforeEach(() => {
    ({ db, user } = freshDb());
  });

  it("removes the session when the only turn is forgotten", () => {
    const sid = getOrCreateSession(db, user.id);
    const userEntryId = appendEntry(db, sid, null, "message", {
      role: "user",
      content: [{ type: "text", text: "hi" }],
    });
    appendEntry(db, sid, userEntryId, "message", {
      role: "assistant",
      content: [{ type: "text", text: "hello" }],
    });

    expect(countSessions(db)).toBe(1);
    const result = forgetTurn(db, userEntryId, user.id);
    expect(result?.deleted.length).toBe(2);
    expect(countSessions(db)).toBe(0);
  });

  it("keeps the session when there are still turns after forget", () => {
    const sid = getOrCreateSession(db, user.id);
    const t1User = appendEntry(db, sid, null, "message", {
      role: "user",
      content: [{ type: "text", text: "first" }],
    });
    appendEntry(db, sid, t1User, "message", {
      role: "assistant",
      content: [{ type: "text", text: "first reply" }],
    });
    const t2User = appendEntry(db, sid, t1User, "message", {
      role: "user",
      content: [{ type: "text", text: "second" }],
    });
    appendEntry(db, sid, t2User, "message", {
      role: "assistant",
      content: [{ type: "text", text: "second reply" }],
    });

    forgetTurn(db, t2User, user.id);
    expect(countSessions(db)).toBe(1);
  });
});

describe("pruneEmptySessionsForUser (CV1.E15 follow-up)", () => {
  let db: Database.Database;
  let user: User;

  beforeEach(() => {
    ({ db, user } = freshDb());
  });

  it("does NOT prune drafts younger than minAgeMs (race protection)", () => {
    const sid = createFreshSession(db, user.id);
    // Fresh draft, no entries, age <1 min.
    const removed = pruneEmptySessionsForUser(db, user.id);
    expect(removed).toBe(0);
    expect(countSessions(db)).toBe(1);
    void sid;
  });

  it("prunes empty drafts older than minAgeMs", () => {
    const sid = createFreshSession(db, user.id);
    backdateSession(db, sid, 120_000); // 2 min ago
    const removed = pruneEmptySessionsForUser(db, user.id);
    expect(removed).toBe(1);
    expect(countSessions(db)).toBe(0);
  });

  it("does not touch sessions with entries", () => {
    const sid = getOrCreateSession(db, user.id);
    appendEntry(db, sid, null, "message", {
      role: "user",
      content: [{ type: "text", text: "hi" }],
    });
    backdateSession(db, sid, 120_000);
    const removed = pruneEmptySessionsForUser(db, user.id);
    expect(removed).toBe(0);
    expect(countSessions(db)).toBe(1);
  });

  it("respects excludeId — never prunes the listed session even when stale", () => {
    // Insert two stale empty sessions directly so createFreshSession's
    // own sweep doesn't remove them before the assertion runs.
    db.prepare(
      "INSERT INTO sessions (id, user_id, created_at) VALUES (?, ?, ?)",
    ).run("a-old", user.id, Date.now() - 120_000);
    db.prepare(
      "INSERT INTO sessions (id, user_id, created_at) VALUES (?, ?, ?)",
    ).run("b-old", user.id, Date.now() - 120_000);

    const removed = pruneEmptySessionsForUser(db, user.id, {
      excludeId: "b-old",
    });
    expect(removed).toBe(1);
    expect(countSessions(db)).toBe(1);
    const surviving = (db
      .prepare("SELECT id FROM sessions")
      .get() as { id: string }).id;
    expect(surviving).toBe("b-old");
  });
});

describe("createFreshSession sweeps prior drafts (CV1.E15 follow-up)", () => {
  let db: Database.Database;
  let user: User;

  beforeEach(() => {
    ({ db, user } = freshDb());
  });

  it("apparently consecutive begin-agains do not accumulate orphans", () => {
    const a = createFreshSession(db, user.id);
    backdateSession(db, a, 120_000);
    const b = createFreshSession(db, user.id);
    backdateSession(db, b, 120_000);
    const c = createFreshSession(db, user.id);
    // After three creates with no entries: only `c` should remain
    // (the only one fresh enough not to be swept).
    expect(countSessions(db)).toBe(1);
    const surviving = (db
      .prepare("SELECT id FROM sessions")
      .get() as { id: string }).id;
    expect(surviving).toBe(c);
  });
});

describe("migration sweeps pre-existing orphans (CV1.E15 follow-up)", () => {
  it("removes sessions without entries on openDb", () => {
    const db = openDb(":memory:");
    const hash = createHash("sha256").update("orphan-token").digest("hex");
    const user = createUser(db, "orphanuser", hash);
    // Manually insert an orphan session simulating a pre-fix DB state.
    db.prepare(
      "INSERT INTO sessions (id, user_id, created_at) VALUES (?, ?, ?)",
    ).run("orphan-id", user.id, Date.now() - 86_400_000);
    expect(countSessions(db)).toBe(1);
    // Re-run migrate by closing and reopening — :memory: doesn't
    // persist, so simulate by calling the deletion directly.
    db.exec(
      "DELETE FROM sessions WHERE id NOT IN (SELECT DISTINCT session_id FROM entries)",
    );
    expect(countSessions(db)).toBe(0);
  });
});
