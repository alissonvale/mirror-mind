[< Story](index.md)

# Test guide — CV1.E7.S3 Conditional scope activation

Manual roteiro to validate the new composition semantics in the browser.

## Pre-conditions

- Dev server running (`npm run dev` from the mirror-mind repo root).
- A user with at least one organization and one journey created. The journey can be linked to the organization or independent — both cases work for this test.
- A session pinned to that org **and** that journey (use the conversation header's "Edit scope ›" or the rail to add tags). Suggested: pin `software-zen` (org) + `vida-economica` (journey).
- The user's `software-zen` org has a non-empty `briefing` and/or `situation` field (so a non-empty block exists to be either rendered or omitted). Same for the journey. If either field is empty, the relevant assertions ("snapshot contains briefing") need adjustment.

## Test 1 — Casual message, no scope domain

**Send:** `bom dia` (or any greeting / small-talk).

**Expected:**

- The assistant bubble does **not** carry the `◈ software-zen` badge nor the `↝ vida-economica` badge.
- Open the rail's `Look inside ›`. The composed prompt snapshot does **not** contain the briefing or situation of either scope. Soul, identity, behavior should be there; org/journey blocks should be absent.
- The conversation header's scope pills (`◈ software-zen`, `↝ vida-economica`) **stay visible** — they reflect the session-level pinning, not the per-turn activation. This is the asymmetry: pill = stable; bubble badge = per-turn.

**Why this validates:** reception correctly classified the greeting as scope-less; pre-S3, the composer would have rendered both scopes anyway because they were tagged. Post-S3, it doesn't.

## Test 2 — Message clearly in the org's domain

**Send:** something that names the org or its territory. Example: *"qual é o foco da Software Zen esta semana?"* (or whichever message clearly lands in the org's situation territory).

**Expected:**

- The assistant bubble carries `◈ software-zen` (and possibly `↝ vida-economica` if the journey also activates per the sole-scope or pair rules).
- The `Look inside ›` snapshot contains the org's briefing and/or situation block. The wrapper `Current situation:\n...` is present if the situation field is non-empty.
- The reply substance touches the org's context — that's the substance check that the prompt actually carried the briefing.

**Why this validates:** reception's pick reaches composition; the bubble badge and the prompt agree.

## Test 3 — Message off-domain (neither scope's territory)

**Send:** something clearly outside both scopes' descriptors. Example: *"me explica em poucas palavras o que é uma monad em Haskell"*.

**Expected:**

- No badges on the bubble.
- No scope blocks in the snapshot.
- The reply is on-topic for the question (the assistant uses base ego + whichever persona reception picked, if any) — no leakage of the pinned scopes into the answer.

**Why this validates:** when no scope applies, composition is empty. Pre-S3, the pinned scopes would have leaked into the prompt and possibly into the answer.

## Test 4 — Multiple turns same session, mixed domains

In the same session (still pinned to org + journey), alternate the three message types in any order. After each turn, verify:

- The header pills (`◈`, `↝`) stay visible across all turns — they don't flicker.
- The bubble badges (`◈`, `↝`) appear or disappear turn-by-turn based on what reception picked.
- The "Look inside" snapshot reflects the **current turn's** activation, not a cumulative state.

**Why this validates:** the per-turn conditionality is symmetric across turns; nothing carries over from a previous turn's pick.

## Failure modes to watch for

If any of these surfaces, S3 has a regression:

- Pre-S3 leak: a pinned scope's briefing appears in the snapshot of a clearly off-domain turn.
- Header instability: the pills disappear when reception returns null (they should not — pills are session-level).
- Bubble inversion: a bubble carries `◈ software-zen` but the snapshot doesn't contain the briefing (the badge claims activation but the prompt didn't carry the content).
- Reception starvation: a question genuinely about the pinned org returns no badge and no block — sole-scope rule is broken.

## Automated coverage

The contract is pinned at the unit level by the 4 tests in `tests/identity.test.ts` under `describe("composeSystemPrompt — conditional scope activation (CV1.E7.S3)")`. Manual smoke is the validation that the new rule integrates cleanly with reception, the rail, the bubble signature, and the snapshot UI.

## Optional — re-run scope-routing eval

Reception's logic did not change in S3, so the [scope-routing eval](../../../../../process/evals.md) should still score the same as it did at S2 close (9/11 on Gemini 2.5 Flash with `reasoning: "minimal"`). Run only if you want a regression check; not required to declare S3 done.

```bash
npx tsx evals/scope-routing.ts
```

A score below 9/11 on the same DB and the same model is a regression — likely in reception, not in composition (S3 doesn't touch reception).
