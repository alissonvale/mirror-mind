import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import {
  openDb,
  createUser,
  appendEntry,
  setIdentityLayer,
  createOrganization,
  createJourney,
  createSessionAt,
} from "../server/db.js";
import {
  getLatestOrganizationSessions,
  getLatestJourneySessions,
  getOrganizationSessions,
  getJourneySessions,
} from "../server/scope-sessions.js";

function freshDb(): Database.Database {
  return openDb(":memory:");
}

function makeImportedSession(
  db: Database.Database,
  userId: string,
  title: string,
  ts: number,
  opts: { org?: string; journey?: string; persona?: string; userMsg?: string; assistantMsg?: string },
) {
  const sessionId = createSessionAt(db, userId, title, ts);
  const userData = {
    role: "user",
    content: [{ type: "text", text: opts.userMsg ?? "hi" }],
    timestamp: ts,
  };
  const assistantData: Record<string, unknown> = {
    role: "assistant",
    content: [{ type: "text", text: opts.assistantMsg ?? "hello" }],
    timestamp: ts + 1,
  };
  if (opts.persona) assistantData._persona = opts.persona;
  if (opts.org) assistantData._organization = opts.org;
  if (opts.journey) assistantData._journey = opts.journey;
  appendEntry(db, sessionId, null, "message", userData, ts);
  appendEntry(db, sessionId, null, "message", assistantData, ts + 1);
  return sessionId;
}

describe("getOrganizationSessions", () => {
  it("returns all sessions tagged to one organization, most recent first", () => {
    const db = freshDb();
    const user = createUser(db, "alisson", "h");
    setIdentityLayer(db, user.id, "persona", "estrategista", "...");
    createOrganization(db, user.id, "software-zen", "Software Zen");

    const s1 = makeImportedSession(db, user.id, "First", 1000, {
      org: "software-zen",
      persona: "estrategista",
      userMsg: "talk about pricing",
    });
    const s2 = makeImportedSession(db, user.id, "Second", 2000, {
      org: "software-zen",
      persona: "estrategista",
      userMsg: "talk about positioning",
    });
    const s3 = makeImportedSession(db, user.id, "Third", 3000, {
      org: "software-zen",
      persona: "estrategista",
      userMsg: "talk about hiring",
    });

    const list = getOrganizationSessions(db, user.id, "software-zen");
    expect(list).toHaveLength(3);
    expect(list[0]!.sessionId).toBe(s3);
    expect(list[1]!.sessionId).toBe(s2);
    expect(list[2]!.sessionId).toBe(s1);
    expect(list[0]!.title).toBe("Third");
    expect(list[0]!.personaKey).toBe("estrategista");
    expect(list[0]!.firstUserPreview).toBe("talk about hiring");
  });

  it("does not return sessions tagged to other organizations", () => {
    const db = freshDb();
    const user = createUser(db, "alisson", "h");
    setIdentityLayer(db, user.id, "persona", "estrategista", "...");
    createOrganization(db, user.id, "software-zen", "Software Zen");
    createOrganization(db, user.id, "nova-acropole", "Nova Acrópole");

    makeImportedSession(db, user.id, "SZ", 1000, {
      org: "software-zen",
      persona: "estrategista",
    });
    makeImportedSession(db, user.id, "NA", 2000, {
      org: "nova-acropole",
      persona: "estrategista",
    });

    const sz = getOrganizationSessions(db, user.id, "software-zen");
    expect(sz).toHaveLength(1);
    expect(sz[0]!.title).toBe("SZ");
  });

  it("returns empty list when scope has no tagged sessions", () => {
    const db = freshDb();
    const user = createUser(db, "alisson", "h");
    createOrganization(db, user.id, "empty-org", "Empty");
    const list = getOrganizationSessions(db, user.id, "empty-org");
    expect(list).toEqual([]);
  });

  it("isolates sessions per user", () => {
    const db = freshDb();
    const u1 = createUser(db, "alice", "h1");
    const u2 = createUser(db, "bob", "h2");
    setIdentityLayer(db, u1.id, "persona", "estrategista", "...");
    setIdentityLayer(db, u2.id, "persona", "estrategista", "...");
    createOrganization(db, u1.id, "shared-key", "Alice's Org");
    createOrganization(db, u2.id, "shared-key", "Bob's Org");

    makeImportedSession(db, u1.id, "Alice S", 1000, {
      org: "shared-key",
      persona: "estrategista",
    });
    makeImportedSession(db, u2.id, "Bob S", 2000, {
      org: "shared-key",
      persona: "estrategista",
    });

    const alice = getOrganizationSessions(db, u1.id, "shared-key");
    expect(alice).toHaveLength(1);
    expect(alice[0]!.title).toBe("Alice S");
  });

  it("uses last activity (max entry timestamp) for ordering", () => {
    const db = freshDb();
    const user = createUser(db, "alisson", "h");
    setIdentityLayer(db, user.id, "persona", "estrategista", "...");
    createOrganization(db, user.id, "org", "Org");

    // s1 created first but with later activity
    const s1 = createSessionAt(db, user.id, "S1", 1000);
    appendEntry(db, s1, null, "message", {
      role: "user", content: [{ type: "text", text: "x" }], timestamp: 1000,
    }, 1000);
    appendEntry(db, s1, null, "message", {
      role: "assistant", content: [{ type: "text", text: "y" }], _persona: "estrategista", _organization: "org", timestamp: 5000,
    }, 5000);

    // s2 created later but no follow-up
    const s2 = createSessionAt(db, user.id, "S2", 2000);
    appendEntry(db, s2, null, "message", {
      role: "user", content: [{ type: "text", text: "x" }], timestamp: 2000,
    }, 2000);
    appendEntry(db, s2, null, "message", {
      role: "assistant", content: [{ type: "text", text: "y" }], _persona: "estrategista", _organization: "org", timestamp: 2001,
    }, 2001);

    const list = getOrganizationSessions(db, user.id, "org");
    expect(list).toHaveLength(2);
    expect(list[0]!.sessionId).toBe(s1); // s1's last activity (5000) > s2's (2001)
    expect(list[0]!.lastActivityAt).toBe(5000);
  });

  it("truncates long previews with an ellipsis", () => {
    const db = freshDb();
    const user = createUser(db, "alisson", "h");
    setIdentityLayer(db, user.id, "persona", "estrategista", "...");
    createOrganization(db, user.id, "org", "Org");

    const long = "a".repeat(200);
    makeImportedSession(db, user.id, "Long", 1000, {
      org: "org",
      persona: "estrategista",
      userMsg: long,
    });

    const list = getOrganizationSessions(db, user.id, "org");
    expect(list[0]!.firstUserPreview!.length).toBeLessThanOrEqual(140);
    expect(list[0]!.firstUserPreview!.endsWith("…")).toBe(true);
  });

  it("collapses internal whitespace in previews", () => {
    const db = freshDb();
    const user = createUser(db, "alisson", "h");
    setIdentityLayer(db, user.id, "persona", "estrategista", "...");
    createOrganization(db, user.id, "org", "Org");

    makeImportedSession(db, user.id, "Multi", 1000, {
      org: "org",
      persona: "estrategista",
      userMsg: "first line\n\nsecond line\n   third line",
    });

    const list = getOrganizationSessions(db, user.id, "org");
    expect(list[0]!.firstUserPreview).toBe("first line second line third line");
  });
});

describe("getJourneySessions", () => {
  it("returns sessions tagged to one journey", () => {
    const db = freshDb();
    const user = createUser(db, "alisson", "h");
    setIdentityLayer(db, user.id, "persona", "estrategista", "...");
    createJourney(db, user.id, "o-espelho", "O Espelho");

    makeImportedSession(db, user.id, "A", 1000, {
      journey: "o-espelho",
      persona: "estrategista",
    });
    makeImportedSession(db, user.id, "B", 2000, {
      journey: "o-espelho",
      persona: "estrategista",
    });

    const list = getJourneySessions(db, user.id, "o-espelho");
    expect(list).toHaveLength(2);
    expect(list[0]!.title).toBe("B");
  });
});

describe("getLatestOrganizationSessions and getLatestJourneySessions (S7 carryover)", () => {
  // Sanity: the S7 helpers still work after S5 added more functions to the file.
  it("returns the most recent session per scope key", () => {
    const db = freshDb();
    const user = createUser(db, "alisson", "h");
    setIdentityLayer(db, user.id, "persona", "estrategista", "...");
    createOrganization(db, user.id, "o1", "O1");
    createOrganization(db, user.id, "o2", "O2");

    makeImportedSession(db, user.id, "O1-old", 1000, {
      org: "o1", persona: "estrategista",
    });
    makeImportedSession(db, user.id, "O1-new", 3000, {
      org: "o1", persona: "estrategista",
    });
    makeImportedSession(db, user.id, "O2-only", 2000, {
      org: "o2", persona: "estrategista",
    });

    const latest = getLatestOrganizationSessions(db, user.id);
    expect(latest.size).toBe(2);
    expect(latest.get("o1")!.title).toBe("O1-new");
    expect(latest.get("o2")!.title).toBe("O2-only");
  });
});
