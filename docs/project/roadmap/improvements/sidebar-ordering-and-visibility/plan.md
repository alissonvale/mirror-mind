[< Story](index.md)

# Plan: Sidebar ordering and visibility

## Problem

Journeys and organizations appear in the sidebar and on their respective
listing pages sorted alphabetically by `name`. Two distinct problems surface
in real use:

1. **Order doesn't match daily focus.** Which journey matters most today is
   personal and time-varying. Alphabetical is a reasonable default for a
   fresh install but a poor fit once a user has curated a set of scopes.
2. **Not every active scope deserves sidebar real estate.** An active scope
   that's consulted rarely still participates in reception, still lives on
   the listing page — but listing it in the sidebar adds noise to the
   scopes that are touched weekly.

Archiving doesn't solve either problem: archived scopes are hidden
everywhere, which is too aggressive when the scope is still live.

## Solution

Two orthogonal controls per scope, both additive to the current schema:

- `sort_order INTEGER` — nullable integer. Smaller is higher in the list.
  Listing queries order by `sort_order IS NULL, sort_order ASC, name ASC`.
  NULLs fall to the end alphabetically so newly created scopes without
  explicit order don't disrupt the curated section above.
- `show_in_sidebar INTEGER NOT NULL DEFAULT 1` — boolean. Only affects the
  sidebar query; the listing page always shows every active scope.

UI on `/journeys` and `/organizations`: three inline controls per row — up
arrow, down arrow, eye toggle. POST a small redirect-style form for each
action, following the existing convention of `archive` / `unarchive`.

### Ordering scope

Order is a flat per-user value. For `/organizations`, that maps directly to
the rendered list. For `/journeys`, which groups by organization, up/down
swap against the **next or previous visible sibling in the rendered list**
— i.e., within the same group. Cross-group ordering isn't adjustable from
the UI; if a journey needs to move to another group, that's a different
operation (linking to a different organization, already supported).

The sidebar renders journeys in a single flat section ordered by
`sort_order`. If two groups' sort values interleave on the listing page,
the sidebar reflects that — acceptable because the user controlled it.

### Visibility on the listing page

A scope with `show_in_sidebar = 0` still renders on its listing page,
slightly dimmed (e.g. `opacity: 0.55` on the row's meta) with the eye icon
in the "off" state. Clicking it re-enables sidebar visibility. The intent
is: the listing page is the administrative view where you manage what goes
in the sidebar.

## Files affected

**Schema + db helpers:**

- `server/db.ts`:
  - Extend the `organizations` and `journeys` `CREATE TABLE` statements with
    `sort_order INTEGER` and `show_in_sidebar INTEGER NOT NULL DEFAULT 1`.
  - In `migrate()`, add `ALTER TABLE` checks for both columns on both tables
    (four checks total).
  - Seed `sort_order` for existing rows using a window function:
    ```sql
    UPDATE journeys SET sort_order = (
      SELECT COUNT(*) FROM journeys j2
      WHERE j2.user_id = journeys.user_id AND j2.name < journeys.name
    ) WHERE sort_order IS NULL;
    ```
    Same shape for `organizations`. Runs once guarded by the `ALTER TABLE`
    check — if the column is new, seed the existing rows.
- `server/db/journeys.ts`:
  - `Journey` interface gains `sort_order: number | null` and
    `show_in_sidebar: number` (0/1).
  - `getJourneys` query changes its `ORDER BY` clause.
  - New helpers: `setJourneySortOrder`, `setJourneyShowInSidebar`,
    `moveJourney(db, userId, key, direction, scopeFilter)` that performs
    the swap with the adjacent visible sibling (using `organization_id`
    as the grouping filter when present; otherwise the personal group).
- `server/db/organizations.ts`:
  - `Organization` interface gains the same two fields.
  - `getOrganizations` updated the same way.
  - New helpers: `setOrganizationSortOrder`, `setOrganizationShowInSidebar`,
    `moveOrganization(db, userId, key, direction)`.

**Routes:**

- `adapters/web/index.tsx`:
  - `POST /journeys/:key/reorder` — body or query `direction=up|down`,
    redirects back to `/journeys`.
  - `POST /journeys/:key/sidebar` — body or query `visible=0|1`, redirects
    back to `/journeys`.
  - Mirror routes for `organizations`.

**Sidebar:**

- `adapters/web/pages/layout.tsx`:
  - `loadSidebarScopes` adds `options: { showInSidebarOnly: true }` to the
    getters (or takes the filter directly in the query).
  - No JSX changes beyond what already iterates `journeys` / `organizations`.

**Listing pages:**

- `adapters/web/pages/journeys.tsx`:
  - Each row (`ScopeRow`) gains three control buttons wrapped in tiny
    `<form method="POST">` elements. The first-row in a group has the up
    button disabled; last row in a group has the down button disabled.
  - Dimmed style applied when `show_in_sidebar === 0`.
- `adapters/web/pages/organizations.tsx`:
  - Same treatment. `ScopeRow` is shared between the two files (journeys
    imports from organizations), so the control buttons likely live on
    `ScopeRow` directly with props for the action URLs.

**Styles:**

- `adapters/web/public/style.css`:
  - `.scope-row-controls` — flex row of small icon buttons.
  - `.scope-row.is-hidden-from-sidebar` — `opacity: 0.6` on descendants that
    represent the scope's metadata, keeping the controls at full opacity.
  - Cache bust the stylesheet version suffix.

**Tests:**

- `tests/db/journeys.test.ts`:
  - `getJourneys orders by sort_order then name`
  - `getJourneys falls back to name for NULL sort_order`
  - `moveJourney up swaps with previous sibling in same group`
  - `moveJourney down at last position is a no-op`
  - `setJourneyShowInSidebar persists`
- `tests/db/organizations.test.ts`: mirror set.
- `tests/web/scope-routes.test.ts` (new):
  - Reorder endpoint returns 302 and persists the swap.
  - Sidebar toggle endpoint returns 302 and persists the flag.
  - `loadSidebarScopes` excludes hidden scopes; listing page still shows
    them.

## Decisions

**Why one flat sort_order per user (not per-organization-group).**
Fewer columns, fewer edge cases. The group-based UX on `/journeys` works
anyway because up/down swaps against the next visible sibling — the user
never sees the global order directly, only the local swap. The sidebar
flattens scopes into a single list, so a single global order is the
natural match.

**Why `show_in_sidebar` as a separate flag instead of archiving.**
Archiving is a lifecycle operation: the scope is done, out of rotation,
doesn't route. Sidebar visibility is a cosmetic preference: the scope is
live and active, just not prominent enough to keep on the left rail. The
two concerns are independent and belong in separate columns.

**Why keep listing pages showing hidden rows.**
The listing page is where the user manages their scopes. If hiding from
the sidebar also removed the scope from the listing page, there'd be no
surface to toggle it back on. The dim treatment communicates state
without removing the control.

**Why redirect-style POST instead of a JSON endpoint with client-side JS.**
Consistent with the existing `archive`/`unarchive` convention in the web
adapter. No JS dependency, no client-side state, and reordering a handful
of scopes doesn't need the latency win that an async endpoint would give.
If the UX ever demands drag-and-drop, the helpers on the server side
already support a `setSortOrder` primitive that a JSON endpoint can call.

**Why seed via subquery instead of a single `ROW_NUMBER()` update.**
Both work on modern SQLite. The subquery is more obviously correct when
reading: "for each row, count how many same-user rows have a name less
than mine." It also sidesteps any ambiguity around window function
support on the specific `better-sqlite3` build in production. Cost is
negligible at the scale of a per-user scope list.

## Validation

**Automated:** the test list under **Files affected** covers the query
changes, the swap logic, the visibility flag, and the route wiring.

**Manual (browser):**
1. `npm run dev` on a database with existing journeys.
2. Open `/journeys` — rows appear in alphabetical order (unchanged).
3. Press ↓ on the top journey in a group; reload — the top journey
   moved down, the one below took its place. Sidebar reflects the new
   order in the same session.
4. Press the eye toggle on one journey; sidebar entry disappears, but
   the listing row stays (dimmed) with the eye now in "off" state.
5. Press the eye toggle again — sidebar entry reappears; dim removed.
6. Mirror test on `/organizations` — same three verifications.
7. Create a new journey via `/journeys/new`; it appears at the end of
   its group (NULL sort_order falls back to name alphabetical) and
   starts visible in the sidebar.

## Risk

Low. Additive columns with safe defaults. Existing rows get seeded
sort_order but keep `show_in_sidebar = 1`, so pre-migration behavior is
preserved exactly. The listing pages gain controls but don't change their
structure. Rollback is `git revert` + leaving the columns in place (they
remain unread).

## Out of scope

- **Drag-and-drop reordering.** The up/down buttons cover the need; a
  JSON endpoint with a drag-and-drop handler is a natural follow-up if
  the interaction grows (e.g., reorder a section of 10+ scopes).
- **Ordering groups on `/journeys`.** Group order follows organization
  order (which is now user-controlled via this improvement), so there's
  no separate mechanism to build.
- **Keyboard shortcuts.** `Alt+↑` / `Alt+↓` or similar — deferred until
  the click-based flow proves insufficient.
- **Persona ordering in the sidebar.** Not currently listed in the
  sidebar; if that changes, this improvement's pattern (column +
  helpers + route + UI) extends cleanly.
- **Sync of order across devices via a per-user preference blob.**
  Already covered by the DB being the single source of truth; no
  client-side cache exists to invalidate.
