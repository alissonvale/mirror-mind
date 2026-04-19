[< Story](index.md)

# Plan: Compose order — identity then form

## Problem

After the three post-spike improvements shipped, a voice-probe battery ran through the chat revealed a persistent failure of the ego/expression rules whenever a persona was active. Two violations dominated: em-dashes (absolute rule) and listicle disguised as parallel heading-phrase paragraphs.

With DeepSeek as the `main` model, em-dashes leaked through in both persona-routed probes. Swapping to Claude Haiku 4.5 fixed the em-dash leak, but the listicle pattern persisted — three consecutive probes produced variations of the same anti-pattern:

- "em três camadas que se atravessam" (explicit ordinal opener)
- "E há uma terceira camada que está emergindo" (ordinal marker mid-text)
- Six parallel paragraphs each opening with a heading-phrase + elaboration

The problem was structural. The composition order at that point was:

```
self/soul → ego/identity → ego/expression → ego/behavior → persona/<key>
```

Persona sat last. Transformer recency bias gave persona content more attention weight than the expression rules preceding it, even though those rules explicitly prohibit the listicle pattern the model was producing.

## Solution

Reorganize the composition into two semantic clusters:

```
identity cluster: self/soul → ego/identity → [persona]
form cluster:     ego/behavior → ego/expression
[adapter instruction last]
```

This reframes persona as a **specialization of identity**, not as an overriding final instruction. The form cluster (how I act, how I speak) is invariant across personas — it applies regardless of which lens is active. Expression sits last in the identity stack so its absolute rules keep maximum recency weight.

Two separate orderings now coexist, and they serve different purposes:

- **Display order** (Cognitive Map cards, SQL `ORDER BY`): `identity → expression → behavior`. Readable human progression: who → how-speak → how-act.
- **Composition order** (system prompt to LLM): `identity → [persona] → behavior → expression`. Cluster-based, recency-optimized.

## Files affected

- `server/identity.ts`:
  - `composeSystemPrompt` refactored from `baseLayers.map(l => l.content)` (generic) to explicit cluster-based assembly: soul → identity → persona → behavior → expression → adapter.
  - New `get(layer, key)` helper to pick specific layers from the full list.
  - Docstring describes the composition order and the contrast with display order.
- `tests/identity.test.ts`:
  - Replaced "appends the specified persona layer at the end" with "places persona between identity and form clusters" (asserts soul < identity < mentora < behavior < expression).
  - Updated "appends adapter instruction after persona" to "appends adapter instruction at the very end" (asserts expression < telegram).
  - `does not append adapter instruction for unknown adapter` relaxed from `.toBe("SOUL")` to `.toContain("SOUL")` + `.not.toContain("Telegram")` to tolerate trailing content.

## Decisions

**Why "identity → form" and not the original "identity → expression → behavior" order within ego.** The original semantic ordering improvement (shipped earlier the same day) argued for `identity → expression → behavior` within the ego layer. That ordering is still right for display — it reads naturally for humans scanning the Cognitive Map. But for composition to the LLM, the user's reframing is cleaner: persona is a lens on identity, behavior/expression are invariants of form. Grouping by semantic cluster instead of within-layer ordering gives recency to the rules that need it most.

**Why expression last and not behavior last.** Expression carries the absolute rules (no em-dash, no listicle) that the persona was overriding. Behavior carries conduct/method rules (ressoar, reframe, devolver pergunta) that are less prone to violation. Putting expression at the very end of the identity stack (before adapter) maximizes recency for the rules that proved fragile.

**Why not hardcode a final reminder block.** A `FINAL_REMINDER` variant was implemented and tested during this session: a short, sharp block with the absolute rules appended after expression. It failed to prevent the listicle pattern in a controlled probe. The block added prompt tokens on every call and did not solve the main problem, so it was removed. The composition reordering (which does land) is retained as the structural improvement.

**Accepted limit: listicle under enumeration-shaped questions.** After three layers of reinforcement (composition reordering, model swap to Haiku 4.5, final reminder block), questions with plural-enumeration grammar ("quais são as coisas mais importantes...") still produced structured enumeration responses. This appears to be a stubborn transformer default that prompt engineering cannot fully override — the model has strong priors for structured responses to list-inviting questions. The em-dash rule is consistently held by Haiku; the listicle rule is not. Mitigation paths left open: fine-tuning, stronger model (Sonnet 4.6), or reframing the expected voice to allow narrative subheadings in long-arc answers.

## Validation

- 162 tests passing. Three existing tests in `identity.test.ts` updated; no new tests added.
- Voice-probe battery run manually before and after:
  - **Probe A** (benchmark from spike, bypass on, "Por que você construiu o Espelho?"): voice markedly stronger on Haiku vs DeepSeek — antagonism-integrative pairs visible throughout, canonical vocabulary in place, aphoristic closing. No em-dashes. Single list-without-bullets slip in one paragraph.
  - **Probe B** (no bypass, "Tenho sentido que estou produzindo menos..."): routed to terapeuta. Reframe worked ("produzir menos vs sentir que produz menos"). No em-dashes. No listicle.
  - **Probe C** (no bypass, "Quais são as coisas mais importantes pra você..."): routed to terapeuta. Listicle disguised persisted across all mitigations — finding accepted as structural LLM limit.

## Risk

Low. Behavioral change is in composition order only; no schema change, no data change. The adapter instruction continues to sit at the very end. Tests cover both cluster boundaries and adapter position.

## Out of scope

- Fine-tuning to enforce anti-listicle under enumeration pressure.
- Changing the display order in the Cognitive Map (stays `identity → expression → behavior`).
- Changing within-ego SQL ordering (semantic-ordering improvement kept intact — it still governs how layers are fetched and displayed).
