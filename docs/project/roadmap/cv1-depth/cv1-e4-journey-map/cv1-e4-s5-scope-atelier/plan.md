[< Story](index.md)

# Plan: CV1.E4.S5 — Scope page becomes an ateliê

**Roadmap:** [CV1.E4.S5](index.md)
**Framing:** S9 (conversation import) revealed an acute gap — 27 imported sessions in `software-zen` have nowhere to be browsed. The Begin again worklog already noted this *"no UI surfaces the preserved sessions yet"* with the expectation that an Episodic Memory surface (CV1.E6) would handle it. With imports, the gap moved from latent to acute. This story closes it for scoped sessions, without building the global Memory Map yet.

---

## Goal

`/organizations/<X>` and `/journeys/<X>` gain a **Sessions** section listing every session tagged to that scope. Clicking a session opens it for continuation — the user can read, scroll, and resume.

The page becomes an ateliê: identity (briefing + situation + summary), then sessions (the work that happened in this context).

**Validation criterion:** the 27 imported sessions in `software-zen` show up at `/organizations/software-zen` as a scrollable list ordered most-recent-first; clicking any one opens it at `/conversation/<sessionId>` with the full transcript loaded; sending a new message continues the same session.

## Non-goals (v1)

- **Global "all sessions" surface.** The mirror's distinguishing structure is that sessions belong to scopes/personas — a flat global list erases that. If the user wants "everything," they accumulate through scope pages. The eventual Memory Map (CV1.E6) is the right home for cross-scope browse, not this story.
- **Sessions without org/journey.** Imported sessions all have at least a persona; orphan handling (sessions tagged only with persona, or with nothing) is a separate concern. Flagged in *Open questions* below.
- **Search across session content.** Title + first-line preview is enough for v1. Semantic search lands with CV1.E3.S3.
- **Read-only mode.** Clicking a session opens it for continuation. No separate "read" view. The current chat surface already lets you scroll up and read; that's enough.
- **Filters.** No persona/time/length filters in v1. Most-recent-first sort. Filters earn their right when the list overwhelms; with 27 sessions in a scope, scroll suffices.
- **Pagination.** Lazy load if any one scope passes ~50 sessions in practice. Render all in v1; revisit if the page feels slow with the actual data.
- **Replacing the "Last conversation" card from S7.** It was good for a sparse scope; with the full list, it becomes redundant. Remove it.

## Decisions

### D1 — Sessions section replaces the S7 "Last conversation" card

The S7 single-card surface is generalized: instead of just the latest, render every session in this scope. The earlier work isn't wasted — the SQL pattern (`scope-sessions.ts`) extends naturally to "all sessions per scope" by removing the `LIMIT 1`.

### D2 — Session shape on the list

Each session row shows:
- **Title** (links to `/conversation/<sessionId>`)
- **Persona badge(s)** — singular in practice today; the row supports multi for future
- **Relative time** — "há 2 dias", "há 3 meses", same helper as elsewhere
- **First-line preview** — first user message, single line, truncated (~120 chars). Surfaces what the conversation was *about* without forcing the user to remember from the title alone.

No avatars, no engagement metrics, no badges for org/journey (the user is already on that scope's page). Quiet.

### D3 — Click navigates to `/conversation/<sessionId>`

A new route pattern: `/conversation/<sessionId>` loads the named session as the active conversation. The default `/conversation` continues to use the user's current "active" session (latest by `created_at`). Visiting `/conversation/<sessionId>` makes that session the new active session for subsequent default loads — implemented by updating the session's `created_at` to a strictly-newer value (same monotonic-bump pattern `createFreshSession` already uses).

Rationale: the existing `getOrCreateSession` and the chat path use "latest by created_at" to resolve "which session am I in." Bumping `created_at` to make a session active is a one-line change that preserves all existing behavior. No new "active session" column needed.

### D4 — `/conversation/<sessionId>` validates ownership

The session must belong to the authenticated user. Otherwise 404 (not 403 — don't leak existence of other users' sessions).

### D5 — Empty state has voice, not silence

When a scope has zero sessions tagged to it, the Sessions section shows an invitation: *"Esta organização ainda não tem conversas tagueadas. Comece uma nova ou tagueie uma conversa existente do Context Rail."* — same Quiet Luxury empty-state pattern as the Cognitive Map cards (S10).

### D6 — Sort: most recent first by last activity

`lastActivityAt = COALESCE(MAX(entry.timestamp), session.created_at)` — same definition the home's Continue band uses (S1). Imported sessions, whose entries have synthetic timestamps from import time, will cluster together by import recency. That's the honest representation: imports happened together; they sort together unless newly visited.

### D7 — No filter UI; sort is implicit

No dropdown, no checkboxes. The list shows what's there in the right order. If filters become necessary later, they earn their place. Honors the "no premature feature" principle.

### D8 — Render all rows, no pagination

For Alisson's case (27 sessions in software-zen), all rows fit. If a scope grows past ~50 sessions and the page feels heavy, revisit with lazy load. Documented as a deferral, not a gap.

## Steps

### Phase 1 — DB helper

`server/scope-sessions.ts` (existing file from S7):
- New `getOrganizationSessions(db, userId, organizationKey)` and `getJourneySessions(db, userId, journeyKey)` — return `Array<{id, title, lastActivityAt, firstUserMessagePreview, personaKeys}>` ordered by `lastActivityAt DESC`.
- Same SQL shape as the existing `getLatestOrganizationSessions` / `getLatestJourneySessions`, but without `LIMIT 1`. The `_persona` meta extraction stays.
- Preview: subquery selecting the first user-role entry's content, truncated server-side.

Tests in `tests/db.test.ts` or a new `tests/scope-sessions.test.ts` (covering the existing latest-* helpers if not already there).

### Phase 2 — Session-by-id loading

`server/db/sessions.ts`:
- New `getSessionById(db, sessionId, userId)` — returns the session if it belongs to the user, undefined otherwise.
- New `markSessionActive(db, sessionId)` — bumps `created_at` to `Math.max(now, MAX(other sessions for the same user) + 1)`. Same monotonic-bump pattern as `createFreshSession` and `createSessionAt`.

Unit tests for both.

### Phase 3 — Route `/conversation/<sessionId>`

`adapters/web/index.tsx`:
- New GET handler at `/conversation/:sessionId` — loads the named session via `getSessionById`, 404 if not found / not owned. Calls `markSessionActive(db, sessionId)`. Renders the same `ConversationPage` as `/conversation`, just with the loaded session.
- Existing `/conversation` (no id) continues to resolve via `getOrCreateSession` — unchanged.

Tests for the route in `tests/web.test.ts` (load own session 200, foreign session 404, loaded session becomes active).

### Phase 4 — Scope page Sessions section

`adapters/web/pages/organizations.tsx` and `journeys.tsx` detail pages (or wherever they live today — to confirm during implementation):
- Replace the single "Last conversation" card with a **Sessions** section.
- Each row: title (link), persona badge(s), relative time, first-user-message preview.
- Empty state: invitation paragraph.

CSS: small additions for the row layout. Bump asset version per the project convention if applicable.

Tests: render with 0 / 1 / N sessions, confirm correct ordering, confirm clicks navigate to the right URL.

### Phase 5 — Remove S7's "Last conversation" card from list pages

`/organizations` (list) and `/journeys` (list) keep the S7 readout — those are list pages where one card per scope still makes sense. The card is only removed from the *detail* pages, where it's now subsumed by the full Sessions section.

(Re-read the S7 implementation to confirm placement; this step is conditional on whether the card is currently on the detail page or only the list page. If only on list, no removal needed.)

### Phase 6 — Close-out

- `docs/process/worklog.md` entry
- Mark S5 ✅ in epic and roadmap indexes
- Run full test suite, confirm passing
- Manual UX validation: visit `/organizations/software-zen`, see the 27 imported sessions, open one, send a message, confirm continuation works

## Open questions (registered, not blockers)

- **Sessions without org or journey.** Today, every session has at least a persona (reception always picks one or the user pins one). A session tagged only with persona has no org/journey scope to live under in this story's surface. Where does it appear?
  - Option A: Persona detail page on the Psyche Map (when persona pages get a full layout — separate work).
  - Option B: New "Personal threads" section on `/me`.
  - Option C: Treat persona as scope here too — `/personas/<key>/sessions` or similar.
  - **Resolution deferred** — for v1 of this story, persona-only sessions are reachable via the rail's "active session" path or the home's Continue band. They don't disappear; they just don't surface here.
- **Pagination threshold.** No data point yet for what "too many" looks like. 27 fits trivially. Revisit when a scope passes ~50.
- **Session row preview source.** First user message is the chosen heuristic. If imported sessions' first user message is uninformative (some Gemini exports started with a long persona setup prompt), the preview can look noisy. Acceptable tradeoff for v1; refining the preview is a follow-up.

## Files likely touched

- `server/scope-sessions.ts` — new full-list helpers + first-message preview
- `server/db/sessions.ts` — `getSessionById`, `markSessionActive`
- `server/db.ts` — re-exports
- `adapters/web/index.tsx` — `/conversation/:sessionId` route
- `adapters/web/pages/organizations.tsx`, `adapters/web/pages/journeys.tsx` — detail pages gain Sessions section (file paths to confirm during implementation)
- `adapters/web/public/style.css` — small row styling
- `tests/scope-sessions.test.ts` (new or extension) — list helpers
- `tests/db.test.ts` — `getSessionById`, `markSessionActive`
- `tests/web.test.ts` — route + page rendering coverage
