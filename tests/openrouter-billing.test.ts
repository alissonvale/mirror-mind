import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getKeyInfo,
  getGeneration,
  __resetKeyInfoCacheForTests,
} from "../server/openrouter-billing.js";

function okResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function errResponse(status: number): Response {
  return new Response("", { status });
}

beforeEach(() => {
  __resetKeyInfoCacheForTests();
});

describe("getKeyInfo", () => {
  it("parses a normal response and caches the result", async () => {
    const fetchFn = vi.fn(async () =>
      okResponse({
        data: {
          label: "mirror-dev",
          usage: 0.42,
          limit: 10,
          limit_remaining: 9.58,
          is_free_tier: false,
        },
      }),
    ) as any;
    const first = await getKeyInfo(fetchFn, "sk-test");
    expect(first?.label).toBe("mirror-dev");
    expect(first?.usage).toBeCloseTo(0.42, 4);
    expect(first?.limit).toBe(10);
    expect(first?.limit_remaining).toBeCloseTo(9.58, 4);
    // Second call within TTL should hit the cache
    const second = await getKeyInfo(fetchFn, "sk-test");
    expect(second).toBe(first);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("returns undefined (not thrown) when the endpoint returns non-2xx", async () => {
    const fetchFn = vi.fn(async () => errResponse(500)) as any;
    const info = await getKeyInfo(fetchFn, "sk-test");
    expect(info).toBeUndefined();
  });

  it("returns undefined when no API key is available", async () => {
    const info = await getKeyInfo(fetch, undefined);
    expect(info).toBeUndefined();
  });

  it("handles responses with nullable fields (no spending cap)", async () => {
    const fetchFn = vi.fn(async () =>
      okResponse({ data: { usage: 1.23 } }),
    ) as any;
    const info = await getKeyInfo(fetchFn, "sk-test");
    expect(info?.limit).toBeNull();
    expect(info?.limit_remaining).toBeNull();
    expect(info?.is_free_tier).toBe(false);
  });
});

describe("getGeneration", () => {
  it("returns parsed data on a 200", async () => {
    const fetchFn = vi.fn(async () =>
      okResponse({
        data: {
          id: "gen-abc",
          model: "google/gemini-2.5-flash",
          total_cost: 0.0032,
          tokens_prompt: 500,
          tokens_completion: 120,
        },
      }),
    ) as any;
    const gen = await getGeneration(
      "gen-abc",
      fetchFn,
      "sk-test",
      async () => undefined,
    );
    expect(gen?.id).toBe("gen-abc");
    expect(gen?.total_cost).toBeCloseTo(0.0032, 6);
    expect(gen?.tokens_prompt).toBe(500);
    expect(gen?.tokens_completion).toBe(120);
  });

  it("retries on 404 then succeeds", async () => {
    let attempt = 0;
    const fetchFn = vi.fn(async () => {
      attempt++;
      if (attempt < 3) return errResponse(404);
      return okResponse({
        data: {
          id: "gen-xyz",
          model: "m",
          total_cost: 0.001,
          tokens_prompt: 10,
          tokens_completion: 5,
        },
      });
    }) as any;
    const sleep = vi.fn(async () => undefined);
    const gen = await getGeneration("gen-xyz", fetchFn, "sk-test", sleep, [
      1, 2, 4, 8, 16,
    ]);
    expect(gen?.total_cost).toBeCloseTo(0.001, 6);
    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("returns undefined after exhausting retries on 404", async () => {
    const fetchFn = vi.fn(async () => errResponse(404)) as any;
    const sleep = vi.fn(async () => undefined);
    const gen = await getGeneration("gen-nope", fetchFn, "sk-test", sleep, [
      1, 2,
    ]);
    expect(gen).toBeUndefined();
    // 3 attempts (initial + 2 retries)
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it("fails fast (no retry) on a 500", async () => {
    const fetchFn = vi.fn(async () => errResponse(500)) as any;
    const sleep = vi.fn(async () => undefined);
    const gen = await getGeneration("gen-500", fetchFn, "sk-test", sleep, [
      1, 2, 4,
    ]);
    expect(gen).toBeUndefined();
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("returns undefined when the body shape is unexpected", async () => {
    const fetchFn = vi.fn(async () =>
      okResponse({ data: { model: "m" } }),
    ) as any; // no id
    const gen = await getGeneration(
      "gen-malformed",
      fetchFn,
      "sk-test",
      async () => undefined,
    );
    expect(gen).toBeUndefined();
  });

  it("returns undefined when no API key is set", async () => {
    const gen = await getGeneration(
      "gen-x",
      fetch,
      undefined,
      async () => undefined,
    );
    expect(gen).toBeUndefined();
  });
});
