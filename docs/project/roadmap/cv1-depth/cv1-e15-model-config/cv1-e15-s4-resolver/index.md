[< CV1.E15](../)

# CV1.E15.S4 — Resolver + per-turn stamping

**Status:** ✅ Done (2026-05-05). The keystone — turns now honor session/scene model overrides and every assistant entry stamps the model that produced it.

## Problem

S2 and S3 persisted `scenes.{model_provider, model_id}` and `sessions.{model_provider, model_id}`, but the main path still reads `getModels(db).main` directly. Without a resolver chain, the persisted overrides are dead weight.

## Fix

New `server/main-model-resolver.ts` with `resolveMainModel(db, sessionId, userId)`:

```
session  ← sessions.{model_provider, model_id}  (S3)
   ↑ fallback
scene    ← scenes.{model_provider, model_id}    (S2)
   ↑ fallback
global   ← models[role='main']                  (CV0.E3.S1)
```

Each tier requires **both** provider and id; partial values fall through. The returned `ResolvedMainModel` carries `{ provider, model, source, globalConfig }` — `source` is what S7 will read to badge bubbles whose model differs from the session's current default.

Every main path swaps `getModels(db).main` for `resolveMainModel(db, sessionId, user.id)`:

- `server/index.tsx` (API adapter) — main turn
- `adapters/web/index.tsx` (web SSE) — main streaming turn
- `adapters/web/index.tsx` (divergent runs) — branch on persona/scope, honor session model
- `adapters/telegram/index.ts` — telegram turn

Every assistant entry now stamps `_model_provider` and `_model_id` in its meta dict. `logLlmCall` uses the resolved values, so admin can see in `/admin/llm-logs` which model actually ran each turn.

## Auth handling (out of scope, recorded)

`resolveApiKey(db, "main")` still resolves through the global main role. When session/scene overrides stay inside the same provider as global (the common case — admin pinning a different OpenRouter model), env-based auth keeps working unchanged. **Cross-provider overrides** (e.g. main=openrouter but session=anthropic-direct OAuth) would need a richer auth resolver. Not blocking S4: documented as follow-up.

## What ships

### New files

- `server/main-model-resolver.ts` — the resolver
- `tests/main-model-resolver.test.ts` — 7 unit tests

### Edited files

- `server/index.tsx` — API adapter
- `adapters/web/index.tsx` — web SSE main path + divergent run
- `adapters/telegram/index.ts` — telegram path

## Validation

### Unit tests (7 new)

- Returns global when no override
- Session override wins over global
- Session partial override (only id) falls through
- Scene override wins when session has no override
- Session override wins over scene override
- Scene partial override falls through to global
- `globalConfig` always populated regardless of source

### Manual

1. Send a message in a session with no override → check `/admin/llm-logs` shows global model
2. Set per-session model override (S3 admin row) to a different model → next turn → `/admin/llm-logs` shows the override model
3. Anchor session to a cena that has its own model override (S2) → clear session override → next turn uses cena's model
4. `entries.data` JSON for a recent assistant turn carries `_model_provider` and `_model_id` (verify via SQLite or `/admin/llm-logs`)

## Out of scope (deferred to S5/S6/S7)

- Per-turn rerun via UI menu (S5 + S6)
- Bubble badge for model divergence (S7)
- `session-stats` price/cost using resolver (today still global) — minor inaccuracy in the rail's cost line; doesn't affect generation
- Cross-provider auth resolution — out of scope, documented above
