[< Docs](../../../../../index.md)

# Test Guide: CV0.E2.S5 — Chat with visual identity

**Plan:** [Plan](plan.md)

## Manual verification

### 1. Chat background

Open `/chat`. Expect: messages area has a warm cream background, not white or grey.

### 2. Assistant bubbles

Send a message. Expect: assistant reply in a white bubble with a subtle warm border. Visually distinct from the user's blue-tinted bubble.

### 3. Persona badge

Send a message that triggers a persona (e.g., a technical question). Expect: a small warm-toned pill badge above the assistant bubble showing `◇ persona-name`.

### 4. No persona

Send a generic message. Expect: no badge, just the bubble.

### 5. Streaming

During streaming, the bubble should have a left border indicator. Badge appears before tokens start arriving.

### 6. Chat fills height

The chat messages area should fill the available vertical space. The input form stays pinned at the bottom.

---

**See also:** [Plan](plan.md)
