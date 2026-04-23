[< Story](index.md)

# Test guide: Sidebar ordering and visibility

## Automated

Run the full suite:

```bash
npm test
```

Focused tests (optional while iterating):

```bash
npx vitest run tests/db.test.ts
npx vitest run tests/web.test.ts
```

Coverage:

- **`tests/db.test.ts`** — `getJourneys` and `getOrganizations` order by
  `sort_order` then `name`, NULL rows fall to the end alphabetically,
  `moveJourney` / `moveOrganization` swap with the adjacent sibling,
  group-scoped swaps don't cross organization boundaries, edge-of-list
  moves return `false`, `setJourneyShowInSidebar` /
  `setOrganizationShowInSidebar` persist the flag, and the `sidebarOnly`
  option excludes hidden rows.
- **`tests/web.test.ts`** — the four new POST routes
  (`/journeys/:key/reorder`, `/journeys/:key/sidebar`,
  `/organizations/:key/reorder`, `/organizations/:key/sidebar`) redirect
  on success, reject invalid parameters with 400, return 404 for missing
  scopes, and the end-to-end check that a hidden journey disappears from
  `/conversation`'s sidebar while still rendering on `/journeys`.

## Manual (browser)

Spin up the dev server and exercise the flow:

```bash
npm run dev
```

### Setup

You need at least:

- Two organizations (so reorder has a sibling to swap with)
- Two journeys inside one of the organizations (for group-local swap)
- One personal journey (to confirm groups stay separate)

Use `/organizations` and `/journeys` create forms if you don't have
these in the local DB already.

### Ordering

1. Open `/organizations`. Each row now has a vertical stack of three
   controls on the left: `↑`, `↓`, and a filled dot (●).
2. On the top organization, `↑` is disabled; on the bottom, `↓` is
   disabled.
3. Click `↓` on the top row. The page reloads; the row moves down by
   one. The sidebar on the left reflects the new order in the same
   render.
4. Click `↑` on the same (now-second) row. It goes back to the top.
5. Repeat on `/journeys`. Notice the swaps stay within the group —
   pressing `↓` on the last journey of a group has no effect (button
   disabled), even if there's another journey in the next group below.

### Sidebar visibility

6. On any row, click the dot (●). The dot turns hollow (◎), the row
   dims to ~55% opacity, and the matching sidebar entry disappears on
   the next render.
7. Click the hollow dot. The row un-dims, the dot fills in again, and
   the sidebar entry returns.
8. Hide a row, then navigate to `/journeys/<that-key>` via direct URL.
   The workshop page still renders; routing still works — visibility is
   strictly a sidebar concern.

### New scopes

9. Create a new organization via the form on `/organizations`. It lands
   at the bottom of the list (new rows have `sort_order = NULL`, which
   the query pushes to the end alphabetically) with the dot filled in
   (visible in the sidebar by default).
10. Same for a new journey — it appears at the bottom of its group.

### Regression sweep

11. Archive a scope — it still vanishes from both the listing page
    default view and the sidebar (archived behavior unchanged).
12. Switch `/journeys?archived=1` on — archived journeys still show up
    in the bottom section of the page; controls don't appear on them
    (the controls live on `active` rows only).
13. Refresh `/conversation` — the sidebar listing reflects whatever
    visibility + order state the listing page set.

## Known acceptable behaviors

- The sidebar renders journeys in a flat list sorted by `sort_order`.
  If you reorder within group A in a way that interleaves group A's
  `sort_order` values with group B's, the sidebar shows exactly that
  interleaving. On `/journeys` the grouping by organization hides this
  from view; on the sidebar it's visible. This is intentional — one
  flat order per user, mirrored faithfully on the sidebar.
- First-time-after-migration orderings match the previous alphabetical
  render — the migration seeds `sort_order` from the pre-migration
  alphabetical position so nothing shuffles unexpectedly.
