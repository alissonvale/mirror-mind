[< CV1 — Depth](../)

# CV1.E7 — Response Intelligence

**Roadmap:** [CV1.E7](../../index.md)
**Status:** S1 ✅ · S2–S7 drafts
**Premise:** *"Every token in the prompt must earn its place"* ([briefing #5](../../../briefing.md))

Through CV0 and CV1.E1–E6, the mirror's intelligence lived almost entirely **in the prompt**. Every turn composed a single system prompt carrying `self/soul → ego/identity → persona → organization → journey → ego/behavior → ego/expression → adapter` and sent the whole bundle to one LLM call. Reception was the only exception — a pre-classification pass, added in CV1.E1 and extended in CV1.E4 — and it already proved the pattern works.

This epic makes that pattern first-class. The response stops being the output of one big prompt and starts being the output of a **pipeline** of small, purposeful steps. Each step earns its place: retrieval when context is needed, classification when routing is needed, expression when form is needed. Layers stop being concatenated wholesale and start being activated conditionally.

The goal is not to replace the prompt with code. It is to move intelligence **out of** the prompt (where it is implicit, hard to debug, and pays the full token tax on every turn) **into** the pipeline (where each decision has a name, a signature, and a test).

## Stories

| Code | Story | Status |
|------|-------|--------|
| [S1](cv1-e7-s1-expression-pass/) | **Expression as a post-generation pass** — `ego/expression` moves out of compose, becomes input to a dedicated LLM call that shapes the response. Mode (conversational / compositional / essayistic) auto-detected by reception, overridable from the Context Rail | ✅ Done |
| S2 | **Mode auto-detection** — reception extends to a fourth axis (response mode). May land inside S1 if it doesn't inflate scope | Draft |
| S3 | **Conditional scope activation** — organization and journey content composes only when there's a signal (tag, mention, relevance), not "always if present" | Draft |
| S4 | **Conditional identity layers** — `self/soul` and `ego/identity` compose only when the turn touches identity / purpose / values | Draft |
| S5 | **Conditional persona activation** — including "no persona" and "dual persona" (tone + domain) as valid outcomes of reception | Draft |
| S6 | **Semantic retrieval before composition** — memory search runs as a pipeline step; [CV1.E4.S2 Attachments](../cv1-e4-journey-map/) and [CV1.E3.S3 Long-term memory](../cv1-e3-memory/) re-connect here | Draft |
| S7 | **Pipeline generalization** — after 4–5 steps exist organically, abstract into named stages with typed contracts. Not before (no abstraction without at least three uses) | Draft |

**Ordering rationale:** S1 is the tracer bullet for the pipeline pattern — `ego/expression` is the cheapest layer to peel off first (smallest identity footprint, clearest pain signal: responses are too long when the user wants conversational exchange). Everything after S1 reuses the extension point S1 installs. S3–S5 peel layers off the prompt one at a time, each with its own condition signal. S6 re-wires retrieval as the sixth step and unlocks attachments. S7 is the abstraction payoff, deferred until there's enough shape to abstract honestly.

## Architecture (shape as of S1)

```
user message
    ↓
┌──────────────────────────┐
│  Reception               │   ← persona + organization + journey + mode
│  (one LLM classification) │
└──────────┬───────────────┘
           ↓
┌──────────────────────────────────────────────┐
│  System prompt composition                    │
│  soul → identity → persona →                  │
│  organization → journey → behavior → adapter  │
│  (expression REMOVED from here)               │
└──────────┬───────────────────────────────────┘
           ↓
┌──────────────────────────┐
│  Main generation          │   ← large model, pi-agent-core Agent
└──────────┬───────────────┘
           ↓
┌──────────────────────────┐
│  Expression pass          │   ← small model, ego/expression + mode
│  (second LLM call)        │     as input; streams to the user
└──────────┬───────────────┘
           ↓
┌──────────────────────────┐
│  Response + rail          │
└──────────────────────────┘
```

By end of the epic, the diagram grows: `retrieval` appears before composition; `composition` itself branches per layer depending on reception's signals; `persona`, `organization`, `journey`, `soul`, `identity` each become conditional.

## Non-goals for the epic

- **Tools / agentic turn.** Multi-step tool use with an orchestrator LLM stays parked in a later epic (see [decisions.md 2026-04-20 — Agentic turn deferred](../../../decisions.md)). This epic is about *deterministic* pipeline steps, not autonomous planning.
- **Replacing reception with a general planner.** Reception stays a classifier. S7's abstraction is a pipeline runtime, not a planner.
- **Changing Agent-per-request.** [D7 of the briefing](../../../briefing.md) stands. Pipeline steps are called inside a single HTTP request; the Agent still dies at the end of the turn.

---

**See also:**
- [Briefing #5](../../../briefing.md) — "Every token in the prompt must earn its place"
- [CV1.E1 — Personas](../cv1-e1-personas/) — where reception was born
- [CV1.E4 — Journey Map](../cv1-e4-journey-map/) — where reception became multi-axis
