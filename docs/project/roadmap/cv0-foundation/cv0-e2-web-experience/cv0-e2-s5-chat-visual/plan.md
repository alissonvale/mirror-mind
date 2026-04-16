[< Docs](../../../../../index.md)

# Plan: CV0.E2.S5 — Chat with visual identity

**Roadmap:** [CV0.E2.S5](../../../index.md)

## Goal

The chat feels like a mirror — warm, calm, distinctive. Not a generic chatbot UI.

## Changes

- **Background** — chat messages area changed from white/grey (`#fff`) to warm cream (`#faf8f5`) with matching border (`#e8e4df`)
- **Assistant bubbles** — white with subtle warm border instead of flat grey
- **Persona badge** — `◇ persona-name` displayed as a small pill badge above the bubble in warm tones (`#f0ece6` bg, `#8b7d6b` text) instead of plain monospace text
- **Chat container** — full height layout using flex, form pinned to bottom
- **User bubbles** — kept blue-tinted (`#e8f0fe`) for contrast with warm assistant bubbles

## Files changed

- `adapters/web/pages/chat.tsx` — `chat-container` wrapper, `persona-badge` span
- `adapters/web/public/style.css` — warm palette, badge styles, flex layout
- `adapters/web/public/chat.js` — badge element matches new class

---

**See also:** [Test Guide](test-guide.md)
