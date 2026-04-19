[< Roadmap](../../index.md)

# Split ego into three keys (identity / expression / behavior)

**Status:** ✅ Shipped 2026-04-19
**Source:** [Identity Lab spike §9.3](../../spikes/spike-2026-04-18-identity-lab.md#93-split-ego-into-three-keys-identity-expression-behavior)
**Depends on:** [Semantic ordering of ego layers](../semantic-ordering-of-ego-layers/) (shipped earlier same day)

## Goal

Split the `ego/behavior` layer into two distinct keys: **conduct** stays in `ego/behavior` (how I act, how I think, how I position myself); **expression** moves to a new `ego/expression` (how I speak, vocabulary, format, punctuation).

Mixed in the same key, problems of formatting (using listicle, using em-dash) and problems of method (jumping to solution, not resonating) became hard to diagnose separately. The Identity Lab POC kept them as two sections (`## Conduta` and `## Expressão`) inside the same `ego/behavior` as an interim measure; this story lands the proper architectural split.

## Status

- [x] Custom ordering in `getIdentityLayers` extended to include expression (identity → expression → behavior)
- [x] `isAllowedWorkshop` accepts `ego/expression`
- [x] `LAYER_META` in `layer-workshop.tsx` describes the new layer
- [x] Cognitive Map gains a 4th card for `ego/expression`, between identity and behavior
- [x] Default template `server/templates/expression.md` created
- [x] Both seed paths (web `createUser` handler and CLI `handleUserAdd`) seed `ego/expression` from the template
- [x] Tests updated for new ordering and new seeded layer
- [x] Worklog entry
- [x] Radar entry removed

## Documents

- [Plan](plan.md) — implementation details, files affected, decisions
