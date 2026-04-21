import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type Database from "better-sqlite3";
import { openDb, createUser, getUsageLog } from "../server/db.js";
import { logUsage, currentEnv } from "../server/usage.js";

function freshDb(): Database.Database {
  return openDb(":memory:");
}

function fakeAssistantMessage(overrides: Partial<any> = {}): any {
  return {
    role: "assistant",
    content: [],
    api: "openai-responses",
    provider: "openrouter",
    model: "google/gemini-2.5-flash",
    responseId: "gen-test-123",
    usage: {
      input: 150,
      output: 30,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 180,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: "stop",
    timestamp: Date.now(),
    ...overrides,
  };
}

describe("logUsage", () => {
  let db: Database.Database;
  const originalFetch = global.fetch;

  beforeEach(() => {
    db = freshDb();
    global.fetch = vi.fn() as any;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("inserts an immediate row with tokens + generation_id, cost_usd NULL", () => {
    const alice = createUser(db, "alice", "h");
    const id = logUsage(db, {
      role: "reception",
      env: "dev",
      message: fakeAssistantMessage(),
      user_id: alice.id,
    });
    const row = getUsageLog(db, id);
    expect(row?.role).toBe("reception");
    expect(row?.user_id).toBe(alice.id);
    expect(row?.provider).toBe("openrouter");
    expect(row?.model).toBe("google/gemini-2.5-flash");
    expect(row?.generation_id).toBe("gen-test-123");
    expect(row?.input_tokens).toBe(150);
    expect(row?.output_tokens).toBe(30);
    // cost_usd arrives later via background reconciler
    expect(row?.cost_usd).toBeNull();
    expect(row?.env).toBe("dev");
  });

  it("skips background reconcile when provider is not openrouter", () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as any;
    logUsage(db, {
      role: "main",
      env: "dev",
      message: fakeAssistantMessage({ provider: "anthropic" }),
    });
    // small microtask tick
    return new Promise((resolve) => setTimeout(resolve, 10)).then(() => {
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  it("skips background reconcile when responseId is missing", () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as any;
    logUsage(db, {
      role: "main",
      env: "dev",
      message: fakeAssistantMessage({ responseId: undefined }),
    });
    return new Promise((resolve) => setTimeout(resolve, 10)).then(() => {
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });
});

describe("currentEnv", () => {
  const original = process.env.MIRROR_ENV;

  afterEach(() => {
    if (original === undefined) delete process.env.MIRROR_ENV;
    else process.env.MIRROR_ENV = original;
  });

  it("defaults to 'dev' when unset", () => {
    delete process.env.MIRROR_ENV;
    expect(currentEnv()).toBe("dev");
  });

  it("returns 'prod' for MIRROR_ENV=prod", () => {
    process.env.MIRROR_ENV = "prod";
    expect(currentEnv()).toBe("prod");
  });

  it("accepts 'production' as 'prod'", () => {
    process.env.MIRROR_ENV = "production";
    expect(currentEnv()).toBe("prod");
  });

  it("any other value falls back to 'dev'", () => {
    process.env.MIRROR_ENV = "staging";
    expect(currentEnv()).toBe("dev");
  });
});
