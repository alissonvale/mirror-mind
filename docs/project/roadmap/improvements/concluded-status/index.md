[< Roadmap](../../index.md)

# Concluded status for journeys and organizations

**Status:** ✅ Shipped 2026-04-23

## Problem

The status enum on journeys and organizations had two values: `active`
and `archived`. The pair conflated two meaningfully different outcomes:
a scope that finished what it set out to do (O Reflexo ran its course,
all deliverables shipped) and a scope that was put aside for any other
reason (abandoned, deprioritized, obsoleted). Archive was doing double
duty, and the user noticed — there was no way to say "this concluded
with dignity" without sending it to the same bucket as "I gave up on
this."

## Fix

Added a third status `concluded` on both journeys and organizations.
Three distinct lifecycle positions:

- `active` — working on it, lives in the sidebar, routes in reception.
- `concluded` — finished its cycle, out of sidebar noise, **still
  routes in reception** because past context is still relevant when
  the user asks about it. Visible on the listing page in its own band.
- `archived` — out of routing, out of the default list, requires
  explicit "Show archived" to reveal. Abandonment / pause territory.

DB layer: no schema change (status column is TEXT). New helpers
`concludeJourney` / `reopenJourney` / `concludeOrganization` /
`reopenOrganization`. `archiveJourney` and `archiveOrganization`
relaxed to accept any non-archived status so the flow concluded →
archived is a single click. `getJourneys` / `getOrganizations` accept
an independent `includeConcluded` flag; the earlier `includeArchived`
was narrowed to mean just archived.

Reception (`server/reception.ts`) passes `includeConcluded: true` —
concluded scopes compete for the routing decision alongside active
ones.

Sidebar loader continues to filter `status = 'active'` by default, so
concluded scopes naturally drop out.

UI:

- Workshop lifecycle section shows "Mark as concluded" + "Archive"
  when active; "Reopen" + "Archive" when concluded; "Unarchive" when
  archived.
- Workshop breadcrumb shows a "concluded" badge (warm beige) next to
  the archived one.
- Listing page renders a separate "Concluded" band between the active
  rows and the archived toggle, with a subtle hint explaining the
  status. Rows are visually dampened (off-white card background,
  muted text), the reorder controls work within the band.

## Commit

`d9ec30e` — Concluded status for journeys and organizations

## Tests added

- `tests/db.test.ts` — 10 new tests covering transitions, default
  `getJourneys` excluding concluded, `includeConcluded` widening,
  `sidebarOnly` dropping concluded, `archiveJourney` from a concluded
  row, mirror coverage for organizations.
- `tests/web.test.ts` — 7 new tests covering the four new POST
  routes (conclude, reopen × journeys, organizations), 404 on wrong
  state, sidebar exclusion, listing-page band rendering, workshop
  badge and buttons.

Total: 504 tests passing (was 484).
