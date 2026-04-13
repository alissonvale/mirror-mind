[< Docs](../index.md)

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

Two types of automated tests, each with a clear purpose:

**Unit tests** (`tests/db.test.ts`) — test pure logic in isolation. Database helpers, identity operations, session management, POC import. Run against `:memory:` SQLite — no mocks, no disk, no external dependencies. Fast feedback on whether the code is correct.

**Smoke tests** (`tests/smoke.test.ts`) — test the full flow end-to-end. Invoke the admin CLI as a subprocess against a real database in `/tmp`. Verify that the pieces work together as a user would experience them. Slower, but catch integration issues that unit tests miss.

**SQLite in memory for unit tests.** No mocks for the database — use `:memory:` and test against real SQL.

**Every commit leaves tests passing.**

### Running tests

```bash
npm test              # all tests (unit + smoke)
npm run test:unit     # unit tests only
npm run test:smoke    # smoke tests only
npm run test:watch    # watch mode (reruns on file changes)
```

---

## Conventions

**English in code.** Variables, functions, comments, endpoints, schema — all in English. User-facing content (identities, mirror responses) in each user's language.

**Test runner: vitest.** Fast, TypeScript-native, minimal config.

---

**See also:** [Briefing](../project/briefing.md) (architectural decisions) · [CV0.M1 — Tracer Bullet](../cv0-m1/tracer-bullet.md) (first deliverable spec)
