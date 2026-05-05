import { describe, it, expect } from "vitest";
import { openDb } from "../server/db.js";
import {
  getCached,
  setCached,
  computeSourceHash,
  getOrGenerate,
} from "../server/portraits/cache.js";

describe("entity_profile_cache (CV1.E13.S1)", () => {
  it("returns null on first lookup", () => {
    const db = openDb(":memory:");
    expect(getCached(db, "journey", "j1", "lede", "h1")).toBeNull();
  });

  it("returns the stored value when source_hash matches", () => {
    const db = openDb(":memory:");
    setCached(db, "journey", "j1", "lede", "the line", "h1");
    expect(getCached(db, "journey", "j1", "lede", "h1")).toBe("the line");
  });

  it("returns null when source_hash differs (stale entry)", () => {
    const db = openDb(":memory:");
    setCached(db, "journey", "j1", "lede", "old line", "h-old");
    expect(getCached(db, "journey", "j1", "lede", "h-new")).toBeNull();
  });

  it("upserts overwrite stale entries with new value + hash", () => {
    const db = openDb(":memory:");
    setCached(db, "journey", "j1", "lede", "old", "h-old");
    setCached(db, "journey", "j1", "lede", "new", "h-new");
    expect(getCached(db, "journey", "j1", "lede", "h-new")).toBe("new");
    expect(getCached(db, "journey", "j1", "lede", "h-old")).toBeNull();
  });

  it("isolates entries by entity_type + entity_id + field_name", () => {
    const db = openDb(":memory:");
    setCached(db, "journey", "j1", "lede", "L", "h");
    setCached(db, "journey", "j1", "close", "C", "h");
    setCached(db, "organization", "j1", "lede", "ORG", "h");
    expect(getCached(db, "journey", "j1", "lede", "h")).toBe("L");
    expect(getCached(db, "journey", "j1", "close", "h")).toBe("C");
    expect(getCached(db, "organization", "j1", "lede", "h")).toBe("ORG");
  });

  it("computeSourceHash is deterministic and order-sensitive", () => {
    expect(computeSourceHash(["a", 1])).toBe(computeSourceHash(["a", 1]));
    expect(computeSourceHash(["a", 1])).not.toBe(computeSourceHash([1, "a"]));
  });

  it("computeSourceHash treats null distinctly from empty", () => {
    expect(computeSourceHash([null])).not.toBe(computeSourceHash([""]));
  });
});

describe("getOrGenerate", () => {
  it("returns cached on hit and never invokes generate", async () => {
    const db = openDb(":memory:");
    setCached(db, "journey", "j", "f", "cached", "h");
    let called = false;
    const result = await getOrGenerate(
      db,
      "journey",
      "j",
      "f",
      "h",
      async () => {
        called = true;
        return "regenerated";
      },
    );
    expect(result).toBe("cached");
    expect(called).toBe(false);
  });

  it("calls generate on miss and writes the result", async () => {
    const db = openDb(":memory:");
    const result = await getOrGenerate(
      db,
      "journey",
      "j",
      "f",
      "h",
      async () => "fresh value",
    );
    expect(result).toBe("fresh value");
    expect(getCached(db, "journey", "j", "f", "h")).toBe("fresh value");
  });

  it("does not write when generate returns null", async () => {
    const db = openDb(":memory:");
    const result = await getOrGenerate(
      db,
      "journey",
      "j",
      "f",
      "h",
      async () => null,
    );
    expect(result).toBeNull();
    expect(getCached(db, "journey", "j", "f", "h")).toBeNull();
  });

  it("regenerates after source_hash change (e.g., source field edited)", async () => {
    const db = openDb(":memory:");
    await getOrGenerate(db, "journey", "j", "f", "h-v1", async () => "v1");
    expect(getCached(db, "journey", "j", "f", "h-v1")).toBe("v1");

    const result = await getOrGenerate(
      db,
      "journey",
      "j",
      "f",
      "h-v2",
      async () => "v2",
    );
    expect(result).toBe("v2");
    expect(getCached(db, "journey", "j", "f", "h-v2")).toBe("v2");
    expect(getCached(db, "journey", "j", "f", "h-v1")).toBeNull();
  });
});
