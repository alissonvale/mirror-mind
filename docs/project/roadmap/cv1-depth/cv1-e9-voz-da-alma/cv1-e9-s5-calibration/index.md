[< CV1.E9](../)

# CV1.E9.S5 — Calibration with Antonio/Bia diary entries

**Status:** ✅ Done (2026-04-27) · Released in `v0.18.0`

## Problem

S3 ships the auto-detector. The classifier's quality is not provable from unit tests alone — those exercise the contract (drift handling, parser strictness, NULL_RESULT semantics) but not whether reception's prompt actually distinguishes apontamento-de-vida from analytical reflection from functional question on real-world phrasing.

Without a calibration round against representative inputs, S3 ships blind. The first user (Alisson) discovers mis-classification through use; the second user (Veronica) inherits whatever bias was hidden.

## Fix

Two artifacts:

1. **Canonical test set** — a code-level fixture (`tests/voz-da-alma-calibration.test.ts`) that holds 12-18 representative messages across the three classes. Each message has a label (`expected_is_self_moment`) and a justification comment. The test calls `receive(...)` against a mocked LLM that returns reception's verbatim output, asserting the parsed boolean matches the expected. Failures surface immediately when reception's prompt drifts.

   The test set isn't a model evaluation (we don't have the LLM running in CI). It's a *contract test* on the parser + prompt-shape: "given this LLM output, the pipeline produces this routing." It catches accidental contract changes (e.g., parser stops accepting `is_self_moment: true`) without requiring an LLM call.

2. **Manual smoke roteiro** — `test-guide.md` walks Alisson (and later Veronica) through six representative conversations against the live model. Each turn has an expected routing (auto: alma vs persona), an expected feel of the reply, and what to look for in the rail's Look inside snapshot. Manual smoke is the only path to validate that the LLM honors the prompt's classification rules in practice.

## Why Antonio + Bia narrative content

The CV2.E1 work created two fully-fleshed Brazilian tenants — Antonio Castro (mineiro-em-Floripa, creator/educator) and Bia Lima (his wife, pediatric emergency physician). Each has identity layers (self/soul, ego/identity, ego/behavior, persona/* multiple), organizations, journeys, and canonical conversations. Their canonical conversations include life-fragment turns that are exactly the apontamento-de-vida shape Voz da Alma serves.

Reusing them for the calibration test set:
- They're already in the database after `narrative load`
- They cover both registers (creator-flavored / medical-flavored)
- They're authored, not synthetic — so the calibration measures against intent that came from a writer, not a checklist
- Adding new test users wouldn't help the calibration; their existing material is the right corpus

For variety, the test set also includes Alisson-flavored phrasing (his actual cadence) so calibration covers his voice as well as the narrative authors'.

## Scope of S5

S5 ships **the test set + manual guide + calibration round done**. If the manual smoke surfaces mis-classification (e.g., reception calls a clear apontamento "false"), S5 includes ITERATING the reception prompt and the canonical examples in `server/reception.ts` until the obvious cases land correctly.

S5 does NOT ship:
- A general-purpose eval harness (CV1.E8 / future work)
- Per-user fine-tuning
- LLM-call recording infrastructure (CV1.E8.S1)

## What ships

- **`tests/voz-da-alma-calibration.test.ts`** — contract tests for 12-18 canonical messages with expected `is_self_moment` labels. Each test feeds the message into reception via `fakeComplete` returning the expected LLM verdict, asserts the parsed boolean.
- **`docs/.../cv1-e9-s5-calibration/test-guide.md`** — manual smoke roteiro: 6 conversations covering apontamento, functional question, analytical reflection, edge cases, and "Enviar Para…" flow.
- **Reception prompt iteration** (if needed) — inline tweaks to `server/reception.ts` based on smoke outcomes.

## Tests

The contract tests run in CI; the manual smoke runs once per release of the epic.

## Non-goals (parked)

- **Live-LLM eval harness** — not the right shape for v1; logs from CV1.E8.S1 + per-conversation manual review will give us calibration evidence over time.
- **Probabilistic confidence threshold** — boolean now, threshold parked behind S3b if the binary proves too coarse.

## Docs

- [Plan](plan.md)
- [Test guide](test-guide.md)
