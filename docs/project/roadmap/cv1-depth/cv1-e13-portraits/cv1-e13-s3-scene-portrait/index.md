[< CV1.E13](../)

# CV1.E13.S3 — Scene portrait

**Status:** ✅ Done (2026-05-05). Shipped in one round; ~70% engine reuse from S1/S2.

> Editorial design source: [`docs/design/entity-profiles.md`](../../../../../design/entity-profiles.md).
> Reference draft confirmed against Antonio Castro's `noite-com-bia` cena.

## What's different vs S1/S2

Cenas are **declarative** — they describe a kind of moment, not a story unfolding. The portrait reflects that:

1. **The briefing IS the lede** — no extraction heuristic, no last-paragraph picker. The whole briefing reads as the opening.
2. **"A pergunta viva" and structural section don't apply** — cenas are unities, not decisions.
3. **Tiles cap at 2** — conversation count and recency. No "tempo desde início" since cenas are operational, not biographical.
4. **Voice bifurcation** in the cast section — the central anatomical difference:
   - `voice='persona'`: lists cast personas with `◇` glyph + descriptors via `scene_personas` junction
   - `voice='alma'`: renders a single ♔ **voz da alma** indicator with warm-amber glyph
5. **"QUANDO ELA ACONTECE"** surfaces `temporal_pattern` in italic when present.
6. **"EM QUAL TERRITÓRIO"** lists `organization_key` (`⌂`) and `journey_key` (`↝`) when declared. Section omits when both null.
7. **Empty briefing renders a stub block** — glyph (♔ for alma, ❖ for persona) in display position + an italic invitation to author the briefing.

Conversations queried via `sessions.scene_id` (CV1.E11.S4) — different signal than the meta-stamping that journey/org portraits read.

## What reuses

- `portrait-shared.tsx` exports (`<NumericTilesRow>`, `<ConversationsSection>`, `<PortraitClose>`, `<PortraitFooter>`, `editPathFor`, `PORTRAIT_STYLES`)
- `entity_profile_cache` table + cache helpers
- `getCitableLineForSession` (LLM extractor)
- `warmScenePortraitCache` mirrors the journey/org warmup pattern

## URL migration

| URL today | After this story |
|---|---|
| GET `/cenas/<key>` (didn't exist before) | portrait |
| GET `/cenas/<key>/editar` (existing workshop) | unchanged |
| GET `/cenas/<key>/edit` (new alias) | workshop (en locale) |

The `/editar` slug already existed for cenas — only `/edit` had to be added as an alias.

## Visual silhouette

- Plum accent `#9a8ba0` (the `/espelho` Vivo-pane palette).
- Scoped via `[data-entity="scene"]` so other portraits keep their own accents (teal for journey, warm-amber for org).
- Voz da Alma cenas: shell stays plum, but the `♔` glyph in the cast section and the stub block renders in warm-amber `#b8956a` — signals "this is the Soul Voice" without flipping the page identity.

## Tests

`tests/scene-portrait.test.ts` (11 tests):

- `composeSceneLede`: returns briefing as-is, returns null when empty.
- `composeSceneClose`: picks last sentence of briefing when ≥30 chars; null when too short.
- `composeScenePortrait` integration:
  - persona-voiced cena → `cast.kind === "personas"` with descriptors hydrated from `identity.summary`
  - alma-voiced cena → `cast.kind === "alma"` regardless of personas table
  - territory populates org and journey when declared; both null when unscoped
  - tiles emit conversation count + recency when sessions linked via `sessions.scene_id`; empty when no sessions

Existing `tests/cenas-routes.test.ts` continues to pass — `/cenas/:key/editar` workshop URL unchanged.

## CV1.E13 epic state

All three stories shipped. Each entity (journey, organization, scene) has a read-view-by-default surface; the workshop form is reachable via a discreet "editar" link in the portrait footer.

Visual smoke against a provisioned tenant remains the manual validation pass.
