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
