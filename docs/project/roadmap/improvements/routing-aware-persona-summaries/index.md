[< Roadmap](../../index.md)

# Routing-aware persona summaries

**Status:** ✅ Shipped 2026-04-19
**Evolves:** [Generated summary by lite model](../generated-summary-by-lite-model/) (shipped same day)

## Goal

Make layer summaries genuinely useful for their two distinct consumers: (1) the Cognitive Map cards, which want an evocative essence-descriptor, and (2) the persona router, which needs a clear domain signal to decide when to switch lenses. A single prompt shape was optimizing for neither well — the first shipped iteration produced formulaic "Esta camada opera..." openings, and the router was not getting domain keywords.

Also: show persona summaries on hover in the Cognitive Map, add a bulk-regenerate endpoint, and fix a language-sensitivity bug where the summary language was defaulting to English regardless of content language.

## Status

- [x] Summary prompt rewritten: banned formulaic openings ("Esta camada", "This layer", "Distingue-se por"), few-shot examples (good + bad pairs), max ~40 words
- [x] Persona-specific variant: requires domain + activation triggers as the first clause, then distinctive posture as optional second clause
- [x] Language sensitivity fix: prompt explicitly requires matching the content's language (Portuguese → Portuguese, English → English)
- [x] Bulk regenerate endpoint for all personas in parallel (`POST /map/personas/regenerate-summaries`)
- [x] "regenerate all summaries" button on the Cognitive Map's Personas card
- [x] Hover tooltip on persona badges showing the full summary (`data-summary` + CSS `::after`)
- [x] Routing probe script (`identity-lab/routing-probe.mjs`) exercises reception with a battery of probes and reports hits vs expected
- [x] Worklog entry

## Documents

- [Plan](plan.md) — prompt rewrites, code changes, probe results, design decisions
