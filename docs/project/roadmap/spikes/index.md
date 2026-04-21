[< Roadmap](../index.md)

# Spikes

Technical investigations that shaped the path. Each spike is a historical document: it records what was tried, what was learned, and what decisions followed. Spikes are not specs and not status — once closed, they stop being updated, even when the codebase moves on.

## Closed spikes

- [Pi as Foundation](spike-2026-04-12-pi-foundation.md) — 11–12 April 2026. Technical investigation that led to the reconstruction of the mirror on top of `pi-mono`, with eight runnable experiments covering provider abstraction, tool-calling, memory, and personas.
- [Identity Lab](spike-2026-04-18-identity-lab.md) — 18–19 April 2026. Exploratory POC on closing the feedback loop between editing identity prompts and hearing the resulting voice. Validated the loop manually, shipped `Lab mode` (bypass_persona) as a reusable affordance, and produced prompt engineering learnings for any future work on identity or persona authoring.
- [Subscription-based LLM access via OAuth](spike-2026-04-21-subscription-oauth.md) — 21 April 2026. Investigation into alternative billing paths (consumer subscriptions) and an empirical three-model comparison for reception. Found pi-ai already supports OAuth against five subscription-backed providers; Gemini 2.5 Flash with `reasoning=minimal` matches Haiku on accuracy at 3× lower cost. Decisions: reception default swaps to Flash; OAuth integration prioritized as CV0.E3.S8.
