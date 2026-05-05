import { readFileSync } from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";
import { getUsdToBrlRate } from "./settings.js";

/**
 * Model catalog (CV1.E15.S1). Live OpenRouter list + curated extension
 * for non-OpenRouter providers, surfaced through `<ModelPicker>` in the
 * admin chrome and (later stories) the scene form, session header,
 * per-turn rerun.
 *
 * Cache is in-memory (process-scoped). TTL 1h. Restart or `?refresh=1`
 * forces a refetch.
 */

export interface CatalogEntry {
  provider: string;
  model_id: string;
  display_name?: string;
  price_brl_per_1m_input?: number;
  price_brl_per_1m_output?: number;
}

interface CuratedFile {
  $schema?: string;
  entries: CatalogEntry[];
}

interface OpenRouterModel {
  id: string; // e.g. "anthropic/claude-sonnet-4-6"
  name?: string;
  pricing?: {
    prompt?: string; // USD per token, as a string
    completion?: string;
  };
}

interface OpenRouterListResponse {
  data?: OpenRouterModel[];
}

const CURATED_PATH = path.resolve(
  process.cwd(),
  "config",
  "models-catalog.json",
);

const OPENROUTER_LIST_URL = "https://openrouter.ai/api/v1/models";
const TTL_MS = 60 * 60 * 1000; // 1h

interface CacheState {
  fetchedAt: number;
  entries: CatalogEntry[];
}

let cache: CacheState | null = null;

export interface GetCatalogOptions {
  /** Bypass the in-memory cache and refetch upstream. */
  force?: boolean;
  /** Filter to a single provider (case-insensitive). */
  provider?: string;
}

export async function getCatalog(
  db: Database.Database,
  opts: GetCatalogOptions = {},
): Promise<CatalogEntry[]> {
  const fresh =
    cache && !opts.force && Date.now() - cache.fetchedAt < TTL_MS
      ? cache.entries
      : await loadCatalog(db);
  if (!cache || opts.force) {
    cache = { fetchedAt: Date.now(), entries: fresh };
  }
  if (!opts.provider) return fresh;
  const needle = opts.provider.toLowerCase();
  return fresh.filter((e) => e.provider.toLowerCase() === needle);
}

/** Test seam — reset the in-memory cache. */
export function resetCatalogCache(): void {
  cache = null;
}

async function loadCatalog(db: Database.Database): Promise<CatalogEntry[]> {
  const usdToBrl = getUsdToBrlRate(db);
  const [openrouter, curated] = await Promise.all([
    fetchOpenRouter(usdToBrl),
    Promise.resolve(loadCurated()),
  ]);
  return mergeCatalogs(openrouter, curated);
}

async function fetchOpenRouter(usdToBrl: number): Promise<CatalogEntry[]> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.log(
      "[models-catalog] OPENROUTER_API_KEY not set — skipping OpenRouter fetch",
    );
    return [];
  }
  try {
    const res = await fetch(OPENROUTER_LIST_URL, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      console.log(
        `[models-catalog] OpenRouter returned ${res.status}; using curated only`,
      );
      return [];
    }
    const json = (await res.json()) as OpenRouterListResponse;
    const data = json.data ?? [];
    return data.map((m) => openRouterToEntry(m, usdToBrl));
  } catch (err) {
    console.log(
      "[models-catalog] OpenRouter fetch failed:",
      (err as Error).message,
    );
    return [];
  }
}

function openRouterToEntry(
  m: OpenRouterModel,
  usdToBrl: number,
): CatalogEntry {
  const promptUsdPerToken = parseFloat(m.pricing?.prompt ?? "");
  const completionUsdPerToken = parseFloat(m.pricing?.completion ?? "");
  const entry: CatalogEntry = {
    provider: "openrouter",
    model_id: m.id,
    display_name: m.name,
  };
  if (Number.isFinite(promptUsdPerToken) && promptUsdPerToken > 0) {
    entry.price_brl_per_1m_input =
      promptUsdPerToken * 1_000_000 * usdToBrl;
  }
  if (Number.isFinite(completionUsdPerToken) && completionUsdPerToken > 0) {
    entry.price_brl_per_1m_output =
      completionUsdPerToken * 1_000_000 * usdToBrl;
  }
  return entry;
}

function loadCurated(): CatalogEntry[] {
  try {
    const raw = readFileSync(CURATED_PATH, "utf-8");
    const parsed = JSON.parse(raw) as CuratedFile;
    return Array.isArray(parsed.entries) ? parsed.entries : [];
  } catch (err) {
    console.log(
      "[models-catalog] curated file missing/invalid — empty curated list:",
      (err as Error).message,
    );
    return [];
  }
}

/**
 * Merge OpenRouter + curated. Curated entries with the same
 * `provider/model_id` as an OpenRouter row override (admins can pin
 * pricing or display names). Otherwise both sets coexist.
 */
function mergeCatalogs(
  openrouter: CatalogEntry[],
  curated: CatalogEntry[],
): CatalogEntry[] {
  const byKey = new Map<string, CatalogEntry>();
  for (const e of openrouter) byKey.set(`${e.provider}/${e.model_id}`, e);
  for (const e of curated) byKey.set(`${e.provider}/${e.model_id}`, e);
  return Array.from(byKey.values()).sort((a, b) => {
    if (a.provider !== b.provider)
      return a.provider.localeCompare(b.provider);
    return a.model_id.localeCompare(b.model_id);
  });
}
