[< Docs](../index.md)

# Worklog

What was done, what's next. Updated each session.

Current focus: **CV1.E1 — Personas**

S1 (persona routing via reception) done. Next: S2 (deepen persona content) or move on if S1 already delivers the depth.

---

## Next

### Admin personas page (CV1.E2.S3) `v0.3.1`

Dedicated web page for managing personas per user — list, edit content, add new.

## Done

### 2026-04-15 — Adapter Awareness (CV1.E2) ✅

- [x] `config/adapters.json` — per-channel prompt instructions (Telegram=short, Web=deep, CLI=scannable)
- [x] `composeSystemPrompt` accepts adapter param, appends instruction as last section
- [x] Adapter flows through /message, /chat/stream, Telegram, CLI
- [x] `server/formatters.ts` — Telegram MarkdownV2 conversion (headers→bold, lists→bullets, escape special chars)
- [x] Telegram adapter sends with parse_mode MarkdownV2, plain text fallback
- [x] 55 tests passing (3 adapter tests, 11 formatter tests)

## Done

### 2026-04-14 — Persona routing (CV1.E1.S1) ✅

- [x] `config/models.json` + `server/config/models.ts` — centralized model config with `purpose` field
- [x] `server/reception.ts` — LLM classifier, 5s timeout, graceful fallback, 6 tests
- [x] `composeSystemPrompt` accepts personaKey, appends as lens on top of base
- [x] `_persona` metadata pattern — stored in entries, stripped from LLM context, surfaced in UI
- [x] `identity import --from-poc` extended to include persona layer (14 personas)
- [x] Wired into /message, /chat/stream (with SSE event), and Telegram
- [x] Chat UI renders signature from live stream and from history
- [x] 41 tests passing, manual test confirmed persona routing working

## Done

### 2026-04-13 — Telegram (CV0.E1.S6) ✅

- [x] grammy installed, adapter at adapters/telegram/
- [x] DB helpers: linkTelegramUser, getUserByTelegramId
- [x] Admin CLI: telegram link command
- [x] Bot created (@alisson_mirror_bot), webhook set, user linked
- [x] Tested: message from Telegram, mirror responds with real voice

### 2026-04-13 — Web UI (CV0.E1.S5) ✅

- [x] Login page with token → cookie auth
- [x] Chat page with SSE real-time streaming
- [x] Admin: user list/create, identity view/edit
- [x] Hono JSX server-rendered, vanilla client JS
- [x] Deployed and tested in production

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
