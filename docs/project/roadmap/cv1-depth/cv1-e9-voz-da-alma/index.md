[< CV1 Depth](../)

# CV1.E9 — Voz da Alma

**Status:** 🚧 In Progress (opened 2026-04-27)

## Premise

The mirror-mind has shipped a lot of pipeline machinery — reception, conditional identity, conditional scope, multi-persona, expression, divergent runs, localization. None of it is what makes the user open the app on a Sunday evening. **A wise voice responding to a moment of life is.**

The next milestone is adoption: *"Works for me, then works for Veronica"*. The bottleneck is not more features; it's a use case worth coming back to. CV1.E9 ports the conversational wise-voice prompt that already proved itself in the Software Zen o-espelho app, surfaces it through a new architectural layer (the Self), and wires reception to recognize the moments that deserve it.

## What ships

A user writes a short, lived-in fragment — *"hoje atendi um caso difícil"*, *"fechei a porta enquanto a Veronica chegava destruída"*, *"tive uma conversa com o Tonico que ficou pesando"*. Reception classifies the moment as journal-tone with weight. The pipeline routes the turn to a new composition path — the **Voz da Alma** — that integrates the user's own soul, doctrine (their declared framework), and identity layers into a single short return. The reply sounds like the user's own most centered voice talking back to them, not a bot, not a domain expert, not a therapist. It cites the user's own principles when they ressoam.

A second send button — **"Enviar Para…"** — opens a destination picker (Voz da Alma + each persona in the cast) so the user can route a turn explicitly. Manual choices feed back as labeled training data for the auto-detector.

## Stories

| # | Story | Status | Notes |
|---|---|---|---|
| S1 | [self/doctrine layer](cv1-e9-s1-doctrine-layer/) | 🚧 | New identity layer for the user's adopted framework. Composes alongside soul + identity when the turn touches identity OR when Voz da Alma is engaged. |
| S2 | [Voz da Alma identity + prompt port](cv1-e9-s2-alma-prompt/) | 📋 | Port the conversational prompt from szen_play, reframe as generic Voz da Alma skeleton. New compose path that substitutes persona. |
| S3 | [is_self_moment reception axis + composer integration](cv1-e9-s3-is-self-moment/) | 📋 | New boolean axis on reception. Conservative defaults. Pipeline routes to Voz da Alma when true. Telemetry from day 1. |
| S4 | ["Enviar Para…" UI + manual override](cv1-e9-s4-enviar-para/) | 📋 | Second send button + dropdown destinations. Backend override channel. Logged as ground-truth labels. |
| S5 | [Calibration with Antonio/Bia diary entries](cv1-e9-s5-calibration/) | 📋 | Smoke test set from the existing narrative diary entries (CV2.E1). Calibrate reception's detection rules to the canonical cases. |

## Why this epic exists

**Pipeline machinery without a use case is silent.** CV1.E7 made the pipeline smart. CV1.E8 will make it observable. Neither makes the user *want* to use it daily. CV1.E9 installs the moment — the recurring micro-ritual of "I write something from my life and the mirror says something I'd want to read back later."

The o-espelho app in Software Zen already proved this voice works. The prompt is calibrated. The reception of users in szen_play is positive. The risk of porting is low; the upside (a use case strong enough to drive adoption) is high.

## Architectural decisions installed

- **`self/doctrine` as a separate layer** (not bundled into `self/soul`). Future-proofs the case where users adopt different frameworks. The user's soul (who I am) and doctrine (which framework I've adopted) are different objects.
- **Voz da Alma is core, not an extension.** Auto-detection is the headline. The "Enviar Para…" manual override exists to handle reception's mistakes AND to generate labeled data for tuning the auto-detector.
- **Voice = Self, not Persona.** Personas are domain lenses. The Alma is integrative — it speaks across domains from the user's most centered position. Mixing it into the persona system would dilute both.
- **Vocabulary asymmetry:** internal code says "self" (`is_self_moment`, `composeAlmaPrompt` returning `self.alma`); external UX says "Voz da Alma" / "Alma". Junguian terminology stays internal; user-facing language is accessible.

## Validation milestone

Alisson uses for one week before Veronica sees it. Then Veronica writes a registry-style entry, and the Alma's reply is something she'd want to read back later. That's the bar.

## Out of scope

- **Sombra layer** (detection of patterns) — Fatia 3, parked.
- **Self as integrator across multiple personas** (the original Fatia 1 design) — parked. CV1.E9 ships the "Voz da Alma responding to a moment" function only, not the broader Self functions.
- **Eval harness for is_self_moment** — manual smoke + canonical narrative test set first; formalize an eval probe only if mis-classification surfaces in real use.

## Docs to update at close

- `docs/process/worklog.md`
- `docs/project/decisions.md`
- `docs/project/roadmap/cv1-depth/index.md` (epic listing)
- Each story folder's `index.md` and `plan.md`
- Reception and composer doc references where applicable

[See parent: CV1 Depth →](../)
