[< Story](index.md)

# Plan: Semantic ordering of ego layers

## Problem

Today `getIdentityLayers` (in `server/db/identity.ts`) orders by `key` alphabetically within the ego layer. This puts `behavior` before `identity` in the composed prompt.

Consequence: the model reads behavioral rules before the framing *"I am a conscious mirror, the user in another register"* that lives in identity. The reflex framing emerges only at the end, after the rules have been processed.

This was diagnosed during the Identity Lab spike. See [Spike §9.1](../../spikes/spike-2026-04-18-identity-lab.md#91-semantic-ordering-of-ego-layers-independent-of-the-split).

## Solution

Add a second `CASE` clause inside the existing `ORDER BY` in `getIdentityLayers`. Within ego: `identity` (1) → `behavior` (2). Other keys fall back to alphabetical via `ELSE 99`.

When the future split into three keys lands (`CV3.E1.S?` → split ego), `expression` slots in as 2 and `behavior` shifts to 3. Incremental update.

## SQL

**Current:**

```sql
ORDER BY
  CASE layer
    WHEN 'self' THEN 1
    WHEN 'ego' THEN 2
    WHEN 'persona' THEN 3
    ELSE 4
  END,
  key
```

**New:**

```sql
ORDER BY
  CASE layer
    WHEN 'self' THEN 1
    WHEN 'ego' THEN 2
    WHEN 'persona' THEN 3
    ELSE 4
  END,
  CASE
    WHEN layer = 'ego' AND key = 'identity' THEN 1
    WHEN layer = 'ego' AND key = 'behavior' THEN 2
    ELSE 99
  END,
  key
```

## Files

- `server/db/identity.ts` — SQL update + comment update in `getIdentityLayers`.
- `tests/db.test.ts` — flip expected order in the test *"returns layers ordered by psychic depth (self → ego → persona), then by key"*.

## Other consumers (verified)

`getIdentityLayers` is used in `server/reception.ts`, `server/admin.ts`, `server/composed-snapshot.ts`, `server/identity.ts`, and `adapters/web/index.tsx`. None depend explicitly on alphabetical ordering — they filter by layer/key, not by array position. The change is safe for all callers; in fact, all will benefit from the more semantic ordering.

`composeSystemPrompt` (in `server/identity.ts`) maps the returned layers in order, so the composed prompt will have `identity` before `behavior` automatically once this change ships.

## Validation

1. Full test suite passes (`npx vitest run`).
2. Manual SQL query against the dev DB confirms identity before behavior within ego:
   ```sql
   SELECT layer, key FROM identity
   WHERE user_id = (SELECT id FROM users WHERE name = 'Alisson Vale')
   ORDER BY <new SQL>;
   ```
3. Optional: inspect a composed prompt by running a request through `/mirror/stream` with logs and confirming that the `## Identidade` block appears before `## Comportamento` in the system prompt.

## Risk

Low. Single SQL function change. No schema migration. No data change. No API change.

## Out of scope

- Splitting `ego` into three keys (`identity`, `expression`, `behavior`). That depends on this improvement landing first; it lives as `CV3.E1.S?` in the roadmap (and as Spike §9.3).
- Generated summary by lite model. Independent improvement listed in the Radar (and Spike §9.2).
