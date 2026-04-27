[< CV1.E9](../)

# CV1.E9.S1 — self/doctrine layer

**Status:** ✅ Done (2026-04-27) · Released in `v0.18.0`

## Problem

The mirror-mind has `self/soul` (essence, purpose, frequency) and `ego/identity` (operational positioning) but no place for a user's **adopted framework** — the principles, doctrines, and mental models the user operates from. For Alisson, this is the 9 Princípios da Liderança Soberana (Primazia do Ser, Integridade Radical, Coerência Atratora, etc.). For another user, it could be a different framework, or nothing.

Without a doctrine layer, the user's framework gets bundled into `self/soul` (mixing "who I am" with "what doctrine I operate from") OR lives nowhere and the Alma can't quote it back.

The o-espelho prompt in szen_play already proves the value of this material: the wise voice cites the user's own principles by name as anchors of paragraphs. Mirror-mind needs a layer to carry that material so the same move works here.

## Fix

A new identity layer — `self/doctrine` — that sits alongside `self/soul`. Stores the user's adopted framework (principles, doctrines, mental models) as plain markdown content. Composes alongside `self/soul` and `ego/identity` when the turn touches identity OR when the Voz da Alma is engaged.

```
identity table (existing schema, no migration)
  layer='self', key='soul'      → essence
  layer='self', key='doctrine'  → adopted framework (NEW)
  layer='ego',  key='identity'  → operational positioning
  layer='ego',  key='behavior'  → conduct/method
  layer='persona', key=…        → domain lenses
```

Composition rule:
- `composeSystemPrompt` includes `self/doctrine` together with `self/soul` and `ego/identity` under the `touchesIdentity` gate (S4 already wires this gate; S1 just adds doctrine to the same conditional).
- `composedSnapshot` includes `self.doctrine` in the layers list when `includeIdentity` is true, filters it out otherwise — same treatment as soul/identity.

## Why a separate layer (not bundled into soul)

The user's **soul** and the **doctrine they've adopted** are different objects:
- Soul changes slowly, over years. Identity-bearing.
- Doctrine can be swapped, refined, or shared between users. Framework-bearing.

A user adopting a new framework (or graduating from one) shouldn't have to rewrite their soul. A user with no declared doctrine has an empty layer — the Alma falls back to soul + identity. Symmetric for the future case where multiple frameworks coexist (a meta-doctrine layer if it ever happens).

This is the **option 2** decision recorded in `docs/project/decisions.md` (2026-04-27).

## What ships

- **Migration: none.** The `identity` table schema is `(layer, key, content)` — flexible. A doctrine row is just a row with `layer='self'` and `key='doctrine'`.
- **`server/identity.ts` — composer.** `composeSystemPrompt` includes `self/doctrine` inside the `touchesIdentity` gate, between `self/soul` and `ego/identity`. Order: soul (essence) → doctrine (framework) → identity (positioning). Conceptually broadest to narrowest within the identity cluster.
- **`server/composed-snapshot.ts` — snapshot.** `composedSnapshot` includes `self.doctrine` in the layers list when `includeIdentity` is true. Adds doctrine to the `isIdentity` filter rule so the snapshot reflects composition truth.
- **`server/db/identity.ts` — read order.** `getIdentityLayers` already orders by layer (self → ego → persona). Inside `self`, alphabetical: doctrine sorts before soul. We override with an explicit ordering for self: `soul` → `doctrine` so the rail's display matches composition order.
- **Seeding for Alisson.** A small admin helper / docs note for inserting the 9 Princípios as Alisson's `self/doctrine` content. Not an automatic migration — admin runs it once.

## Tests

Targeted at the contract:
- `tests/identity.test.ts` — composer includes `self/doctrine` under `touchesIdentity: true`, skips under `false`. Order is soul → doctrine → identity.
- `tests/composed-snapshot.test.ts` — snapshot includes `self.doctrine` when `includeIdentity` is true; filters when false.
- `tests/db.test.ts` — the existing identity read order accommodates the new key (doctrine ordered after soul within the `self` layer).

## Non-goals (parked)

- **A doctrine workshop UI** (analogous to layer-workshop for personas). Doctrine for Alisson is seeded once via admin script. UI for editing comes when a second user adopts a framework.
- **Multiple doctrines per user.** One doctrine row per user for now. If the framework grows complex, the content grows; if multiple frameworks coexist, S1b adds the cardinality.
- **Sidebar visibility for doctrine.** `show_in_sidebar=0` by default — doctrine is not a clickable map surface in this iteration.

## Docs

- [Plan](plan.md)
- [decisions.md — Doctrine layer separation](../../../decisions.md#2026-04-27--cv1e9s1-doctrine-as-separate-layer) (TODO add)
