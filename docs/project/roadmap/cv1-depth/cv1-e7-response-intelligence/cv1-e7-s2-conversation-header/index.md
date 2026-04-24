[< CV1.E7 — Response Intelligence](../index.md)

# S2 — Conversation header + slim rail (cast-as-ensemble scaffolding)

The `/conversation` page redesigns itself around two premises that a product-designer reading of the current UI surfaced:

1. **The rail was a junk drawer.** Seven blocks stacked with the same visual weight (persona block / scope tags / response mode / session stats / composed layers / footer / two destructive actions), each block fighting for attention equally. The chat — the thing that matters — got confined to 800px and competed with it.
2. **Personas are a cast that forms. Scope is a setting that stays.** The user named it: *"personas serão múltiplas em uma conversa, como se fosse um time que vai se formando, cada uma dando uma opinião diferente a cada momento. Journeys e orgs tendem a ser mais estáveis."* The old UI treated all three axes as symmetric "tags." They are not.

This story replaces the dense rail with a compact **conversation header** above the chat, and slims the rail to two disclosures. The header is assymetric — **Cast** (mutable ensemble, avatars) on one side, **Scope** (stable pills) on the other, plus mode + menu. Message bubbles gain a **persona signature**: a lateral color bar + a mini-avatar that appears only when the persona changes between turns. The signature carries the narrative of the ensemble forming — which persona spoke when.

The data shape is prepared for multi-persona per turn (the future CV1.E7.S5), but the backend still returns a single persona. The header renders the whole *pool* as cast; the bubble signature reflects the *pick* of that turn. When S5 turns on multi-persona, the UI absorbs it without rework.

- [Plan](plan.md) — scope, decisions, phases, open questions
