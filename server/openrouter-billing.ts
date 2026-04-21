/**
 * Read-only client for OpenRouter's billing endpoints (CV0.E3.S6).
 *
 * Two endpoints are surfaced to the rest of the system:
 *
 *  - `getKeyInfo()` — /api/v1/auth/key. Returns the dedicated account's
 *    credit balance and spending cap (if any). Cached 60s in-process so
 *    repeated /admin/budget loads don't hammer OpenRouter.
 *
 *  - `getGeneration(id)` — /api/v1/generation/{id}. Returns the exact cost
 *    and token counts for a single LLM call. OpenRouter's /generation/{id}
 *    has a noticeable lag after a call completes (observed ~1-4s in
 *    practice), so this helper retries with exponential backoff before
 *    giving up.
 *
 * Both tolerate transient HTTP failures — they return `undefined` and log
 * a single line. Callers render "billing data unavailable" instead of
 * crashing. This matches the S6 design: real cost is preferred, but a
 * missing reconciliation is diagnostic signal, not a blocker.
 */

export interface KeyInfo {
  /** USD spent on this key, lifetime. */
  usage: number;
  /** USD spending cap set at OpenRouter, or null if uncapped. */
  limit: number | null;
  /** USD remaining under the spending cap. null if uncapped. */
  limit_remaining: number | null;
  /** Whether this key has the free-tier flag set (rarely used for paid accounts). */
  is_free_tier: boolean;
  /** Label the admin set on the key at OpenRouter (e.g. "mirror-prod"). */
  label: string | null;
  /** Epoch ms this response was cached. */
  fetched_at: number;
}

export interface GenerationInfo {
  /** Generation id echoed by OpenRouter. */
  id: string;
  /** Fully-qualified model path, e.g. "google/gemini-2.5-flash". */
  model: string;
  /** Total billed cost in USD. */
  total_cost: number;
  /** Input tokens billed. */
  tokens_prompt: number;
  /** Output tokens billed. */
  tokens_completion: number;
}

const KEY_INFO_TTL_MS = 60_000;
const GENERATION_RETRY_DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 16_000];

interface KeyInfoCache {
  value: KeyInfo;
  expires_at: number;
}

let cache: KeyInfoCache | undefined;

/** Test-only: reset the in-memory cache so each test starts clean. */
export function __resetKeyInfoCacheForTests(): void {
  cache = undefined;
}

type FetchFn = typeof fetch;

/**
 * Fetch the current balance + spending cap for the configured OpenRouter
 * key. Returns `undefined` on any transport or parse failure; returns a
 * cached value for up to 60s on success.
 *
 * `fetchFn` / `apiKey` are injectable for tests — production calls use
 * global `fetch` and `process.env.OPENROUTER_API_KEY`.
 */
export async function getKeyInfo(
  fetchFn: FetchFn = fetch,
  apiKey: string | undefined = process.env.OPENROUTER_API_KEY,
): Promise<KeyInfo | undefined> {
  if (cache && cache.expires_at > Date.now()) {
    return cache.value;
  }
  if (!apiKey) {
    console.log("[billing] no OPENROUTER_API_KEY set; cannot fetch key info");
    return undefined;
  }
  try {
    const res = await fetchFn("https://openrouter.ai/api/v1/auth/key", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      console.log(`[billing] /auth/key returned ${res.status}`);
      return undefined;
    }
    const body = (await res.json()) as { data?: Record<string, unknown> };
    const data = body.data ?? {};
    const info: KeyInfo = {
      usage: Number(data.usage ?? 0),
      limit: typeof data.limit === "number" ? data.limit : null,
      limit_remaining:
        typeof data.limit_remaining === "number"
          ? data.limit_remaining
          : null,
      is_free_tier: Boolean(data.is_free_tier),
      label: typeof data.label === "string" ? data.label : null,
      fetched_at: Date.now(),
    };
    cache = { value: info, expires_at: Date.now() + KEY_INFO_TTL_MS };
    return info;
  } catch (err) {
    console.log(
      "[billing] /auth/key fetch failed:",
      (err as Error).message,
    );
    return undefined;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch the exact cost + token counts OpenRouter billed for a specific
 * generation. Retries on 404 (endpoint lags behind the stream completion)
 * with exponential backoff before giving up.
 *
 * `sleepFn` is injectable for tests — production uses `setTimeout`.
 */
export async function getGeneration(
  id: string,
  fetchFn: FetchFn = fetch,
  apiKey: string | undefined = process.env.OPENROUTER_API_KEY,
  sleepFn: (ms: number) => Promise<void> = sleep,
  retryDelays: number[] = GENERATION_RETRY_DELAYS_MS,
): Promise<GenerationInfo | undefined> {
  if (!apiKey) {
    console.log("[billing] no OPENROUTER_API_KEY; cannot fetch generation");
    return undefined;
  }
  const url = `https://openrouter.ai/api/v1/generation?id=${encodeURIComponent(id)}`;
  // Retry only on "not ready yet" (404/202). Other errors fail fast.
  for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
    try {
      const res = await fetchFn(url, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (res.ok) {
        const body = (await res.json()) as { data?: Record<string, unknown> };
        const data = body.data ?? {};
        if (typeof data.id !== "string") {
          console.log(`[billing] /generation returned unexpected body for ${id}`);
          return undefined;
        }
        return {
          id: String(data.id),
          model: String(data.model ?? ""),
          total_cost: Number(data.total_cost ?? 0),
          tokens_prompt: Number(
            data.tokens_prompt ?? data.native_tokens_prompt ?? 0,
          ),
          tokens_completion: Number(
            data.tokens_completion ?? data.native_tokens_completion ?? 0,
          ),
        };
      }
      if (res.status === 404 || res.status === 202) {
        // Not yet available — retry if we still have budget.
        if (attempt < retryDelays.length) {
          await sleepFn(retryDelays[attempt]);
          continue;
        }
        console.log(
          `[billing] /generation ${id} still 404 after ${attempt + 1} attempts`,
        );
        return undefined;
      }
      console.log(`[billing] /generation ${id} returned ${res.status}`);
      return undefined;
    } catch (err) {
      console.log(
        `[billing] /generation ${id} fetch failed:`,
        (err as Error).message,
      );
      return undefined;
    }
  }
  return undefined;
}
