[< Roadmap](../../index.md)

# Regenerate Summary: categorized result + banner

**Status:** ✅ Shipped 2026-04-23

## Problem

Clicking "Regenerate summary" on an organization or journey workshop
could hit any of several failure modes — empty briefing+situation,
LLM timeout, upstream API error — and leave the page looking
identical to "nothing happened". The form-POST redirect landed on the
same page with the same empty state, and the failure only appeared
in server logs. The awaited call was indistinguishable from the
fire-and-forget one used by Save.

## Fix

`generateScopeSummary` now returns a typed `ScopeSummaryResult`
("ok" | "empty" | "timeout" | "error"). The regenerate routes echo
the result as a `?summary=...` query param on the redirect; the
workshop reads it and renders a small banner above the Summary block
with wording appropriate to the outcome.

Also bumped the scope-summary timeout floor to 30s — the title role's
default 8s was calibrated for title generation (short input), but
scope summaries send briefing+situation, a bigger payload that needs
more budget. The floor is per-call, not a DB change.

## Commit

`2000417` — Regenerate Summary: categorized result + user-visible banner

## Tests added

- `tests/summary.test.ts` — 6 unit tests across the 5 return paths
  (empty, missing scope, ok, timeout, non-timeout error, empty LLM
  output), injecting mock completeFn so no network is touched.
- `tests/web.test.ts` — 5 route-level tests covering the redirect
  query param and banner rendering.
