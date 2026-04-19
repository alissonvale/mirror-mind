[< Roadmap](../../index.md)

# Cognitive Map polish

**Status:** ✅ Shipped 2026-04-19

## Goal

Small UX refinements to the Cognitive Map that accumulated during voice-probing work. Lighter, more restrained typography on card descriptions; a truncate + `read more` affordance for long summaries; a sidebar toggle so the map can be seen wider; suppression of the favicon 404 console noise.

## Status

- [x] Card preview font smaller + lighter color + weight 300
- [x] Line-height tightened; `-webkit-line-clamp: 3` + truncation detection adds `read more →`
- [x] Sidebar collapse/expand button with smooth transitions (desktop behavior; mobile behavior preserved)
- [x] Favicon 404 suppressed via inline data URI
- [x] Worklog entry

## Documents

- [Plan](plan.md) — files changed, CSS choices, inline-JS fix for the sidebar handler
