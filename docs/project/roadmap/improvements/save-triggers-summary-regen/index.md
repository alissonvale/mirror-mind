[< Roadmap](../../index.md)

# Save awaits summary regen when content changed

**Status:** ✅ Shipped 2026-04-23
**Follows:** [Regenerate Summary feedback](../regenerate-summary-feedback/)

## Problem

The Save form on scope workshops called `generateScopeSummary`
fire-and-forget: the redirect landed on the same page before the LLM
finished, so Save visibly did nothing to the Summary block. Users
(including the author, who hit this in production) concluded that
Save "doesn't regenerate the summary" and started clicking Regenerate
after every edit — friction that the system was supposed to absorb.

## Fix

Save now awaits `generateScopeSummary` with the same shape as the
Regenerate button and redirects with `?summary=<result>` so the banner
shows the outcome. The await is gated on actual content change:
Save reads the pre-update row, compares `briefing` and `situation`
against the submitted values, and only regenerates when one of those
actually changed. Name-only edits and org-link changes on journeys
skip the LLM call entirely and redirect instantly.

## Commit

`73f2c25` — Save awaits summary regen when briefing or situation changed

## Tests added

4 route-level tests in `tests/web.test.ts`:

- Organization save with name-only change keeps existing summary,
  redirects without the query param.
- Organization save with briefing change redirects with
  `?summary=...`.
- Journey save with name + org-link change (briefing/situation
  unchanged) keeps existing summary, no query param.
- Journey save with situation change redirects with `?summary=...`.
