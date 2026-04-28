[< Story](index.md)

# Plan — CV1.E10.S1 Trivial turn elision

## Reception axis

```typescript
export interface ReceptionResult {
  // ... existing fields
  is_trivial: boolean;
}
```

NULL_RESULT carries `false`. Parser strict — only literal `true` flips. Mutual exclusion enforced post-parse: if `is_self_moment === true`, force `is_trivial = false` regardless of the model's output (Alma wins).

## Reception system prompt extension

New section after the `is_self_moment` block:

```
**Trivial turn — is_trivial (boolean). When to set true vs false.**

`true` skips ALL composed prompt material (identity, persona, scope, behavior — even the always-on transversal layers). The model receives only the user's text and replies in its default voice. Use only when the turn is purely protocol/courtesy with no substance the mirror's voice would shape.

**Three positive classes:**

1. **Greetings** — pure channel-opening, no ask, no statement of fact:
   - "oi", "olá", "bom dia", "boa noite", "bom dia, tudo bem?"
   - "hi", "hey", "hello", "good morning"

2. **Acknowledgments** — closes a loop, adds no information:
   - "ok", "entendi", "beleza", "blz", "uhum"
   - "got it", "thanks", "thanks!", "valeu", "obrigado", "obrigada"

3. **Casual pings without substance** — courtesy with no real interrogation:
   - "tudo bem?", "como vai?", "e aí?"
   - "how are you?", "how's it going?"

**The line that's NOT trivial:**

- "tô cansado hoje" → false (apontamento embrionário, even if short)
- "obrigado, isso ajudou demais" → false (acknowledgment WITH affirmation — let canonical add warmth)
- "oi, preciso de uma coisa" → false (greeting + ask — the ask is substance)
- "ok mas o que vc acha de X?" → false (acknowledgment + ask — the ask is substance)

**Mutual exclusion with is_self_moment.** If `is_self_moment` is true, `is_trivial` MUST be false. An apontamento de vida is never a courtesy. When in doubt between trivial and self-moment, prefer self-moment (false positive on Alma is recoverable; false positive on trivial loses the mirror's voice).

**Conservative-by-default.** False positive (trivial fires on a turn with weight) → user gets a generic-feeling reply where they wanted the mirror. False negative (trivial stays false on a clear greeting) → invisible cost (a few KB extra). Bias toward false; require positive evidence to flip true.
```

JSON spec updated to include `is_trivial`.

## Composer — `composeMinimalPrompt`

New exported function in `server/identity.ts`:

```typescript
export function composeMinimalPrompt(adapter?: string): string {
  if (adapter && adapters[adapter]?.instruction) {
    return adapters[adapter].instruction;
  }
  return "";
}
```

That's it. No DB access, no layer composition, no scopes. Pure function of the adapter parameter.

## Pipeline branch order

In all three adapters (web stream, web sync, telegram), the composer choice becomes:

```typescript
const isTrivial = reception.is_trivial === true && reception.is_self_moment !== true;
const isAlma = reception.is_self_moment === true;
const personasForRun: string[] = isTrivial
  ? []
  : isAlma
    ? []
    : forcedPersonaKey
      ? [forcedPersonaKey]
      : reception.personas;
const systemPrompt = isTrivial
  ? composeMinimalPrompt("web")
  : isAlma
    ? composeAlmaPrompt(...)
    : composeSystemPrompt(...);
```

Mutual-exclusion guard belt-and-suspenders: even if reception drifts and emits both true, the JS check forces only one path.

Persona pool seeding skipped on trivial turns (`if (personasEmptyBefore && !isAlma && !isTrivial && !forcedPersonaKey)`).

## Snapshot

`composedSnapshot` gains `isTrivial?: boolean = false`. When true:
- `layers` returned as empty array
- `personas` forced empty
- `isAlma` forced false

The existing rail rule (Composed block hides when `layers.length === 0`) handles the UI automatically — no rail code changes.

## Meta + F5 reload

Stamp `_is_trivial: true` on the assistant entry meta. `buildRailState` reads it (similar to `_is_alma` from CV1.E9.S3) and passes through to `composedSnapshot`.

## Expression pass — keep on, with empty personas

Trivial turns still go through `express()` with `personaKeys: []` and the resolved mode (almost always `conversational`). Reasoning: the expression pass enforces brevity rules ("1-3 sentences, no headers, no preamble, meet the message on its own register") which are exactly right for a courtesy reply. Cost is negligible (gemini-flash). If smoke surfaces drift, S1b skips expression on trivial too.

## Calibration cases (test fixture)

Extend `tests/voz-da-alma-calibration.test.ts` with a new section:

| Case | Message | expectedIsTrivial | expectedIsSelfMoment |
|---|---|---|---|
| greeting-pt-1 | "boa noite" | true | false |
| greeting-en-1 | "hey" | true | false |
| greeting-with-ping | "bom dia, tudo bem?" | true | false |
| ack-pt | "ok" | true | false |
| ack-thanks | "obrigado" | true | false |
| ping-howareyou | "como vai?" | true | false |
| border-tired | "tô cansado hoje" | false | true (apontamento) |
| border-thanks-affirm | "obrigado, isso ajudou demais" | false | false |
| border-greet-with-ask | "oi, preciso de uma coisa" | false | false |
| border-ack-with-ask | "ok mas o que vc acha de X?" | false | false |

## Phases

| # | Phase | Files |
|---|---|---|
| 1 | Story docs | this folder |
| 2 | Reception axis + prompt + tests | `server/reception.ts`, `tests/reception.test.ts` |
| 3 | composeMinimalPrompt + tests | `server/identity.ts`, `tests/identity.test.ts` |
| 4 | Snapshot extension + tests | `server/composed-snapshot.ts`, `tests/voz-da-alma.test.ts` (or its companion) |
| 5 | Pipeline routing in 3 adapters | `adapters/web/index.tsx`, `server/index.tsx`, `adapters/telegram/index.ts` |
| 6 | Calibration probes | `tests/voz-da-alma-calibration.test.ts` |
| 7 | Wrap-up | worklog, decisions, badge, version bump, tag |

## Risks

**Generic-voice reply on edge trivial cases.** Without behavior, the model reverts to provider-default voice. For "boa noite" this is fine (cordial greeting back). For edge cases like "obrigado" the response might feel slightly more "AI assistant" than mirror. Mitigation: monitor for this complaint in real use; v2 adds a 30-token baseline if it surfaces.

**False positive on borderline turns.** "Tudo bem?" looks like a casual ping but a user who really means "tell me how YOU are" might want the mirror voice. Mitigation: conservative default + manual override via "Enviar Para…" if the user wants to force a specific routing.

**Token saving smaller than expected.** Most sessions don't open with greetings — they open with the actual ask. Acknowledgments mid-session are also rare. The savings are real but proportional to the user's usage pattern. Worth doing for the structural rightness; the cost numbers are secondary.
