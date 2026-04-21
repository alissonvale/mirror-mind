[< CV0.E4 — Home & Navigation](../index.md)

# S1 — Landing home

A new authenticated route `/` becomes the landing after login, with four bands:

1. **Greeting** — time-of-day + user name, in the mirror's quiet register
2. **State of the mirror** (admin only) — compact one-row glance: users, budget, release
3. **Latest from the mirror** — most recent release's headline + two-line digest
4. **Continue** — user's active session with a Resume CTA + up to 3 earlier threads as history

**Derived from:** 2026-04-21 conversation in modo Espelho with the `product-designer` persona. Two felt dores collapsed into a single need — too many sidebar links + no temporal anchor. Direction A from the design proposal: add a home surface now, address sidebar pruning as a follow-up (S2) once the home is stable.

- [Plan](plan.md) — scope, design, phases, files touched
- [Test guide](test-guide.md) — automated + manual acceptance walk-through
- [Refactoring](refactoring.md) — applied + parked cleanups

## Done criteria

1. `GET /` (authenticated) renders the home page; unauthenticated requests redirect to `/login`.
2. Login POST redirects to `/` (was `/mirror`).
3. All 11 release files in `docs/releases/v*.md` carry a `digest:` frontmatter field, two-line narrative in the mirror's voice.
4. Admins see a *State of the mirror* band above the release card; non-admin users do not see it and admin-only data helpers are not invoked on their render path.
5. The Continue band handles all four session states: no sessions (empty-state CTA), fresh empty session ("New conversation / not started yet"), 1 session with entries (active only, no earlier threads), 2+ sessions (active + up to 3 earlier threads, capped).
6. `npm test` green across all phases; existing chat / admin / docs flows unaffected.
