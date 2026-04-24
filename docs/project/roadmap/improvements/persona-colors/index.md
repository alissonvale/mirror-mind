[< Improvements](../)

# Persona colors ✅

**Landed 2026-04-24.** Give each persona a persistent, editable color that reinforces the visual identity of the cast across every surface where a persona appears.

## Problem

Persona colors were a pure function of the key — `avatarColor(key)` ran a Horner-style hash and picked an index into an 8-color palette. Consequences:

1. **Ephemeral.** The color was derived on the fly; there was no way to persist it, change it, or override it. If two personas hashed to the same palette slot, they were visually indistinguishable with no way to correct.
2. **Inconsistent application.** Only avatars (Cast header + `/personas` listing) used the color. `◇ persona` text badges on bubbles, persona tags in `/conversations`, Psyche Map persona cards — all stayed neutral gray. The reinforcement of "this is persona X" didn't carry across the system.
3. **No user agency.** The hash was what it was; if the user didn't like the pairing, there was no remedy.

## Fix

A `color` column on the `identity` table, a small editor on `/map/persona/:key`, and consistent use of the stored color across every persona-bearing surface.

**Five phases** (see [plan.md](plan.md) for detail), one commit each:

1. **Schema + helpers** ([`2c1a39e`](../../../../..)). `identity.color` TEXT nullable, backfilled from the hash on migration. New `server/personas/colors.ts` with `hashPersonaColor`, `normalizeHexColor`, `resolvePersonaColor`. `setPersonaColor(db, userId, key, color | null)` writes with validation. 24 new unit + DB tests.
2. **Color picker UI** ([`3579184`](../../../../..)). New section on the persona workshop page: current swatch, 8-color palette (click-to-commit), custom hex input + Apply, Reset-to-hash. New endpoint `POST /map/persona/:key/color` handles swatch clicks, custom hex, and reset. Custom takes precedence when both are posted. 8 new web tests.
3. **Consumers swapped** ([`f660ba2`](../../../../..)). `RailState` gains `personaColors: Record<key, color>` populated once per render. Header Cast, bubble color bar, `/personas` listing, and the streaming `routing` SSE event all read from the map (with `resolvePersonaColor` fallback for legacy rows that were backfilled to hash). Server is the single source of truth.
4. **New colored surfaces** ([`9c26bae`](../../../../..)). `◇ persona` text badge in bubbles (both server-rendered and streamed), `/conversations` persona tag, and Psyche Map persona card now carry inline color from the stored value. 4 new web tests.
5. **Close-out** (this commit). Docs.

## Tests

**628 total** (was 592 at S2 close). **+36 new** across:
- `tests/persona-colors.test.ts` — hash, normalize, resolve (14 cases).
- `tests/db.test.ts` — color seed on persona insert, non-persona leaves NULL, re-saving preserves, setPersonaColor valid/invalid/null/missing, backfill migration (10 cases).
- `tests/web.test.ts` — color picker render + endpoint behavior (8 cases), color propagation across badges/listing/map (4 cases).

## Commit SHAs

- `2c1a39e` — phase 1 schema + helpers + backfill
- `3579184` — phase 2 picker UI + endpoint
- `f660ba2` — phase 3 existing consumers read from DB
- `9c26bae` — phase 4 new colored surfaces
- (this commit) — phase 5 docs

## Before → After

**Before.** Two personas with a key collision in the hash: both teal. No recourse.

**After.** `/map/persona/<key>` has a color picker. Pick a swatch or type a hex. Refresh `/conversation`, `/conversations`, or `/map` — the color carries through every persona surface.

---

- [Plan](plan.md) — design decisions, phases, open questions
- [Test guide](test-guide.md) — manual validation walkthrough
