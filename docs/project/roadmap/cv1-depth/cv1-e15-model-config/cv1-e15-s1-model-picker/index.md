[< CV1.E15](../)

# CV1.E15.S1 — Model catalog + picker component

**Status:** ✅ Done (2026-05-05). Catalog module + endpoint + reusable picker shipped; `/admin/models` is the first consumer. Tests: 6 unit (mocked fetch). Smoke + full suite passing (1200/1200).

## Problem

`/admin/models` asks the admin to type model IDs from memory (`anthropic/claude-sonnet-4-6`, `google/gemini-2.5-pro-preview-03-25`, etc.). Typos silently break the role until the next request fails. Discovery is non-existent — the admin has to look up the OpenRouter catalog in another tab.

## Fix

A reusable model picker (combobox) backed by a live OpenRouter catalog plus a curated extension for non-OpenRouter providers (anthropic direct, google code assist OAuth, etc.). First user is `/admin/models`. The same component will be reused in S2 (scenes), S3 (session header), S5 (per-turn rerun).

## What ships

### Server

- **`server/db/models-catalog.ts`** — new module:
  ```ts
  export interface CatalogEntry {
    provider: string;
    model_id: string;
    display_name?: string;
    price_brl_per_1m_input?: number;
    price_brl_per_1m_output?: number;
  }
  export async function getCatalog(opts?: { force?: boolean; provider?: string }): Promise<CatalogEntry[]>;
  ```
  - In-memory cache, TTL 1h. `force: true` bypasses cache.
  - Pulls OpenRouter (`https://openrouter.ai/api/v1/models`) — maps to entries with `provider: "openrouter"`.
  - Reads `config/models-catalog.json` (curated, non-OpenRouter entries) and merges.
  - Network failure or missing key → returns curated only, logs warning, doesn't throw.
  - USD→BRL conversion uses the rate already exposed via `getSetting(db, 'usd_to_brl_rate')`.

- **`config/models-catalog.json`** — seed file. Initially:
  ```json
  {
    "$schema": "Curated catalog: providers and models not exposed via OpenRouter.",
    "entries": []
  }
  ```
  Documented shape; admin populates as needed. (No initial entries — keeps the seed honest; admin sees "openrouter only" until they add curated rows.)

- **`GET /api/admin/models/catalog`** in `server/index.tsx` — admin-only:
  - Query: `?provider=<filter>` (optional), `?refresh=1` (force cache bypass).
  - Returns `{ catalog: CatalogEntry[] }`.

### Component

- **`adapters/web/pages/components/model-picker.tsx`** — reusable:
  ```tsx
  <ModelPicker
    name="model"               // form field name
    value={current_model_id}    // pre-fill
    catalog={catalog}           // CatalogEntry[]
    listId="model-catalog-main" // unique per render to scope <datalist>
    required={false}
  />
  ```
  - Renders `<input type="text" list={listId}>` + `<datalist id={listId}>` populated from `catalog`.
  - Each `<option>` carries `value={`${provider}/${model_id}`}` and a label string with display_name + price.
  - SSR-only; no client JS needed for basic operation. JS hooks (price update on change) layered on top, opt-in.

### Page edits

- **`adapters/web/pages/admin/models.tsx`**:
  - Server-side: load catalog via `getCatalog()` once per request, pass to picker.
  - Replace the model `<input>` with `<ModelPicker name="model" value={m.model} catalog={catalog} listId={`model-catalog-${m.role}`} required />`.
  - Provider input stays as-is (datalist already exists for providers).

### i18n

- New keys: `admin.models.catalogHint` (small caption under the field), `admin.models.catalogEmpty` (when no entries available).

## Validation

### Smoke (manual)

1. `npm run dev` → log in as admin → `/admin/models`.
2. Click on the `model` input for any role: dropdown surfaces OpenRouter catalog.
3. Type "claude" → list filters (native `<datalist>` substring matching).
4. Pick an entry → field fills with `provider/model_id` shape.
5. Submit → row updates, page reloads, new value persisted.
6. With `OPENROUTER_API_KEY` unset (or offline): page still renders, datalist empty, input still accepts free typing.
7. As non-admin: `GET /api/admin/models/catalog` returns 403.

### Unit / integration

- **`tests/models-catalog.test.ts`** —
  - `getCatalog()` happy path: stub fetch, verify mapping.
  - Cache: second call within TTL doesn't refetch.
  - `force: true` bypasses cache.
  - Network error: returns curated only.
  - Curated merge: provider filter on combined list works.
- Smoke suite already covers `/admin/models` page render — verify it still passes.

## Out of scope

- Filtering/sorting catalog UI (provider tabs, price sort) — datalist is enough for S1.
- Catalog refresh button in admin UI — `?refresh=1` URL param is plumbing that the next story can surface.
- Picker reuse on other pages — those are separate stories (S2, S3, S5).

## Reuse contract

Stories S2, S3, S5 import `<ModelPicker>` and the server-side `getCatalog()` directly. The shape of `CatalogEntry` is the contract — adding fields is fine, renaming requires updating downstream sites.
