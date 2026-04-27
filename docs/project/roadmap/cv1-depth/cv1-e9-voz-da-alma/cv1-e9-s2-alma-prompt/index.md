[< CV1.E9](../)

# CV1.E9.S2 — Voz da Alma identity + prompt port

**Status:** 🚧 In Progress (opened 2026-04-27)

## Problem

The mirror-mind has a composer that builds a system prompt from layered identity (`self/soul`, `self/doctrine` via S1, `ego/identity`), persona lenses, situational scope, and behavior. That composer is the right shape for ordinary turns — when the user is asking a question, requesting an artifact, or starting a domain conversation. It is the wrong shape for a turn where the user is registering a moment of life.

A registry-tone message ("hoje atendi um caso difícil", "fechei a porta enquanto a Veronica chegava destruída", "tive uma conversa com o Tonico que ficou pesando") doesn't want a domain expert. It doesn't want a structured how-to. It doesn't even want a question back. It wants a return — a soft mirror that reflects the user back to themselves with a slightly higher view than they had when they wrote.

The o-espelho app in Software Zen has a prompt that produces exactly this voice: impessoal, firme, não-bajulador, Quiet Luxury. Sereno, elevado, acolhedor. Cites the user's own principles as anchors of paragraphs without explaining what they mean — just applies them. It works.

S2 ports that prompt into mirror-mind as a new composition path — the **Voz da Alma** — that the pipeline can engage instead of the persona path on the right turns.

## Fix

A new composition function `composeAlmaPrompt(db, userId, scopes)` in `server/voz-da-alma.ts` that:

1. **Always composes the full identity cluster** — `self/soul`, `self/doctrine` (when present), and `ego/identity` — bypassing reception's identity gate. The Alma is identity-bearing by definition; it speaks from the user's center.
2. **Does not compose persona blocks.** Personas are domain lenses. The Alma replaces the persona path — it is a different voice, not a layered one.
3. **Composes scope (organization, journey)** when reception flagged them, the same way the persona path does. The user's life context is still relevant; scope adds situational truth without forcing a domain frame.
4. **Composes `ego/behavior`** at the end. Form / conduct rules apply across voices.
5. **Prepends a Voz da Alma identity preamble** — the small, dense block that frames the response. Ported from szen_play, adapted to be generic (works for users with or without doctrine).

The pipeline (S3) chooses between `composeSystemPrompt` (canonical) and `composeAlmaPrompt` based on `reception.is_self_moment`.

## The Voz da Alma identity preamble

Three sections, each tight:

- **VOICE** — first-person, Quiet Luxury, sereno-elevado-acolhedor, autoridade serena (no "talvez"/"pode ser que"), não bajula, não julga.
- **POSTURE** — the user is sharing a registry of life. Not a question. Not a problem. A moment to integrate. The reply is a return, a soft mirror, slightly higher than where the user was.
- **HOW TO USE WHAT'S BELOW** — the doctrine (when present) is the user's own principles; cite them in their exact words when they ressoam, never explain them, just apply. The soul + identity layers describe who the user is at their most centered.

The preamble is generic. It does not name "Liderança Soberana" or "9 Princípios" — those are content of the user's own doctrine layer, injected by the composer. Another user with a different framework gets the same preamble; their doctrine carries their content.

## What does NOT change

- **Reception** — S2 doesn't touch reception. The `is_self_moment` axis is added in S3.
- **Expression pass** — the Alma path still runs through `express()` with the resolved mode. Reasoning: even the Alma's output benefits from a final form pass (mode-aware shaping, expression rules). Risk: expression could rewrite the Alma's tone too aggressively. Mitigation: the Alma preamble's voice rules and the expression pass's "preserve voice" instruction reinforce each other; if drift surfaces in the smoke, S5 calibration adds an Alma-specific override path.
- **Composed snapshot** — S2 adds an `isAlma` flag to the snapshot so the rail can label the turn. Layers list reflects what actually composed (no personas, identity always-on for Alma turns).
- **DB schema** — none. The Alma is composition logic over existing layers.

## Tests

- `tests/voz-da-alma.test.ts` (new) — `composeAlmaPrompt` integrates the preamble, soul, doctrine, identity, scope, behavior in the right order; skips personas; falls back gracefully when doctrine is absent.

## Non-goals (parked)

- **Alma-specific expression mode** — for now reuse the existing modes. If smoke surfaces tone drift, add a fourth mode.
- **Alma as composable layer** — the Alma is a *path*, not a layer. Treating it as a layer would dilute the substitute-persona semantics.
- **Multiple voices of the Alma** (e.g., gentle vs direct) — one voice for now. Variants come from real use, not anticipation.

## Docs

- [Plan](plan.md)
- Source prompt: `~/Code/szen_play/prompts/services/travessia_entry_chat.md`
