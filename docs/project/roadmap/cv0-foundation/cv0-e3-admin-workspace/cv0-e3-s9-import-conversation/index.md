[< CV0.E3 — Admin Workspace](../index.md)

# S9 — Import conversation history from markdown ✅

The admin imports existing conversation history into the mirror as new sessions, tagged with persona and optional organization/journey. Each markdown file becomes one session; alternating `**User:**` / `**Assistant:**` blocks become entries in order.

Motivated by the strangler-fig migration: years of conversation accumulated in other AI tools (Gemini, ChatGPT, Claude) shouldn't have to evaporate when the user moves to the mirror. A documented canonical markdown format lets any source produce input for this importer with a small adapter — the mirror itself doesn't grow per-source code.

- [Plan](plan.md) — scope, decisions, steps
- [Conversation markdown format](../../../../../product/conversation-markdown-format.md) — the canonical input contract
