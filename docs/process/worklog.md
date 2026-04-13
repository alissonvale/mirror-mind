[< Docs](../index.md)

# Worklog

What was done, what's next. Updated each session.

Current focus: **[CV0.E1 — Tracer Bullet](../cv0-e1/tracer-bullet.md)**

---

## Next

### Web UI (CV0.E1.S5)

I can chat and manage from a browser — chat + admin served from hono with JSX.

### Telegram (CV0.E1.S6)

I can chat from Telegram on my phone — bot as thin adapter over the server.

## Done

### 2026-04-13 — CLI (CV0.E1.S4) ✅

- [x] `cli/index.ts` — REPL client with config at ~/.mirror/config.json
- [x] `cli/config.json.example` — template config
- [x] Getting-started updated with CLI setup instructions
- [x] Tested: message, continuity, /exit — all working against production

### 2026-04-13 — Deploy (CV0.E1.S3) ✅

- [x] DNS: A record mirror.softwarezen.com.br → 51.222.160.3 (Cloudflare, proxied)
- [x] VPS: Node.js 20 installed on Ubuntu 20.04
- [x] nginx: server block added to existing Docker container (Zenith), reusing wildcard Origin cert
- [x] systemd: mirror-server.service enabled and running
- [x] User alisson created on VPS, identity imported from POC
- [x] All tests passed: HTTPS, thread persistence, auth rejection

### 2026-04-13 — Server responds with my voice (CV0.E1.S2) ✅

- [x] `server/auth.ts` — bearer token middleware (SHA-256 + hono)
- [x] `server/identity.ts` — compose system prompt from layers
- [x] `server/index.ts` — hono server with POST /message and GET /thread
- [x] Unit tests for identity composition (3 tests)
- [x] Manual smoke test via curl — reply with real voice confirmed
- [x] 32 tests passing total

### 2026-04-13 — DB + Identity transfer (CV0.E1.S1) ✅

- [x] `server/db.ts` — schema (users, identity, sessions, entries, telegram_users) + 8 helper functions
- [x] `server/admin.ts` — CLI: user add, identity set/list, identity import --from-poc
- [x] 24 tests passing (vitest, :memory: SQLite)
- [x] User alisson created, real identity imported from POC Mirror

### 2026-04-13 — Project setup + docs

- [x] Project setup (package.json, tsconfig, .gitignore, .env)
- [x] Install dependencies (pi-ai, pi-agent-core, hono, better-sqlite3)
- [x] Docs: getting-started, principles, decisions log, worklog
- [x] Docs: reorganize into project/, design/, process/ with wiki navigation
- [x] Design: identity as layers (decision + schema + docs updated)
- [x] Briefing: add premises 5–8 (context intelligence, proactive mirror, metacognition, self-construction)
- [x] Roadmap: CV → Epic → Story hierarchy, CV3–CV5
