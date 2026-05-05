import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { openDb } from "../server/db.js";
import {
  getCatalog,
  resetCatalogCache,
} from "../server/db/models-catalog.js";

function freshDb() {
  return openDb(":memory:");
}

describe("models-catalog", () => {
  let originalKey: string | undefined;
  let originalFetch: typeof fetch | undefined;

  beforeEach(() => {
    resetCatalogCache();
    originalKey = process.env.OPENROUTER_API_KEY;
    originalFetch = globalThis.fetch;
    process.env.OPENROUTER_API_KEY = "test-key";
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = originalKey;
    if (originalFetch) globalThis.fetch = originalFetch;
    resetCatalogCache();
  });

  it("maps OpenRouter response to catalog entries with BRL conversion", async () => {
    const db = freshDb();
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            {
              id: "anthropic/claude-sonnet-4-6",
              name: "Claude Sonnet 4.6",
              pricing: { prompt: "0.000003", completion: "0.000015" },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    ) as unknown as typeof fetch;

    const catalog = await getCatalog(db);
    expect(catalog).toHaveLength(1);
    const [entry] = catalog;
    expect(entry.provider).toBe("openrouter");
    expect(entry.model_id).toBe("anthropic/claude-sonnet-4-6");
    expect(entry.display_name).toBe("Claude Sonnet 4.6");
    // Default rate is R$5/USD; 0.000003 USD/token * 1M = $3 → R$15
    expect(entry.price_brl_per_1m_input).toBeCloseTo(15, 4);
    expect(entry.price_brl_per_1m_output).toBeCloseTo(75, 4);
  });

  it("caches results within the TTL window", async () => {
    const db = freshDb();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), { status: 200 }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await getCatalog(db);
    await getCatalog(db);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("force=true bypasses cache", async () => {
    const db = freshDb();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), { status: 200 }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await getCatalog(db);
    await getCatalog(db, { force: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("network error returns empty (or curated) without throwing", async () => {
    const db = freshDb();
    globalThis.fetch = vi
      .fn()
      .mockRejectedValue(new Error("ECONNREFUSED")) as unknown as typeof fetch;

    const catalog = await getCatalog(db);
    // Curated file ships with no entries by default — network failure
    // collapses to whatever curated has.
    expect(Array.isArray(catalog)).toBe(true);
  });

  it("missing API key skips OpenRouter fetch", async () => {
    delete process.env.OPENROUTER_API_KEY;
    const db = freshDb();
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const catalog = await getCatalog(db);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(Array.isArray(catalog)).toBe(true);
  });

  it("provider filter narrows to a single provider", async () => {
    const db = freshDb();
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            {
              id: "anthropic/claude-sonnet-4-6",
              pricing: { prompt: "0.000003", completion: "0.000015" },
            },
            {
              id: "google/gemini-2.5-flash",
              pricing: { prompt: "0.0000003", completion: "0.0000012" },
            },
          ],
        }),
        { status: 200 },
      ),
    ) as unknown as typeof fetch;

    const filtered = await getCatalog(db, { provider: "openrouter" });
    expect(filtered.length).toBe(2);
    const empty = await getCatalog(db, { provider: "anthropic" });
    expect(empty.length).toBe(0);
  });
});
