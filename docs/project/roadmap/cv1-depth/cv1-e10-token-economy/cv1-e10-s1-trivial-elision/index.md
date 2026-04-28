[< CV1.E10](../)

# CV1.E10.S1 — Trivial turn elision

**Status:** ✅ Done (2026-04-27) · Released in `v0.20.0`

## Problem

The first day of real Alma usage surfaced the dor: opening a session with *"boa noite"* sends the entire `ego/behavior` block (~5 KB — Pensamento, Estrutura argumentativa, Postura, Condutas operacionais, Exemplo de voz) plus the adapter instruction to the model, just to receive a one-line greeting back. CV1.E7.S4 deliberately left `ego/behavior` always-on because *form is transversally relevant* — but that assumption holds when there's substance for form to shape. For greetings, acknowledgments, thanks, casual pings — the protocol-level turns at the boundary of every conversation — the behavior load pays no return.

Briefing #5 (*every token in the prompt must earn its place*) is violated structurally on this class of turn, multiplied by every conversation that opens or closes with a courtesy.

## Fix

A new boolean axis on reception — `is_trivial` — that classifies whether the turn is a courtesy/protocol exchange of negligible substance. When `true`, the pipeline routes to a third composer path — `composeMinimalPrompt` — that returns only the adapter instruction (or empty string when no adapter applies). All identity layers, persona blocks, scope content, and `ego/behavior` itself are skipped. The model receives the user's greeting and replies in its default voice.

Mutually exclusive with `is_self_moment` at the prompt level: an apontamento de vida is never trivial. Reception's prompt enforces this, and the composer falls back defensively if both are true (Alma wins — a self-moment can't elide).

```
reception classifies →
  is_trivial:      true →  composeMinimalPrompt    (adapter only)
  is_self_moment:  true →  composeAlmaPrompt        (heavy)
  default              →  composeSystemPrompt      (canonical)
```

## Conservative-by-default classification

Same risk asymmetry as the other axes: a false positive (trivial fires on a turn with weight) is corrosive — the model responds in generic mode when the user wanted the mirror. A false negative (trivial stays false on a clear greeting) is invisible — pays a few KB extra and gives a slightly mirror-flavored greeting back. Bias toward false; require positive evidence to flip true.

Defaults:
- Reception success with explicit `true` → minimal path (token saving)
- Reception success with explicit `false` → canonical (the modal turn)
- Reception success with field missing → false
- Reception success with non-boolean drift → false
- Reception failure → false (NULL_RESULT carries it)
- Mutual-exclusion violation (both `is_trivial` and `is_self_moment` true): force `is_trivial` to false (Alma wins)

## Reception prompt — what counts as trivial

The classifier learns three positive classes and stays false elsewhere:

1. **Greetings** — *"oi"*, *"olá"*, *"bom dia"*, *"boa noite"*, *"hi"*, *"hey"*. Single line, no substance, just opening the channel.
2. **Acknowledgments** — *"ok"*, *"entendi"*, *"beleza"*, *"got it"*, *"thanks"*, *"valeu"*, *"obrigado"*. Closes a loop, no new information.
3. **Casual pings without substance** — *"tudo bem?"*, *"como vai?"*, *"e aí"*. Asks the bot how it is — a courtesy with no real interrogation.

The line that's NOT trivial:
- *"tô cansado hoje"* — apontamento embrionário; canonical or Alma path. Trivial = false.
- *"obrigado, isso ajudou muito"* — acknowledgment WITH affirmation — close enough to acknowledgment that it can stay trivial. Conservative call: leave false (give the canonical pipeline a chance to add warmth).
- *"oi, preciso de uma coisa"* — opening + ask. Not trivial; canonical path with reception classifying the ask substance.

## What ships

- **`server/reception.ts`** — `ReceptionResult` gains `is_trivial: boolean`. NULL_RESULT carries `false`. System prompt extension with class definitions, examples, conservative default. Strict parser. Mutual-exclusion enforcement (if `is_self_moment` is true, `is_trivial` is forced to false).
- **`server/identity.ts`** — new exported `composeMinimalPrompt(adapter?)` returning only the adapter instruction (or empty string).
- **Pipeline (3 adapters)** — branch composer choice on `is_trivial` first, then `is_self_moment`, else canonical. Persona pool seeding skipped on trivial turns (no substance to seed). Skip the empty-reply guard's "Alma silent" message branch on trivial — the model's generic response is the right answer.
- **Snapshot** — `composedSnapshot` gains `isTrivial: boolean`. When true: layers empty, personas empty, isAlma false. The existing fresh-session-empty-Composed-block CSS hides the rail's section automatically.
- **Meta** — `_is_trivial: true` stamped on the assistant entry so F5 reload reproduces the routing decision.

## Tests

- `tests/reception.test.ts` (extend) — new test block covering: explicit true, explicit false, missing field, drift to false, no-candidates short circuit, mutual exclusion with is_self_moment, system prompt content.
- `tests/identity.test.ts` (extend) — composeMinimalPrompt returns adapter only; falls back to empty string when adapter is unknown.
- `tests/composed-snapshot.test.ts` (extend) — isTrivial forces empty layers + personas.
- `tests/voz-da-alma-calibration.test.ts` (extend) — add 6 trivial cases + 2 border cases (short-but-substantive that should NOT be trivial).

## Non-goals (parked)

- **Hybrid trivial+adapter** — for now the minimal path is just adapter. If smoke surfaces "responses too generic / off-tone for the mirror", v2 adds a 30-token baseline ("you are the user's personal mirror; respond briefly and warmly in their language").
- **Per-role behavior subsets.** Different epic story.
- **Trivial signaling on the bubble** — no UI change. Rail Composed block hides automatically when layers are empty (existing CSS rule). The empty Composed is itself the signal.

## Docs

- [Plan](plan.md)
- [Test guide](test-guide.md)
