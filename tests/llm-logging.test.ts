import { describe, it, expect, beforeEach, vi } from "vitest";
import type Database from "better-sqlite3";
import {
  openDb,
  createUser,
  setLlmLoggingEnabled,
  getLlmCall,
  countLlmCalls,
} from "../server/db.js";
import { logLlmCall, linkLlmCallEntry } from "../server/llm-logging.ts";

describe("logLlmCall — service (CV1.E8.S1)", () => {
  let db: Database.Database;
  let userId: string;

  beforeEach(() => {
    db = openDb(":memory:");
    userId = createUser(db, "alice", "hash").id;
  });

  function basePayload(overrides = {}) {
    return {
      role: "reception" as const,
      provider: "openrouter",
      model: "google/gemini-2.5-flash",
      system_prompt: "system prompt",
      user_message: "hello",
      response: "{}",
      tokens_in: 10,
      tokens_out: 5,
      cost_usd: 0.0001,
      latency_ms: 500,
      session_id: null,
      entry_id: null,
      user_id: userId,
      env: "dev",
      ...overrides,
    };
  }

  it("writes a row when logging is enabled (default)", () => {
    const id = logLlmCall(db, basePayload());
    expect(id).not.toBeNull();
    expect(countLlmCalls(db)).toBe(1);
    const row = getLlmCall(db, id!);
    expect(row?.role).toBe("reception");
    expect(row?.user_message).toBe("hello");
  });

  it("is a no-op when logging is disabled — returns null, no row written", () => {
    setLlmLoggingEnabled(db, false);
    const id = logLlmCall(db, basePayload());
    expect(id).toBeNull();
    expect(countLlmCalls(db)).toBe(0);
  });

  it("flipping toggle back on resumes writes", () => {
    setLlmLoggingEnabled(db, false);
    expect(logLlmCall(db, basePayload())).toBeNull();
    setLlmLoggingEnabled(db, true);
    expect(logLlmCall(db, basePayload())).not.toBeNull();
    expect(countLlmCalls(db)).toBe(1);
  });

  it("never throws on insert failure — returns null and logs to stderr", () => {
    // Force the insert to fail by passing an invalid env (NOT NULL constraint).
    // A null env triggers the constraint and the helper rejects.
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const id = logLlmCall(db, basePayload({ env: null as unknown as string }));
    expect(id).toBeNull();
    // The error log fired — confirms the catch path ran.
    expect(consoleSpy).toHaveBeenCalled();
    const calls = consoleSpy.mock.calls.flat().join(" ");
    expect(calls).toMatch(/llm-logging.*insert failed/i);
    consoleSpy.mockRestore();
  });

  it("error rows can be logged (response null + error populated)", () => {
    const id = logLlmCall(
      db,
      basePayload({
        response: null,
        error: "Reception timeout",
        tokens_in: null,
        tokens_out: null,
        cost_usd: null,
      }),
    );
    expect(id).not.toBeNull();
    const row = getLlmCall(db, id!);
    expect(row?.response).toBeNull();
    expect(row?.error).toBe("Reception timeout");
  });
});

describe("linkLlmCallEntry (CV1.E8.S1)", () => {
  let db: Database.Database;
  let userId: string;
  beforeEach(() => {
    db = openDb(":memory:");
    userId = createUser(db, "alice", "hash").id;
  });

  it("backfills entry_id on a row that was inserted before the entry existed", () => {
    const id = logLlmCall(db, {
      role: "main",
      provider: "openrouter",
      model: "anthropic/claude-sonnet-4",
      system_prompt: "prompt",
      user_message: "msg",
      response: "reply",
      session_id: "sess-1",
      user_id: userId,
      env: "dev",
    });
    expect(id).not.toBeNull();
    expect(getLlmCall(db, id!)!.entry_id).toBeNull();

    linkLlmCallEntry(db, id, "ent-99");
    expect(getLlmCall(db, id!)!.entry_id).toBe("ent-99");
  });

  it("is a no-op when callId is null (logging was disabled)", () => {
    expect(() => linkLlmCallEntry(db, null, "ent-1")).not.toThrow();
  });

  it("never throws on update failure", () => {
    // Updating a non-existent id: better-sqlite3 returns 0 changes,
    // doesn't throw. Confirm the helper completes silently.
    expect(() => linkLlmCallEntry(db, "no-such-id", "ent-1")).not.toThrow();
  });
});
