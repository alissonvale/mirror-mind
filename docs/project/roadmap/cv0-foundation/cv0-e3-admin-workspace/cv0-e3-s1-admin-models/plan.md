[< Story](index.md)

# Plan: CV0.E3.S1 — Admin customizes models via the browser

**Roadmap:** [CV0.E3.S1](../index.md)
**Framing:** live model tuning. The admin changes which LLM answers, with what parameters, and sees it take effect on the next request. No restart, no JSON editing, no deploy.

---

## Goal

- A new `models` table in SQLite holds the model roles currently in use (`main`, `reception`, `title`). The JSON at `config/models.json` becomes seed data: it populates the table on first boot if the table is empty, and a "Revert to default" action reloads any role from the JSON.
- `/admin/models` lists the configured roles in a table. Each row is inline-editable: provider, model ID, input price (BRL per 1M tokens), output price, optional timeout, purpose. Save writes to the DB; the next LLM call reads from the DB. Revert per row reloads that role's seed values.
- The current `server/config/models.ts` stops reading the JSON at module load. Callers switch to `getModels(db)` / `getModel(db, role)` that query the DB on each call.

## Non-goals (v1)

- **Adding new roles via the UI.** The table starts with `main`, `reception`, `title`. New roles are added by code (add the seed JSON, add a consumer). The admin page edits what's there; it doesn't create new role slots.
- **Provider catalog / autocomplete.** The provider field is free-form text matching what pi-ai understands (`openrouter`, etc.). No curated dropdown in v1.
- **Model catalog from the provider.** The admin types the model ID. Pi-ai will error at request time if the ID is invalid; that's acceptable feedback for v1.
- **History of changes.** Each save overwrites the row. An audit log is future (radar).
- **Per-user overrides.** Models are install-wide by design — per-user model preferences are a different epic.
- **Usage tracking.** Real per-request token counts come with S6 (radar); this story uses the existing approximate estimation.

## Decisions

### D1 — DB is the live source; JSON is seed

On first boot after this story ships, the migration creates the `models` table and copies every role from `config/models.json` into it. From that point on, the DB is canonical. The JSON stays in the repo for two reasons:

1. Fresh installs (new mirrors) need something to seed from.
2. Revert to default needs a known-good reference.

### D2 — Inline edit, one row per role

Model config has few fields (provider, model, prices, timeout, purpose) and few rows (3 today). A table with inline edit is the right surface. Dedicated page per role would be overkill.

### D3 — Read per request

`getModels(db)` runs on every call — it's a tiny SQL query. No caching layer in v1. If profiling ever shows it as hot, we add an LRU. For now, simplicity wins.

### D4 — Price and timeout stay nullable

Some roles may not have prices wired (e.g., a future skill that uses a local model). Nullable columns preserve that. The dashboard and rail already handle `null` prices gracefully (cost shows as unavailable).

### D5 — Timeout semantics

`timeout_ms` only applies to background calls (reception, title) where a cap is honest. The `main` role's timeout isn't honored today — the Agent loop handles streaming. Keep the column for the future; document it reads as "target timeout for background LLM calls."

## Schema

```sql
CREATE TABLE IF NOT EXISTS models (
  role TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  model_id TEXT NOT NULL,
  timeout_ms INTEGER,
  price_brl_per_1m_input REAL,
  price_brl_per_1m_output REAL,
  purpose TEXT,
  updated_at INTEGER NOT NULL
);
```

## Steps

1. **Schema + migration.** Add CREATE TABLE + seed-from-JSON logic to `openDb`/`migrate`.
2. **DB helpers** (`server/db/models.ts`):
   - `ModelConfig` type matching the shape callers expect.
   - `getModels(db): Record<string, ModelConfig>` returning every row keyed by role.
   - `getModel(db, role): ModelConfig | undefined` for single-role reads.
   - `updateModel(db, role, fields)` — partial update with validation.
   - `resetModelToDefault(db, role)` — read JSON, overwrite row.
3. **Migrate callers.** `server/reception.ts`, `server/title.ts`, `server/session-stats.ts`, `server/admin-stats.ts`, `adapters/web/index.tsx` switch from `models.main` (static import) to `getModels(db).main`.
4. **Retire `server/config/models.ts` as runtime config source.** Replace with a thin module that loads the JSON for seed/reset only, or keep the file but stop exporting the static `models` object. Decide during implementation.
5. **Admin UI** (`adapters/web/pages/admin/models.tsx`): `ModelsPage` with a table — one row per role, inline edit form per row, save button, revert button.
6. **Routes** (inside admin sub-app):
   - `GET /admin/models` — render the page.
   - `POST /admin/models/:role` — update.
   - `POST /admin/models/:role/reset` — revert to JSON default.
7. **Sidebar link.** "Models" as a sub-item under "This Mirror", below "Users".
8. **CSS.** Table with edit form per row — reuses admin table style.
9. **Tests.** Schema migration seeds correctly; update persists; reset reloads JSON; non-admin 403; unknown role 404; invalid provider/model empty body rejected.
10. **Docs.** test-guide, worklog, mark ✅.

## Files likely touched

- `server/db.ts` — schema + migration + re-exports
- `server/db/models.ts` — new helpers
- `server/config/models.ts` — refactored to be a seed-reader only (or removed)
- `server/reception.ts` — use `getModels(db)`
- `server/title.ts` — use `getModels(db)`
- `server/session-stats.ts` — use `getModels(db)`
- `server/admin-stats.ts` — use `getModels(db)`
- `adapters/web/index.tsx` — use `getModels(db)` for Agent + rail + new routes
- `adapters/web/pages/admin/models.tsx` — new page
- `adapters/web/pages/layout.tsx` — sidebar link
- `adapters/web/public/style.css` — row-edit table styling
- `tests/web.test.ts` — coverage

## Release note

Lands in **v0.6.0** alongside CV1.E3.S4, CV0.E3.S3, S4, S5. Headline candidate: *"This Mirror Shows Itself"* (mirroring v0.5.0's *"The Mirror Shows Itself"*).
