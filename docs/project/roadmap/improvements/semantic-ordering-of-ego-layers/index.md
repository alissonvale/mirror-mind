[< Roadmap](../../index.md)

# Semantic ordering of ego layers

**Status:** ✅ Shipped 2026-04-19
**Source:** [Identity Lab spike §9.1](../../spikes/spike-2026-04-18-identity-lab.md#91-semantic-ordering-of-ego-layers-independent-of-the-split)

## Goal

Within the `ego` layer, return `identity` before `behavior` in `getIdentityLayers` results. This puts "who I am" before "how I act" in the composed prompt, which matches the semantic flow the model should read.

## Status

- [x] Implementation in `server/db/identity.ts`
- [x] Test update in `tests/db.test.ts`
- [x] Full test suite passes (151/151)
- [x] Manual validation against composed prompt (SQL query confirms identity → behavior within ego)
- [x] Worklog entry
- [x] Radar entry removed (improvement shipped)

## Documents

- [Plan](plan.md) — problem, solution, files, validation
