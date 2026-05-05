[< CV1.E15](../)

# CV1.E15.S3 — Per-session model override

**Status:** ✅ Done (2026-05-05). Schema + helpers + admin-only header row + POST handler. S4 will consume the persisted fields.

## Problem

When a turn lands wrong mid-thread, the obvious next move is "try this with a different model". Today this requires editing the global `/admin/models` (which leaks into every other session) or starting a new session (loses thread). S3 adds a per-session override surface in the conversation header so the admin swaps models from inside the conversation, applying from the next turn on.

## Fix

Two new columns on `sessions` (`model_provider`, `model_id`, both nullable). The conversation header's `<details class="cena-advanced">` pouch gains a "Modelo" row, **admin-only**, with a provider input + S1's `<ModelPicker>` + Save button. POST to `/conversation/model` 403s for non-admin (defense in depth — the admin gating happens at render *and* route level).

## What ships

### Schema

```sql
ALTER TABLE sessions ADD COLUMN model_provider TEXT;
ALTER TABLE sessions ADD COLUMN model_id TEXT;
```

Idempotent migration via `PRAGMA table_info(sessions)`. SCHEMA constant at the top of `db.ts` updated for fresh installs.

### Helpers (`server/db/sessions.ts`)

```ts
export interface SessionModel {
  provider: string | null;
  id: string | null;
}
export function getSessionModel(db, sessionId, userId): SessionModel;
export function setSessionModel(db, sessionId, userId, model: SessionModel): void;
```

`setSessionModel` collapses empty strings to NULL; ownership enforced (UPDATE no-ops for foreign sessions).

Re-exported from `server/db.ts` alongside the other session helpers.

### Rail state (`adapters/web/pages/context-rail.tsx`)

New `SessionModelState { provider, id }` and `RailState.sessionModel` field. `buildRailState` reads via `getSessionModel` and populates.

### Conversation header (`adapters/web/pages/conversation-header.tsx`)

- `ConversationHeaderData` gains `modelCatalog?: CatalogEntry[]`
- `AdvancedZone` accepts `isAdmin`, `sessionModel`, `modelCatalog`
- New row inside `.header-advanced-panel`, **rendered only when `isAdmin && modelCatalog`**:
  - `<input name="model_provider" list="header-model-providers">` (free text + datalist)
  - `<ModelPicker name="model_id" ...>`
  - `<button>Salvar</button>`
  - Hint copy: "Aplica do próximo turno em diante. Vazio = herda da cena ou global. Admin-only."
- Pouch summary now appends `· <model_short>` when an override is set (last `/`-segment of `model_id` so multi-vendor IDs don't blow up the pill width).

### Page wiring (`adapters/web/pages/mirror.tsx` + `adapters/web/index.tsx`)

- `MirrorPage` gains `modelCatalog?: CatalogEntry[]` and forwards to `ConversationHeader`.
- Both `GET /conversation` and `GET /conversation/:sessionId` load the catalog when `user.role === "admin"`, pass to `MirrorPage`. Non-admin requests pass `undefined`.
- The async refresh path (`refreshConversationHeader` in chat.js) re-fetches the same GET, so it inherits the admin-gated catalog automatically.

### Route handler

`POST /conversation/model` — admin-gated:

```ts
if (user.role !== "admin") return c.text("Forbidden", 403);
```

Body: `sessionId`, `model_provider`, `model_id`. Empty fields clear the override (resolver falls through to scene → global). No upstream validation — typos surface as failed LLM calls (same as `/admin/models`).

### CSS

New `.header-advanced-row-model` rule (separator above), `.header-model-form/.provider/.id/.save/.hint` rules. `style.css?v` bumped to `session-model-row-1`.

### i18n

- `header.model.label` — "Modelo" / "Model"
- `header.model.providerPlaceholder` — "openrouter"
- `header.model.save` — "Salvar" / "Save"
- `header.model.hint` — applies-from-next-turn copy

## Validation

### Tests (9 new — `tests/session-model.test.ts`)

Helper level:
- `getSessionModel` returns null/null when unset
- `setSessionModel` persists provider/id
- `setSessionModel` collapses empty strings to NULL
- `setSessionModel` ownership check no-ops on foreign sessions

Route level:
- Admin POST persists
- Admin POST with empty fields clears
- Non-admin POST returns 403 + does not mutate

Render level:
- Admin GET `/conversation` includes `action="/conversation/model"` + the two field names
- Non-admin GET excludes all three markers

Suite green at 1218/1218.

### Manual

1. Admin in `/conversation` → expand "Avançado" → see "Modelo" row at the bottom of the pouch
2. Pick a model from the datalist + provider → Save → reload, fields persist
3. Pouch summary shows `auto/auto · gemini-2.5-flash` (or similar tail)
4. Clear both fields → Save → reload, fields empty, summary back to "Avançado"
5. Non-admin user → "Modelo" row absent from the pouch
6. Non-admin tries `POST /conversation/model` via DevTools → 403

## Out of scope (deferred to S4)

- Reading the per-session model in the main turn path. Until S4 lands, the persisted fields exist but don't affect generation.
- Catalog refresh button on the row — `?refresh=1` URL param suffices.
- Showing the resolved model on the bubble badge — that's S7, depends on S4.
