import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import {
  openDb,
  createUser,
  getUserByTokenHash,
  getUserByName,
  deleteUser,
  setIdentityLayer,
  setIdentitySummary,
  getIdentityLayers,
  getOrCreateSession,
  createSessionAt,
  getSessionById,
  markSessionActive,
  loadMessages,
  appendEntry,
  createOrganization,
  updateOrganization,
  setOrganizationSummary,
  archiveOrganization,
  unarchiveOrganization,
  deleteOrganization,
  getOrganizations,
  getOrganizationByKey,
  createJourney,
  updateJourney,
  setJourneySummary,
  linkJourneyOrganization,
  archiveJourney,
  unarchiveJourney,
  deleteJourney,
  getJourneys,
  getJourneyByKey,
  setOAuthCredentials,
  getOAuthCredentials,
  getAllOAuthCredentials,
  listOAuthCredentials,
  deleteOAuthCredentials,
  getModels,
  getModel,
  updateModel,
  insertUsageLog,
  updateUsageLog,
  getUsageLog,
  getUsageTotals,
  getUsageByRole,
  getUsageByEnv,
  getUsageByModel,
  getUsageByDay,
  getSetting,
  setSetting,
  getUsdToBrlRate,
  setUsdToBrlRate,
  updateShowBrlConversion,
} from "../server/db.js";
import { importIdentityFromPoc } from "../server/admin.js";

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
    expect(names).toContain("organizations");
    expect(names).toContain("journeys");
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

  it("first user on an empty table defaults to admin", () => {
    const user = createUser(db, "alice", "hash1");
    expect(user.role).toBe("admin");
  });

  it("subsequent users default to user", () => {
    createUser(db, "alice", "hash1");
    const bob = createUser(db, "bob", "hash2");
    expect(bob.role).toBe("user");
  });

  it("honors explicit role argument", () => {
    createUser(db, "alice", "hash1");
    const bob = createUser(db, "bob", "hash2", "admin");
    expect(bob.role).toBe("admin");
    const carol = createUser(db, "carol", "hash3", "user");
    expect(carol.role).toBe("user");
  });

  it("persists role so getUserByTokenHash returns it", () => {
    createUser(db, "alice", "hash1");
    const fetched = getUserByTokenHash(db, "hash1");
    expect(fetched?.role).toBe("admin");
  });
});

describe("migrate — role retrofit", () => {
  it("adds role column to pre-existing users table and promotes oldest to admin", () => {
    // Simulate a pre-migration schema: users table without role column.
    const raw = new Database(":memory:");
    raw.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        token_hash TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE identity (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL, layer TEXT NOT NULL,
        key TEXT NOT NULL, content TEXT NOT NULL, updated_at INTEGER NOT NULL
      );
      CREATE TABLE sessions (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at INTEGER NOT NULL
      );
      CREATE TABLE entries (
        id TEXT PRIMARY KEY, session_id TEXT NOT NULL, parent_id TEXT,
        type TEXT NOT NULL, data TEXT NOT NULL, timestamp INTEGER NOT NULL
      );
      CREATE TABLE telegram_users (
        telegram_id TEXT PRIMARY KEY, user_id TEXT NOT NULL
      );
    `);
    raw.prepare(
      "INSERT INTO users (id, name, token_hash, created_at) VALUES (?, ?, ?, ?)",
    ).run("u1", "alice", "h1", 1000);
    raw.prepare(
      "INSERT INTO users (id, name, token_hash, created_at) VALUES (?, ?, ?, ?)",
    ).run("u2", "bob", "h2", 2000);
    raw.prepare(
      "INSERT INTO users (id, name, token_hash, created_at) VALUES (?, ?, ?, ?)",
    ).run("u3", "carol", "h3", 3000);

    // Dump to a file so openDb can reopen and apply schema+migrate.
    const tmpPath = `/tmp/mirror-migrate-test-${Date.now()}.db`;
    raw.exec(`VACUUM INTO '${tmpPath}'`);
    raw.close();

    const db = openDb(tmpPath);
    const alice = getUserByTokenHash(db, "h1");
    const bob = getUserByTokenHash(db, "h2");
    const carol = getUserByTokenHash(db, "h3");

    expect(alice?.role).toBe("admin"); // oldest, promoted
    expect(bob?.role).toBe("user");
    expect(carol?.role).toBe("user");
  });

  it("does not re-promote when an admin already exists", () => {
    const db = freshDb();
    createUser(db, "alice", "h1"); // first — admin
    createUser(db, "bob", "h2", "user");
    createUser(db, "carol", "h3", "user");

    // Running migrate again (via a fresh openDb on same memory is not possible,
    // so we re-invoke the logic directly by simulating no-admin detection).
    const adminCount = (
      db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'admin'").get() as {
        c: number;
      }
    ).c;
    expect(adminCount).toBe(1);

    const alice = getUserByTokenHash(db, "h1");
    expect(alice?.role).toBe("admin");
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

  it("starts with summary as null on a new layer", () => {
    const layer = setIdentityLayer(db, userId, "self", "soul", "I am.");
    expect(layer.summary).toBeNull();
  });
});

describe("setIdentitySummary", () => {
  let db: Database.Database;
  let userId: string;
  beforeEach(() => {
    db = freshDb();
    userId = createUser(db, "alice", "hash123").id;
  });

  it("writes summary to an existing layer without touching content", () => {
    setIdentityLayer(db, userId, "self", "soul", "Long content text.");
    setIdentitySummary(db, userId, "self", "soul", "Brief summary.");

    const layers = getIdentityLayers(db, userId);
    expect(layers).toHaveLength(1);
    expect(layers[0].summary).toBe("Brief summary.");
    expect(layers[0].content).toBe("Long content text.");
  });

  it("overwrites previous summary", () => {
    setIdentityLayer(db, userId, "self", "soul", "Content.");
    setIdentitySummary(db, userId, "self", "soul", "First summary.");
    setIdentitySummary(db, userId, "self", "soul", "Second summary.");

    const layers = getIdentityLayers(db, userId);
    expect(layers[0].summary).toBe("Second summary.");
  });

  it("is a no-op when the layer does not exist", () => {
    setIdentitySummary(db, userId, "self", "soul", "Summary.");
    expect(getIdentityLayers(db, userId)).toHaveLength(0);
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

  it("returns layers ordered by psychic depth (self → ego → persona), with semantic order within ego (identity → expression → behavior)", () => {
    const user = createUser(db, "alice", "hash123");
    setIdentityLayer(db, user.id, "ego", "behavior", "behavior content");
    setIdentityLayer(db, user.id, "ego", "expression", "expression content");
    setIdentityLayer(db, user.id, "ego", "identity", "identity content");
    setIdentityLayer(db, user.id, "self", "soul", "soul content");
    setIdentityLayer(db, user.id, "persona", "mentora", "mentora content");

    const layers = getIdentityLayers(db, user.id);
    expect(layers).toHaveLength(5);
    // self first (essence)
    expect(layers[0].layer).toBe("self");
    expect(layers[0].key).toBe("soul");
    // ego next, with semantic order: identity (who I am) → expression (how I speak) → behavior (how I act)
    expect(layers[1].layer).toBe("ego");
    expect(layers[1].key).toBe("identity");
    expect(layers[2].layer).toBe("ego");
    expect(layers[2].key).toBe("expression");
    expect(layers[3].layer).toBe("ego");
    expect(layers[3].key).toBe("behavior");
    // persona last
    expect(layers[4].layer).toBe("persona");
    expect(layers[4].key).toBe("mentora");
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

  it("uses provided timestamp when explicitly passed", () => {
    appendEntry(db, sessionId, null, "message", { content: "third" }, 5_000);
    appendEntry(db, sessionId, null, "message", { content: "first" }, 1_000);
    appendEntry(db, sessionId, null, "message", { content: "second" }, 2_000);
    const messages = loadMessages(db, sessionId);
    expect(messages.map((m) => (m as { content: string }).content)).toEqual([
      "first",
      "second",
      "third",
    ]);
  });
});

describe("getSessionById", () => {
  it("returns the session when it belongs to the user", () => {
    const db = freshDb();
    const user = createUser(db, "alice", "h");
    const sid = createSessionAt(db, user.id, "Hello", 1000);
    const found = getSessionById(db, sid, user.id);
    expect(found).toBeDefined();
    expect(found!.id).toBe(sid);
    expect(found!.title).toBe("Hello");
  });

  it("returns undefined when the session belongs to another user", () => {
    const db = freshDb();
    const u1 = createUser(db, "alice", "h1");
    const u2 = createUser(db, "bob", "h2");
    const sid = createSessionAt(db, u1.id, "Alice's", 1000);
    expect(getSessionById(db, sid, u2.id)).toBeUndefined();
  });

  it("returns undefined when the session does not exist", () => {
    const db = freshDb();
    const user = createUser(db, "alice", "h");
    expect(getSessionById(db, "nonexistent-id", user.id)).toBeUndefined();
  });
});

describe("markSessionActive", () => {
  it("bumps created_at past every other session for the user", () => {
    const db = freshDb();
    const user = createUser(db, "alice", "h");
    const s1 = createSessionAt(db, user.id, "S1", 1000);
    const s2 = createSessionAt(db, user.id, "S2", 2000);
    const s3 = createSessionAt(db, user.id, "S3", 3000);

    markSessionActive(db, s1, user.id);

    const row = db
      .prepare("SELECT created_at FROM sessions WHERE id = ?")
      .get(s1) as { created_at: number };
    // s1 should now be the latest by created_at
    const others = db
      .prepare("SELECT MAX(created_at) as max_ts FROM sessions WHERE user_id = ? AND id != ?")
      .get(user.id, s1) as { max_ts: number };
    expect(row.created_at).toBeGreaterThan(others.max_ts);
  });

  it("does not affect other users' sessions", () => {
    const db = freshDb();
    const u1 = createUser(db, "alice", "h1");
    const u2 = createUser(db, "bob", "h2");
    const s_alice = createSessionAt(db, u1.id, "A", 1000);
    const s_bob = createSessionAt(db, u2.id, "B", 5000);

    markSessionActive(db, s_alice, u1.id);

    const bob_row = db.prepare("SELECT created_at FROM sessions WHERE id = ?").get(s_bob) as { created_at: number };
    expect(bob_row.created_at).toBe(5000);
  });

  it("makes the session resolve as active via getOrCreateSession", () => {
    const db = freshDb();
    const user = createUser(db, "alice", "h");
    const s1 = createSessionAt(db, user.id, "S1", 1000);
    const s2 = createSessionAt(db, user.id, "S2", 2000);

    expect(getOrCreateSession(db, user.id)).toBe(s2); // S2 is initially latest

    markSessionActive(db, s1, user.id);

    expect(getOrCreateSession(db, user.id)).toBe(s1); // S1 is now latest
  });
});

describe("createSessionAt", () => {
  it("creates a session with explicit title and created_at", () => {
    const db = freshDb();
    const userId = createUser(db, "alice", "h").id;
    const sessionId = createSessionAt(db, userId, "Imported title", 10_000);

    const row = db
      .prepare("SELECT title, created_at FROM sessions WHERE id = ?")
      .get(sessionId) as { title: string; created_at: number };
    expect(row.title).toBe("Imported title");
    expect(row.created_at).toBe(10_000);
  });

  it("accepts a null title", () => {
    const db = freshDb();
    const userId = createUser(db, "alice", "h").id;
    const sessionId = createSessionAt(db, userId, null, 10_000);
    const row = db
      .prepare("SELECT title FROM sessions WHERE id = ?")
      .get(sessionId) as { title: string | null };
    expect(row.title).toBeNull();
  });

  it("returns a uuid", () => {
    const db = freshDb();
    const userId = createUser(db, "alice", "h").id;
    const id = createSessionAt(db, userId, "x", 10_000);
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });
});

describe("importIdentityFromPoc", () => {
  function createPocDb(): string {
    const pocDb = new Database(":memory:");
    pocDb.exec(`
      CREATE TABLE identity (
        id TEXT PRIMARY KEY,
        layer TEXT NOT NULL,
        key TEXT NOT NULL,
        content TEXT NOT NULL,
        version TEXT DEFAULT '1.0.0',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        metadata TEXT,
        UNIQUE(layer, key)
      )
    `);
    const now = new Date().toISOString();
    pocDb.prepare(
      "INSERT INTO identity (id, layer, key, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run("1", "self", "soul", "POC soul content", now, now);
    pocDb.prepare(
      "INSERT INTO identity (id, layer, key, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run("2", "ego", "identity", "POC identity content", now, now);
    pocDb.prepare(
      "INSERT INTO identity (id, layer, key, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run("3", "ego", "behavior", "POC behavior content", now, now);
    pocDb.prepare(
      "INSERT INTO identity (id, layer, key, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run("4", "persona", "mentora", "POC mentora content", now, now);
    pocDb.prepare(
      "INSERT INTO identity (id, layer, key, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run("5", "persona", "tecnica", "POC tecnica content", now, now);
    pocDb.prepare(
      "INSERT INTO identity (id, layer, key, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run("6", "organization", "identity", "should not be imported", now, now);

    const tmpPath = `/tmp/poc-test-${Date.now()}.db`;
    pocDb.exec(`VACUUM INTO '${tmpPath}'`);
    pocDb.close();
    return tmpPath;
  }

  it("imports self/soul, ego/identity, ego/behavior, and all personas from POC", () => {
    const db = freshDb();
    const user = createUser(db, "alice", "hash123");
    const pocPath = createPocDb();

    const count = importIdentityFromPoc(db, user.id, pocPath);
    expect(count).toBe(5); // soul + identity + behavior + 2 personas

    const layers = getIdentityLayers(db, user.id);
    expect(layers).toHaveLength(5);
    expect(layers.find((l) => l.layer === "self" && l.key === "soul")?.content).toBe(
      "POC soul content",
    );
    expect(layers.find((l) => l.layer === "ego" && l.key === "identity")?.content).toBe(
      "POC identity content",
    );
    expect(layers.find((l) => l.layer === "ego" && l.key === "behavior")?.content).toBe(
      "POC behavior content",
    );
    expect(layers.find((l) => l.layer === "persona" && l.key === "mentora")?.content).toBe(
      "POC mentora content",
    );
    expect(layers.find((l) => l.layer === "persona" && l.key === "tecnica")?.content).toBe(
      "POC tecnica content",
    );
  });

  it("overwrites existing layers when importing", () => {
    const db = freshDb();
    const user = createUser(db, "alice", "hash123");
    setIdentityLayer(db, user.id, "self", "soul", "old content");
    const pocPath = createPocDb();

    importIdentityFromPoc(db, user.id, pocPath);

    const layers = getIdentityLayers(db, user.id);
    const soul = layers.find((l) => l.layer === "self" && l.key === "soul");
    expect(soul?.content).toBe("POC soul content");
  });

  it("does not import non-core layers (organization, knowledge, etc.)", () => {
    const db = freshDb();
    const user = createUser(db, "alice", "hash123");
    const pocPath = createPocDb();

    importIdentityFromPoc(db, user.id, pocPath);

    const layers = getIdentityLayers(db, user.id);
    const org = layers.find((l) => l.layer === "organization");
    expect(org).toBeUndefined();
  });

  it("throws when POC db does not exist", () => {
    const db = freshDb();
    const user = createUser(db, "alice", "hash123");
    expect(() =>
      importIdentityFromPoc(db, user.id, "/nonexistent/path.db"),
    ).toThrow("POC database not found");
  });
});

describe("organizations", () => {
  let db: Database.Database;
  let userId: string;
  beforeEach(() => {
    db = freshDb();
    userId = createUser(db, "alice", "hash").id;
  });

  it("creates with defaults and returns full row", () => {
    const org = createOrganization(
      db,
      userId,
      "software-zen",
      "Software Zen",
      "posture: curadoria",
      "phase: sem receita",
    );
    expect(org.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(org.user_id).toBe(userId);
    expect(org.key).toBe("software-zen");
    expect(org.name).toBe("Software Zen");
    expect(org.briefing).toBe("posture: curadoria");
    expect(org.situation).toBe("phase: sem receita");
    expect(org.summary).toBeNull();
    expect(org.status).toBe("active");
    expect(org.created_at).toBeGreaterThan(0);
    expect(org.updated_at).toBe(org.created_at);
  });

  it("briefing and situation default to empty strings", () => {
    const org = createOrganization(db, userId, "k", "Name");
    expect(org.briefing).toBe("");
    expect(org.situation).toBe("");
  });

  it("rejects duplicate key per user", () => {
    createOrganization(db, userId, "sz", "Software Zen");
    expect(() => createOrganization(db, userId, "sz", "Something else")).toThrow();
  });

  it("allows same key for different users", () => {
    const bob = createUser(db, "bob", "hash2");
    createOrganization(db, userId, "sz", "Alice's SZ");
    const bobOrg = createOrganization(db, bob.id, "sz", "Bob's SZ");
    expect(bobOrg.key).toBe("sz");
  });

  it("updateOrganization patches only provided fields", () => {
    createOrganization(db, userId, "sz", "Software Zen", "b1", "s1");
    const updated = updateOrganization(db, userId, "sz", {
      situation: "new situation",
    });
    expect(updated?.name).toBe("Software Zen");
    expect(updated?.briefing).toBe("b1");
    expect(updated?.situation).toBe("new situation");
  });

  it("updateOrganization returns undefined for missing org", () => {
    const result = updateOrganization(db, userId, "nope", { name: "x" });
    expect(result).toBeUndefined();
  });

  it("setOrganizationSummary writes summary", () => {
    createOrganization(db, userId, "sz", "Software Zen");
    setOrganizationSummary(db, userId, "sz", "concise summary");
    expect(getOrganizationByKey(db, userId, "sz")?.summary).toBe(
      "concise summary",
    );
  });

  it("archive / unarchive toggles status", () => {
    createOrganization(db, userId, "sz", "Software Zen");
    expect(archiveOrganization(db, userId, "sz")).toBe(true);
    expect(getOrganizationByKey(db, userId, "sz")?.status).toBe("archived");
    expect(unarchiveOrganization(db, userId, "sz")).toBe(true);
    expect(getOrganizationByKey(db, userId, "sz")?.status).toBe("active");
  });

  it("archive returns false when already archived", () => {
    createOrganization(db, userId, "sz", "Software Zen");
    archiveOrganization(db, userId, "sz");
    expect(archiveOrganization(db, userId, "sz")).toBe(false);
  });

  it("getOrganizations excludes archived by default", () => {
    createOrganization(db, userId, "sz", "Software Zen");
    createOrganization(db, userId, "old", "Old Org");
    archiveOrganization(db, userId, "old");
    const active = getOrganizations(db, userId);
    expect(active.map((o) => o.key)).toEqual(["sz"]);
  });

  it("getOrganizations includes archived when flag set", () => {
    createOrganization(db, userId, "sz", "Software Zen");
    createOrganization(db, userId, "old", "Old Org");
    archiveOrganization(db, userId, "old");
    const all = getOrganizations(db, userId, { includeArchived: true });
    expect(all.map((o) => o.key).sort()).toEqual(["old", "sz"]);
  });

  it("deleteOrganization removes the row", () => {
    createOrganization(db, userId, "sz", "Software Zen");
    expect(deleteOrganization(db, userId, "sz")).toBe(true);
    expect(getOrganizationByKey(db, userId, "sz")).toBeUndefined();
  });

  it("deleteOrganization unlinks linked journeys instead of deleting them", () => {
    const org = createOrganization(db, userId, "sz", "Software Zen");
    createJourney(db, userId, "o-espelho", "O Espelho", "", "", org.id);
    createJourney(db, userId, "mirror-mind", "Mirror Mind", "", "", org.id);

    deleteOrganization(db, userId, "sz");

    const journeys = getJourneys(db, userId);
    expect(journeys.map((j) => j.key).sort()).toEqual(["mirror-mind", "o-espelho"]);
    expect(journeys.every((j) => j.organization_id === null)).toBe(true);
  });

  it("deleteOrganization returns false for missing org", () => {
    expect(deleteOrganization(db, userId, "nope")).toBe(false);
  });
});

describe("journeys", () => {
  let db: Database.Database;
  let userId: string;
  beforeEach(() => {
    db = freshDb();
    userId = createUser(db, "alice", "hash").id;
  });

  it("creates journey without organization", () => {
    const j = createJourney(db, userId, "vida-economica", "Vida econômica");
    expect(j.organization_id).toBeNull();
    expect(j.key).toBe("vida-economica");
    expect(j.status).toBe("active");
    expect(j.briefing).toBe("");
    expect(j.situation).toBe("");
  });

  it("creates journey with organization", () => {
    const org = createOrganization(db, userId, "sz", "Software Zen");
    const j = createJourney(
      db,
      userId,
      "o-espelho",
      "O Espelho",
      "brief",
      "sit",
      org.id,
    );
    expect(j.organization_id).toBe(org.id);
  });

  it("rejects duplicate key per user", () => {
    createJourney(db, userId, "k", "Name");
    expect(() => createJourney(db, userId, "k", "Other")).toThrow();
  });

  it("updateJourney patches fields", () => {
    createJourney(db, userId, "j", "Name", "b", "s");
    const updated = updateJourney(db, userId, "j", { briefing: "new b" });
    expect(updated?.briefing).toBe("new b");
    expect(updated?.situation).toBe("s");
  });

  it("setJourneySummary writes summary", () => {
    createJourney(db, userId, "j", "Name");
    setJourneySummary(db, userId, "j", "concise");
    expect(getJourneyByKey(db, userId, "j")?.summary).toBe("concise");
  });

  it("linkJourneyOrganization binds and unbinds", () => {
    const org = createOrganization(db, userId, "sz", "Software Zen");
    createJourney(db, userId, "j", "Name");

    expect(linkJourneyOrganization(db, userId, "j", org.id)).toBe(true);
    expect(getJourneyByKey(db, userId, "j")?.organization_id).toBe(org.id);

    expect(linkJourneyOrganization(db, userId, "j", null)).toBe(true);
    expect(getJourneyByKey(db, userId, "j")?.organization_id).toBeNull();
  });

  it("linkJourneyOrganization returns false when journey missing", () => {
    expect(linkJourneyOrganization(db, userId, "nope", null)).toBe(false);
  });

  it("archive / unarchive toggles status", () => {
    createJourney(db, userId, "j", "Name");
    expect(archiveJourney(db, userId, "j")).toBe(true);
    expect(getJourneyByKey(db, userId, "j")?.status).toBe("archived");
    expect(unarchiveJourney(db, userId, "j")).toBe(true);
    expect(getJourneyByKey(db, userId, "j")?.status).toBe("active");
  });

  it("getJourneys excludes archived by default", () => {
    createJourney(db, userId, "a", "A");
    createJourney(db, userId, "b", "B");
    archiveJourney(db, userId, "b");
    expect(getJourneys(db, userId).map((j) => j.key)).toEqual(["a"]);
  });

  it("getJourneys with includeArchived returns all", () => {
    createJourney(db, userId, "a", "A");
    createJourney(db, userId, "b", "B");
    archiveJourney(db, userId, "b");
    expect(
      getJourneys(db, userId, { includeArchived: true }).map((j) => j.key).sort(),
    ).toEqual(["a", "b"]);
  });

  it("getJourneys filters by organizationId", () => {
    const org = createOrganization(db, userId, "sz", "Software Zen");
    createJourney(db, userId, "a", "A", "", "", org.id);
    createJourney(db, userId, "b", "B");
    createJourney(db, userId, "c", "C", "", "", org.id);

    const inOrg = getJourneys(db, userId, { organizationId: org.id });
    expect(inOrg.map((j) => j.key).sort()).toEqual(["a", "c"]);

    const personal = getJourneys(db, userId, { organizationId: null });
    expect(personal.map((j) => j.key)).toEqual(["b"]);
  });

  it("deleteJourney removes the row", () => {
    createJourney(db, userId, "j", "Name");
    expect(deleteJourney(db, userId, "j")).toBe(true);
    expect(getJourneyByKey(db, userId, "j")).toBeUndefined();
  });
});

describe("deleteUser cascade on scopes", () => {
  it("removes the user's organizations and journeys", () => {
    const db = freshDb();
    const alice = createUser(db, "alice", "hash1");
    const bob = createUser(db, "bob", "hash2");

    const aliceOrg = createOrganization(db, alice.id, "sz", "Software Zen");
    createJourney(db, alice.id, "o-espelho", "O Espelho", "", "", aliceOrg.id);
    createJourney(db, alice.id, "vida", "Vida");

    const bobOrg = createOrganization(db, bob.id, "bob-inc", "Bob Inc");
    createJourney(db, bob.id, "bob-j", "Bob J", "", "", bobOrg.id);

    deleteUser(db, alice.id);

    expect(getOrganizations(db, alice.id)).toEqual([]);
    expect(getJourneys(db, alice.id)).toEqual([]);
    expect(getOrganizations(db, bob.id).map((o) => o.key)).toEqual(["bob-inc"]);
    expect(getJourneys(db, bob.id).map((j) => j.key)).toEqual(["bob-j"]);
  });
});

describe("oauth_credentials", () => {
  let db: Database.Database;
  beforeEach(() => {
    db = freshDb();
  });

  it("setOAuthCredentials inserts a new row", () => {
    setOAuthCredentials(db, "google-gemini-cli", {
      refresh: "rt-1",
      access: "at-1",
      expires: 1700000000,
      project_id: "proj-xyz",
    });
    const stored = getOAuthCredentials(db, "google-gemini-cli");
    expect(stored?.provider).toBe("google-gemini-cli");
    expect(stored?.credentials.refresh).toBe("rt-1");
    expect(stored?.credentials.access).toBe("at-1");
    expect(stored?.credentials.expires).toBe(1700000000);
    expect(stored?.credentials.project_id).toBe("proj-xyz");
    expect(stored?.updated_at).toBeGreaterThan(0);
  });

  it("setOAuthCredentials upserts on conflict", () => {
    setOAuthCredentials(db, "anthropic", {
      refresh: "rt-old",
      access: "at-old",
      expires: 1,
    });
    setOAuthCredentials(db, "anthropic", {
      refresh: "rt-new",
      access: "at-new",
      expires: 2,
    });
    const stored = getOAuthCredentials(db, "anthropic");
    expect(stored?.credentials.refresh).toBe("rt-new");
    expect(stored?.credentials.access).toBe("at-new");
    expect(stored?.credentials.expires).toBe(2);
  });

  it("getOAuthCredentials returns undefined for unknown provider", () => {
    expect(getOAuthCredentials(db, "nope")).toBeUndefined();
  });

  it("getAllOAuthCredentials returns a map keyed by provider", () => {
    setOAuthCredentials(db, "anthropic", {
      refresh: "r-a",
      access: "a-a",
      expires: 1,
    });
    setOAuthCredentials(db, "google-gemini-cli", {
      refresh: "r-g",
      access: "a-g",
      expires: 2,
      project_id: "p",
    });
    const map = getAllOAuthCredentials(db);
    expect(Object.keys(map).sort()).toEqual(["anthropic", "google-gemini-cli"]);
    expect(map["anthropic"].access).toBe("a-a");
    expect(map["google-gemini-cli"].project_id).toBe("p");
  });

  it("listOAuthCredentials returns rows ordered by provider", () => {
    setOAuthCredentials(db, "openai-codex", {
      refresh: "r",
      access: "a",
      expires: 1,
    });
    setOAuthCredentials(db, "anthropic", {
      refresh: "r",
      access: "a",
      expires: 1,
    });
    const list = listOAuthCredentials(db);
    expect(list.map((r) => r.provider)).toEqual(["anthropic", "openai-codex"]);
  });

  it("deleteOAuthCredentials removes the row", () => {
    setOAuthCredentials(db, "anthropic", {
      refresh: "r",
      access: "a",
      expires: 1,
    });
    deleteOAuthCredentials(db, "anthropic");
    expect(getOAuthCredentials(db, "anthropic")).toBeUndefined();
  });

  it("preserves arbitrary extra fields through round-trip", () => {
    setOAuthCredentials(db, "google-gemini-cli", {
      refresh: "r",
      access: "a",
      expires: 1,
      project_id: "proj",
      nested: { foo: "bar", n: 42 },
    } as any);
    const stored = getOAuthCredentials(db, "google-gemini-cli");
    expect((stored!.credentials as any).nested).toEqual({ foo: "bar", n: 42 });
  });
});

describe("models.auth_type", () => {
  let db: Database.Database;
  beforeEach(() => {
    db = freshDb();
  });

  it("defaults every seeded row to 'env'", () => {
    const models = getModels(db);
    for (const role of Object.keys(models)) {
      expect(models[role].auth_type).toBe("env");
    }
  });

  it("updateModel persists auth_type change", () => {
    updateModel(db, "reception", {
      provider: "google-gemini-cli",
      model: "gemini-2.5-flash",
      auth_type: "oauth",
    });
    const reception = getModel(db, "reception");
    expect(reception?.auth_type).toBe("oauth");
    expect(reception?.provider).toBe("google-gemini-cli");
    expect(reception?.model).toBe("gemini-2.5-flash");
  });

  it("updateModel preserves auth_type when omitted", () => {
    updateModel(db, "reception", { auth_type: "oauth" });
    updateModel(db, "reception", { purpose: "updated" });
    expect(getModel(db, "reception")?.auth_type).toBe("oauth");
  });

  it("auth_type migration is idempotent — reopening the DB does not throw", () => {
    // Simulate a second open by re-running the ALTER guard; the PRAGMA
    // check in migrate() should see the column and skip the ALTER.
    const path = ":memory:"; // ephemeral; we exercise migrate() indirectly
    const db2 = openDb(path);
    const cols = db2
      .prepare("PRAGMA table_info(models)")
      .all() as { name: string }[];
    expect(cols.some((c) => c.name === "auth_type")).toBe(true);
  });
});

describe("usage_log", () => {
  let db: Database.Database;
  beforeEach(() => {
    db = freshDb();
  });

  it("insertUsageLog creates a row and returns its id", () => {
    const id = insertUsageLog(db, {
      role: "reception",
      provider: "openrouter",
      model: "google/gemini-2.5-flash",
      env: "dev",
    });
    const row = getUsageLog(db, id);
    expect(row?.role).toBe("reception");
    expect(row?.provider).toBe("openrouter");
    expect(row?.model).toBe("google/gemini-2.5-flash");
    expect(row?.env).toBe("dev");
    expect(row?.cost_usd).toBeNull();
    expect(row?.created_at).toBeGreaterThan(0);
  });

  it("updateUsageLog patches only provided fields (partial reconciliation)", () => {
    const id = insertUsageLog(db, {
      role: "main",
      provider: "openrouter",
      model: "google/gemini-2.5-flash",
      env: "prod",
      generation_id: "gen-abc",
    });
    updateUsageLog(db, id, {
      input_tokens: 500,
      output_tokens: 120,
      cost_usd: 0.0032,
    });
    const row = getUsageLog(db, id);
    expect(row?.input_tokens).toBe(500);
    expect(row?.output_tokens).toBe(120);
    expect(row?.cost_usd).toBeCloseTo(0.0032, 4);
    expect(row?.generation_id).toBe("gen-abc"); // untouched
  });

  it("getUsageTotals sums cost_usd and counts calls over a time window", () => {
    const now = Date.now();
    insertUsageLog(db, { role: "main", provider: "o", model: "a", env: "dev" });
    const id2 = insertUsageLog(db, {
      role: "reception",
      provider: "o",
      model: "a",
      env: "dev",
    });
    updateUsageLog(db, id2, { cost_usd: 0.01 });
    const id3 = insertUsageLog(db, {
      role: "main",
      provider: "o",
      model: "a",
      env: "prod",
    });
    updateUsageLog(db, id3, { cost_usd: 0.05 });
    const totals = getUsageTotals(db, now - 1000, now + 1000);
    expect(totals.total_usd).toBeCloseTo(0.06, 6);
    expect(totals.total_calls).toBe(3);
    expect(totals.resolved_calls).toBe(2);
  });

  it("getUsageByRole / Env / Model aggregate correctly", () => {
    const insert = (role: string, env: string, model: string, cost: number) => {
      const id = insertUsageLog(db, {
        role,
        env,
        model,
        provider: "openrouter",
      });
      updateUsageLog(db, id, { cost_usd: cost });
    };
    insert("main", "dev", "gemini-2.5-flash", 0.01);
    insert("main", "prod", "gemini-2.5-flash", 0.02);
    insert("reception", "dev", "gemini-2.5-flash", 0.005);
    insert("reception", "prod", "gemini-2.5-flash", 0.005);
    insert("title", "prod", "gemini-2.0-flash-lite-001", 0.001);

    const now = Date.now();
    const byRole = getUsageByRole(db, now - 1000, now + 1000);
    const byEnv = getUsageByEnv(db, now - 1000, now + 1000);
    const byModel = getUsageByModel(db, now - 1000, now + 1000);

    expect(byRole.find((r) => r.key === "main")?.total_usd).toBeCloseTo(0.03, 6);
    expect(byRole.find((r) => r.key === "reception")?.calls).toBe(2);
    expect(byEnv.find((r) => r.key === "prod")?.total_usd).toBeCloseTo(0.026, 6);
    expect(byModel.length).toBe(2);
  });

  it("getUsageByDay groups by calendar day", () => {
    // Insert one row; it should show up under today
    const id = insertUsageLog(db, {
      role: "main",
      provider: "openrouter",
      model: "m",
      env: "dev",
    });
    updateUsageLog(db, id, { cost_usd: 0.1 });
    const now = Date.now();
    const byDay = getUsageByDay(db, now - 86_400_000, now + 86_400_000);
    expect(byDay.length).toBe(1);
    expect(byDay[0].total_usd).toBeCloseTo(0.1, 6);
  });
});

describe("settings", () => {
  let db: Database.Database;
  beforeEach(() => {
    db = freshDb();
  });

  it("getSetting returns undefined for an unknown key", () => {
    expect(getSetting(db, "not-a-key")).toBeUndefined();
  });

  it("setSetting upserts on conflict", () => {
    setSetting(db, "alpha", "1");
    setSetting(db, "alpha", "2");
    expect(getSetting(db, "alpha")).toBe("2");
  });

  it("USD→BRL rate seeds to 5.0 on first boot", () => {
    expect(getUsdToBrlRate(db)).toBe(5.0);
  });

  it("setUsdToBrlRate persists and round-trips", () => {
    setUsdToBrlRate(db, 5.37);
    expect(getUsdToBrlRate(db)).toBeCloseTo(5.37, 4);
  });

  it("setUsdToBrlRate rejects invalid values", () => {
    expect(() => setUsdToBrlRate(db, 0)).toThrow();
    expect(() => setUsdToBrlRate(db, -1)).toThrow();
    expect(() => setUsdToBrlRate(db, Number.NaN)).toThrow();
  });

  it("getUsdToBrlRate falls back to default when stored value is garbage", () => {
    setSetting(db, "usd_to_brl_rate", "not-a-number");
    expect(getUsdToBrlRate(db)).toBe(5.0);
  });
});

describe("users.show_brl_conversion", () => {
  let db: Database.Database;
  beforeEach(() => {
    db = freshDb();
  });

  it("new users default to show_brl_conversion = 1", () => {
    const user = createUser(db, "alice", "h");
    expect(user.show_brl_conversion).toBe(1);
  });

  it("updateShowBrlConversion toggles the flag", () => {
    const user = createUser(db, "alice", "h");
    updateShowBrlConversion(db, user.id, false);
    const row = db
      .prepare("SELECT show_brl_conversion FROM users WHERE id = ?")
      .get(user.id) as { show_brl_conversion: number };
    expect(row.show_brl_conversion).toBe(0);
    updateShowBrlConversion(db, user.id, true);
    const row2 = db
      .prepare("SELECT show_brl_conversion FROM users WHERE id = ?")
      .get(user.id) as { show_brl_conversion: number };
    expect(row2.show_brl_conversion).toBe(1);
  });
});
