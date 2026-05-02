import { describe, it, expect, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import {
  openDb,
  createUser,
  getOrCreateSession,
  getSessionScene,
  setSessionScene,
  createScene,
  getSceneById,
  getSceneByKey,
  listScenesForUser,
  updateScene,
  archiveScene,
  unarchiveScene,
  deleteScene,
  setScenePersonas,
  getScenePersonas,
  isSceneVoice,
} from "../server/db.js";

describe("scenes CRUD helpers (CV1.E11.S4)", () => {
  let db: Database.Database;
  let userId: string;

  beforeEach(() => {
    db = openDb(":memory:");
    const user = createUser(db, "alissonvale", "hash");
    userId = user.id;
  });

  it("create + read by id + read by key round-trip", () => {
    const cena = createScene(db, userId, "aula-na", {
      title: "Aula Nova Acrópole",
      temporal_pattern: "qua 20h",
      briefing: "Conversa durante aula de filosofia.",
      response_mode: "conversational",
    });

    expect(cena.key).toBe("aula-na");
    expect(cena.title).toBe("Aula Nova Acrópole");
    expect(cena.temporal_pattern).toBe("qua 20h");
    expect(cena.briefing).toBe("Conversa durante aula de filosofia.");
    expect(cena.response_mode).toBe("conversational");
    expect(cena.voice).toBeNull();
    expect(cena.status).toBe("active");

    const byId = getSceneById(db, cena.id, userId);
    const byKey = getSceneByKey(db, userId, "aula-na");
    expect(byId?.id).toBe(cena.id);
    expect(byKey?.id).toBe(cena.id);
  });

  it("partial update only changes provided fields and bumps updated_at", async () => {
    const cena = createScene(db, userId, "k", {
      title: "Original",
      briefing: "first",
    });
    const before = cena.updated_at;
    await new Promise((r) => setTimeout(r, 5));

    const updated = updateScene(db, userId, "k", { briefing: "second" });
    expect(updated?.title).toBe("Original");
    expect(updated?.briefing).toBe("second");
    expect(updated?.updated_at).toBeGreaterThan(before);
  });

  it("UNIQUE(user_id, key) prevents duplicate keys", () => {
    createScene(db, userId, "dup", { title: "A" });
    expect(() =>
      createScene(db, userId, "dup", { title: "B" }),
    ).toThrow();
  });

  it("archive + unarchive flips status", () => {
    createScene(db, userId, "k", { title: "T" });
    expect(archiveScene(db, userId, "k")).toBe(true);
    expect(getSceneByKey(db, userId, "k")?.status).toBe("archived");
    expect(unarchiveScene(db, userId, "k")).toBe(true);
    expect(getSceneByKey(db, userId, "k")?.status).toBe("active");
  });

  it("deleteScene unscopes linked sessions and removes the cena + cast", () => {
    const cena = createScene(db, userId, "del", { title: "Delete me" });
    setScenePersonas(db, cena.id, ["a", "b"]);
    const sessId = getOrCreateSession(db, userId);
    setSessionScene(db, sessId, userId, cena.id);

    expect(getSessionScene(db, sessId, userId)).toBe(cena.id);
    expect(getScenePersonas(db, cena.id)).toEqual(["a", "b"]);

    expect(deleteScene(db, userId, "del")).toBe(true);

    expect(getSceneByKey(db, userId, "del")).toBeUndefined();
    expect(getSessionScene(db, sessId, userId)).toBeNull();
    expect(getScenePersonas(db, cena.id)).toEqual([]);
    // session row still exists
    const sessionRow = db
      .prepare("SELECT id FROM sessions WHERE id = ?")
      .get(sessId) as { id: string } | undefined;
    expect(sessionRow?.id).toBe(sessId);
  });

  it("voice='alma' on update clears the persona junction (mutex)", () => {
    const cena = createScene(db, userId, "mutex", { title: "M" });
    setScenePersonas(db, cena.id, ["x", "y"]);
    expect(getScenePersonas(db, cena.id)).toEqual(["x", "y"]);

    updateScene(db, userId, "mutex", { voice: "alma" });

    expect(getSceneByKey(db, userId, "mutex")?.voice).toBe("alma");
    expect(getScenePersonas(db, cena.id)).toEqual([]);
  });

  it("setScenePersonas throws when voice='alma'", () => {
    const cena = createScene(db, userId, "alma-cena", {
      title: "A",
      voice: "alma",
    });
    expect(() =>
      setScenePersonas(db, cena.id, ["x"]),
    ).toThrow(/Alma/);
  });

  it("setScenePersonas rewrites the junction transactionally", () => {
    const cena = createScene(db, userId, "k", { title: "T" });
    setScenePersonas(db, cena.id, ["a", "b", "c"]);
    expect(getScenePersonas(db, cena.id)).toEqual(["a", "b", "c"]);

    setScenePersonas(db, cena.id, ["d"]);
    expect(getScenePersonas(db, cena.id)).toEqual(["d"]);

    setScenePersonas(db, cena.id, []);
    expect(getScenePersonas(db, cena.id)).toEqual([]);
  });

  it("listScenesForUser orders by recent activity (linked sessions win over never-used)", async () => {
    // Three cenas created in order A, B, C, but B is the only one with a linked session.
    const a = createScene(db, userId, "a", { title: "A" });
    await new Promise((r) => setTimeout(r, 2));
    const b = createScene(db, userId, "b", { title: "B" });
    await new Promise((r) => setTimeout(r, 2));
    const c = createScene(db, userId, "c", { title: "C" });

    const sessB = getOrCreateSession(db, userId);
    setSessionScene(db, sessB, userId, b.id);
    // Bump the session's created_at well past everything else to make B
    // the most-recent activity unambiguously.
    db.prepare("UPDATE sessions SET created_at = ? WHERE id = ?").run(
      Date.now() + 10_000,
      sessB,
    );

    const list = listScenesForUser(db, userId);
    expect(list.map((s) => s.key)).toEqual(["b", "c", "a"]);
    // b first (recent session), then c (newest cena, no session), then a (oldest cena)
    expect(list[0].id).toBe(b.id);
    expect(list[2].id).toBe(a.id);
  });

  it("listScenesForUser default filters to active; archived hidden", () => {
    createScene(db, userId, "active1", { title: "A1" });
    createScene(db, userId, "archived1", { title: "X" });
    archiveScene(db, userId, "archived1");

    const active = listScenesForUser(db, userId);
    expect(active.map((s) => s.key)).toEqual(["active1"]);

    const archived = listScenesForUser(db, userId, { status: "archived" });
    expect(archived.map((s) => s.key)).toEqual(["archived1"]);
  });

  it("ownership: helpers no-op for foreign user", () => {
    createScene(db, userId, "owned", { title: "T" });
    const other = createUser(db, "veronica", "h2");

    expect(getSceneByKey(db, other.id, "owned")).toBeUndefined();
    expect(updateScene(db, other.id, "owned", { title: "Hijack" })).toBeUndefined();
    expect(archiveScene(db, other.id, "owned")).toBe(false);
    expect(deleteScene(db, other.id, "owned")).toBe(false);

    // Original intact
    expect(getSceneByKey(db, userId, "owned")?.title).toBe("T");
    expect(getSceneByKey(db, userId, "owned")?.status).toBe("active");
  });

  it("getSessionScene + setSessionScene round-trip + ownership", () => {
    const cena = createScene(db, userId, "k", { title: "T" });
    const sessId = getOrCreateSession(db, userId);

    expect(getSessionScene(db, sessId, userId)).toBeNull();
    setSessionScene(db, sessId, userId, cena.id);
    expect(getSessionScene(db, sessId, userId)).toBe(cena.id);
    setSessionScene(db, sessId, userId, null);
    expect(getSessionScene(db, sessId, userId)).toBeNull();

    // Foreign caller: read returns null, write is a no-op.
    const other = createUser(db, "veronica", "h2");
    setSessionScene(db, sessId, userId, cena.id);
    expect(getSessionScene(db, sessId, other.id)).toBeNull();
    setSessionScene(db, sessId, other.id, null);
    expect(getSessionScene(db, sessId, userId)).toBe(cena.id);
  });

  it("isSceneVoice accepts 'alma' and rejects everything else", () => {
    expect(isSceneVoice("alma")).toBe(true);
    expect(isSceneVoice("persona")).toBe(false);
    expect(isSceneVoice(null)).toBe(false);
    expect(isSceneVoice(undefined)).toBe(false);
    expect(isSceneVoice("")).toBe(false);
    expect(isSceneVoice(42)).toBe(false);
  });
});
