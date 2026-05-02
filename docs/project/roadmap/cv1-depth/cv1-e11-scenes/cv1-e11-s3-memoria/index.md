[< CV1.E11](../)

# CV1.E11.S3 — Memória dashboard em `/memoria`

**Status:** 🟡 In progress · Opened 2026-05-02

## Problem

The avatar menu's "Minha Memória" link is a placeholder text response today (`em construção`). The locked design (Memória dashboard) is the **second user-facing surface** of the cena pivot — the place where the world-as-experienced (orgs, travessias, library, history, scenes) lives, distinct from the Mapa Cognitivo (psyche layers: self/ego/personas).

Without `/memoria`, the user has no integrated view of what they've accumulated — they can browse `/conversations`, `/organizations`, `/journeys` separately via the sidebar, but those are old-chrome surfaces, scattered and equal-weighted. The dashboard is where they cohere into a single map.

## Fix

A new `/memoria` page that renders a 2×2 grid of cards (Cenas, Travessias, Organizações, Library) plus a full-width Histórico section below — exactly the layout in the locked design. Each card shows a count, three recent items, and a "ver →" link. Histórico mirrors the `conversations-rows` markup from `/conversations` so the visual is consistent.

```
┌─────────────────────────────────────────────────────────────────┐
│  ⌘ espelho                                                  [A] │
├─────────────────────────────────────────────────────────────────┤
│  Minha Memória                                                  │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐                            │
│  │  Cenas       │  │  Travessias  │                            │
│  │  4 ativas    │  │  5 ativas    │                            │
│  │  ◇ Aula NA   │  │  • mirror    │                            │
│  │  ♔ Voz Alma  │  │  • o-espelho │                            │
│  │  ◇ Diário    │  │  • walden    │                            │
│  │  ver →       │  │  ver →       │                            │
│  └──────────────┘  └──────────────┘                            │
│  ┌──────────────┐  ┌──────────────┐                            │
│  │  Orgs        │  │  Library     │                            │
│  │  2 ativas    │  │  em breve    │                            │
│  │  ⌂ S.Zen     │  │  (vazio)     │                            │
│  │  ⌂ N.A.      │  │              │                            │
│  │  ver →       │  │  CV1.E4.S2   │                            │
│  └──────────────┘  └──────────────┘                            │
│                                                                 │
│  Histórico                                                      │
│  ─────────                                                      │
│  N conversas — M esta semana                                    │
│  • Hoje  Voz da Alma  fragmento sobre paciência…               │
│  • ...                                                          │
│  ver tudo →                                                     │
└─────────────────────────────────────────────────────────────────┘
```

## What ships

### Routes

```
GET /memoria       — dashboard (grid 2×2 + Histórico)
GET /cenas         — simple list page (cenas reading from listScenesForUser)
                     created here so the "ver →" link on the Cenas card works
```

### Pages

- `adapters/web/pages/memoria.tsx` — `MemoriaPage` (TopBarLayout chrome)
- `adapters/web/pages/cenas-list.tsx` — `CenasListPage` (TopBarLayout chrome; reuses CenaCard from `home-inicio.tsx`)

### Card semantics

| Card | Count source | Items | "ver →" target |
|---|---|---|---|
| Cenas | `listScenesForUser` (active) | first 3 by recent activity | `/cenas` |
| Travessias | `getJourneys` (active) | first 3 by sort_order | `/journeys` |
| Orgs | `getOrganizations` (active) | first 3 by sort_order | `/organizations` |
| Library | static "em breve" + 0 count | placeholder text | (no link, badge `em breve`) |

Library is a deliberate **honest placeholder** (option a from the planning conversation): the attachment subsystem is CV1.E4.S2 backlog. Renders the slot so the dashboard's 2×2 shape lands; surfaces a clear "the feature exists, it's just not ready yet" signal instead of pretending the slot doesn't exist.

### Empty states (P3)

Each card renders even when its collection is empty — the card stays in the grid, the count says "0 active" (or locale equivalent), and the items section says "Nenhuma X ainda — crie a primeira" with a link to the create surface. Per the locked design ("Empty state: new tenant with 0 records still renders all five cards. Each card shows its empty state rather than hiding").

### Histórico

Full-width section below the grid. Reuses `conversations-rows` markup (just like `/inicio`'s recents) so the visual matches `/conversations` exactly. Limited to ~20 most recent sessions; "ver tudo →" link at the bottom navigates to `/conversations` for filters and pagination. **No new filter UI in S3** — defer to follow-up if real use surfaces it.

## Tests

- `tests/memoria-routes.test.ts` — GET /memoria returns 200; renders all 4 cards; renders Histórico section; renders empty states when collections are empty; admin gating not relevant (any user)
- `tests/cenas-list-route.test.ts` — GET /cenas returns 200; renders existing cenas; empty-state when none

## Non-goals (parked)

- **Cena hover ⋯ menu** on the dashboard cards — keep it minimal; editing is via `/cenas/<key>/editar`
- **Histórico filters** — defer to a follow-up
- **Library functionality** — CV1.E4.S2 backlog
- **Search across the whole memory** — out of scope
- **Pagination on Histórico** — show top 20; "ver tudo" goes to `/conversations`

## Risks

- **`/cenas` list page is new surface created in this story.** Small (~50 LOC), but worth flagging — it's a sub-deliverable not in S3's name. The alternative (link to a non-existent route) would be worse UX.
- **Empty state copy needs i18n in en + pt-BR** — 4 keys (one per card). Skip-able if neglected.
- **Memória dashboard sits on TopBarLayout.** Same chrome as `/inicio`. No new chrome work.

## Phases

| # | Phase | Scope |
|---|---|---|
| 1 | Story docs | This folder + epic index update |
| 2 | Dashboard page + /cenas list + routes | Grid + Histórico (with data); /cenas list route |
| 3 | Empty states | Each card renders an empty-state branch with create link |
| 4 | Histórico polish | "ver tudo →" link + cap at 20 + i18n strings |
| 5 | Wrap-up | worklog, decisions, badges |

## Docs

- [Plan](plan.md)
- [Test guide](test-guide.md)
- [Design — scenes-home-design.md](../../../../design/scenes-home-design.md) (Memória section)
