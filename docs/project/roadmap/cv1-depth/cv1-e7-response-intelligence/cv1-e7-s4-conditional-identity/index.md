[< CV1.E7](../)

# CV1.E7.S4 — Conditional identity layers

**Status:** ✅ Done (2026-04-26)

## Problem

`self/soul` and `ego/identity` are the heaviest two layers in the prompt's identity cluster — together a few thousand tokens of essence, purpose, and operational positioning. Until S4, both composed on **every turn**, regardless of relevance.

A casual greeting (*"bom dia"*) carried the full existential framing into the system prompt. A factual question (*"how does Proxmox handle live migration?"*) loaded the soul. The mirror's identity was framing every exchange whether the exchange asked for that framing or not — corrosive at scale, expensive in tokens, and tonally wrong on operational turns.

The premise of [briefing #5](../../../briefing.md) — *every token in the prompt must earn its place* — wasn't satisfied for the heaviest layers in the prompt. S3 closed the gap for scope content; S4 closes it for the deeper identity layers that S3 didn't touch.

## Fix

A new boolean axis on reception — `touches_identity` — gates `self/soul` and `ego/identity` together. When the turn invites depth on identity / purpose / values, both compose. Otherwise, both skip.

```
reception classifies → touches_identity: boolean
                                │
                                ▼
                composer gates self/soul + ego/identity
                                │
                                ▼
                snapshot reflects what actually composed
```

The pair is gated together (single boolean from reception) — splitting per layer is parked behind S4b, opened only if real use surfaces "I want one but not the other."

## Identity-conservative defaults

Identity-touching turns are the minority case. Most turns are operational. The fallback semantics reflect that:

| Cenário | `touches_identity` value | Composer faz |
|---|---|---|
| Reception success com `true` | true | compõe ambas |
| Reception success com `false` | false | **skipa ambas** ← o ganho |
| Reception success com campo missing (modelo drift) | (default false) | **skipa ambas** |
| Reception fail entirely | false (NULL_RESULT) | **skipa ambas** |

Composer-level default: when caller passes no `touchesIdentity` flag (legacy path that pre-dates S4), default is `true` — the safe back-compat path. The canonical caller (reception result) always provides an explicit boolean, so the composer's fallback is a defensive corner that shouldn't fire in production.

The two defaults pull in opposite directions because they exist for different paths:
- **Reception fallback** (`false`) honors the modal turn (operational).
- **Composer fallback** (`true`) honors back-compat (don't strip identity from old test paths or callers that haven't migrated).

## What shipped

- **`server/reception.ts`** — `ReceptionResult` gains `touches_identity: boolean`. NULL_RESULT carries `false`. System prompt gains a fifth axis with rules, examples, and the "identity-conservative tiebreaker" framing. Parser strict-checks for the literal boolean `true` (any other value falls to `false`).
- **`server/identity.ts`** — `ComposeScopes` gains optional `touchesIdentity?: boolean`. Composer wraps `self/soul` and `ego/identity` blocks in a single conditional. Default true for back-compat with legacy callers.
- **`server/composed-snapshot.ts`** — `composedSnapshot` gains optional `includeIdentity` parameter. When false, filters `self.soul` and `ego.identity` from the layers list so the rail's "Look inside" matches what actually composed. Default true.
- **Three adapters** — `adapters/web/index.tsx`, `adapters/telegram/index.ts`, `server/index.tsx` all read `reception.touches_identity` and pass it to the composer. All three also stamp `_touches_identity` on the assistant entry meta for cross-adapter parity and snapshot persistence across F5.
- **`buildRailState`** in the web adapter — accepts `overrideTouchesIdentity` parameter mirroring the existing override pattern; when undefined, derives from the last assistant entry's `_touches_identity` meta. Passes the resolved value to `composedSnapshot`.

## Tests

670 passing (was 650 before S4; +20 new):
- 8 new in `tests/reception.test.ts` covering the new axis (success, drift, null, failure, no-candidates short circuit, system prompt content)
- 8 new in `tests/identity.test.ts` covering composer gate (true/false, default, independence from persona/scope, composition order preserved)
- 4 new in `tests/composed-snapshot.test.ts` covering snapshot layer filtering

## Non-goals (parked)

- **S4b — split soul vs identity** into independent gates. Open if real use distinguishes between needing one but not the other.
- **`ego/behavior` conditional.** Behavior is form/posture, transversally applicable. Cost of accidentally stripping it (tone collapse) far exceeds the token savings. Stays always-on.
- **Adapter instruction conditional.** Adapter instructions are short and adapter-specific; conditional gating adds complexity without proportional savings.
- **Eval harness for the new axis.** Manual smoke first; formalize an eval probe only if mis-classification surfaces frequently in real use.

## Docs

- [Plan](plan.md) — design decisions, defaults, phases
- [Test guide](test-guide.md) — manual roteiro for validating in the browser
- [decisions.md — Conditional identity layers](../../../decisions.md#2026-04-26--conditional-identity-layers-cv1e7s4)
- [prompt-composition § 1 Reception](../../../../product/prompt-composition/index.md#1-reception) — refactored to canonical reference for all 5 reception axes
- [prompt-composition § 2 Composition](../../../../product/prompt-composition/index.md#2-composition) — layer activation rules table updated; soul + identity rows now show conditional activation

## Empirical observations from S4 manual smoke

(To be filled after the user runs the manual smoke and shares observations — same pattern as S3's close-out section.)
