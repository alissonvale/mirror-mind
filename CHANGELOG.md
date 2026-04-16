# Changelog

## [0.3.1] — 2026-04-16

### Upgrade notes

From any version: `git pull && npm install && systemctl restart mirror-server`

If upgrading from v0.1.0, also: re-import identity (`identity import --from-poc`) and remove `LLM_MODEL` from `.env`.

### Added
- **Admin personas page** — dedicated page per user to view, edit, add, and delete personas (`/admin/personas/:name`)
- **Prompt composition reference** — `docs/design/prompt-composition/` with architecture docs and example prompts (base, telegram, web)
- **Release notes navigation** — prev/next links between release notes
- **`deleteIdentityLayer`** — new DB helper for removing identity layers

---

## [0.3.0] — 2026-04-16

### Upgrade notes

From any version: `git pull && npm install && systemctl restart mirror-server`

If upgrading from v0.1.0, also: re-import identity (`identity import --from-poc`) and remove `LLM_MODEL` from `.env`.

### Added
- **Adapter-aware prompts** — each channel gets a tailored instruction appended to the system prompt. Telegram: short, conversational, no formatting. Web: deep, structured. CLI: scannable.
- **Formatter per adapter** — LLM markdown output converted to channel-native format before sending. Telegram gets MarkdownV2 with HTML and plain text fallbacks.
- **`config/adapters.json`** — per-channel instructions configurable without touching code
- **3-tier Telegram formatting** — MarkdownV2 → HTML → stripped plain text fallback chain
- **No narrated actions** — Telegram instruction blocks LLM from narrating internal states (*pauses*, *thinks*, etc.)

### Fixed
- Telegram bold/italic now renders correctly (MarkdownV2 with fallbacks)
- Tables and horizontal rules stripped from Telegram output

---

## [0.2.0] — 2026-04-15

### Upgrade notes

After `git pull && npm install`:

1. Re-import identity to include personas: `npx tsx server/admin.ts identity import <name> --from-poc`
2. Remove `LLM_MODEL` from your `.env` — models are now configured in `config/models.json`
3. Restart: `systemctl restart mirror-server`

### Added
- **Reception layer** — lightweight LLM classifier runs before every response, selects the right persona for the context
- **Persona routing** — 14 personas imported from POC, each becomes a lens on top of base identity
- **Centralized model config** — `config/models.json` with `purpose` field replaces scattered env vars
- **Persona signature** — `◇ persona-name` prefix on responses across CLI, Web (SSE), and Telegram
- **Metadata pattern** — `_persona` stored in entries, stripped before re-feeding to LLM, surfaced in UI
- **`user reset` admin command** — clears conversation history for a user
- **`identity import --from-poc`** now includes all persona layers
- **`loadMessagesWithMeta`** — returns message data + metadata separately for UI rendering

### Fixed
- **Telegram duplicate replies** — webhook now processes updates async (return 200 immediately, handle in background) to prevent redelivery loops caused by LLM response time exceeding grammy's 10s timeout
- **Telegram bot initialization** — explicit `bot.init()` before `handleUpdate` when not using `webhookCallback`

---

## [0.1.0] — 2026-04-13

### Added
- **Mirror server** — hono HTTP server with `POST /message` and `GET /thread`, Agent per request via pi-agent-core
- **Identity in layers** — soul, ego/identity, ego/behavior stored in SQLite, composed into system prompt at runtime
- **Bearer token auth** — SHA-256 hashed tokens, middleware for API routes
- **Admin CLI** — `user add`, `identity set/list/import`, `telegram link`
- **CLI client** — REPL at `adapters/cli/`, config at `~/.mirror/config.json`
- **Web UI** — login (cookie auth), chat with SSE streaming, admin (users, identity editing), served from same hono server via JSX
- **Telegram adapter** — grammy webhook at `adapters/telegram/`, resolves user via `telegram_users` table
- **Deploy** — systemd service, Caddyfile, deploy script
- **POC migration** — `identity import --from-poc` reads from `~/.espelho/memoria.db`
- **32 tests** — vitest, SQLite `:memory:`, unit + smoke
- **Documentation** — getting-started, roadmap (CV0–CV5), principles, decisions log, worklog, story docs per epic with plans and test guides
