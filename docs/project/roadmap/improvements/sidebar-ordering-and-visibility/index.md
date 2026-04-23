[< Roadmap](../../index.md)

# Sidebar ordering and visibility

**Status:** ✅ Shipped 2026-04-23

## Goal

Give the user manual control over how journeys and organizations appear in
the sidebar. Two controls per item, independent of the existing `archived`
lifecycle:

- **Order** — reorder journeys and organizations manually instead of relying
  on alphabetical name. Applies to the sidebar and the `/journeys` /
  `/organizations` listing pages so both surfaces stay consistent.
- **Sidebar visibility** — hide an active item from the sidebar without
  archiving it. It still exists, still appears on the listing page, still
  routes as a scope — only the sidebar entry disappears.

## Motivation

Real use in production exposes two frictions the alphabetical default can't
solve:

- A user with five journeys doesn't want them listed by name. The ordering
  that matches daily focus is personal and only the user knows it.
- Some active journeys or organizations are touched rarely. They belong
  in the system (reception still routes into them; the listing page is the
  right place to find them) but don't need to occupy sidebar real estate.

These were absent in the initial design because there were fewer scopes and
alphabetical order was adequate. The threshold was crossed once production
data came in.

## Status

- [x] Schema: `sort_order INTEGER` + `show_in_sidebar INTEGER NOT NULL DEFAULT 1` on `journeys` and `organizations` (additive migrations in `migrate()`)
- [x] Seed `sort_order` for existing rows to current alphabetical position
- [x] `getJourneys`, `getOrganizations`, and `loadSidebarScopes` ordered by `sort_order NULLS LAST, name`
- [x] `loadSidebarScopes` filters `show_in_sidebar = 1`; listing pages continue to show everything
- [x] `POST /journeys/:key/reorder` + `POST /organizations/:key/reorder` (direction=up|down) swap with adjacent visible sibling
- [x] `POST /journeys/:key/sidebar` + `POST /organizations/:key/sidebar` (visible=0|1) toggle sidebar visibility
- [x] Row controls on `/journeys` and `/organizations`: `↑` `↓` buttons + eye toggle
- [x] Visual dim of rows where `show_in_sidebar = 0` (listing page)
- [x] Tests for the new db helpers and the new routes
- [x] Worklog entry

## Documents

- [Plan](plan.md) — schema, query changes, routes, UI, decisions, validation
- [Test guide](test-guide.md) — automated coverage + manual browser walkthrough
