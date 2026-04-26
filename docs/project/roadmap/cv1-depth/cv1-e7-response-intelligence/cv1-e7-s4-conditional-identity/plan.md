[< Story](index.md)

# Plan — CV1.E7.S4 Conditional identity layers

## Premise

Briefing #5: every token in the prompt must earn its place. `self/soul` and `ego/identity` are the heaviest two layers in the identity cluster — a few thousand tokens of essence, purpose, and operational positioning. Until S4, both composed on every turn regardless of relevance: a casual greeting carried the full existential framing.

S4 makes both conditional: compose only when reception flags the turn as touching identity, purpose, or values. Direct sibling of S3 (same asymmetry — move decision to reception, composer respects), applied to the deepest identity layers instead of scope.

## Design

### Single boolean (not split soul/identity)

`touches_identity: boolean` on reception. When `true`, both `self/soul` and `ego/identity` compose. When `false`, both skip.

**Why a single boolean:** the layers are conceptually adjacent (essence + operational positioning are "who I am" on a spectrum). A single classification keeps reception simple. If real use surfaces "I want one but not the other", S4b refines.

### Identity-conservative defaults (Alisson's framing)

Identity-touching turns are the minority case — most turns are operational. The defaults reflect that:

- **Reception success with explicit `true`** → compose
- **Reception success with explicit `false`** → skip (the savings)
- **Reception success with field missing** → skip (drift falls toward minority)
- **Reception failure (timeout, JSON parse, network)** → skip (NULL_RESULT carries false)

Only an explicit `true` flips composition on. Silence in any form keeps the prompt minimal.

This inverts the normal "compose on uncertainty" stance — chosen deliberately because identity layers are heavy and identity-touching turns are rare. A miss in the false direction is recoverable (user can ask for more depth and reception reclassifies). A miss in the true direction is silent token waste plus tonal mismatch.

### Composer fallback default — true (back-compat)

The composer's `touchesIdentity` parameter defaults to `true` when omitted. This is opposite to reception's NULL_RESULT default — chosen because it serves a different role:

- **Reception fallback** (`false`) honors the modal turn.
- **Composer fallback** (`true`) honors back-compat with callers that pre-date S4.

The canonical caller (reception result) always provides an explicit boolean, so the composer's default is a defensive corner that shouldn't fire in production. Existing tests that didn't pass the flag continue to compose identity, matching their original intent.

## Phases

| # | Phase | Files | Validation |
|---|---|---|---|
| 1 | **Reception** — add `touches_identity` to `ReceptionResult`, NULL_RESULT, system prompt, parser. Strict boolean check (anything not literal `true` → `false`). | `server/reception.ts` | 8 new tests in `tests/reception.test.ts` |
| 2 | **Composer** — `ComposeScopes` gains `touchesIdentity?: boolean`. Soul + identity wrapped in a single conditional. Default `true` for back-compat. | `server/identity.ts` | 8 new tests in `tests/identity.test.ts` |
| 3 | **Composed snapshot** — `composedSnapshot` accepts `includeIdentity?: boolean`. When false, filters `self.soul` + `ego.identity` from layers. Default `true`. | `server/composed-snapshot.ts` | 4 new tests in `tests/composed-snapshot.test.ts` |
| 4 | **Adapter wiring** — three adapters pass `reception.touches_identity` to compose, stamp `_touches_identity` on assistant entry meta, threaded through buildRailState's override + DB-derive paths. | `adapters/web/index.tsx`, `adapters/telegram/index.ts`, `server/index.tsx` | Type check + full suite |
| 5 | **Manual smoke** — Dan walkthrough: Test 1 ("Quiet evening") should now show `Look inside` with reduced layers (no `self.soul`, no `ego.identity`); identity-touching message ("Help me think about who I am as an engineer") should restore the full layers. | navegador | [test-guide.md](test-guide.md) |
| 6 | **Docs close-out** — story folder, epic index, prompt-composition refactor (including reception §1 canonical rewrite — accumulated debt from prior stories), decisions.md, worklog. | docs | reading |

## Risks

**Reception classifying mis-aligned with intent.** Most likely failure mode: reception says `false` when the user actually wanted identity depth. Mitigation: identity-conservative default makes this the recoverable error (user can rephrase or ask explicitly). The opposite error (false `true`) loads identity unnecessarily — no quality regression, just wasted tokens, same as today.

**Calibration drift.** Reception's prompt for the new axis may need iteration based on real use. The plan keeps this as Phase 5 manual smoke surfacing, not a pre-built eval. If frequent miss-classification surfaces, S2b (mode auto-detection calibration) becomes "S2b — reception calibration" covering the new axis too.

## Narrative impact

Like S3, S4 changes the prompt's internals — not a user-facing surface in the design-doc sense. The visible effects are quieter responses on operational turns (identity layers no longer framing every exchange). Narrative extension not required.

For Dan Reilly's flow specifically: turn-1 casual greeting now responds without invoking the full soul; turn-2 in-domain question still composes the identity if the system prompt's framing benefits from it (rare for IT questions, common for life-decision questions).
