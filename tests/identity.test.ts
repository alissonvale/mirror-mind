import { describe, it, expect, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import { openDb, createUser, setIdentityLayer } from "../server/db.js";
import { composeSystemPrompt } from "../server/identity.js";

describe("composeSystemPrompt", () => {
  let db: Database.Database;
  let userId: string;

  beforeEach(() => {
    db = openDb(":memory:");
    userId = createUser(db, "alice", "hash123").id;
  });

  it("returns empty string for user with no layers", () => {
    expect(composeSystemPrompt(db, userId)).toBe("");
  });

  it("joins layers with separators", () => {
    setIdentityLayer(db, userId, "self", "soul", "I am the soul.");
    setIdentityLayer(db, userId, "ego", "identity", "I am the identity.");
    setIdentityLayer(db, userId, "ego", "behavior", "I am the behavior.");

    const prompt = composeSystemPrompt(db, userId);

    expect(prompt).toContain("I am the behavior.");
    expect(prompt).toContain("---");
    expect(prompt).toContain("I am the soul.");
  });

  it("preserves layer ordering (ego before self)", () => {
    setIdentityLayer(db, userId, "self", "soul", "SOUL");
    setIdentityLayer(db, userId, "ego", "behavior", "BEHAVIOR");

    const prompt = composeSystemPrompt(db, userId);
    const behaviorPos = prompt.indexOf("BEHAVIOR");
    const soulPos = prompt.indexOf("SOUL");

    expect(behaviorPos).toBeLessThan(soulPos);
  });
});
