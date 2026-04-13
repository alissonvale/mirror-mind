[< Docs](../index.md)

# Worklog

What was done, what's next. Updated each session.

Current focus: **[CV0.M1 — Tracer Bullet](../design/cv0-m1-tracer-bullet.md)**

---

## Next

### DB + Identity transfer (CV0.M1.E1)

- [ ] `db.ts` — schema SQLite (users, identity, sessions, entries) + helpers
- [ ] `admin.ts` — CLI: `user add`, `identity set`, `identity list`, `identity import --from-poc`
- [ ] Transfer Alisson's identity from POC Mirror to mirror-mind via admin

### Server (CV0.M1.E2)

- [ ] `auth.ts` — bearer token middleware
- [ ] `identity.ts` — compose system prompt from layers
- [ ] `index.ts` — hono server with POST /message and GET /thread
- [ ] End-to-end smoke test via curl

## Done

### 2026-04-13 — Project setup + docs

- [x] Project setup (package.json, tsconfig, .gitignore, .env)
- [x] Install dependencies (pi-ai, pi-agent-core, hono, better-sqlite3)
- [x] Docs: getting-started, principles, decisions log, worklog
- [x] Docs: reorganize into project/, design/, process/ with wiki navigation
- [x] Design: identity as layers (decision + schema + docs updated)
- [x] Design: rename design-v1 → cv0-m1-tracer-bullet (convention established)
- [x] Briefing: add premises 5 (context intelligence) and 6 (proactive mirror)
- [x] Roadmap: CV3.E1 proactive mirror, CV1 context intelligence tag
