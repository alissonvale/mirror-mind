[< CV1.E11](../)

# CV1.E11.S6 + S5 — Onboarding seed + cutover (final arc)

**Status:** 🟡 In progress · Opened 2026-05-02

## Problem

Two stories closing the cena pivot epic:

**S6.** New tenants today are born with empty `self/soul`, empty `self/doctrine`, and no cenas — only `ego/behavior` + `ego/expression` are seeded. The first time a user logs in to `/inicio`, they see an empty state with a `+ Nova cena` card and an empty Histórico — a true blank slate. Per the locked design, the empty home is **never seen**: tenants are seeded with a default Voz da Alma cena + Alisson's doctrine as the v1 default content.

**S5.** `GET /` still renders the old sidebar-chrome `HomePage` (CV0.E4.S1). The cena pivot installed `/inicio` as the new home but `/` was left untouched per the strangler approach. Cutover redirects `/` → `/inicio` so the new chrome becomes the canonical entry point.

## Fix

**S6** extends `handleUserAdd` in `server/admin.ts` to seed three things after `createUser`:
1. `self/doctrine` from `docs/seed/alisson/doctrine.md`
2. `self/soul` — empty for now (no canonical Alisson seed file exists yet); the user fills via `/map/self/soul` workshop on first use
3. A Voz da Alma cena via `createScene(db, userId, 'voz-da-alma', { title: 'Voz da Alma', voice: 'alma', briefing: '' })`

When adoption widens beyond the household, a follow-up will add a `--seed` flag to the admin command so other tenants don't get Alisson's doctrine — registered as task `76efa059` already in backlog.

**S5** changes `web.get("/")` from rendering `HomePage` to issuing a 302 redirect to `/inicio`. The `HomePage` component itself stays in the codebase (it's still imported in tests) — removing it is a future cleanup. Old surfaces (`/conversation`, `/map`, `/personas`, `/organizations`, `/journeys`) keep their sidebar chrome — they're reachable via direct URL or via Memória dashboard item links. Migration to TopBarLayout is a separate, larger refactor not in scope for this arc.

## What ships

### S6

- `server/admin.ts` `handleUserAdd` extended with:
  - Read `docs/seed/alisson/doctrine.md` (gracefully skipping if file missing — defensive for repos that don't carry it)
  - `setIdentityLayer(db, user.id, 'self', 'doctrine', doctrine)`
  - `createScene(db, user.id, 'voz-da-alma', { title: 'Voz da Alma', voice: 'alma', briefing: '' })`
- Console output mentions the seeded cena so admin knows the new tenant has a Voz da Alma ready

### S5

- `web.get("/")` → `c.redirect("/inicio")`
- Existing HomePage tests (if any) updated to expect 302
- Admin route `/admin` unchanged (it's a separate page; `/` was the old user home)

### Tests

- `tests/onboarding-seed.test.ts` — provisioning a fresh user creates self/doctrine layer + voz-da-alma cena (when seed file present); skips gracefully when seed file missing
- `tests/web.test.ts` (or new `tests/cutover.test.ts`) — `GET /` returns 302 to `/inicio`

## Non-goals

- **Migrate `/map`, `/personas`, `/organizations`, `/journeys`, `/conversation` to TopBarLayout** — out of scope; future per-surface refactors. Sidebar still serves them.
- **Remove the `HomePage` component** — code stays, just no longer routed. Future cleanup task.
- **Custom `--seed` flag for non-Alisson tenants** — backlog task `76efa059`.
- **Seed `self/soul`** — left empty; the Mapa Cognitivo's "create the layer" invitation surfaces it for the user.
- **Seed an empty user's `ego/behavior` from a richer template** — current behavior preserved.

## Risks

- **Doctrine seed file may not exist in fresh clones.** Defensive read with try/catch — log but don't fail user creation. The user lands without doctrine; the workshop fills it later.
- **Voz da Alma cena conflicts** if admin re-runs `user add` somehow — `createUser` already errors on duplicate name (line 79-82 in admin.ts), so the seed never runs twice.
- **Old `GET /` had analytics/admin state** (latestRelease, burn rate) — that work was for the old home. Redirect drops it; admin sees the same admin state on `/admin` route. No data loss.

## Phases

| # | Phase | Scope |
|---|---|---|
| 1 | Story docs | This folder + epic index update |
| 2 | S6 — onboarding seed | Extend handleUserAdd + tests |
| 3 | S5 — cutover | Redirect / → /inicio + tests |
| 4 | Wrap-up | worklog, decisions, badges, close epic |

## Docs

- [Plan in this index] (S6+S5 combined; small enough to skip a separate plan.md)
- [Test guide](test-guide.md)
- [Design — scenes-home-design.md](../../../../design/scenes-home-design.md)
