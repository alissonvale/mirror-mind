[< CV1.E7 — Response Intelligence](../index.md)

# S5 — Multi-persona per turn (integrated voicing) ✅

**Landed 2026-04-24.** Cast visually declared itself in [S2](../cv1-e7-s2-conversation-header/): avatars in the header, data shape forward-compatible, bubble signature on transitions. Before S5 the pipeline still picked **one** persona per turn — the UI showed a team; the backend spoke as a monologue.

S5 closes that gap for the integrated voicing case — the common one. Reception returns `personas: string[]`, the composer renders multiple lenses simultaneously active, the expression pass preserves the list under a "one unified voice, multiple lenses" instruction, and the UI carries multiple `◇ key` badges when new personas enter the turn (set comparison, so reordering the same cast produces no fresh badges).

**Segmented voicing** (explicit `◇ X ... / ◇ Y ...` transitions within a single reply) stays parked for a follow-up (S5b). The default integrated mode already covers the canonical design-conversation probe (*"qual seria a estratégia de divulgação do espelho para o público da Software Zen?"* → estrategista + divulgadora, woven).

**Shipped in six commits:**
1. Reception returns `personas: string[]` (with legacy singular fallback).
2. Composer accepts the array + renders the multi-lens instruction prefix when >1.
3. Expression pass accepts `personaKeys: string[]` and reminds the model not to emit segment markers.
4. All three adapters (web, telegram, api) migrated to the plural shape; meta stamps both `_personas` and `_persona` (first) for backward compat.
5. UI bubble signature rewrites to set-based transitions; one badge per persona new relative to the previous turn.
6. Close-out (this commit): worklog, decisions, refactoring log, docs.

**Tests:** 640 passing (was 627 at v0.14.0) — +13 new across reception (4), identity composer (4), expression (1), web multi-persona signature (5).

- [Plan](plan.md) — scope, decisions, phases, backward-compatibility shape
- [Refactoring log](refactoring.md) — what was cleaned up, what was parked
