[< CV1 Depth](../)

# CV1.E15 — Model configuration per scope

**Status:** ✅ Done (2026-05-05). All 7 stories shipped in one session.

> Design source: design conversation 2026-05-05 (this session). Supersedes [`CV1.E8.S2`](../cv1-e8-pipeline-observability-eval/) (per-turn model switching with side-by-side divergent responses) — the destructive variant in this epic does the same job with a simpler model.

## Premise

Today the `main` model is a single global config (`models.role='main'`). The admin edits provider + model_id as free strings in `/admin/models`. Two pressures push beyond that:

1. **Different scenes deserve different models.** A scene of strategic deliberation wants the strongest model available; a journaling scene can run on a cheap one. The user already classifies conversations by scene — make scene the natural place to set the model.
2. **The admin needs to swap models mid-thread.** When a turn lands wrong, the obvious next move is "try this with a different model." Currently it requires editing global config or starting a new session. Per-turn rerun closes that loop.

The picker side: typing `anthropic/claude-sonnet-4-6` from memory is the wrong UX. A combobox with the live OpenRouter catalog plus a curated extension is cheap to build and lifts the floor.

## What ships

### Resolution order (precedence)

```
turn (entries.data._model_id)             ← rerun or recorded at write time
  ↑ fallback
session (sessions.model_provider, model_id) ← admin override in chat header
  ↑ fallback
scene (scenes.model_provider, model_id)     ← admin override in scene form
  ↑ fallback
global (models.role='main')                 ← /admin/models default
```

### Surfaces

- **`/admin/models`** — input replaced by combobox picker (S1)
- **`/cenas/<key>/editar`** — model picker added to the scene form (S2)
- **Conversation header** — admin-only "trocar modelo" menu (S3)
- **Per-turn kebab menu** — admin-only `⋯` replacing `×`; options: re-executar com modelo / excluir (S5)
- **Bubble badge** — `⊕ <model_short>` when the turn's model differs from the session's current default (S7)

## Stories

| Story | Status | Title |
|---|---|---|
| [`S1`](cv1-e15-s1-model-picker/) | ✅ Done | Model catalog + picker component (`/admin/models` first user) |
| [`S2`](cv1-e15-s2-scene-model/) | ✅ Done | Per-scene model override (schema + form, admin-only) |
| [`S3`](cv1-e15-s3-session-model/) | ✅ Done | Per-session model override (admin-only header pouch row) |
| [`S4`](cv1-e15-s4-resolver/) | ✅ Done | Resolver + per-turn stamping in main path |
| [`S5`](cv1-e15-s5-turn-menu/) | ✅ Done | Per-turn kebab menu (admin-only) |
| [`S6`](cv1-e15-s6-rerun-endpoint/) | ✅ Done | Destructive rerun endpoint |
| [`S7`](cv1-e15-s7-divergence-badge/) | ✅ Done | Bubble badge for model divergence |

## Out of scope

- **Per-role override at scene/session level.** Scope-level config sets `main` only. `reception`, `expression`, `title` keep their global config. The cost-tuning use case for non-main roles is sufficiently rare that the surface area cost isn't worth it.
- **Catalog auto-refresh on a timer.** Cache TTL is 1h; a manual `?refresh=1` query param is enough.
- **Cross-tenant model presets.** Each user (in the multi-tenant future) gets the same global picker; no shared "favorite models" feature.

## Decisions

- **Destructive rerun, not side-by-side.** Replaces the existing `CV1.E8.S2` (draft) which proposed branching divergent runs in the entries table. The destructive variant keeps history coherent without `divergent_runs` plumbing for this surface — the table stays for the persona/scope branching it was built for (CV1.E7.S8).
- **`provider/model` columns at scene + session, not foreign keys to `models`.** The `models` table is keyed by role; per-scope overrides aren't roles. Two columns (`model_provider TEXT`, `model_id TEXT`) keep it simple and don't introduce a new join.
- **Stamp the resolved model on every assistant entry.** `entries.data._model_provider` + `_model_id` written at append time. The `assistantMsg` from pi-ai already carries `provider`/`model` in its top-level shape, but stamping explicitly via the meta convention (`_` prefix) keeps the read path honest and survives shape changes upstream.
