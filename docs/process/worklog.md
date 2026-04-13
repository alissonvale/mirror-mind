[< Docs](../index.md)

# Worklog

What was done, what's next. Updated each session.

Current focus: **[CV0.M1 — Tracer Bullet](../design/cv0-m1-tracer-bullet.md)**

---

## Next

### Server (CV0.M1.E2)

The mirror receives a message via HTTP and responds with the user's real voice.

- [ ] `auth.ts` — bearer token middleware
- [ ] `identity.ts` — compose system prompt from layers
- [ ] `index.ts` — hono server with POST /message and GET /thread
- [ ] End-to-end smoke test via curl

## Done

### 2026-04-13 — DB + Identity transfer (CV0.M1.E1) ✅

- [x] `server/db.ts` — schema (users, identity, sessions, entries, telegram_users) + 8 helper functions
- [x] `server/admin.ts` — CLI: user add, identity set/list, identity import --from-poc
- [x] 24 tests passing (vitest, :memory: SQLite)
- [x] User alisson created, real identity imported from POC Mirror

### 2026-04-13 — Project setup + docs

- [x] Project setup (package.json, tsconfig, .gitignore, .env)
- [x] Install dependencies (pi-ai, pi-agent-core, hono, better-sqlite3)
- [x] Docs: getting-started, principles, decisions log, worklog, plans
- [x] Docs: reorganize into project/, design/, process/ with wiki navigation
- [x] Design: identity as layers (decision + schema + docs updated)
- [x] Design: rename design-v1 → cv0-m1-tracer-bullet (convention established)
- [x] Briefing: add premises 5–8 (context intelligence, proactive mirror, metacognition, self-construction)
- [x] Roadmap: CV3–CV5 (proactivity, metacognition, self-construction)
