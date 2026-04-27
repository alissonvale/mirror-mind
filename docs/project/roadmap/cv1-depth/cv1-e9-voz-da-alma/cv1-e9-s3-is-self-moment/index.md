[< CV1.E9](../)

# CV1.E9.S3 — is_self_moment reception axis + composer integration

**Status:** ✅ Done (2026-04-27) · Released in `v0.18.0`

## Problem

S2 builds the Voz da Alma composition path. S1 adds the `self/doctrine` layer that the Alma cites. Neither knows *when* to engage — the pipeline still routes every turn through the canonical persona path.

The Alma's value depends on a tight definition of "the right moment." Engaged too often, it becomes patronizing wisdom-spam (every casual question gets an existential reply). Engaged too rarely, the user never sees the feature exist. The auto-detector is the make-or-break component.

## Fix

A new boolean axis on reception — `is_self_moment` — that classifies whether the user's message is a journal-tone fragment of personal weight. When `true`, the pipeline (web adapter) routes the turn through `composeAlmaPrompt` instead of `composeSystemPrompt`.

```
reception classifies → is_self_moment: boolean
                              │
                              ▼
            true  →  composeAlmaPrompt (Voz da Alma path)
            false →  composeSystemPrompt (canonical path)
```

The classification is independent from `touches_identity`. They overlap (most self-moments touch identity) but they're distinct: `touches_identity` asks "does this turn want the soul/doctrine/identity layers loaded into a *persona* response?"; `is_self_moment` asks "does this turn want the persona-skipping Alma voice?". `is_self_moment: true` always implies the Alma path, which always composes identity. `touches_identity` only matters for the canonical path.

## Conservative-by-default classification

The risk asymmetry mirrors S4's: a false positive (Alma fires on a casual question) is corrosive — patronizing wisdom on small talk damages trust quickly. A false negative (Alma stays silent when the user wanted it) is recoverable — the user can use S4's "Enviar Para… Voz da Alma" to invoke explicitly.

So the defaults pull toward `false`:
- Reception success with explicit `true` → Alma engages
- Reception success with explicit `false` → canonical path (the modal turn)
- Reception success with field missing → false
- Reception success with non-boolean drift (e.g., string `"true"`) → false
- Reception failure (timeout, JSON parse, network) → false (NULL_RESULT carries it)

## Reception prompt — three classes

The system prompt expansion frames three classes the model needs to distinguish:

1. **Apontamento de vida** — the target. Lived-in fragments, statements about something that happened, registries of moments that carry weight. *"hoje atendi um caso difícil"*, *"fechei a porta enquanto a Veronica chegava destruída"*, *"tive uma conversa com o Tonico que ficou pesando"*. → `is_self_moment: true`.

2. **Pergunta funcional** — operational, factual, transactional. *"qual a melhor forma de cobrar X?"*, *"como configuro Y?"*, *"compare A e B"*. → `is_self_moment: false`.

3. **Reflexão analítica sem peso pessoal** — thinking-out-loud about strategy, design, marketing, ideas. *"estou pensando sobre estratégia de marketing"*, *"acho que a divulgação devia focar em X"*. → `is_self_moment: false`.

The (1)↔(3) line is where calibration matters most. The reception prompt anchors with 6-8 examples per class so the model has a reference frame.

## What ships

- **`server/reception.ts`** — `ReceptionResult` gains `is_self_moment: boolean`. NULL_RESULT carries `false`. System prompt gains a sixth axis with class definitions, examples, and the conservative-default framing. Parser strict-checks for literal `true` only. New tests in `tests/reception.test.ts`.
- **`adapters/web/index.tsx`** — pipeline wires the new axis. When `reception.is_self_moment === true`:
  - `composeAlmaPrompt(db, user.id, { organization, journey }, "web")` replaces `composeSystemPrompt`
  - Persona seeding into the session pool is **skipped** (Alma is not a persona; the cast doesn't grow on Alma turns)
  - The expression pass still runs (mode-aware shaping; Alma-specific bypass parked for S5 if drift surfaces)
  - Snapshot built with `isAlma: true` (rail labels the turn as Voz da Alma)
  - Assistant entry meta carries `_is_alma: true` + the same `_touches_identity: true` (Alma always loads identity) for cross-adapter parity
- **`server/index.tsx` API endpoint** — same wiring, sync flavor.
- **Telegram adapter** — same wiring (Alma is universal across canals).
- **Telemetry** — every reception classification is already logged via `logUsage(role: "reception")`. The `is_self_moment` value flows through `console.log` (existing reception log line) for now; CV1.E8.S1 LLM logging will pick it up when it lands.

## Tests

- `tests/reception.test.ts` — new tests covering: explicit true, explicit false, missing field, drift to false, no-candidates short circuit, system prompt content (class definitions and examples).
- `tests/voz-da-alma.test.ts` — pipeline integration covered via S5 manual smoke; unit tests for the composer were S2.

## Non-goals (parked)

- **Probabilistic / threshold detection.** Boolean now. If reception's binary is too coarse, S3b adds a confidence axis the pipeline can threshold.
- **Per-user calibration.** One global classifier. Per-user fine-tuning lives in CV1.E8 (logging) + future eval work.
- **Auto-fallback when Alma's reply is judged wrong by the user.** S4's "Enviar Para…" provides the manual escape; learning from those signals is CV1.E8 + future work.

## Docs

- [Plan](plan.md)
