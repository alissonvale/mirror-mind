[< CV1.E7 — Response Intelligence](../index.md)

# S1 — Expression as a post-generation pass ✅

**Landed 2026-04-24.** Pipeline-over-prompt pattern shipped as a tracer bullet across nine commits. The response now passes through a dedicated expression step that shapes how it sounds before reaching the user. `ego/expression` is no longer part of the main prompt; it is input to this step, together with a response mode (conversational / compositional / essayistic) auto-detected by reception and overridable from the Context Rail.

Short, lived-in exchanges read short and lived-in. *"Had coffee with Mike Fraser this morning."* gets a reply that meets it on its own register — not a five-paragraph essay. The pipeline has a named second LLM step for the first time; everything in the rest of [CV1.E7](../index.md) reuses the extension point this story installs.

**552 tests passing** (+39 from the v0.13.0 baseline of 513). Nine phases, each its own commit:
1. Remove expression from compose (`server/identity.ts`).
2. Add `expression` model role (`config/models.json` + `addMissingModelRoles` migration).
3. Expression pass module (`server/expression.ts`) + 16 unit tests.
4. Reception classifies mode as a fourth axis (`server/reception.ts`) + 8 new mode tests.
5. `sessions.response_mode` column + ownership-scoped setter (`server/db/sessions.ts`) + 6 DB tests.
6. Wire pipeline through all three adapters (web SSE, Telegram, API) + 5 route tests.
7. Context Rail UI for the mode selector + 3 rail tests.
8. Client-side two-phase streaming microtext (`chat.js`).
9. Worklog + docs close-out.

- [Plan](plan.md) — scope, decisions, phases, open questions
- [Refactoring log](refactoring.md) — what was cleaned up, what was left parked
