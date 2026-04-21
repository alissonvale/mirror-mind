[< Story](index.md)

# CV0.E4.S7 — Last conversation per scope

## Context

S3 renamed the sidebar sections to the three questions (Who / What / Where). After S6 (single-currency) and the /me polish (S4), one friction remained on the scope list surfaces: `/journeys` and `/organizations` showed pure structure — cards about each scope — without any trace of *how each scope is actually being used*. A scope with zero conversations looked identical to a scope the user had just been talking about for three hours.

This story threads a minimal temporal signal into both list pages: a **Last conversation** card next to each scope, showing the title and relative time of the most recent session the mirror tagged with that scope.

## Data source

No schema change. Reception has been stamping three meta keys on every web assistant message since CV1.E4.S1 landed:

```json
{
  "role": "assistant",
  "content": [...],
  "_persona": "terapeuta",
  "_organization": "software-zen",
  "_journey": "vida-economica"
}
```

A SQL query with a window function returns the most recent entry per scope key, joined back to the session for title + timestamp:

```sql
WITH scoped AS (
  SELECT
    json_extract(e.data, '$._journey') AS scope_key,
    e.session_id,
    e.timestamp AS ts,
    s.title,
    ROW_NUMBER() OVER (
      PARTITION BY json_extract(e.data, '$._journey')
      ORDER BY e.timestamp DESC
    ) AS rn
  FROM entries e
  JOIN sessions s ON e.session_id = s.id
  WHERE s.user_id = ?
    AND e.type = 'message'
    AND json_extract(e.data, '$._journey') IS NOT NULL
)
SELECT scope_key, session_id, ts, title FROM scoped WHERE rn = 1;
```

Same query shape for `_organization`. Returned as a `Map<string, LatestScopeSession>` keyed by scope key, so the page renderer can look up each card's latest session with O(1).

## Adapter coverage caveat

Telegram and API adapters today stamp only `_persona` — not `_organization` or `_journey`. So a scope used only over Telegram shows "No conversations tagged yet" even though conversations do exist for it. This is an acceptable initial state:

- Web is the primary surface where scope authoring happens anyway.
- Telegram/API don't show scope routing badges either (S8+ territory).
- Backfilling is a no-op the moment those adapters are updated.

This caveat is noted in the plan but not called out in the UI — the empty state just reads "No conversations tagged yet" without explaining why.

## Layout

Each scope gets a pair:

```
┌───────────────────┐ ┌───────────────────┐
│ Scope card        │ │ Last conversation │
│                   │ │                   │
│ name / key / body │ │ Sunday planning   │
│                   │ │ 2 hours ago       │
└───────────────────┘ └───────────────────┘
```

`.scope-rows` — grid with one pair per row (narrow) or two pairs per row (≥900px).
`.scope-row` — inner grid: `1.2fr 1fr` for scope card vs conversation card; collapses to single column below 540px.
`.scope-last--empty` — dashed border when the scope has no tagged conversation.

The existing `.scope-card` is unchanged (reused as-is).

## Component reuse

The same pair-row component renders on both `/organizations` and `/journeys`. Put `ScopeRow` in `organizations.tsx` and export it; `journeys.tsx` imports it. One component, both pages. Avoids a third shared file for a 40-line FC.

## Files

**New**
- `server/scope-sessions.ts` — `getLatestOrganizationSessions`, `getLatestJourneySessions`, `LatestScopeSession` interface
- Story folder with this plan, index, test guide

**Modified**
- `adapters/web/pages/organizations.tsx` — adds `ScopeRow` (exported), replaces `.scope-grid` loop with `.scope-rows`/`<ScopeRow>`, accepts `latestSessions` prop
- `adapters/web/pages/journeys.tsx` — imports `ScopeRow`, accepts `latestSessions`, renders per-group `.scope-rows`
- `adapters/web/index.tsx` — route handlers fetch `getLatest*Sessions(db, user.id)` and pass down
- `adapters/web/public/style.css` — `.scope-rows`, `.scope-row`, `.scope-last*` classes; existing `.scope-card` untouched
- `tests/web.test.ts` — one test per list surface covering untagged → empty-state and tagged → title visible

## Verification

- `npm test` passes (339, +2 net).
- Manual:
  - `/organizations` with no conversations — each org card is paired with a dashed "No conversations tagged yet" card.
  - Send one message on `/conversation` while the mirror correctly routes to an organization — go to `/organizations` and see the paired card with the session title (or "Untitled conversation" if title generation hasn't landed yet).
  - Same flow on `/journeys`.
