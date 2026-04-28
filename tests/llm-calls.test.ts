import { describe, it, expect, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import {
  openDb,
  createUser,
  insertLlmCall,
  setLlmCallEntryId,
  listLlmCalls,
  countLlmCalls,
  getLlmCall,
  listLlmCallModels,
  deleteAllLlmCalls,
  deleteLlmCallsOlderThan,
  getLlmLoggingEnabled,
  setLlmLoggingEnabled,
  DEFAULT_LLM_LOGGING_ENABLED,
} from "../server/db.js";

describe("llm_calls — DB helpers (CV1.E8.S1)", () => {
  let db: Database.Database;
  let userId: string;

  beforeEach(() => {
    db = openDb(":memory:");
    userId = createUser(db, "alice", "hash").id;
  });

  function insertSample(overrides: Partial<Parameters<typeof insertLlmCall>[1]> = {}) {
    return insertLlmCall(db, {
      role: "reception",
      provider: "openrouter",
      model: "google/gemini-2.5-flash",
      system_prompt: "You classify user messages…",
      user_message: "hi",
      response: '{"personas":[],"is_self_moment":false}',
      tokens_in: 50,
      tokens_out: 20,
      cost_usd: 0.0001,
      latency_ms: 800,
      session_id: null,
      entry_id: null,
      user_id: userId,
      env: "dev",
      ...overrides,
    });
  }

  it("insert + getLlmCall round-trips every field", () => {
    const id = insertSample({
      session_id: "sess-1",
      entry_id: "ent-1",
    });
    const row = getLlmCall(db, id);
    expect(row).toBeTruthy();
    expect(row!.role).toBe("reception");
    expect(row!.provider).toBe("openrouter");
    expect(row!.model).toBe("google/gemini-2.5-flash");
    expect(row!.system_prompt).toBe("You classify user messages…");
    expect(row!.user_message).toBe("hi");
    expect(row!.response).toBe('{"personas":[],"is_self_moment":false}');
    expect(row!.tokens_in).toBe(50);
    expect(row!.tokens_out).toBe(20);
    expect(row!.cost_usd).toBe(0.0001);
    expect(row!.latency_ms).toBe(800);
    expect(row!.session_id).toBe("sess-1");
    expect(row!.entry_id).toBe("ent-1");
    expect(row!.user_id).toBe(userId);
    expect(row!.env).toBe("dev");
    expect(row!.error).toBeNull();
    expect(typeof row!.created_at).toBe("number");
  });

  it("insert with optional fields omitted stores null", () => {
    const id = insertLlmCall(db, {
      role: "title",
      provider: "openrouter",
      model: "google/gemini-2.0-flash-lite-001",
      system_prompt: "Generate title",
      user_message: "transcript",
      env: "dev",
    });
    const row = getLlmCall(db, id);
    expect(row!.response).toBeNull();
    expect(row!.tokens_in).toBeNull();
    expect(row!.cost_usd).toBeNull();
    expect(row!.session_id).toBeNull();
    expect(row!.entry_id).toBeNull();
    expect(row!.user_id).toBeNull();
    expect(row!.error).toBeNull();
  });

  it("setLlmCallEntryId updates entry_id after the fact", () => {
    const id = insertSample();
    expect(getLlmCall(db, id)!.entry_id).toBeNull();
    setLlmCallEntryId(db, id, "ent-99");
    expect(getLlmCall(db, id)!.entry_id).toBe("ent-99");
  });

  it("list returns rows ordered by created_at DESC (newest first)", () => {
    const a = insertSample({ user_message: "first" });
    // Force a tick so timestamps differ even on fast machines.
    const sleep = () => new Promise<void>((r) => setTimeout(r, 2));
    return sleep().then(() => {
      const b = insertSample({ user_message: "second" });
      const rows = listLlmCalls(db);
      expect(rows.length).toBeGreaterThanOrEqual(2);
      // Newer first.
      expect(rows[0].id).toBe(b);
      expect(rows[1].id).toBe(a);
    });
  });

  it("list filters by role", () => {
    insertSample({ role: "reception" });
    insertSample({ role: "main" });
    insertSample({ role: "main" });
    const mains = listLlmCalls(db, { role: "main" });
    expect(mains).toHaveLength(2);
    expect(mains.every((r) => r.role === "main")).toBe(true);
  });

  it("list filters by session_id", () => {
    insertSample({ session_id: "sess-A" });
    insertSample({ session_id: "sess-B" });
    insertSample({ session_id: "sess-A" });
    const a = listLlmCalls(db, { session_id: "sess-A" });
    expect(a).toHaveLength(2);
  });

  it("list filters by model", () => {
    insertSample({ model: "google/gemini-2.5-flash" });
    insertSample({ model: "anthropic/claude-sonnet-4" });
    const claude = listLlmCalls(db, { model: "anthropic/claude-sonnet-4" });
    expect(claude).toHaveLength(1);
    expect(claude[0].model).toBe("anthropic/claude-sonnet-4");
  });

  it("list filters by date window (since/until)", () => {
    const id1 = insertSample();
    // Manually rewrite created_at to a known value for the window check.
    db.prepare("UPDATE llm_calls SET created_at = ? WHERE id = ?").run(
      1000,
      id1,
    );
    const id2 = insertSample();
    db.prepare("UPDATE llm_calls SET created_at = ? WHERE id = ?").run(
      2000,
      id2,
    );
    const id3 = insertSample();
    db.prepare("UPDATE llm_calls SET created_at = ? WHERE id = ?").run(
      3000,
      id3,
    );

    const inWindow = listLlmCalls(db, { since: 1500, until: 2500 });
    expect(inWindow).toHaveLength(1);
    expect(inWindow[0].id).toBe(id2);
  });

  it("list filters by search substring against system_prompt OR response", () => {
    insertSample({
      system_prompt: "First persona prompt",
      response: "matches resposta",
    });
    insertSample({
      system_prompt: "Second different prompt",
      response: "no match here",
    });
    insertSample({
      system_prompt: "Third with resposta inside system",
      response: "another body",
    });

    // Searching "resposta" should match #1 (response) and #3 (system).
    const matches = listLlmCalls(db, { search: "resposta" });
    expect(matches).toHaveLength(2);
  });

  it("list combines filters with AND", () => {
    insertSample({ role: "main", session_id: "sess-A" });
    insertSample({ role: "main", session_id: "sess-B" });
    insertSample({ role: "reception", session_id: "sess-A" });
    const both = listLlmCalls(db, { role: "main", session_id: "sess-A" });
    expect(both).toHaveLength(1);
    expect(both[0].role).toBe("main");
    expect(both[0].session_id).toBe("sess-A");
  });

  it("list paginates via limit + offset", () => {
    for (let i = 0; i < 5; i++) insertSample({ user_message: `msg-${i}` });
    const page1 = listLlmCalls(db, { limit: 2, offset: 0 });
    const page2 = listLlmCalls(db, { limit: 2, offset: 2 });
    expect(page1).toHaveLength(2);
    expect(page2).toHaveLength(2);
    // No overlap.
    const ids = new Set([...page1, ...page2].map((r) => r.id));
    expect(ids.size).toBe(4);
  });

  it("count respects the same filters", () => {
    insertSample({ role: "main" });
    insertSample({ role: "main" });
    insertSample({ role: "reception" });
    expect(countLlmCalls(db)).toBe(3);
    expect(countLlmCalls(db, { role: "main" })).toBe(2);
    expect(countLlmCalls(db, { role: "expression" })).toBe(0);
  });

  it("listLlmCallModels returns distinct, sorted models", () => {
    insertSample({ model: "z-model" });
    insertSample({ model: "a-model" });
    insertSample({ model: "z-model" });
    expect(listLlmCallModels(db)).toEqual(["a-model", "z-model"]);
  });

  it("deleteAllLlmCalls removes every row", () => {
    insertSample();
    insertSample();
    expect(deleteAllLlmCalls(db)).toBe(2);
    expect(countLlmCalls(db)).toBe(0);
  });

  it("deleteLlmCallsOlderThan cuts only rows before the cutoff", () => {
    const oldId = insertSample();
    db.prepare("UPDATE llm_calls SET created_at = ? WHERE id = ?").run(
      100,
      oldId,
    );
    const newId = insertSample();
    db.prepare("UPDATE llm_calls SET created_at = ? WHERE id = ?").run(
      9999999999,
      newId,
    );
    const removed = deleteLlmCallsOlderThan(db, 1000);
    expect(removed).toBe(1);
    expect(countLlmCalls(db)).toBe(1);
    expect(getLlmCall(db, newId)).toBeTruthy();
    expect(getLlmCall(db, oldId)).toBeUndefined();
  });
});

describe("llm_logging_enabled toggle (CV1.E8.S1)", () => {
  let db: Database.Database;
  beforeEach(() => {
    db = openDb(":memory:");
  });

  it("defaults to true on a fresh DB", () => {
    expect(getLlmLoggingEnabled(db)).toBe(DEFAULT_LLM_LOGGING_ENABLED);
    expect(getLlmLoggingEnabled(db)).toBe(true);
  });

  it("setLlmLoggingEnabled flips the value", () => {
    setLlmLoggingEnabled(db, false);
    expect(getLlmLoggingEnabled(db)).toBe(false);
    setLlmLoggingEnabled(db, true);
    expect(getLlmLoggingEnabled(db)).toBe(true);
  });

  it("falls back to default on a non-boolean value", () => {
    db.prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)`,
    ).run("llm_logging_enabled", "garbage", Date.now());
    expect(getLlmLoggingEnabled(db)).toBe(DEFAULT_LLM_LOGGING_ENABLED);
  });
});
