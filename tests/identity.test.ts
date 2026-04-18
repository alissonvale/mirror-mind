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

  it("orders layers by psychic depth (self before ego)", () => {
    setIdentityLayer(db, userId, "self", "soul", "SOUL");
    setIdentityLayer(db, userId, "ego", "behavior", "BEHAVIOR");

    const prompt = composeSystemPrompt(db, userId);
    const soulPos = prompt.indexOf("SOUL");
    const behaviorPos = prompt.indexOf("BEHAVIOR");

    // Self (essence) leads; ego (operational) follows.
    // See decisions.md 2026-04-18 "identity layers are ordered by psychic depth".
    expect(soulPos).toBeLessThan(behaviorPos);
  });

  it("excludes persona layers from base composition", () => {
    setIdentityLayer(db, userId, "self", "soul", "SOUL");
    setIdentityLayer(db, userId, "persona", "mentora", "MENTORA");

    const prompt = composeSystemPrompt(db, userId);

    expect(prompt).toContain("SOUL");
    expect(prompt).not.toContain("MENTORA");
  });

  it("appends the specified persona layer at the end", () => {
    setIdentityLayer(db, userId, "self", "soul", "SOUL");
    setIdentityLayer(db, userId, "ego", "behavior", "BEHAVIOR");
    setIdentityLayer(db, userId, "persona", "mentora", "MENTORA");

    const prompt = composeSystemPrompt(db, userId, "mentora");

    expect(prompt).toContain("SOUL");
    expect(prompt).toContain("BEHAVIOR");
    expect(prompt).toContain("MENTORA");

    // Persona comes last
    const mentoraPos = prompt.indexOf("MENTORA");
    const behaviorPos = prompt.indexOf("BEHAVIOR");
    const soulPos = prompt.indexOf("SOUL");
    expect(mentoraPos).toBeGreaterThan(behaviorPos);
    expect(mentoraPos).toBeGreaterThan(soulPos);
  });

  it("falls back to base when persona key is unknown", () => {
    setIdentityLayer(db, userId, "self", "soul", "SOUL");
    setIdentityLayer(db, userId, "ego", "behavior", "BEHAVIOR");

    const prompt = composeSystemPrompt(db, userId, "nonexistent");

    expect(prompt).toContain("SOUL");
    expect(prompt).toContain("BEHAVIOR");
  });

  it("appends adapter instruction when adapter is specified", () => {
    setIdentityLayer(db, userId, "self", "soul", "SOUL");

    const prompt = composeSystemPrompt(db, userId, null, "telegram");

    expect(prompt).toContain("SOUL");
    expect(prompt).toContain("Telegram");
    expect(prompt.indexOf("Telegram")).toBeGreaterThan(prompt.indexOf("SOUL"));
  });

  it("does not append adapter instruction for unknown adapter", () => {
    setIdentityLayer(db, userId, "self", "soul", "SOUL");

    const prompt = composeSystemPrompt(db, userId, null, "unknown");

    expect(prompt).toBe("SOUL");
  });

  it("appends adapter instruction after persona", () => {
    setIdentityLayer(db, userId, "self", "soul", "SOUL");
    setIdentityLayer(db, userId, "persona", "mentora", "MENTORA");

    const prompt = composeSystemPrompt(db, userId, "mentora", "telegram");

    const soulPos = prompt.indexOf("SOUL");
    const mentoraPos = prompt.indexOf("MENTORA");
    const telegramPos = prompt.indexOf("Telegram");

    expect(mentoraPos).toBeGreaterThan(soulPos);
    expect(telegramPos).toBeGreaterThan(mentoraPos);
  });
});
