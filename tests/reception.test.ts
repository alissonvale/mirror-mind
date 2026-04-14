import { describe, it, expect, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import { openDb, createUser, setIdentityLayer } from "../server/db.js";
import { receive } from "../server/reception.js";

type CompleteFn = Parameters<typeof receive>[4];

function fakeComplete(text: string, delayMs = 0): CompleteFn {
  return (async () => {
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    return { content: [{ type: "text", text }] };
  }) as unknown as CompleteFn;
}

function failingComplete(): CompleteFn {
  return (async () => {
    throw new Error("boom");
  }) as unknown as CompleteFn;
}

describe("receive", () => {
  let db: Database.Database;
  let userId: string;

  beforeEach(() => {
    db = openDb(":memory:");
    userId = createUser(db, "alice", "hash123").id;
  });

  it("returns {persona: null} when user has no persona layers (no LLM call)", async () => {
    let called = false;
    const completeFn = (async () => {
      called = true;
      return { content: [] };
    }) as unknown as CompleteFn;

    const result = await receive(db, userId, "hello", {}, completeFn);

    expect(result.persona).toBeNull();
    expect(called).toBe(false);
  });

  it("returns the persona key when LLM decides", async () => {
    setIdentityLayer(db, userId, "persona", "mentora", "# Mentora\n\nA mentora responde perguntas.");
    setIdentityLayer(db, userId, "persona", "tecnica", "# Tecnica\n\nA tecnica resolve problemas técnicos.");

    const result = await receive(
      db,
      userId,
      "me ajuda a refletir sobre uma decisão",
      {},
      fakeComplete('{"persona": "mentora"}'),
    );

    expect(result.persona).toBe("mentora");
  });

  it("returns null when LLM returns invalid JSON", async () => {
    setIdentityLayer(db, userId, "persona", "mentora", "# Mentora");

    const result = await receive(
      db,
      userId,
      "hello",
      {},
      fakeComplete("not json at all"),
    );

    expect(result.persona).toBeNull();
  });

  it("returns null when LLM returns unknown persona", async () => {
    setIdentityLayer(db, userId, "persona", "mentora", "# Mentora");

    const result = await receive(
      db,
      userId,
      "hello",
      {},
      fakeComplete('{"persona": "nonexistent"}'),
    );

    expect(result.persona).toBeNull();
  });

  it("returns null when LLM returns persona: null", async () => {
    setIdentityLayer(db, userId, "persona", "mentora", "# Mentora");

    const result = await receive(
      db,
      userId,
      "hello",
      {},
      fakeComplete('{"persona": null}'),
    );

    expect(result.persona).toBeNull();
  });

  it("returns null when LLM call fails", async () => {
    setIdentityLayer(db, userId, "persona", "mentora", "# Mentora");

    const result = await receive(db, userId, "hello", {}, failingComplete());

    expect(result.persona).toBeNull();
  });
});
