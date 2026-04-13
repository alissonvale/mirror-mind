[< Docs](../index.md)

# Plan: CV0.M1.E1 — DB + Identity Transfer

**Roadmap:** [CV0.M1.E1](../project/roadmap.md) — The mirror has my real voice
**Design:** [CV0.M1 — Tracer Bullet](../design/cv0-m1-tracer-bullet.md)
**Date:** 13 April 2026

## Goal

The mirror has a database with users and their real identity loaded — ready to be consumed by the server.

---

## Deliverables

### 1. `server/db.ts` — Schema + helpers

Opens SQLite, creates tables (users, identity, sessions, entries, telegram_users), exports typed helper functions. Accepts optional `dbPath` for testing with `:memory:`.

**Exports:**
- Types: `User`, `IdentityLayer`, `Session`, `Entry`
- `openDb(dbPath?)` — WAL pragma, CREATE IF NOT EXISTS
- `createUser(db, name, tokenHash)` → User
- `getUserByTokenHash(db, tokenHash)` → User | undefined
- `getUserByName(db, name)` → User | undefined
- `setIdentityLayer(db, userId, layer, key, content)` → IdentityLayer (ON CONFLICT upsert)
- `getIdentityLayers(db, userId)` → IdentityLayer[] (ordered by layer, key)
- `getOrCreateSession(db, userId)` → session id
- `loadMessages(db, sessionId)` → parsed message objects
- `appendEntry(db, sessionId, parentId, type, data)` → entry id

db.ts owns all SQL. No HTTP, no CLI, no crypto, no file I/O beyond SQLite.

### 2. `server/admin.ts` — CLI provisioning

Four commands via `process.argv` (no CLI framework):

- **`user add <name>`** — generates token (randomBytes), hashes (SHA-256), creates user + starter identity layers (self/soul, ego/identity, ego/behavior with templates) + first session. Prints token once.
- **`identity set <name> --layer --key --text`** — upserts one layer
- **`identity list <name>`** — shows all layers with content preview
- **`identity import <name> --from-poc`** — reads self/soul, ego/identity, ego/behavior from `~/.espelho/memoria.db` (readonly), writes into mirror-mind db. Import logic extracted as `importIdentityFromPoc()` for testability.

### 3. `tests/db.test.ts` — Unit + integration tests

All tests use `:memory:` SQLite. No mocks.

- openDb: creates tables, idempotent
- createUser: returns User, rejects duplicates
- getUserByTokenHash / getUserByName: found/not found
- setIdentityLayer: create, upsert
- getIdentityLayers: ordered, isolated per user
- getOrCreateSession: creates or returns existing
- appendEntry + loadMessages: round-trip, ordering, filtering
- importIdentityFromPoc: reads POC db, writes layers correctly

---

## Implementation order

| Step | What | Commit |
|------|------|--------|
| 0 | Install vitest, add test scripts to package.json | — |
| 1 | `server/db.ts` + `tests/db.test.ts` (db helpers) | Commit 1 |
| 2 | `server/admin.ts` + import test in db.test.ts | Commit 2 |
| 3 | Run `admin.ts user add alisson` + `identity import alisson --from-poc` | Commit 3 (worklog update) |

---

## Verification

1. `npm test` — all tests pass
2. `npx tsx server/admin.ts user add testuser` — prints token, creates db in data/
3. `npx tsx server/admin.ts identity list testuser` — shows 3 starter layers
4. `npx tsx server/admin.ts identity import testuser --from-poc` — imports from POC
5. `npx tsx server/admin.ts identity list testuser` — shows real identity content
6. Inspect `data/mirror.db` with `sqlite3` to confirm schema and data

---

## Key files

- `/Users/alissonvale/Code/mirror-mind/server/db.ts` (new)
- `/Users/alissonvale/Code/mirror-mind/server/admin.ts` (new)
- `/Users/alissonvale/Code/mirror-mind/tests/db.test.ts` (new)
- `/Users/alissonvale/Code/mirror-mind/package.json` (add vitest)
- `/Users/alissonvale/Code/pi-sandbox/07-identity/db.ts` (reference)
- `~/.espelho/memoria.db` (POC source for import)

---

**See also:** [CV0.M1 — Tracer Bullet](../design/cv0-m1-tracer-bullet.md) (full spec) · [Principles](../design/principles.md) (code and testing guidelines) · [Worklog](../process/worklog.md) (progress tracking)
