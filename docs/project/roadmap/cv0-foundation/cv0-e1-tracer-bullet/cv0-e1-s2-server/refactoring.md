[< Docs](../../../../../index.md)

# Refactoring: CV0.E1.S2 — The server responds with my voice

Refactoring decisions made after implementation.

---

### db.ts split into domain modules

**Before:** db.ts had 217 lines with 8 helpers covering users, identity, sessions, and entries — different domains sharing one file.

**After:** each domain in its own module under `server/db/`:

```
server/
├── db.ts              ← openDb() + schema + re-exports
├── db/
│   ├── users.ts       ← createUser, getUserByTokenHash, getUserByName
│   ├── identity.ts    ← setIdentityLayer, getIdentityLayers
│   ├── sessions.ts    ← getOrCreateSession
│   └── entries.ts     ← appendEntry, loadMessages
```

**External imports don't change** — everything is re-exported from `db.ts`. The reorganization is internal.

**Why:** the discomfort wasn't about line count (~180), it was about mixing domains. Users, identity, sessions, and entries are different concerns. As the project grows (compaction, memory, new session management), each module grows in its own space.

---

### Raw SQL in index.ts noted

There's a raw SQL query in `index.ts` for fetching the last entry id (parent linking). This could move to a db helper, but it's a single use. Revisit if the pattern repeats.

---

**See also:** [Plan](plan.md) · [Test Guide](test-guide.md)
