[< CV1.E4 — Journey Map](../index.md)

# S4 — Manual scope tagging

A session declares a **pool** of contexts — personas, organizations, journeys — that the conversation operates within. Reception still runs per turn, but its candidate pool is narrowed to the tagged set. When no tags are set for a type, reception is unconstrained (backward-compatible). On the first turn of a fresh session, reception's picks auto-populate the session tags — the "suggested" default.

The shift in relational model:

| Relationship | Before | After |
|--------------|--------|-------|
| Session ↔ personas | 1 : N (one per turn, via `_persona` meta) | N : N (junction `session_personas`) |
| Session ↔ organizations | 1 : N (one per turn) | N : N (`session_organizations`) |
| Session ↔ journeys | 1 : N (one per turn) | N : N (`session_journeys`) |

All three junctions use string keys — consistent with reception's output and with how scopes are referenced everywhere else in the codebase.

**Hybrid model (chosen):**
- Session declares the *pool* of available contexts
- Reception picks *within* the pool each turn
- User can *correct* by editing the pool from the Context Rail at any time
- Persona stays singular per turn (the mirror has one voice); orgs and journeys compose multi into the prompt

**Derived from:** 2026-04-21 modo Espelho conversation. User surfaced that perfect reception can't be guaranteed, and manual override needed to be a first-class affordance. Five design questions were answered up-front:

1. Hybrid (session pool + per-turn routing + user correction)
2. User can correct at any time
3. Suggested (first-turn auto-population from reception)
4. Context Rail as the UI surface
5. No backfill — new sessions start clean

- [Plan](plan.md) — scope, schema, composer rules, rail UI, phases
- [Test guide](test-guide.md) — automated + manual acceptance

## Done criteria

1. Three junction tables (`session_personas`, `session_organizations`, `session_journeys`) with composite PK.
2. CRUD helpers for each type: `get`, `add`, `remove`, plus `clearSessionTags`. `forgetSession` cascades.
3. Reception filters candidates by session tags before calling the LLM. Empty lists = no filter.
4. Composer renders **all** tagged orgs and **all** tagged journeys into the prompt. Persona stays singular (reception's pick within pool). When a type has no tags, falls back to reception's single pick.
5. First turn of an empty session auto-populates tags with reception's picks (the "suggested" default).
6. Context Rail shows a "Scope of this conversation" section with three tag groups. Each group renders tagged keys as removable pills + a dropdown-add form.
7. Two endpoints, `POST /conversation/tag` and `POST /conversation/untag`, each take `type` and `key`.
8. Tests cover all five above; reception has +4 tests; composer has +5; web has +5. Total 362, zero regressions.
