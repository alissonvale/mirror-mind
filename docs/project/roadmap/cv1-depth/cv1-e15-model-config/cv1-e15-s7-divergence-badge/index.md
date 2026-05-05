[< CV1.E15](../)

# CV1.E15.S7 — Per-session toggle for model badges

**Status:** ✅ Done (2026-05-05); revised same-day after a usability pass.

> **Naming retained for traceability.** This story shipped first as a "divergence badge" — render `⊕ <model>` on bubbles whose stamped `_model_id` differed from the session's currently-resolved model. In manual testing the rule was hard to predict (badge appeared / disappeared as the resolver chain changed under the admin's feet) and the Look-inside rail's "model" line still showed the global default, lying when the session mixed. The story was rewritten as a **per-session toggle**. The folder name keeps the original slug for git history continuity.

## Problem

Once turns can run on different models (S2 scene override, S3 session override, S6 rerun), the admin needs a way to **see** which model produced each turn while comparing options. The first take (auto-show on divergence) inverted the agency: the admin couldn't choose when badges appear; they appeared as a side-effect of resolver-chain state. Wrong primitive.

## Fix

A binary toggle inside the Advanced pouch (admin-only):

- **Off** (default) → no model badges anywhere; the chrome stays quiet.
- **On** → every assistant bubble with a stamped `_model_id` shows `⊕ <model_short>` in the badges row.

Persisted on `sessions.show_model_badges` (per-session, not user-level): the admin turns it on in the conversation where they're actively comparing, and it stays on across visits to that conversation without leaking into other sessions where the comparison isn't relevant.

In parallel, the **Look-inside rail's "model" line** stops claiming a single model and instead surfaces the actual mix: `gemini-2.5-flash ×7, claude-sonnet-4-6 ×2` (sorted by count desc, then id asc). Pre-S4 turns (no stamp) are silent.

## What ships

### Schema

```sql
ALTER TABLE sessions ADD COLUMN show_model_badges INTEGER NOT NULL DEFAULT 0;
```

Idempotent migration. SCHEMA constant updated.

### Helpers (`server/db/sessions.ts`)

```ts
export function getSessionShowModelBadges(db, sessionId, userId): boolean;
export function setSessionShowModelBadges(db, sessionId, userId, value: boolean): void;
```

Re-exported from `server/db.ts`.

### Rail state

`SessionStats.model: string` retires; in its place `SessionStats.models: Array<{ model_id, count }>` aggregated from `entries.data._model_id` on assistant entries via SQL `GROUP BY`. `RailState.showModelBadges: { enabled }` populated by `buildRailState`.

### UI

- New row in `AdvancedZone` (admin-only): label `Modelo por turno`, segmented `ocultar / mostrar` (POST `/conversation/show-model-badges`).
- `mirror.tsx` bubble badge logic: `assistant && _model_id && rail.showModelBadges.enabled`.
- `context-rail.tsx` Composto/model row: maps `models[]` to `${tail} ×${count}` (`×1` collapsed). New `shortModelId()` helper.
- `chat.js` `updateRail` mirrors the format on live updates.
- `chat.js` streaming bubble: paints the badge in the `done` event when toggle is on AND the server-shipped `event.assistantModel.id` is set; the `done` SSE payload now carries `assistantModel: { provider, id }` from the resolver.
- `#messages` SSR exposes `data-show-model-badges="true|false"` so streamed bubbles can read the active state without a round-trip.

### Route

`POST /conversation/show-model-badges` — admin-only (403 for non-admin); body: `sessionId`, `show=0|1`. Native form submit + redirect (no async path); the page reload picks up the new state for SSR'd bubbles + streamed bubble logic alike.

### Retired

- `MirrorPage.currentMainModel` prop and the `resolveMainModel` pre-compute in the two `/conversation` GET handlers — no longer needed; the badge no longer compares against a "current" reference.
- The "differs from current default" rule in the badge code path.

## Tests

`tests/show-model-badges-toggle.test.ts` (7 new):
- Helper default false + round-trip true/false
- Admin POST persists 1, persists 0, returns 302
- Non-admin POST returns 403
- `computeSessionStats` aggregates `_model_id` correctly across multiple turns + multiple models
- `computeSessionStats` skips entries without `_model_id` (pre-S4 back-compat)

Existing `session-stats.test.ts` updated: `stats.model` removed, `stats.models` expected as `[]` on empty.

Suite at 1248/1248.

## Validation (manual)

1. Default: nova conversa, segmented em `ocultar`, nenhum badge.
2. Click `mostrar` → reload → todas as bolhas assistant com `⊕ <tail>`.
3. Olhar Dentro → linha "Composto" mostra `<model> ×N` por modelo distinto, com contagem.
4. Mandar mensagem com toggle on → bolha streamada já chega com badge no `done` event.
5. Outra conversa → toggle volta a `ocultar` (default per-session).
6. Voltar à conversa anterior → toggle persiste em `mostrar`.

## Out of scope

- User-level "show by default everywhere" preference — per-session was the user's explicit ask; if it stops feeling right, the surface migration is small (column on `users`, fallback chain when `sessions.show_model_badges` is not set).
- Live toggle without reload — saving the toggle currently triggers a native form submit + reload. A `refreshConversationHeader`-style async + DOM walk would work but isn't worth the code on a low-frequency toggle.
- Cost dashboard with model breakdown — `/admin/llm-logs` already filters by model.
