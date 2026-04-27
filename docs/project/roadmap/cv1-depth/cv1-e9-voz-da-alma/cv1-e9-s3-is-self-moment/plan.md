[< Story](index.md)

# Plan — CV1.E9.S3 is_self_moment reception axis + composer integration

## Premise

The Alma's value is gated by the auto-detector's quality. False positives are corrosive (patronizing); false negatives are recoverable (S4's Enviar Para…). The classifier defaults conservatively to `false` and only flips to `true` when the message clearly meets the apontamento-de-vida shape.

## Design

### New ReceptionResult field

```typescript
export interface ReceptionResult {
  // ... existing fields
  is_self_moment: boolean;
}
```

Default: `false`. Parser strict-checks for literal `true`; anything else (string `"true"`, `null`, missing, drift) lands at `false`.

### Reception system prompt extension

Add a new section after the `touches_identity` block:

```
**Voz da Alma — is_self_moment (boolean). When to set true vs false.**

`true` activates the Voz da Alma compose path: the canonical persona pipeline is replaced by a wise-voice composition that speaks from the user's center, citing the user's own declared principles (doctrine) when they ressoam. The Alma is identity-bearing by design — heavy in tokens, distinctive in tone — and only earns its place on a narrow class of turns.

**Three classes the model must distinguish:**

1. **Apontamento de vida** (target → true). A lived-in fragment about something that happened, a registry of a moment that carries weight. First-person, often short, often retrospective. Examples:
   - "hoje atendi um caso difícil"
   - "fechei a porta enquanto a Veronica chegava destruída"
   - "tive uma conversa com o Tonico que ficou pesando"
   - "estou voltando do hospital, preciso parar pra respirar"
   - "acabei de saber que o orçamento foi cortado"
   - "minha mãe ligou mais cedo, fiquei pensando o resto do dia"

2. **Pergunta funcional** (→ false). Operational, factual, transactional, how-to.
   - "qual a melhor forma de cobrar X?"
   - "como configuro Y?"
   - "compare A e B"
   - "o que falta para fechar a story?"
   - "lê esse documento e me diz o que achou"

3. **Reflexão analítica sem peso pessoal** (→ false). Thinking-out-loud about strategy, design, marketing, ideas — the user is sharing thought-work, not a moment of life.
   - "estou pensando sobre estratégia de marketing"
   - "acho que a divulgação devia focar em X"
   - "qual seria o caminho de produto pra resolver Y?"
   - "essa ideia ressoa contigo?"

**Conservative-by-default.** The cost of a false positive (Alma fires on a casual question) is patronizing wisdom — corrosive to trust. The cost of a false negative (Alma silent when wanted) is recoverable — the user has a manual override ("Enviar Para… Voz da Alma"). Bias toward false; require positive evidence to flip true.

**Form signals** (use as evidence for `true`):
- First-person past tense or first-person present-state ("hoje X", "estou X")
- Naming a specific event, person, or moment
- Carries weight (the user is sharing something that affects them)
- No question to be answered, no artifact to be produced

**Form signals against** (use as evidence for `false`):
- Question marks at the end of the message
- Imperative verbs ("escreve", "compara", "explica", "lê", "compose")
- Topic-only message ("estratégia de X", "minha mãe é como?" → reflexive, not a registry)
- Long multi-clause exploration of a topic (essayistic but conceptual, not life-registry)
```

### Pipeline integration — single switch, three callers

The web streaming endpoint, the web sync endpoint, and the telegram adapter all consume reception. Each picks the composer based on `reception.is_self_moment`:

```typescript
const isAlma = reception.is_self_moment === true;
const systemPrompt = isAlma
  ? composeAlmaPrompt(db, user.id, {
      organization: reception.organization,
      journey: reception.journey,
    }, "web")
  : composeSystemPrompt(db, user.id, reception.personas, "web", {
      organization: reception.organization,
      journey: reception.journey,
      touchesIdentity: reception.touches_identity,
    });
```

### Persona pool seeding — skipped on Alma

The auto-seed of `session_personas` (when the pool was empty before the turn) skips when the Alma path engages. Reasoning: the cast is the persona ensemble for the session; the Alma is not a persona and should not enter the cast. Pre-existing scope auto-seed (org, journey on first turn) keeps running — those are situational context independent of the voice.

### Snapshot — isAlma threaded through

`composedSnapshot` already accepts `isAlma` (S2). The pipeline passes `isAlma` explicitly so the rail labels the turn correctly. Same path as `touches_identity` from S4: the live-streaming render uses the in-memory value, and a meta stamp (`_is_alma`) on the assistant entry persists it for F5 reload.

### Expression pass — keep on, mode-aware

The Alma draft still runs through `express(...)` with `personaKeys: []` (Alma has no persona) and the resolved mode. Reasoning:
- Mode shaping benefits the Alma too — a quick check-in registry should still get a tight reply, not a full essay
- Expression's "preserve substance" rules don't conflict with the Alma's voice
- Adding an Alma-specific bypass complicates the pipeline; absent evidence of harm, keep things uniform

If smoke surfaces drift (expression rewriting Alma into bullets), S5 calibration adds a `voice=alma` hint to expression's prompt builder.

### Telemetry

The existing `console.log("[reception] ...")` line in `reception.ts` already includes the parsed object verbatim — `is_self_moment` will appear there automatically. `logUsage(role: "reception")` writes the cost / latency / model row regardless. No new telemetry surface in S3; CV1.E8.S1 (LLM call logging) will pick up the new field when it ships.

## Phases

| # | Phase | Files | Validation |
|---|---|---|---|
| 1 | **Reception extend** — add `is_self_moment` field, NULL_RESULT, system prompt section, parser. | `server/reception.ts` | New tests in `tests/reception.test.ts` |
| 2 | **Pipeline (web stream)** — branch composer + skip persona seed + pass isAlma to snapshot/rail + stamp meta. | `adapters/web/index.tsx` | Type check + manual smoke |
| 3 | **Pipeline (web sync API)** — same branch as stream, sync version. | `server/index.tsx` | Type check |
| 4 | **Pipeline (telegram)** — same branch in adapter. | `adapters/telegram/index.ts` | Type check |
| 5 | **Rail labeling** — when `rail.isAlma`, ConversationHeader / ContextRail show "Voz da Alma" instead of persona avatars. | `adapters/web/pages/{conversation-header,context-rail,mirror}.tsx` | manual smoke |

## Risks

**Reception classification drift.** Most likely failure mode: classifier returns `false` on a clear apontamento (false negative). Mitigation: S4's manual override + S5's calibration round.

**Expression rewriting Alma.** As noted in S2 — keep on for now, smoke-driven calibration.

**Two source-of-truth tension between is_self_moment and touches_identity.** They overlap but don't equal. Pipeline rule: `is_self_moment: true` ALWAYS implies Alma path (which composes identity). `touches_identity` only matters when `is_self_moment: false` (canonical path). The composer / snapshot enforce this asymmetry; reception emits both independently.
