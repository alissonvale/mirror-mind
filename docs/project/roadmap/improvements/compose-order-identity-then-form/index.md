[< Roadmap](../../index.md)

# Compose order — identity then form

**Status:** ✅ Shipped 2026-04-19
**Depends on:** [Split ego into three keys](../split-ego-into-three-keys/) (shipped same day)

## Goal

Reorganize the identity composition order around two semantic clusters: **identity** (who I am, in the specific lens active) and **form** (how I act and how I speak). Persona moves from "appendix after ego" to "specialization of identity", sitting between `ego/identity` and the form cluster. `ego/expression` moves to the last position of the identity stack so its absolute rules get maximum recency weight over any persona content.

## Motivation

Voice probing after the three post-spike improvements shipped revealed a systematic problem: responses routed through a persona were violating ego/expression rules (em-dash, listicle disguised as parallel heading-phrase paragraphs). The composition order at that point was:

```
self/soul → ego/identity → ego/expression → ego/behavior → persona/<key>
```

Persona sat last. By the recency bias of transformer attention, persona content had more weight than the expression rules above it. Even with a stronger model (Haiku 4.5 replacing DeepSeek), the listicle pattern persisted under enumeration-shaped questions.

The user's own framing of the fix: "persona vem depois de identity e então behavior e expression. o caminho assim não seria identidade → forma?" — a cleaner conceptualization than the original within-ego ordering.

## Status

- [x] `composeSystemPrompt` in `server/identity.ts` refactored from generic `self+ego` mapping to explicit cluster-based ordering
- [x] Test `places persona between identity and form clusters` replaces the old "persona last" test
- [x] Adapter instruction test updated to verify it still sits after expression
- [x] Documentation of the listicle finding (accepted as LLM limit under question-shape pressure)
- [x] Worklog entry

## Documents

- [Plan](plan.md) — code change, test updates, voice-probe findings, listicle limitation
