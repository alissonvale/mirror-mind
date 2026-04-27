[< Story](index.md)

# Plan — CV1.E9.S1 self/doctrine layer

## Premise

The Voz da Alma in szen_play cites the user's own declared principles back to them — that's the most intimate signal the wise voice carries. To preserve this in mirror-mind, the prompt composition needs a slot for the user's adopted framework that's distinct from `self/soul` (essence) and `ego/identity` (operational positioning).

S1 installs that slot as a new identity layer (`self/doctrine`) with composition rules that match the existing identity-conservative gating from S4. No new schema, no new UI surface, no new APIs — just a new row category and a small composer change.

## Design

### Layer naming

`layer='self'`, `key='doctrine'`. Inside the self namespace alongside `soul`. Alternative considered: `ego/doctrine` (operating framework belongs to ego). Rejected because doctrine is upstream of operation — it shapes how the user *sees* the world, not just how they act. Self is the right home.

### Composition order

Within the identity cluster, broadest-to-narrowest:
```
self/soul          essence (who I am at the deepest)
self/doctrine      adopted framework (which lens I see through)
ego/identity       operational positioning (how I show up)
ego/behavior       conduct/method (always-on, outside the gate)
```

Doctrine sits between soul and identity. Reading: "I am X, I see through framework Y, I show up as Z, I operate via W."

### Conditional activation

Same gate as `self/soul` and `ego/identity` (CV1.E7.S4): the `touchesIdentity` boolean from reception. When `true`, all three identity layers compose. When `false`, all three skip.

The Voz da Alma path (S2) bypasses reception's identity gate and always composes the identity cluster — doctrine included. That's the alma's defining move: it speaks from the user's center, which requires the full identity material.

### Reception — no change in S1

Reception doesn't classify "is this a doctrine moment" because doctrine isn't a separate axis — it composes whenever identity composes. S1 leaves reception alone.

### Snapshot — symmetric to composer

`composedSnapshot` filters layers to reflect what actually composed. Adding doctrine to the `isIdentity` filter keeps the snapshot honest: when the gate is closed, `self.doctrine` is filtered out alongside `self.soul` and `ego.identity`.

### Seeding — admin script, not auto-migration

Doctrine content is user-personal. Inserting Alisson's 9 Princípios automatically into every database would be wrong (the narrative test users — Antonio, Bia, Reilly-Marchetti household — should NOT have Alisson's doctrine). The plan is:

1. A documented `npm run admin -- doctrine seed <user>` command that reads a markdown file and inserts/updates `self/doctrine` for that user.
2. Alisson's content (9 Princípios) lives in a markdown file at `docs/seed/alisson/doctrine.md` — a private content file (gitignored if needed; the file structure is the contract, the content is personal).
3. Other users start with empty doctrine; the Alma falls back gracefully.

For S1's first iteration, we go simpler: an `admin doctrine set` CLI command that takes `<user>` and `<file>` arguments. The seed markdown file is created in the repo for Alisson (the doctrine is already public — it's the Liderança Soberana content from szen_play). For other users, admin invokes the command with their own file.

## Phases

| # | Phase | Files | Validation |
|---|---|---|---|
| 1 | **Composer** — extend `composeSystemPrompt` to include `self/doctrine` between `self/soul` and `ego/identity` under the same `touchesIdentity` gate. | `server/identity.ts` | New tests in `tests/identity.test.ts` |
| 2 | **Snapshot** — extend `composedSnapshot` to include/filter `self.doctrine` symmetrically with soul/identity. Update the `isIdentity` filter. | `server/composed-snapshot.ts` | New tests in `tests/composed-snapshot.test.ts` |
| 3 | **DB read order** — extend `getIdentityLayers` to order `self/soul` before `self/doctrine` (otherwise alphabetical would put doctrine first). | `server/db/identity.ts` | Existing identity tests + 1 new ordering check |
| 4 | **Admin command** — `admin.ts` gains a `doctrine set <user> <file>` subcommand that reads a markdown file and writes `self/doctrine` via `setIdentityLayer`. | `server/admin.ts` | Manual + 1 smoke test |
| 5 | **Alisson's seed file** — `docs/seed/alisson/doctrine.md` with the 9 Princípios content ported from szen_play's `acolhimento.md`. | new file | reading |

## Risks

**Existing tests assume current layer set.** Anything that asserts the exact layer list on a user with both soul and doctrine could break. Mitigation: run the full suite; the only failures should be ones that need to assert "soul + doctrine + identity" instead of "soul + identity".

**Doctrine cardinality.** S1 ships one doctrine per user. If Alisson later adopts a second framework alongside the first, the natural answer is to grow the doctrine markdown's content rather than add a second row. If that becomes painful, S1b explores cardinality.

**Snapshot back-compat.** Existing snapshots expect `self.soul` and `ego.identity` to either both compose or both skip. Adding doctrine to the same set is a content-level change; the contract (gate boolean) is unchanged.

## Narrative impact

For the existing narrative test users (Antonio, Bia, Reilly-Marchetti household), there's no change — they have no doctrine seeded, so the composer / snapshot for their conversations behaves identically. Alisson, after the seed runs, gets the doctrine layered into identity-touching turns and into every Voz da Alma turn (S2).
