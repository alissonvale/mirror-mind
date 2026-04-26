[< CV1.E7](../)

# CV1.E7.S8 — Out-of-pool rail suggestion

**Status:** Plan in review (not started)

## Problem

Pool-as-constraint (CV1.E4.S4 → CV1.E7.S3) keeps conversations focused: reception filters candidate personas/scopes by what the user pinned, the composer renders only what reception activated, the prompt stays clean. But the constraint silently locks out genuinely better picks when the conversation drifts outside the declared frame.

The canonical empirical case lives in [S3's manual smoke close-out](../cv1-e7-s3-conditional-scope/#empirical-evidence-for-cv1e7s8): Dan asked about Stanley plane comparison on a session whose cast was restricted to `[engineer]`. Reception had no choice but to activate `engineer` (the only candidate). The response came back competent-but-misframed — engineer's lens applied to woodwork. Dan had no signal that `maker` existed in his data and would have been the right voice.

## Fix

Make the lockout **visible and opt-in**. Reception emits a "would have picked" signal alongside the canonical pick. The UI surfaces it as a non-modal card below the bubble. Click triggers a divergent one-turn response through the suggested persona/scope, rendered inline. The session pool is unchanged.

## See

- [Plan](plan.md) — full design with diagrams, phases, persistence schema, UX, risks
- [S3 close-out — empirical fixture](../cv1-e7-s3-conditional-scope/#empirical-evidence-for-cv1e7s8) — the canonical use case for accepting S8 as done
- [Prompt-composition § Parked alternatives](../../../../product/prompt-composition/index.md#parked-alternatives--three-design-points) — S8 is the "On-demand divergent response via the rail" entry promoted out of parked

## Status notes

Plan written 2026-04-26. Awaiting approval on key design decisions (single LLM call vs two; suggestion placement below bubble; separate `divergent_runs` table; one-shot JSON for MVP) before phase 1 begins.
