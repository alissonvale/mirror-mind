import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import {
  openDb,
  createUser,
  getUserByTokenHash,
  getUserByName,
  setIdentityLayer,
  getIdentityLayers,
  getOrCreateSession,
  loadMessages,
  appendEntry,
} from "../server/db.js";

function freshDb(): Database.Database {
  return openDb(":memory:");
}

describe("openDb", () => {
  it("creates all expected tables", () => {
    const db = freshDb();
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
      )
      .all() as { name: string }[];
    const names = tables.map((t) => t.name);
    expect(names).toContain("users");
    expect(names).toContain("identity");
    expect(names).toContain("sessions");
    expect(names).toContain("entries");
    expect(names).toContain("telegram_users");
  });

  it("is idempotent", () => {
    const db = freshDb();
    // calling openDb logic again on same db should not throw
    db.exec(
      "CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, token_hash TEXT NOT NULL, created_at INTEGER NOT NULL)",
    );
  });
});

describe("createUser", () => {
  let db: Database.Database;
  beforeEach(() => {
    db = freshDb();
  });

  it("creates user and returns complete object", () => {
    const user = createUser(db, "alice", "hash123");
    expect(user.name).toBe("alice");
    expect(user.token_hash).toBe("hash123");
    expect(user.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(user.created_at).toBeGreaterThan(0);
  });

  it("rejects duplicate name", () => {
    createUser(db, "alice", "hash1");
    expect(() => createUser(db, "alice", "hash2")).toThrow();
  });
});

describe("getUserByTokenHash", () => {
  let db: Database.Database;
  beforeEach(() => {
    db = freshDb();
  });

  it("returns user when hash matches", () => {
    const created = createUser(db, "alice", "hash123");
    const found = getUserByTokenHash(db, "hash123");
    expect(found).toBeDefined();
    expect(found!.id).toBe(created.id);
  });

  it("returns undefined when hash does not match", () => {
    createUser(db, "alice", "hash123");
    expect(getUserByTokenHash(db, "wrong")).toBeUndefined();
  });
});

describe("getUserByName", () => {
  let db: Database.Database;
  beforeEach(() => {
    db = freshDb();
  });

  it("returns user when name matches", () => {
    const created = createUser(db, "alice", "hash123");
    const found = getUserByName(db, "alice");
    expect(found).toBeDefined();
    expect(found!.id).toBe(created.id);
  });

  it("returns undefined when name does not exist", () => {
    expect(getUserByName(db, "nobody")).toBeUndefined();
  });
});

describe("setIdentityLayer", () => {
  let db: Database.Database;
  let userId: string;
  beforeEach(() => {
    db = freshDb();
    userId = createUser(db, "alice", "hash123").id;
  });

  it("creates new identity layer", () => {
    const layer = setIdentityLayer(db, userId, "self", "soul", "I am.");
    expect(layer.layer).toBe("self");
    expect(layer.key).toBe("soul");
    expect(layer.content).toBe("I am.");
    expect(layer.user_id).toBe(userId);
  });

  it("upserts existing layer", () => {
    setIdentityLayer(db, userId, "self", "soul", "v1");
    const updated = setIdentityLayer(db, userId, "self", "soul", "v2");
    expect(updated.content).toBe("v2");

    const layers = getIdentityLayers(db, userId);
    expect(layers).toHaveLength(1);
  });
});

describe("getIdentityLayers", () => {
  let db: Database.Database;
  beforeEach(() => {
    db = freshDb();
  });

  it("returns empty array for user with no layers", () => {
    const user = createUser(db, "alice", "hash123");
    expect(getIdentityLayers(db, user.id)).toEqual([]);
  });

  it("returns layers ordered by layer then key", () => {
    const user = createUser(db, "alice", "hash123");
    setIdentityLayer(db, user.id, "self", "soul", "soul content");
    setIdentityLayer(db, user.id, "ego", "identity", "identity content");
    setIdentityLayer(db, user.id, "ego", "behavior", "behavior content");

    const layers = getIdentityLayers(db, user.id);
    expect(layers).toHaveLength(3);
    expect(layers[0].layer).toBe("ego");
    expect(layers[0].key).toBe("behavior");
    expect(layers[1].layer).toBe("ego");
    expect(layers[1].key).toBe("identity");
    expect(layers[2].layer).toBe("self");
    expect(layers[2].key).toBe("soul");
  });

  it("does not return layers from other users", () => {
    const alice = createUser(db, "alice", "hash1");
    const bob = createUser(db, "bob", "hash2");
    setIdentityLayer(db, alice.id, "self", "soul", "alice soul");
    setIdentityLayer(db, bob.id, "self", "soul", "bob soul");

    const aliceLayers = getIdentityLayers(db, alice.id);
    expect(aliceLayers).toHaveLength(1);
    expect(aliceLayers[0].content).toBe("alice soul");
  });
});

describe("getOrCreateSession", () => {
  let db: Database.Database;
  let userId: string;
  beforeEach(() => {
    db = freshDb();
    userId = createUser(db, "alice", "hash123").id;
  });

  it("creates session when none exists", () => {
    const sessionId = getOrCreateSession(db, userId);
    expect(sessionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it("returns existing session", () => {
    const first = getOrCreateSession(db, userId);
    const second = getOrCreateSession(db, userId);
    expect(second).toBe(first);
  });
});

describe("appendEntry + loadMessages", () => {
  let db: Database.Database;
  let sessionId: string;
  beforeEach(() => {
    db = freshDb();
    const userId = createUser(db, "alice", "hash123").id;
    sessionId = getOrCreateSession(db, userId);
  });

  it("round-trips a message", () => {
    const msg = { role: "user", content: "hello" };
    appendEntry(db, sessionId, null, "message", msg);
    const messages = loadMessages(db, sessionId);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toEqual(msg);
  });

  it("returns messages in timestamp order", () => {
    appendEntry(db, sessionId, null, "message", { role: "user", content: "first" });
    appendEntry(db, sessionId, null, "message", { role: "assistant", content: "second" });
    const messages = loadMessages(db, sessionId);
    expect(messages).toHaveLength(2);
    expect((messages[0] as { content: string }).content).toBe("first");
    expect((messages[1] as { content: string }).content).toBe("second");
  });

  it("only returns message type entries", () => {
    appendEntry(db, sessionId, null, "message", { role: "user", content: "hi" });
    appendEntry(db, sessionId, null, "compaction", { summary: "..." });
    const messages = loadMessages(db, sessionId);
    expect(messages).toHaveLength(1);
  });

  it("only returns entries for the given session", () => {
    const db2 = freshDb();
    const user = createUser(db2, "alice", "h1");
    const s1 = getOrCreateSession(db2, user.id);

    // force a second session
    const s2Id = "session-2";
    db2.prepare(
      "INSERT INTO sessions (id, user_id, created_at) VALUES (?, ?, ?)",
    ).run(s2Id, user.id, Date.now());

    appendEntry(db2, s1, null, "message", { content: "s1" });
    appendEntry(db2, s2Id, null, "message", { content: "s2" });

    expect(loadMessages(db2, s1)).toHaveLength(1);
    expect(loadMessages(db2, s2Id)).toHaveLength(1);
  });

  it("returns the new entry id", () => {
    const id = appendEntry(db, sessionId, null, "message", { role: "user" });
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });
});
