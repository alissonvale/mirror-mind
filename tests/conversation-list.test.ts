import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import {
  openDb,
  createUser,
  setIdentityLayer,
  appendEntry,
  createOrganization,
  createJourney,
  createSessionAt,
} from "../server/db.js";
import { getConversationsList } from "../server/conversation-list.js";

function freshDb(): Database.Database {
  return openDb(":memory:");
}

interface MakeOpts {
  ts: number;
  title?: string;
  persona?: string;
  org?: string;
  journey?: string;
  userMsg?: string;
  assistantMsg?: string;
}

function makeSession(db: Database.Database, userId: string, opts: MakeOpts) {
  const sessionId = createSessionAt(db, userId, opts.title ?? null, opts.ts);
  const userData = {
    role: "user",
    content: [{ type: "text", text: opts.userMsg ?? "hello" }],
    timestamp: opts.ts,
  };
  const assistantData: Record<string, unknown> = {
    role: "assistant",
    content: [{ type: "text", text: opts.assistantMsg ?? "hi" }],
    timestamp: opts.ts + 1,
  };
  if (opts.persona) assistantData._persona = opts.persona;
  if (opts.org) assistantData._organization = opts.org;
  if (opts.journey) assistantData._journey = opts.journey;
  appendEntry(db, sessionId, null, "message", userData, opts.ts);
  appendEntry(db, sessionId, null, "message", assistantData, opts.ts + 1);
  return sessionId;
}

function setupAlisson(db: Database.Database) {
  const user = createUser(db, "alisson", "h");
  setIdentityLayer(db, user.id, "persona", "estrategista", "...");
  setIdentityLayer(db, user.id, "persona", "divulgadora", "...");
  createOrganization(db, user.id, "software-zen", "Software Zen");
  createOrganization(db, user.id, "nova-acropole", "Nova Acrópole");
  createJourney(db, user.id, "o-espelho", "O Espelho");
  return user;
}

describe("getConversationsList", () => {
  it("returns all sessions for a user, most recent first, with no filters", () => {
    const db = freshDb();
    const user = setupAlisson(db);

    const s1 = makeSession(db, user.id, { ts: 1000, title: "First", persona: "estrategista", org: "software-zen" });
    const s2 = makeSession(db, user.id, { ts: 2000, title: "Second", persona: "divulgadora" });
    const s3 = makeSession(db, user.id, { ts: 3000, title: "Third", persona: "estrategista", org: "software-zen", journey: "o-espelho" });

    const result = getConversationsList(db, user.id);
    expect(result.total).toBe(3);
    expect(result.rows).toHaveLength(3);
    expect(result.rows[0]!.sessionId).toBe(s3);
    expect(result.rows[1]!.sessionId).toBe(s2);
    expect(result.rows[2]!.sessionId).toBe(s1);
  });

  it("filters by personaKey", () => {
    const db = freshDb();
    const user = setupAlisson(db);
    makeSession(db, user.id, { ts: 1000, title: "A", persona: "estrategista" });
    makeSession(db, user.id, { ts: 2000, title: "B", persona: "divulgadora" });
    makeSession(db, user.id, { ts: 3000, title: "C", persona: "estrategista" });

    const result = getConversationsList(db, user.id, { personaKey: "estrategista" });
    expect(result.total).toBe(2);
    expect(result.rows.map((r) => r.title)).toEqual(["C", "A"]);
  });

  it("filters by organizationKey", () => {
    const db = freshDb();
    const user = setupAlisson(db);
    makeSession(db, user.id, { ts: 1000, title: "A", persona: "estrategista", org: "software-zen" });
    makeSession(db, user.id, { ts: 2000, title: "B", persona: "estrategista", org: "nova-acropole" });
    makeSession(db, user.id, { ts: 3000, title: "C", persona: "estrategista" });

    const result = getConversationsList(db, user.id, { organizationKey: "software-zen" });
    expect(result.total).toBe(1);
    expect(result.rows[0]!.title).toBe("A");
  });

  it("filters by journeyKey", () => {
    const db = freshDb();
    const user = setupAlisson(db);
    makeSession(db, user.id, { ts: 1000, title: "A", persona: "estrategista", journey: "o-espelho" });
    makeSession(db, user.id, { ts: 2000, title: "B", persona: "estrategista" });

    const result = getConversationsList(db, user.id, { journeyKey: "o-espelho" });
    expect(result.total).toBe(1);
    expect(result.rows[0]!.title).toBe("A");
  });

  it("combines multiple filters with AND semantics", () => {
    const db = freshDb();
    const user = setupAlisson(db);
    makeSession(db, user.id, { ts: 1000, title: "A", persona: "estrategista", org: "software-zen" });
    makeSession(db, user.id, { ts: 2000, title: "B", persona: "divulgadora", org: "software-zen" });
    makeSession(db, user.id, { ts: 3000, title: "C", persona: "estrategista", org: "nova-acropole" });

    const result = getConversationsList(db, user.id, {
      personaKey: "estrategista",
      organizationKey: "software-zen",
    });
    expect(result.total).toBe(1);
    expect(result.rows[0]!.title).toBe("A");
  });

  it("paginates with limit and offset", () => {
    const db = freshDb();
    const user = setupAlisson(db);
    for (let i = 0; i < 7; i++) {
      makeSession(db, user.id, { ts: 1000 * (i + 1), title: `S${i}`, persona: "estrategista" });
    }

    const page1 = getConversationsList(db, user.id, { limit: 3, offset: 0 });
    expect(page1.total).toBe(7);
    expect(page1.rows).toHaveLength(3);
    expect(page1.rows.map((r) => r.title)).toEqual(["S6", "S5", "S4"]);

    const page2 = getConversationsList(db, user.id, { limit: 3, offset: 3 });
    expect(page2.rows.map((r) => r.title)).toEqual(["S3", "S2", "S1"]);

    const page3 = getConversationsList(db, user.id, { limit: 3, offset: 6 });
    expect(page3.rows.map((r) => r.title)).toEqual(["S0"]);
  });

  it("returns scope keys for the row badges", () => {
    const db = freshDb();
    const user = setupAlisson(db);
    makeSession(db, user.id, {
      ts: 1000,
      title: "X",
      persona: "estrategista",
      org: "software-zen",
      journey: "o-espelho",
    });

    const result = getConversationsList(db, user.id);
    expect(result.rows[0]!.personaKey).toBe("estrategista");
    expect(result.rows[0]!.organizationKey).toBe("software-zen");
    expect(result.rows[0]!.journeyKey).toBe("o-espelho");
  });

  it("excludes sessions without any assistant message", () => {
    const db = freshDb();
    const user = setupAlisson(db);

    // session with no assistant message — should be excluded
    const orphan = createSessionAt(db, user.id, "Orphan", 1000);
    appendEntry(db, orphan, null, "message", {
      role: "user",
      content: [{ type: "text", text: "lonely" }],
      timestamp: 1000,
    }, 1000);

    // session with both — should appear
    makeSession(db, user.id, { ts: 2000, title: "Real", persona: "estrategista" });

    const result = getConversationsList(db, user.id);
    expect(result.total).toBe(1);
    expect(result.rows[0]!.title).toBe("Real");
  });

  it("isolates sessions per user", () => {
    const db = freshDb();
    const u1 = createUser(db, "alice", "h1");
    const u2 = createUser(db, "bob", "h2");
    setIdentityLayer(db, u1.id, "persona", "p", "...");
    setIdentityLayer(db, u2.id, "persona", "p", "...");

    makeSession(db, u1.id, { ts: 1000, title: "Alice", persona: "p" });
    makeSession(db, u2.id, { ts: 2000, title: "Bob", persona: "p" });

    const aliceList = getConversationsList(db, u1.id);
    expect(aliceList.total).toBe(1);
    expect(aliceList.rows[0]!.title).toBe("Alice");

    const bobList = getConversationsList(db, u2.id);
    expect(bobList.total).toBe(1);
    expect(bobList.rows[0]!.title).toBe("Bob");
  });

  it("uses last activity (max entry timestamp) for ordering, not session created_at", () => {
    const db = freshDb();
    const user = setupAlisson(db);

    // Old session whose last entry is recent
    const sOld = createSessionAt(db, user.id, "Old", 1000);
    appendEntry(db, sOld, null, "message", {
      role: "user", content: [{ type: "text", text: "x" }], timestamp: 1000,
    }, 1000);
    appendEntry(db, sOld, null, "message", {
      role: "assistant", content: [{ type: "text", text: "y" }],
      _persona: "estrategista", timestamp: 9000,
    }, 9000);

    // Newer session, no recent activity
    const sNew = createSessionAt(db, user.id, "New", 5000);
    appendEntry(db, sNew, null, "message", {
      role: "user", content: [{ type: "text", text: "x" }], timestamp: 5000,
    }, 5000);
    appendEntry(db, sNew, null, "message", {
      role: "assistant", content: [{ type: "text", text: "y" }],
      _persona: "estrategista", timestamp: 5001,
    }, 5001);

    const result = getConversationsList(db, user.id);
    expect(result.rows[0]!.title).toBe("Old"); // 9000 > 5001
    expect(result.rows[0]!.lastActivityAt).toBe(9000);
  });

  it("truncates long previews with ellipsis", () => {
    const db = freshDb();
    const user = setupAlisson(db);
    const long = "x".repeat(200);
    makeSession(db, user.id, { ts: 1000, title: "L", persona: "estrategista", userMsg: long });

    const result = getConversationsList(db, user.id);
    expect(result.rows[0]!.firstUserPreview!.length).toBeLessThanOrEqual(140);
    expect(result.rows[0]!.firstUserPreview!.endsWith("…")).toBe(true);
  });

  it("returns empty result when no sessions match filters", () => {
    const db = freshDb();
    const user = setupAlisson(db);
    makeSession(db, user.id, { ts: 1000, title: "A", persona: "estrategista" });

    const result = getConversationsList(db, user.id, { personaKey: "ghost" });
    expect(result.total).toBe(0);
    expect(result.rows).toEqual([]);
  });
});
