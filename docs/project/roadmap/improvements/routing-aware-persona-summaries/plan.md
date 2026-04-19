[< Story](index.md)

# Plan: Routing-aware persona summaries

## Problem

The first shipped version of the summary prompt ([generated-summary-by-lite-model](../generated-summary-by-lite-model/)) produced formulaic, hollow output. Every summary opened with "Esta camada opera..." or "Este layer descreve..." and closed with "Distingue-se por..." — structural descriptions of "what a layer does" in the abstract, rather than concrete distillations of the layer's actual content. The user's own feedback made the critique sharp: *"as descrições são pobres de significado e repetitivas."*

A second issue surfaced on top: summaries were being generated in English even when the layer content was in Portuguese. The existing "Match the language of the original layer content" instruction was buried in the middle of the rules and the system prompt was itself in English, biasing the lite model toward English output.

A third issue emerged when thinking about the persona consumer: the Cognitive Map wants an evocative essence-descriptor ("Primazia do ser sobre fazer, verdade antes de conforto..."), but the router needs a concrete domain signal ("Finanças pessoais: gastos, runway..."). A single prompt shape cannot satisfy both well.

Finally: the current UX for updating summaries was one layer at a time via the workshop's Regenerate button. After the source-of-truth sync that added 14 personas with NULL summaries, this meant 14 separate round-trips.

## Solution

**Four coordinated changes in `server/summary.ts`, plus UX:**

1. **Prompt rewrite (self/ego variant):** bans formulaic openings explicitly, bans meta-differentiation, requires naming concrete themes/values/rules/vocabulary from the source. Caps at 1–2 sentences (~40 words). Adds good/bad few-shot pairs.

2. **Persona-specific variant:** branches on `layer === "persona"`. First clause names domain + activation triggers ("Finanças pessoais: gastos, runway..."); optional second clause captures distinctive posture. Same anti-formulaic rules.

3. **Language sensitivity:** `CRITICAL:` section at the end of the prompt explicitly requires matching the content's language, with examples across Portuguese / English / Spanish. The recency position gives the rule maximum attention weight.

4. **Bulk regenerate endpoint:** `POST /map/personas/regenerate-summaries` iterates all persona layers for the user and runs `generateLayerSummary` in parallel via `Promise.allSettled`. Admin variant at `/map/:name/personas/regenerate-summaries`.

**UX:**

- New "regenerate all summaries" button at the bottom of the Cognitive Map's Personas card — subtle styling, disables during submit and shows "regenerating...".
- Persona badges on the map get `data-summary={p.summary ?? ""}`; pure-CSS tooltip via `::after` with `attr(data-summary)`. Appears on hover with a 200ms delay, positioned above the badge, max-width 280px. Only shows when summary is non-empty.

## Files affected

- `server/summary.ts`:
  - `generateLayerSummary` branches on `layer === "persona"` to choose between two system prompts (persona-aware vs essence-first).
  - Both prompts include the anti-formulaic bans + few-shot pairs + language-matching rule.
- `adapters/web/index.tsx`:
  - New `handleRegenerateAllPersonasSummaries` — fetches all persona layers, runs `Promise.allSettled` over `generateLayerSummary`, redirects to map.
  - Two new routes: `/map/personas/regenerate-summaries` and `/map/:name/personas/regenerate-summaries` (admin). Registered before `/map/:layer/:key/regenerate-summary` so literal `personas` wins over `:layer`.
- `adapters/web/pages/map.tsx`:
  - `PersonaBadges` gains a form-post footer "regenerate all summaries" when `personas.length > 0`.
  - Each badge gets `data-summary={p.summary ?? ""}`; `title={p.key}` removed (badge label already shows the name).
- `adapters/web/public/style.css`:
  - `.persona-regenerate-form` / `.persona-regenerate-btn` styles for the bulk button.
  - `.persona-badge-link` gains `position: relative` for tooltip anchoring.
  - `.persona-badge-link[data-summary]:not([data-summary=""])::after` defines the tooltip.
  - `.map-card--personas` overrides `overflow: hidden` to `overflow: visible` so the tooltip can escape the card.
- `identity-lab/routing-probe.mjs` (new):
  - Test harness: loads the admin user's identity, runs a fixed battery of `{msg, want}` probes through `receive()`, prints a table of hits/misses.

## Decisions

**Why two prompts instead of one.** A unified prompt trying to capture both essence (display) and domain (routing) compromises both. Self/ego layers have no routing job — they only display, so "essence only" works. Persona layers serve both, so the prompt needs to lead with domain-signaling (*"Finanças pessoais: gastos, runway, saldos"*) before the evocative continuation. Branching on `layer === "persona"` is cheap and keeps both prompts focused.

**Why not a second column for routing descriptor.** Considered. Rejected: schema change, migration, two artifacts to keep in sync, two UIs. The persona-aware prompt produces descriptors that work for both consumers — the router gets domain keywords up front, the Cognitive Map gets an evocative follow-on. One field, two audiences, good enough for now.

**Why parallel `Promise.allSettled` for bulk regenerate.** Lite model handles 14 concurrent calls without rate-limit friction in observed usage. Sequential would take ~14 × timeout (8s each) in the worst case — 2 minutes for a click. `allSettled` returns after the slowest finishes and does not fail the whole batch if one persona errors.

**Why CSS tooltip instead of JS.** Zero JavaScript, works with server-rendered HTML, accessible via `data-*` attribute, easy to inspect. The tradeoff is no positioning fallback (if the badge is near the viewport edge, tooltip could clip). For 14 personas in a bounded card, this has not been an issue.

**Why `overflow: visible` only on the personas card.** The generic `.map-card` has `overflow: hidden` so its border-radius clips inner content cleanly. Changing that globally would affect layout on all four structural cards. Scoped override on `.map-card--personas` is the minimal change.

## Validation

- 162 tests passing. No new tests for the prompt rewrite itself (output is an LLM generation, not unit-testable); existing tests for `generateLayerSummary`, `setIdentitySummary`, and `extractPersonaDescriptor` still pass.
- Manual probe via UI: bulk regenerate triggered, 14 personas got new summaries in Portuguese matching the source content.
- Routing probe run (`node identity-lab/routing-probe.mjs` with Haiku 4.5 + new persona summaries): 14/16 (88%). The two misses are genuinely ambiguous cases where the chosen persona is defensible:
  - "por que acho que a travessia do deserto está mais fácil agora?" → expected `pensadora`, got `terapeuta` (emotional-causal inquiry)
  - "lavadeira parou, pagar conserto agora ou espera?" → expected `tesoureira`, got `dona-de-casa` (half-domestic, half-financial)
- Manual voice probe with the new summaries — reception picked the right persona across all clear-domain messages the user tested.

## Risk

Low. The prompt changes only affect future summary generations; existing summaries remain until regenerated. The bulk regenerate endpoint is idempotent. The tooltip is progressive enhancement — degrades cleanly if the browser doesn't support `::after` / `attr()` (it just won't appear).

## Out of scope

- Fine-grained per-persona prompt tuning (one shared persona prompt for now).
- Tooltip positioning that adapts to viewport edges.
- Separate routing-descriptor column in the schema.
- Test coverage for the prompt text itself (validated empirically via the routing probe).
