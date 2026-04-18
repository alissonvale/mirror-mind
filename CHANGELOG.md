# Changelog

## [0.5.0] — 2026-04-18

### Upgrade notes

From any version: `git pull && npm install && systemctl restart mirror-server`

The `openDb` startup migration runs automatically: it adds a `role` column to `users` (default `'user'`), and promotes the oldest user by `created_at` to `admin` when no admin exists yet. No SQL required on existing installations.

If upgrading from v0.1.0: re-import identity (`identity import --from-poc`) and remove `LLM_MODEL` from `.env`.

Admins previously using `/admin/users/:name` to edit identity will now be redirected to `/map/:name`. Bookmarks continue to work.

### Added
- **Cognitive Map at `/map`** — workspace for the psyche's structure: Self, Ego (identity + behavior pair), Personas card with badges, Skills (empty with invitation). Lateral memory column on the right with shortcuts to rail/conversations/insights and real session stats.
- **Layer Workshop at `/map/:layer/:key`** — focused per-layer editor with live composed-prompt preview that reflects the draft content (debounced, no LLM call).
- **Admin modality** — admins can view and edit other users' maps at `/map/:name/...`. Non-admins get 403 on every admin path.
- **Context Rail** on the mirror page — active persona, session stats, composed context. Collapsible, persisted per user.
- **Self-service identity editing** — users write their own self, ego, personas, and display name from the map.
- **Empty-state invitations** on every empty structural card — primary paragraph describing the layer and inviting action.
- **User roles** (`admin` / `user`) with `adminOnlyMiddleware` gating `/admin/*` routes. Sidebar menu adapts to role.
- **Identity strip + page title** "Cognitive Map of {name}" at the top of the map.
- **Session stats query** (`getUserSessionStats`) backing the memory column's Conversations row.

### Changed
- **Identity layers ordered by psychic depth** — `self` → `ego` → `persona` at the SQL level (`getIdentityLayers`). The composed system prompt now opens with foundation and ends with behavior, matching the map's vertical layout.
- **Primary route renamed** — `/chat` → `/mirror`. `/chat` redirects. The chat affordance is now one element inside the mirror page alongside the rail. Internal DOM names (`chat.js`, `.chat-shell`, `#chat-input`) preserved.
- **New user creation seeds only `ego/behavior`** — the operational baseline. `self/soul` and `ego/identity` are left empty so the map's invitations teach the new user what those layers are.
- **Sidebar menu** — "Map" renamed to "Cognitive Map" for cross-surface consistency. Avatar + name in the footer.
- **Legacy redirects** — `/admin/users/:name`, `/admin/identity/:name`, `/admin/personas/:name` → `/map/:name`. `UserProfilePage` removed.
- **Push cadence rule** — push to `origin` at story completion, not per-commit or per-release. Documented in the development guide.

### Removed
- `adapters/web/pages/admin/user-profile.tsx` (198 lines) — superseded by the Cognitive Map.
- `adapters/web/pages/admin/personas.tsx` and `identity.tsx` — orphaned since the unified profile landed; cleaned up in S7.
- `server/templates/soul.md` and `server/templates/identity.md` — no longer seeded on user creation.

### Fixed
- Admin persona routes were shadowed by self-generic `/map/:layer/:key`; admin literal-segment routes now register before the all-dynamic routes.
- Self compose route `/map/:layer/:key/compose` was shadowed by the admin `/map/:name/:layer/:key` 4-seg catch-all; reordered to honor segment specificity.
- `key` prop on `LayerWorkshopPage` was consumed by JSX as the element reconciliation key instead of arriving at the component; renamed to `layerKey`.
- `.flash-error` CSS missing — persona-creation errors rendered invisible. Soft-red styling added.
- Arbitrary no-whitespace rule on user display names dropped; only slashes (which break URL routing) are rejected now.

### Tests
- **123 passing** (up from 68 at v0.4.0 release). 55 new tests across S7 (auth + role), S8 (map/workshop/personas/name/admin modality), and S10 (empty invitations). Smoke tests updated for the seed-only-ego/behavior rule.

---

## [0.4.0] — 2026-04-16

### Upgrade notes

From any version: `git pull && npm install && systemctl restart mirror-server`

If upgrading from v0.1.0, also: re-import identity (`identity import --from-poc`) and remove `LLM_MODEL` from `.env`.

### Changed
- **Web client moved to adapters/web/** — setupWeb(app, db) follows Telegram adapter pattern. server/index.tsx stripped to core API (~120 lines)
- **Sidebar navigation** — fixed sidebar replaces top nav (Chat, Admin > Users, Logout). Mobile hamburger toggle
- **Chat visual identity** — warm cream background, persona badges as pill above bubble, markdown rendered as HTML
- **Docs restructured** — roadmap hierarchy with named CVs/epics/stories, `design/` renamed to `product/`

### Added
- **Web route tests** — 13 tests via app.request() (login, auth, admin). 68 total
- **CV index pages** — navigation indexes for cv0-foundation, cv1-depth
- **deleteIdentityLayer** — DB helper for removing identity layers

---

## [0.3.2] — 2026-04-16

### Upgrade notes

From any version: `git pull && npm install && systemctl restart mirror-server`

If upgrading from v0.1.0, also: re-import identity (`identity import --from-poc`) and remove `LLM_MODEL` from `.env`.

### Changed
- **Unified user profile page** — base identity and personas on a single page with collapsible cards (`/admin/users/:name`). Old identity/personas routes redirect.

---

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
