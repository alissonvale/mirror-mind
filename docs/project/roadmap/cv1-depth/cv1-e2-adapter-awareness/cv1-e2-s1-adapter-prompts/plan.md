[< Docs](../../../../../index.md)

# Plan: CV1.E2.S1 — Adapter-aware prompts

**Roadmap:** [CV1.E2.S1](../../../index.md)

## Goal

The LLM knows which channel it's talking on and adapts tone, length, and structure accordingly.

## Deliverables

- `config/adapters.json` — per-channel instruction text (Telegram, Web, CLI, API)
- `server/config/adapters.ts` — typed loader
- `composeSystemPrompt` gains `adapter` param — instruction appended as last section
- Each entry point passes its adapter: POST /message reads `client` field, /chat/stream hardcodes `"web"`, Telegram hardcodes `"telegram"`, CLI sends `client: "cli"`

---

**See also:** [Test Guide](test-guide.md)
