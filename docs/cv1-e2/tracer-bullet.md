[< Docs](../index.md)

# CV1.E2 — Adapter Awareness `v0.3.0`

**Roadmap:** [CV1.E2](../project/roadmap.md)
**Status:** In progress

The mirror adapts its communication to the channel. Telegram gets short, conversational replies. Web gets depth and structure. Each adapter shapes both the prompt (how the LLM is instructed) and the output (how the response is formatted).

## Stories

| Code | Story | Status |
|------|-------|--------|
| [S1](s1-adapter-prompts/index.md) | **The mirror knows which channel it's talking on** | ✅ Done |
| [S2](s2-formatters/index.md) | **The output fits the channel** | ✅ Done |

## Architecture

```
config/adapters.json
    ↓
composeSystemPrompt(..., adapter)    ← adapter instruction appended last
    ↓
Agent.prompt()                       ← LLM adapts tone/length
    ↓
formatForAdapter(reply, adapter)     ← markdown → channel-native format
    ↓
channel reply
```

Adapter instructions are configurable in `config/adapters.json` — editable without touching code.

---

**See also:** [Principles](../design/principles.md) · [Decisions](../project/decisions.md)
