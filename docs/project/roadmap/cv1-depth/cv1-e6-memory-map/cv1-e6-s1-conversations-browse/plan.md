[< Story](index.md)

# Plan: CV1.E6.S1 — Conversations browse

**Roadmap:** [CV1.E6.S1](index.md)
**Framing:** S5 (scope ateliê) gave each scope a Conversations section. Two follow-on needs surfaced from use: (a) the per-scope list with all 27 imported sessions overwhelms a quick "what's going on here" glance, and (b) there's no cross-scope view — finding "where did we discuss X?" requires knowing which scope to enter first. This story adds the cross-scope destination, with filters that honor the structure (persona × organization × journey).

The follow-up to S5 (trim to 5 + "View all (N)") and the sidebar update are sibling stories that depend on this one existing — they ship right after.

---

## Goal

A new authenticated route `/conversations` that lists the user's sessions:

- Filterable by **persona**, **organization**, **journey** via query params (one each, dropdowns; "All" = no filter).
- Sorted by last activity (most recent first) — same definition as S5.
- Paginated — default 50 per page, "Show more" loads the next 50.
- Each row matches the S5 row format (title link, persona badge, relative time, 2-line preview).
- URL params survive bookmarking and sharing.

**Validation criterion:** visiting `/conversations` returns every session in `most-recent-first` order; visiting `/conversations?organization=software-zen` returns only sessions tagged with that org; combining filters narrows further; clicking a row opens it via the existing `/conversation/<sessionId>` route from S5.

## Non-goals (v1)

- **Sidebar update.** Sibling story (CV0.E4.S9). The route exists in v1; the sidebar entry is added after.
- **S5 trim ("View all" link from the scope ateliê).** Sibling story. The full list on the scope page works fine while this story is shipping; the trim follows.
- **Multi-select filters.** One persona, one org, one journey — singular dropdowns. Multi-select earns its place when the need shows up.
- **Date range filter.** Recency sort + pagination is enough for v1.
- **Text search across content.** Filters narrow enough today. Search lands with CV1.E3.S3 (semantic memory) or as a follow-up.
- **Cursor pagination.** Offset-based for v1. Cursor is a refinement when the list grows past a few hundred and offset becomes uncomfortable.
- **Sort options.** Recency only. Sort selectors when the need arises.
- **Empty state for "no sessions at all" vs "no sessions matching filter"** — one polite empty message handles both with slightly different copy depending on whether filters are applied.

## Decisions

### D1 — URL is `/conversations` (top-level, not under `/memory`)

The Memory Map landing (`/memory`) is the future meta-surface that ties episodic + attachments + insights together. Until that landing exists, putting episodic browse at `/memory/episodic` would surface a half-built navigation. `/conversations` is a clean top-level URL, matches the sidebar label, and the future `/memory` can link out to `/conversations` as one of its cards.

### D2 — Singular `Conversation` and plural `Conversations` coexist in the sidebar

The sibling sidebar story keeps `Conversation` (singular) as the direct entry to the active session — the daily flow's single click. Adds `Conversations` (plural) as a second entry pointing to the listing. One word's difference, two purposes (continue vs browse).

### D3 — Filters via query string (`?persona=`, `?organization=`, `?journey=`)

Survives bookmarking. Survives back/forward. The "View all" link from S5's scope ateliê uses this directly: `/conversations?organization=software-zen` opens the page already filtered. No client-side state to reconcile.

### D4 — Filter dropdowns populated from existing entities

The persona dropdown lists the user's personas (from `identity` where `layer = 'persona'`). The organization dropdown lists active organizations. The journey dropdown lists active journeys. Each has an "All" option as default. Archived scopes don't appear; the user can still hit them via direct URL params if needed.

### D5 — Pagination: offset + limit, "Show more" link

Page size 50. The page renders the first 50; if there are more, a "Show more" link appends the next 50 (full reload with `?offset=50`). Simple, no client JS needed for v1.

### D6 — Same row format as S5's scope ateliê

Reuse the same visual: title link, persona badge, relative time, 2-line preview. The new context (cross-scope) means we should also show **scope badges** when present (org and journey), so the user knows where each row lives. S5's row didn't need this because the user was already on the scope page.

A new `ConversationsRow` component variant (or shared component with optional scope-badge slots) lives alongside `ScopeSessionsList`. Probably a small refactor: extract the row into its own component, used by both surfaces with different prop combinations.

### D7 — Active session indicator

The session that's currently active (the one `/conversation` resolves to) gets a subtle badge — *"current"*. Helps users locate it in the list at a glance without changing its behavior.

### D8 — Empty state has voice

- No filters, no sessions: *"No conversations yet. Start one from Conversation."*
- Filters applied, no matches: *"No conversations match these filters."* with a "Clear filters" link that returns to `/conversations` unfiltered.

### D9 — DB query: one helper, optional filter args

`server/scope-sessions.ts` (or a new `server/conversation-list.ts` if it grows) gains `getConversationsList(db, userId, opts)` where `opts` is `{ personaKey?, organizationKey?, journeyKey?, limit?, offset? }`. Returns `{ rows: ScopeSessionRow[], total: number }` so pagination can show "Showing 50 of 124".

The query reuses the meta-extraction patterns from S5 — `_persona`, `_organization`, `_journey` on assistant messages — for consistency with S5 and S7. The parallel-mechanism debt with the junction tables stays parked.

When all three filters are absent, the query returns all sessions belonging to the user with at least one assistant message (the meta lives there). Sessions without any assistant message (rare — fresh sessions before the first response) won't appear, which is acceptable.

## Steps

### Phase 1 — DB helper: getConversationsList

`server/conversation-list.ts` (new):
- `getConversationsList(db, userId, opts) → { rows, total }`
- Accepts optional `personaKey`, `organizationKey`, `journeyKey`, `limit`, `offset`.
- Same row shape as `ScopeSessionRow` plus optional `organizationKey` / `journeyKey` extracted from meta (so the UI can show scope badges).
- `total` query is a separate `SELECT COUNT(*)` over the same WHERE — used for "Showing X of Y" and to decide whether to render the "Show more" link.
- 8-10 unit tests covering: no filter, single filter, all three filters, pagination correctness, total count accuracy, isolation per user.

### Phase 2 — Route + page

`adapters/web/index.tsx`:
- New GET handler at `/conversations`. Reads query params, validates personaKey/orgKey/journeyKey exist (silently drop unknown values — no error, just no filter applied). Calls `getConversationsList`. Loads the user's personas / orgs / journeys for the dropdown options. Renders new page.

`adapters/web/pages/conversations.tsx` (new):
- `ConversationsListPage` with: filter bar (3 dropdowns + clear-all link), result count, list of rows, "Show more" if applicable.
- Probably extracts a shared `ConversationRow` from `ScopeSessionsList` (S5's component) and uses it here too. Light refactor.

CSS: small additions for the filter bar. Bump asset version per project convention.

Tests: filter combinations, pagination, empty-state copy, link to `/conversation/<sessionId>` navigation.

### Phase 3 — Active-session badge

Small detail: query the active session (same as `getOrCreateSession` does — latest `created_at`) and pass it down so the row can show a "current" badge when its id matches.

Test for the badge.

### Phase 4 — Close-out

- Worklog entry
- Mark CV1.E6.S1 ✅ in epic + roadmap
- Run full test suite, confirm green
- Manual UX validation: visit `/conversations`, filter by org/persona/journey, navigate via "Show more", click a row to continue, hit URL with bad filter → silently no filter

## Open questions (registered, not blockers)

- **Multi-org or multi-journey filters.** Sessions can be tagged with multiple orgs/journeys via the junction tables. The meta only carries one (last reception decision). v1 filter on meta = filter on "last activated scope." Acceptable. Will resurface if the user notices a session not appearing under a scope they thought it should.
- **What about sessions without scope meta at all?** A session whose assistant messages have no `_persona`/`_organization`/`_journey` (early sessions before reception was wired, or via a not-yet-stamping adapter). They'll appear in `/conversations` with no scope badges and no persona — visible, but with no filter route. Acceptable for v1.
- **Performance with thousands of sessions.** Today maxes at ~30 for the user. SQL with json_extract over `entries` is fine for that scale. With thousands, indexes on `entries.timestamp` + a generated column for `_persona` etc. would help. Documented as a deferred concern.

## Files likely touched

- `server/conversation-list.ts` — new (cross-scope list helper)
- `server/db.ts` — re-export
- `adapters/web/index.tsx` — `/conversations` route handler
- `adapters/web/pages/conversations.tsx` — new page component
- `adapters/web/pages/organizations.tsx` — possible refactor to extract `ConversationRow` from `ScopeSessionsList` (Phase 2 light refactor; defer if it grows)
- `adapters/web/public/style.css` — filter bar styling, asset version bump
- `tests/conversation-list.test.ts` — new (DB helper coverage)
- `tests/web.test.ts` — route + page rendering coverage
