[< Story](index.md)

# Plan — CV1.E9.S5 Calibration

## Premise

S3 ships the auto-detector but proves nothing about quality on real input. S5 closes the loop: a small canonical test set as a contract probe, plus a manual roteiro for live-model smoke against the Antonio/Bia narrative content. If smoke surfaces mis-classification, S5 iterates the reception prompt until the obvious cases land correctly.

## Test set composition

12-18 messages, evenly distributed:

**Apontamento de vida (target → true) — 6 entries**
- Short first-person registry of a difficult moment
- Short first-person registry of a tender moment
- A single sentence about an event the user is processing
- A confiding fragment ("estou voltando do hospital, preciso parar pra respirar")
- A first-person past-tense recall ("hoje atendi um caso que me marcou")
- A trivial-on-surface-but-loaded fragment ("a casa está silenciosa hoje")

**Pergunta funcional (→ false) — 4 entries**
- Configuration question
- Comparison question
- Imperative ask ("write me an email about X")
- Status check ("o que falta para fechar a story?")

**Reflexão analítica sem peso pessoal (→ false) — 4 entries**
- Strategic exploration ("estou pensando sobre estratégia de marketing")
- Conceptual question ("essa ideia ressoa contigo?")
- Multi-clause exploration of a topic
- Brainstorm prompt

**Edge cases — 2-4 entries**
- Greeting (false — class 0)
- Mirror meta-question ("how does the Alma work?" → false)
- Existential question framed as ask ("how should I think about leaving vs staying?" → false; canonical path with touches_identity true)
- Identity-touching but in apontamento form ("hoje sentei e me perguntei quem eu sou" → true on both axes)

## Implementation shape

```typescript
interface CalibrationCase {
  id: string;
  message: string;
  expectedIsSelfMoment: boolean;
  rationale: string;
  // Optional — set when the message also exercises a different axis.
  expectedTouchesIdentity?: boolean;
}

const CASES: CalibrationCase[] = [
  // ... apontamento ...
  // ... functional ...
  // ... reflective ...
  // ... edge ...
];

describe("Voz da Alma calibration set", () => {
  for (const c of CASES) {
    it(`${c.id}: ${c.message.slice(0,40)}...`, async () => {
      const expectedJson = JSON.stringify({
        personas: [],
        organization: null,
        journey: null,
        mode: "conversational",
        touches_identity: c.expectedTouchesIdentity ?? false,
        is_self_moment: c.expectedIsSelfMoment,
      });
      const result = await receive(db, userId, c.message, {}, fakeComplete(expectedJson));
      expect(result.is_self_moment).toBe(c.expectedIsSelfMoment);
    });
  }
});
```

The test asserts the **parser** correctly preserves the LLM's verdict — it doesn't validate the LLM's classification quality. Quality validation is the manual smoke. But the contract probe ensures parser drift can't silently break good classifications.

## Manual smoke roteiro (test-guide.md)

Six conversations, each covering a distinct routing path:

1. **Casual greeting** → reception: false, route: persona/base, no Alma label
2. **Apontamento** → reception: true, route: Alma, ◈ label, ego.behavior + soul + doctrine + identity in Look inside
3. **Functional question** → reception: false, route: persona, ◇ key label
4. **Analytical reflection** → reception: false, route: persona, ◇ key label (NOT Alma — the trap)
5. **Forced send to Alma on a clearly functional message** → reception: false, override: alma, route: Alma despite reception
6. **Forced send to persona on a clearly Alma-shaped message** → reception: true, override: persona:K, route: that persona despite reception (and meta carries both `_forced_destination` and `_reception_is_self_moment` for comparison)

Each step lists what to verify in the bubble (label, content tone) and the rail (Look inside layers, isAlma indicator).

## Risks

**The contract test passes but live LLM disagrees.** This is the design — contract test catches parser drift; live disagreement is calibration material. Manual smoke surfaces it.

**Test set bias to Portuguese-only phrasing.** Add 2-3 English-phrased apontamentos (for Veronica's potential preference + future tenants).

**Test data uses Alisson's identity.** That's fine — the test runs against a fresh `:memory:` database, the user is a stub. No coupling to the live mirror.

## Phases

| # | Phase | Files | Validation |
|---|---|---|---|
| 1 | **Test set fixture** — author 12-18 cases with rationales. | `tests/voz-da-alma-calibration.test.ts` | runs |
| 2 | **Manual smoke guide** — six-conversation roteiro. | `docs/.../cv1-e9-s5-calibration/test-guide.md` | reading |
| 3 | **Smoke + iterate** — run smoke against live model after S1-S4 ship. Adjust reception prompt examples if mis-classification is reproducible. | `server/reception.ts` (if needed) | smoke |
