# Design Principles

Guidelines for building Mirror Mind. Read before contributing code.

---

## Product

**Natural language as interface.** The user talks to the mirror, not to commands or buttons. Everything happens through conversation. The user asks, the mirror acts.

**The mirror is the mediator.** Identity adjustments, context changes, configuration — the user expresses intent in natural language and the mirror translates it into action.

**Commands are internal tools.** They exist for the mirror or the admin to use when necessary. The end user never needs to learn or memorize them.

**Admin CLI is operations, not product.** It exists for provisioning and server maintenance. Used by whoever installs and operates the server, not by whoever talks to the mirror.

---

## Code

**Small functions, clear names.** The code explains the "what"; comments only for the "why".

**One module, one responsibility.** db.ts doesn't know about HTTP. auth.ts doesn't know about LLMs. Each module does one thing.

**No premature abstraction.** Write direct code. Extract only when repetition is real, not when it's hypothetical.

**Validate at the boundaries.** Validate external input at the HTTP layer. Trust internal code.

---

## Testing

**Unit tests for pure logic.** Database helpers, token hashing, identity composition, POC import.

**Smoke e2e tests for the full flow.** Start server, create user, send message, receive response.

**SQLite in memory for tests.** No mocks for the database — use `:memory:` and test against real SQL.

**Every commit leaves tests passing.**

---

## Conventions

**English in code.** Variables, functions, comments, endpoints, schema — all in English. User-facing content (identities, mirror responses) in each user's language.

**Test runner: vitest.** Fast, TypeScript-native, minimal config.
