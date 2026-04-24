[< CV1.E7 — Response Intelligence](../index.md)

# S5 — Multi-persona per turn (integrated voicing)

The cast visually declared itself in [S2](../cv1-e7-s2-conversation-header/): avatars stacked in the header, forward-compatible data shape, bubble signature on transitions. But reception still picks **one** persona per turn. The UI shows a team; the pipeline operates as a monologue.

S5 closes that gap for the integrated voicing case — the common one. Reception returns `personas: string[]`, the composer renders multiple lenses simultaneously active, the expression pass preserves the list under a "one unified voice, multiple lenses" instruction, and the UI carries multiple color bars + multiple `◇ key` badges when new personas enter the turn.

**Segmented voicing** (explicit `◇ X ... / ◇ Y ...` transitions within a single reply) stays parked for a follow-up (S5b). Every pattern in S5a works with one voice that integrates multiple domains. Separation-by-segment is opt-in, not default — and the default already covers the canonical example from the design conversation (*"qual seria a estratégia de divulgação do espelho para o público da Software Zen?"* → estrategista + divulgadora, entrelaçadas).

- [Plan](plan.md) — scope, decisions, phases, backward-compatibility shape
