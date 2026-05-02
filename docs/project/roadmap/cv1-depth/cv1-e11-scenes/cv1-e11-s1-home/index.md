[< CV1.E11](../)

# CV1.E11.S1 — Home `/inicio` (Variante C) + cold-start + briefing-in-compose

**Status:** 🟡 In progress · Opened 2026-05-02

## Problem

S4 + S7 shipped the cena data layer and the form to manage cenas. But cenas are still invisible: no surface lists them, no flow starts a conversation from one, and crucially **the LLM doesn't see them yet** — a session linked to a cena via `sessions.scene_id` composes its prompt identically to an unscoped session. The scene_id is dead data until S1 wires the briefing into composition.

S1 is also where the receptor cold-start lives: the suggestion card that appears after turn 1 of an unscoped session when the user's message matches an existing cena. Without this, users have no path from "free input" to "ah, this is my Aula Nova Acrópole conversation, let's apply that cena" without manual editing.

## Fix

A new home at `/inicio` (Variant C from the design):

```
┌─────────────────────────────────────────────────────────────────┐
│  ⌘ espelho                                                  [A] │  ← S2 top bar
├─────────────────────────────────────────────────────────────────┤
│        ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐     │
│        │ ◇ Aula  │  │ ♔ Voz   │  │ ◇ Diár. │  │ ✚ Nova  │     │
│        │ qua 20h │  │ noites  │  │ manhã   │  │  cena   │     │
│        └─────────┘  └─────────┘  └─────────┘  └─────────┘     │
│                          ─── ou ───                             │
│        ┌───────────────────────────────────────────────┐       │
│        │  Diga o que está vivo agora…              [↵] │       │
│        └───────────────────────────────────────────────┘       │
│                                                                 │
│        Recentes                                                 │
│        • Hoje    Voz da Alma   fragmento sobre paciência…      │
│        • Ontem   Aula N.A.     conexão eídos × signo…          │
│        • 2d      (sem cena)    pricing do book release…       │
└─────────────────────────────────────────────────────────────────┘
```

Three sections: cards (model), free input (improvisation), recents (resume). Plus the S2 avatar bar on top.

**Briefing-in-compose** (P4): when a session has `scene_id`, the compose pipeline injects a `## Cena: <title>` block with the cena's briefing into the system prompt. Applies to both the canonical persona path (`composeSystemPrompt`) and the Alma path (`composeAlmaPrompt`). The trivial path (CV1.E10.S1) skips it — trivial turns ignore everything.

**Cold-start** (P5): turn 1 of an unscoped session runs the normal pipeline; after the response is generated, server calls `findMatchingScene` (CV1.E11.S4). If a match exists, the response payload carries a suggestion card; client renders it below the assistant bubble with `[Continuar nessa cena]` / `[Manter sem cena]`. Accept POSTs to `/conversation/<sessId>/apply-scene` which sets `sessions.scene_id`. Cena applies from turn 2 onward — turn 1 is not re-run.

## What ships

### Routes (additive)

```
GET  /inicio                          — new home page (avatar top bar + Variant C)
POST /inicio                          — free input → create fresh session → redirect
POST /conversation/:sessId/apply-scene — accept cold-start suggestion
```

### Pages

- `adapters/web/pages/avatar-top-bar.tsx` (S2) — shared chrome component
- `adapters/web/pages/home-inicio.tsx` (S1) — `InicioPage` + scene cards + recents

### Compose pipeline changes (P4)

- `composeSystemPrompt(...)` and `composeAlmaPrompt(...)` accept an optional `scene` parameter (a `Scene` object). When provided, the function appends a `## Cena: <title>` block with the briefing as content.
- Adapters (web stream, web sync, telegram) look up `scene` via `session.scene_id` before calling compose.
- `composedSnapshot` includes the cena block when applied — the rail's "Look inside" reflects truth.

### Cold-start (P5)

- Server: after pipeline finishes, if `session.scene_id === null && isFirstTurn`, run `findMatchingScene(db, userId, reception)`. If non-null, attach `{cenaSuggestion: {key, title, glyph}}` to the response payload (web sync, web stream, telegram all share the shape).
- Client (`chat.js`): on response with `cenaSuggestion`, render a suggestion card below the bubble. Two buttons: Accept (POST apply-scene → reload to update header) and Dismiss (remove card).
- Apply endpoint: `POST /conversation/:sessId/apply-scene` with `{key}` body → ownership check → setSessionScene → 200.

### i18n

Namespace `home.*` and `topbar.*` for new strings. en + pt-BR.

## Tests

- `tests/avatar-top-bar.test.ts` — component renders correct items by user role (admin sees Admin/Docs; regular user doesn't)
- `tests/inicio-routes.test.ts` — GET /inicio shows cards + recents; POST /inicio creates session and redirects to /conversation/<id>
- `tests/compose-with-scene.test.ts` (extends identity.test.ts) — composeSystemPrompt with scene injects briefing block; composeAlmaPrompt likewise; trivial path skips
- `tests/composed-snapshot.test.ts` extension — snapshot includes scene block
- `tests/cold-start.test.ts` — pipeline with unscoped session + matching scene returns suggestion in payload; turn 2 doesn't; apply-scene sets scene_id

## Non-goals (parked)

- **Onboarding seed (Voz da Alma default)** — S6, post-arc.
- **Cutover (redirect / → /inicio)** — S5, post-arc.
- **Memória dashboard** — S3, post-arc.
- **Card hover menu (⋯ with Editar/Duplicar/Arquivar)** — minimal action set in v1: click card → enter scene; everything else via the cena form (`/cenas/<key>/editar`).
- **Mobile breakpoint polish** — desktop-first; mobile gets stacked cards via existing responsive CSS.

## Risks

- **Compose pipeline change touches the heart.** `composeSystemPrompt` is the most-tested function in the codebase. Mitigation: optional parameter, default behavior unchanged when scene is null. Tests cover both paths.
- **Cold-start in the streaming adapter.** The current SSE flow streams text deltas; injecting a suggestion event needs careful event ordering (after the final text event, before close). Web sync adapter is simpler — JSON response already has structure.
- **`/inicio` chrome doesn't match the rest of the app.** Acceptable per design; old surfaces keep sidebar until S5 cutover.
- **Apply-scene mid-conversation.** Accepting a suggestion mid-conversation causes the next turn to compose with the cena's briefing. The earlier turns aren't retroactively re-composed. Acceptable — the design explicitly says turn 1 is not re-run.

## Phases

| # | Phase | Scope |
|---|---|---|
| 1 | Story docs | This folder + S2 folder + epic index update |
| 2 | S2 — Avatar top bar | Component + dropdown JS + i18n + tests |
| 3 | S1 skeleton | `/inicio` route + page + cards + free input + recents |
| 4 | Briefing in compose | composeSystemPrompt + composeAlmaPrompt + composedSnapshot + adapters |
| 5 | Cold-start suggestion | findMatchingScene wired in adapters + suggestion in payload + chat.js renders card + apply-scene endpoint |
| 6 | Wrap-up | worklog, decisions, badges |

## Docs

- [Plan](plan.md)
- [Test guide](test-guide.md)
- [Sibling — S2 Avatar top bar](../cv1-e11-s2-top-bar/)
- [Design — scenes-home-design.md](../../../../design/scenes-home-design.md)
