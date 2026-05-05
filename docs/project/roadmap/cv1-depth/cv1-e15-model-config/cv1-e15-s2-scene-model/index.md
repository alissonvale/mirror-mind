[< CV1.E15](../)

# CV1.E15.S2 — Per-scene model override

**Status:** ✅ Done (2026-05-05). Schema, helpers, form fields, route handlers, tests. S4 will consume the persisted fields in the resolver.

## Problem

The `main` model is a single global. A scene of strategic deliberation wants the strongest model the budget allows; a journaling scene runs fine on a cheap one. Today the admin has to flip the global config back and forth — coarse and stateful in the wrong place.

## Fix

Two new columns on `scenes` (`model_provider`, `model_id`) plus a model picker in the scene form's `<details class="cena-advanced">`, admin-only. NULL means "inherit from the global". S4 will consume these in the main path; S2 just persists.

## What ships

### Schema

```sql
ALTER TABLE scenes ADD COLUMN model_provider TEXT;
ALTER TABLE scenes ADD COLUMN model_id TEXT;
```

Idempotent migration (same shape as the prior scene-column adds — `PRAGMA table_info(scenes)` check).

### Helpers (`server/db/scenes.ts`)

- `Scene` + `SceneRow` interfaces gain `model_provider: string | null`, `model_id: string | null`.
- `CreateSceneFields` + `UpdateSceneFields` accept the same.
- `createScene` / `updateScene` insert/update both columns.
- `rowToScene` maps them through.

### Form (`adapters/web/pages/cenas-form.tsx`)

- `CenaFormData` gains `model_provider: string`, `model_id: string`.
- `cenaToFormData` reads them with `?? ""` fallback.
- `emptyCenaFormData` initializes them empty.
- New block inside `<details class="cena-advanced">`, **rendered only when `user.role === "admin"`**:
  - Provider input (text, optional, `name="model_provider"`)
  - `<ModelPicker name="model_id" ...>` with the catalog (loaded server-side and passed as a prop)

Non-admin users don't see the field. Defense-in-depth: the route handler ignores the fields when the requester isn't admin.

### Route handler

- `POST /cenas/nova` and `POST /cenas/:key/editar`: parse `model_provider` / `model_id` from the body **only when `user.role === "admin"`**; pass to `createScene`/`updateScene`. For non-admin, omit the fields (preserving existing values on edit, leaving null on create).

### i18n

- `scenes.form.advanced.modelProvider.label`
- `scenes.form.advanced.modelProvider.placeholder`
- `scenes.form.advanced.modelId.label`
- `scenes.form.advanced.modelHint` — "vazio = usa modelo global"

## Validation

### Unit / integration

- `tests/cenas.test.ts` (or new `cenas-model.test.ts`):
  - migration adds the two columns idempotently
  - `createScene` accepts model fields; `getSceneByKey` reads them back
  - `updateScene` updates both fields independently
  - empty strings normalize to null
- Smoke + full suite stay green.

### Manual

- Admin creates a cena with model_provider=openrouter, model_id=anthropic/claude-sonnet-4-6 → reload, fields persist
- Admin clears the fields → cena reverts to "inherit"
- Non-admin opens the same cena → no model fields visible; submit doesn't disturb existing values
- The picker uses the catalog from S1 (datalist suggests OpenRouter entries)

## Out of scope (deferred to S4)

- Reading the per-scene model in the main turn path. Until S4 lands, the persisted fields exist but don't affect generation.
- Showing the active scene's model in `/espelho` or the rail. The Look-inside rail's `model` row already shows `state.sessionStats.model` (the actual model used) — that surfaces the resolved value once S4 plumbs it through.
