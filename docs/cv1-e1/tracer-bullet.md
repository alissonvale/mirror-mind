[< Docs](../index.md)

# CV1.E1 — Personas

**Roadmap:** [CV1.E1](../project/roadmap.md)
**Status:** In progress

The mirror responds with the right voice for each context. Every message passes through a **reception** layer that classifies it before composing the system prompt. When a persona fits, it becomes a lens on top of the base identity — enriching depth without replacing the voice.

## Stories

| Code | Story | Status |
|------|-------|--------|
| [S1](s1-persona-routing/index.md) | **Automatic persona routing (Reception v1)** | ✅ Done |
| S2 | **Each persona has domain depth** | — |

## Architecture

```
user message
    ↓
┌──────────────────────┐
│  Reception           │   ← fast model (flash-lite)
│  classifies message  │     returns {persona: 'id' | null}
│  5s timeout          │     falls back on failure
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│  System prompt       │   ← base layers + persona (if any)
│  composition         │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│  Main response       │   ← quality model (deepseek-v3)
│  (Agent)             │
└──────────┬───────────┘
           ↓
   ◇ persona signature
        + reply
```

Reception is designed to grow: S1 picks personas; future stages detect topic shifts, journeys, proactive hooks. See decisions.md (2026-04-14 — Reception as a dedicated layer).

---

**See also:** [Model config](../project/decisions.md) · [Principles](../design/principles.md)
