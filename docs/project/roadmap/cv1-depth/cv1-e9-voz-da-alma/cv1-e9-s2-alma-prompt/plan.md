[< Story](index.md)

# Plan — CV1.E9.S2 Voz da Alma identity + prompt port

## Premise

The o-espelho conversational prompt produces a voice that the mirror-mind needs but doesn't currently have. The Alma is structurally **Self** in Junguian terms — integrative, not a domain lens. It speaks from the user's center across all the layered material the system has about them. The composition path for an Alma turn is asymmetric to the persona path; cleanest to model it as a sibling composer function, not a flag inside the existing one.

## Design

### Sibling, not flag

Two composer functions:
- `composeSystemPrompt(...)` — canonical path. Persona-bearing or base-ego, scope-aware, identity-conditional. Unchanged.
- `composeAlmaPrompt(...)` — Alma path. Identity-always, persona-skipped, preamble-prepended, scope-aware, behavior-on.

The pipeline (S3) selects between them based on `reception.is_self_moment`. No flag inside the canonical composer; flag-based forking inside one function would tangle the conditional logic and obscure the asymmetry.

### Composition order — Alma path

```
[Alma identity preamble]                  ← new, the framing block
  ↓
self/soul                                 ← essence (always-on for Alma)
  ↓
self/doctrine (when present)              ← adopted framework
  ↓
ego/identity                              ← operational positioning
  ↓
[organization] (when reception activated) ← situational context (broader)
  ↓
[journey] (when reception activated)      ← situational context (narrower)
  ↓
ego/behavior                              ← form / conduct (always-on)
  ↓
[adapter instruction] (when adapter set)  ← adapter-specific append
```

No persona block. The preamble + identity cluster IS the voice.

### The Alma identity preamble

Drafted to be:
- Generic across users (no naming of specific frameworks; doctrine carries that)
- Tight (~300-400 tokens)
- Form-prescriptive without being formal: "1-3 short paragraphs, no headers, no lists"
- Voice-prescriptive: "first person, Quiet Luxury, sereno-elevado-acolhedor"
- Posture-prescriptive: "user is sharing a registry of life; reply is a soft mirror"
- Doctrine-aware: "if a principle ressoam, name it inline, do not explain — apply"

### Expression pass — keep on

The Alma draft still runs through `express()`. Justification:
- Mode shaping is still relevant (a reflective registry might warrant essayistic, a quick check-in conversational)
- Expression's "preserve substance, change form only" rules don't conflict with the Alma's voice
- Adding an Alma-specific bypass complicates the pipeline; absent evidence of harm, keep things uniform

If smoke surfaces drift (e.g., expression rewriting the Alma into bullets), S5 adds an Alma-aware shortcut.

### Snapshot — `isAlma` flag

The composed snapshot gains an optional `isAlma: boolean` field. When true:
- `personas` is empty (Alma doesn't compose personas)
- `layers` reflects identity-always, doctrine-when-present
- The rail can label the turn ("Voz da Alma") instead of showing persona avatars

S2 plumbs the flag through `composedSnapshot`. The rail's UI rendering uses it (no rail UI changes in S2 — wired in S3).

## Phases

| # | Phase | Files | Validation |
|---|---|---|---|
| 1 | **`server/voz-da-alma.ts`** — new file with `composeAlmaPrompt(db, userId, scopes, adapter?)`. Imports `getIdentityLayers`, `getOrganizationByKey`, `getJourneyByKey`. Reuses the same `renderScope` helper from identity.ts (extract to shared if needed). Exports the preamble as a const for testability. | new file | `tests/voz-da-alma.test.ts` |
| 2 | **Snapshot** — extend `composedSnapshot` with optional `isAlma` parameter; when true, force-include identity layers, drop personas. | `server/composed-snapshot.ts` | tests in `composed-snapshot.test.ts` |
| 3 | **Tests** — new `tests/voz-da-alma.test.ts` covering preamble inclusion, identity always-on, doctrine optional, persona skip, scope conditional, order. | new test file | runs |

## Risks

**Tone bleed from expression.** Expression with conversational mode may shorten the Alma to a single line. Mitigation: smoke catches it; if reproducible, add a reception → expression "voice=alma" hint.

**Doctrine carrying contaminated content.** If the user's doctrine markdown is verbose or off-tone, the Alma will inherit that. Mitigation: doctrine content is curated by the user; not a S2 problem.

**Preamble token cost.** Preamble + soul + doctrine + identity = potentially heavy. Acceptable: identity-bearing turns are the minority case; the cost is paid for the right turns.
