[< Story](index.md)

# Plan: Split ego into three keys (identity / expression / behavior)

## Problem

`ego/behavior` mixed two distinct concerns:
- **Conduct**: how I act, how I think, how I position myself in the encounter (anti-listicle as method, antagonism as argumentative structure, posture toward the interlocutor)
- **Expression**: how I speak (format rules, vocabulary, punctuation, anti-patterns of style)

Mixed together, problems of form contaminate the diagnosis of problems of method and vice versa. During the Identity Lab POC, when an output failed, it was hard to tell whether the rule that needed reinforcement lived in conduct or in expression.

The POC adopted an interim measure: split `ego/behavior` into two sections (`## Conduta` and `## Expressão`) inside the same key. This story makes the split structural by introducing a new `ego/expression` key.

See [Spike §9.3](../../spikes/spike-2026-04-18-identity-lab.md#93-split-ego-into-three-keys-identity-expression-behavior).

## Solution

Add `expression` as a new allowed key under the `ego` layer, sitting semantically between `identity` and `behavior` in the composed prompt:

`identity` (who I am) → `expression` (how I speak) → `behavior` (how I act)

The change leans on the [semantic ordering improvement](../semantic-ordering-of-ego-layers/) shipped earlier the same day. That improvement already added a `CASE` clause for within-ego ordering; this story extends it with the expression slot.

## Files affected

- `server/db/identity.ts`:
  - `getIdentityLayers` SQL extends the within-ego CASE to three keys (identity = 1, expression = 2, behavior = 3).
- `adapters/web/index.tsx`:
  - `ALLOWED_WORKSHOP_LAYERS.ego` includes `"expression"`.
  - `createUser` handler seeds `ego/expression` from a template (in addition to the existing `ego/behavior` seed).
- `adapters/web/pages/layer-workshop.tsx`:
  - `LAYER_META["ego.expression"]` adds title / meta / help text.
- `adapters/web/pages/map.tsx`:
  - `CognitiveMapPage` resolves `egoExpressionLayer`, passes content + summary to a new `StructuralCard` between identity and behavior.
- `server/admin.ts`:
  - CLI `handleUserAdd` also seeds `ego/expression` from template.
- `server/templates/expression.md` (new):
  - Minimal default template covering format, vocabulary and punctuation as starting points.
- `tests/db.test.ts`:
  - The within-ego ordering test extends to four ego keys, asserts identity → expression → behavior order.
- `tests/smoke.test.ts`:
  - The seeded-baseline test now expects `[ego/expression]` alongside `[ego/behavior]`.

## SQL change

```sql
ORDER BY
  CASE layer ... END,
  CASE
    WHEN layer = 'ego' AND key = 'identity' THEN 1
    WHEN layer = 'ego' AND key = 'expression' THEN 2
    WHEN layer = 'ego' AND key = 'behavior' THEN 3
    ELSE 99
  END,
  key
```

## Decisions

**Why no auto-migration of existing `ego/behavior` content.** The migration would have to parse the markdown of every existing `ego/behavior`, find the `## Conduta` / `## Expressão` boundary, split into two records, and update accordingly. The boundary is a convention the user adopted during the POC, not a guaranteed structure. An automatic split is fragile and would silently mangle prompts that don't follow the convention.

The pragmatic alternative: leave existing `ego/behavior` records untouched. New users get `ego/expression` seeded from template. Existing users (the only one is Alisson) move content from `ego/behavior` to `ego/expression` manually via the source-of-truth — a one-time, ten-minute task that the user controls.

**Why the new template is minimal.** A bigger default template would risk imposing a generic voice on new users, which goes against the spike's learning that the user must declare the voice themselves. Three short sections (format, vocabulary, punctuation) with placeholders signal the right kind of content without dictating it.

**Why both seed paths get updated.** The web `createUser` handler and the CLI `handleUserAdd` are separate entry points for user creation; both must be consistent. Forgetting the CLI would create users via `npx tsx server/admin.ts user add` without the new template and break the smoke test.

## Validation

- 162 tests passing. No new tests added beyond updates to two existing ones (the within-ego ordering test in db.test.ts, and the seeded-baseline check in smoke.test.ts). The new layer is structurally identical to existing layers; existing test infrastructure covers reads and writes already.

## Risk

Low. Schema requires no change (the `identity` table already accepts arbitrary `key` values within layer `ego`). New users get the new layer seeded; existing users see no change until they save a layer named `ego/expression`. The composer naturally handles the new layer (it's just another row to concatenate in semantic order).

## Out of scope

- Auto-migration of existing `ego/behavior` records.
- Cognitive Map layout adjustments. Current grid (`1fr 1fr`) accommodates the 4th card in the 3-row layout (2 + 2 + 2). If visual issues appear during use, layout can be revisited.
- The Identity Lab POC's source-of-truth file format (`identity-lab/identity.md`) needs to learn about `ego/expression` as a separate layer. The user will update the file manually when they migrate content.
