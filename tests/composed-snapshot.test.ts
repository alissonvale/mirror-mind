import { describe, it, expect, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import { openDb, createUser, setIdentityLayer } from "../server/db.js";
import { composedSnapshot } from "../server/composed-snapshot.js";

describe("composedSnapshot", () => {
  let db: Database.Database;
  let userId: string;

  beforeEach(() => {
    db = openDb(":memory:");
    userId = createUser(db, "alice", "hash").id;
  });

  it("returns empty layers + null fields for a user with no identity rows", () => {
    const snap = composedSnapshot(db, userId);
    expect(snap.layers).toEqual([]);
    expect(snap.personas).toEqual([]);
    expect(snap.persona).toBeNull();
    expect(snap.organization).toBeNull();
    expect(snap.journey).toBeNull();
  });

  it("lists self.* and ego.* layers from the DB, ordered by storage order", () => {
    setIdentityLayer(db, userId, "self", "soul", "SOUL");
    setIdentityLayer(db, userId, "ego", "identity", "IDENTITY");
    setIdentityLayer(db, userId, "ego", "behavior", "BEHAVIOR");

    const snap = composedSnapshot(db, userId);
    expect(snap.layers).toContain("self.soul");
    expect(snap.layers).toContain("ego.identity");
    expect(snap.layers).toContain("ego.behavior");
  });

  it("CV1.E7.S1: ego.expression is excluded from the layers list", () => {
    // Expression migrated to the post-generation pass and no longer
    // composes into the system prompt. The snapshot must reflect
    // composition truth, not DB inventory — having an expression row
    // in the identity table should not surface here.
    setIdentityLayer(db, userId, "self", "soul", "SOUL");
    setIdentityLayer(db, userId, "ego", "identity", "IDENTITY");
    setIdentityLayer(db, userId, "ego", "behavior", "BEHAVIOR");
    setIdentityLayer(db, userId, "ego", "expression", "EXPRESSION_RULES");

    const snap = composedSnapshot(db, userId);
    expect(snap.layers).toContain("self.soul");
    expect(snap.layers).toContain("ego.identity");
    expect(snap.layers).toContain("ego.behavior");
    expect(snap.layers).not.toContain("ego.expression");
  });

  it("excludes persona layers from the layers list (they live in the personas field)", () => {
    setIdentityLayer(db, userId, "self", "soul", "SOUL");
    setIdentityLayer(db, userId, "persona", "tecnica", "TECNICA");

    const snap = composedSnapshot(db, userId);
    expect(snap.layers).toContain("self.soul");
    expect(snap.layers).not.toContain("persona.tecnica");
  });

  it("CV1.E7.S5: personaKeys array becomes personas field; first element is the primary", () => {
    const snap = composedSnapshot(
      db,
      userId,
      ["estrategista", "divulgadora"],
      null,
      null,
    );
    expect(snap.personas).toEqual(["estrategista", "divulgadora"]);
    expect(snap.persona).toBe("estrategista");
  });

  it("legacy singular persona string normalizes to a one-element array", () => {
    const snap = composedSnapshot(db, userId, "mentora");
    expect(snap.personas).toEqual(["mentora"]);
    expect(snap.persona).toBe("mentora");
  });

  it("null/undefined persona input yields empty personas + null primary", () => {
    expect(composedSnapshot(db, userId, null).personas).toEqual([]);
    expect(composedSnapshot(db, userId, null).persona).toBeNull();
    expect(composedSnapshot(db, userId).personas).toEqual([]);
    expect(composedSnapshot(db, userId).persona).toBeNull();
  });

  it("organization and journey keys pass through unchanged", () => {
    const snap = composedSnapshot(db, userId, [], "software-zen", "o-espelho");
    expect(snap.organization).toBe("software-zen");
    expect(snap.journey).toBe("o-espelho");
  });

  it("CV1.E7.S9 phase 2: mode passes through unchanged when provided", () => {
    const snap = composedSnapshot(
      db,
      userId,
      [],
      null,
      null,
      "compositional",
    );
    expect(snap.mode).toBe("compositional");
  });

  it("CV1.E7.S9 phase 2: mode defaults to null when not provided", () => {
    expect(composedSnapshot(db, userId).mode).toBeNull();
    expect(
      composedSnapshot(db, userId, [], "sz", "j").mode,
    ).toBeNull();
  });

  it("CV1.E7.S9 phase 2: mode is independent from other axes (all combinations)", () => {
    setIdentityLayer(db, userId, "self", "soul", "SOUL");
    const conv = composedSnapshot(db, userId, [], null, null, "conversational");
    const comp = composedSnapshot(db, userId, ["mentora"], null, null, "compositional");
    const ess = composedSnapshot(db, userId, [], "sz", null, "essayistic");
    expect(conv.mode).toBe("conversational");
    expect(comp.mode).toBe("compositional");
    expect(ess.mode).toBe("essayistic");
    // The mode field doesn't leak into other fields.
    expect(conv.organization).toBeNull();
    expect(comp.persona).toBe("mentora");
    expect(ess.organization).toBe("sz");
  });
});
