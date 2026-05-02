[< Story](index.md)

# Plan — CV1.E11.S3 Memória dashboard

Five phases. Each ends with `npm test` green and a commit.

## Phase 1 — Story docs

This folder + epic index update.

Commit: `docs(cv1-e11-s3): open story — Memória dashboard`

## Phase 2 — Dashboard + /cenas list + routes

**Files:**

- `adapters/web/pages/memoria.tsx` — `MemoriaPage({user, scenes, journeys, organizations, recents})` rendering the 2×2 grid + Histórico. Uses `TopBarLayout`. Reuses `conversations-rows` styling for Histórico.
- `adapters/web/pages/cenas-list.tsx` — `CenasListPage({user, scenes})` rendering a simple grid of `CenaCard` (imported/duplicated from home-inicio.tsx) for active cenas. TopBarLayout chrome.
- Two new routes in `adapters/web/index.tsx`:
  - `web.get("/memoria")` — loads cenas, journeys, orgs, recents; renders `MemoriaPage`
  - `web.get("/cenas")` — loads scenes; renders `CenasListPage`. Replaces the placeholder behavior; same data path as `/inicio` cards.
- Replace the old `/memoria` placeholder text route with the real handler.
- Reuse `loadRecentSessionsWithScene` (or similar helper to enrich `RecentSession` with sceneTitle — already implicitly built in inicio handler; lift to a shared helper).
- i18n: `memoria.*` namespace in en + pt-BR (~12 keys).

**Tests:** `tests/memoria-routes.test.ts` — basic 200 + render checks; `tests/cenas-list-route.test.ts` — 200 + cards render.

Commit: `feat(memoria): /memoria dashboard + /cenas list page`

## Phase 3 — Empty states

Each card renders even when its collection is empty.

Card empty-state pattern:
```
┌──────────────┐
│  Cenas       │
│  0 ativas    │
│              │
│  Nenhuma     │
│  cena ainda. │
│  + Criar     │
└──────────────┘
```

Library is permanently in "em breve" mode — its empty state is the placeholder text "atalhos pra documentos e materiais que viram contexto. Em breve."

i18n keys for empty copy.

Tests: render with empty arrays for each card; assert empty-state text + create link present.

Commit: `feat(memoria): empty states + library placeholder`

## Phase 4 — Histórico polish

- Cap recents at 20 rows (already capped at 8 on /inicio; bump for memoria's full-width context)
- "ver tudo →" link at the bottom of Histórico → `/conversations`
- Header line: "N conversas" or "N conversas — M esta semana" if we want to compute. Keep it simple in v1: just `N conversas` total, no weekly breakdown.

Tests: assert "ver tudo" link, count rendering.

Commit: `feat(memoria): histórico — cap 20 + ver tudo link`

## Phase 5 — Wrap-up

Worklog Done entry + decisions doc + badges.

Commit: `docs(cv1-e11-s3): close story — Memória dashboard ready`

## Risks across phases

- **`/memoria` was a placeholder route from S1.** P2 replaces it; no migration concern (just delete the placeholder line).
- **`CenaCard` reuse from home-inicio.tsx.** Either export it as a named component or duplicate the markup. Prefer export — reduces drift.
- **Histórico data shape duplication.** The `loadRecentSessionsWithScene` enrichment is currently inline in /inicio; lift to a shared helper for memoria use.
- **Library placeholder copy needs to be honest.** Avoid "coming soon!" marketing tone — match the project's "Quiet Luxury" voice. Suggested copy: "Atalhos para documentos e materiais que viram contexto. Em construção."

## Out of scope (re-affirmed)

- No filter UI on Histórico
- No search
- No pagination on Histórico (cap + link out)
- No Library functionality
