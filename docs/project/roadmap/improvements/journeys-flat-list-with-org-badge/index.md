[< Roadmap](../../index.md)

# Journeys: flat list with org badge, order independent of group

**Status:** ✅ Shipped 2026-04-23

## Problem

The `/journeys` page rendered journeys grouped by organization, with a
"Personal journeys" section above and one section per org below. In
production use the grouping felt wrong: most journeys live without an
org, groups with a single journey looked overwrought, and the
organization the journey belonged to was actually secondary
information compared to the journey's own identity. The up/down
reorder was also group-local, which surprised the user — swapping
cross-org wasn't possible from the UI even though the sidebar renders
everything flat.

## Fix

The list is now flat. Every journey is one row in a single
`scope-rows` section. Journeys linked to an organization render a
small pill badge next to the name showing the org's name; personal
journeys have no badge (absence = personal). The badge is a plain
label, not a link — the whole row anchors to the journey workshop,
and the workshop's breadcrumb handles the jump to the org.

`moveJourney` stopped filtering by `organization_id`. Swaps now run
across the full per-user journey list, matching what the user sees.
The existing `sort_order` column carries the new flat semantic
without a schema change.

## Commit

`b7f01a4` — Journeys: flat list with org badge; moveJourney flat across orgs

## Tests added / changed

- `tests/db.test.ts` — replaced the old "does not cross organization
  boundaries" assertion with "swaps across organizations — order is
  flat per user". Earlier "same-group swap" tests still pass (the new
  behavior is a superset).
- `tests/web.test.ts` — replaced the "groups journeys by organization"
  assertion with "flat list with an org badge on org-linked rows".
