# Changelog

## [0.8.1] — 2026-04-21

Post-release calibration of reception model choice and documentation of the subscription-OAuth path.

### Upgrade notes

From v0.8.0: `git pull && npm install && systemctl restart mirror-server`. No schema changes, no data migration.

Recommended (manual):
- To adopt the new reception default on your existing install, go to `/admin/models` → `reception` role → set provider `openrouter`, model `google/gemini-2.5-flash`, prices 1.5 / 12.5. Reception fires with the new model on next request.
- Existing installs keep whatever is in the DB; the seed change in `config/models.json` affects new installs and "Revert to default" only.

### Changed
- **Reception default model: Claude Haiku 4.5 → Gemini 2.5 Flash** in `config/models.json`. Three-model eval against production DB showed Flash matching Haiku's accuracy (9/11 on scope-routing probes) at ~3× lower cost and comparable latency, with `reasoning: "minimal"` applied.
- **Reception now passes `reasoning: "minimal"` universally** in `server/reception.ts`. Applies across all providers. No-op on models that don't use reasoning; closes the accuracy gap on Gemini 2.5 Flash (which over-activated scopes when reasoning was default); protects future models from hiding JSON output in reasoning blocks.

### Added
- **Latency logging in reception diagnostic output.** Every reception call now logs `latency=Nms` alongside candidate counts and axis decisions. Ongoing model observability.
- **Thinking-block fallback in reception response parser.** If a provider puts JSON output in reasoning blocks instead of text blocks (observed on some paths), the parser now reads from both. Defensive — doesn't kick in under normal operation.
- **[Spike 2026-04-21 — Subscription-based LLM access via OAuth](docs/project/roadmap/spikes/spike-2026-04-21-subscription-oauth.md)** — retrospective documentation of the investigation that found pi-ai supports OAuth for five subscription-backed providers, the three-model reception eval, and the decisions produced.
- **[CV0.E3.S8 — OAuth credentials for subscription-backed providers](docs/project/roadmap/cv0-foundation/cv0-e3-admin-workspace/cv0-e3-s8-oauth-subscriptions/)** — next-priority story. Plan covers oauth_credentials table, `/admin/oauth` paste UI, `models.auth_type` column, `resolveApiKey` wrapper. Primary target: Google Cloud Code Assist free tier for zero-cost reception at personal/family scale.

### Known issues
- **Gemini 2.5 Pro via OpenRouter blocked** by a pi-ai parsing issue (`content: []`, `stopReason: "error"`) specific to how the OpenAI-compatible adapter reads Gemini's reasoning response shape. Direct OpenRouter calls work correctly. Parked until pi-ai patches the path OR CV0.E3.S8 makes the native `google-gemini-cli` provider (different path) available.

## [0.8.0] — 2026-04-20

### Upgrade notes

From v0.7.0: `git pull && npm install && systemctl restart mirror-server`

On first boot after upgrade:
- `organizations` and `journeys` tables are created via `CREATE TABLE IF NOT EXISTS`. No data migration, no schema change on existing tables.

No SQL required. No data loss.

Recommended (manual):
- Change `reception` role at `/admin/models` to `anthropic/claude-haiku-4.5`. Scope routing (persona + organization + journey) exceeds what Gemini Flash Lite can hold consistently; Haiku restores routing quality at ~10× the cost per call (~R$0.002 vs ~R$0.0002, still trivial in absolute terms).
- Create organizations at `/organizations` and journeys at `/journeys`. Write briefing + situation on each; the lite model generates summaries in the background. The summaries feed reception's classifier.

### Added
- **Organizations** (`organizations` table, `/organizations` surface). Broader situational scope. Briefing + situation + summary. Archive lifecycle. `deleteOrganization` unlinks associated journeys transactionally (journeys survive as personal).
- **Journeys** (`journeys` table, `/journeys` surface). Narrower situational scope. Briefing + situation + summary. Nullable `organization_id` FK. Archive lifecycle. List page groups journeys by organization (personal first).
- **Reception three-axis envelope** — `receive()` returns `{persona, organization, journey}`, each nullable, validated independently. One LLM call, three signals.
- **Composition scope slots** — `composeSystemPrompt()` accepts `scopes: { organization?, journey? }`. Renders each as `briefing` + `Current situation:` block. Position: `soul → identity → persona → organization → journey → behavior → expression → adapter`. Archived scopes never compose.
- **Shared `generateScopeSummary`** — organization and journey branches in `server/summary.ts`. Fire-and-forget on save, awaited on regenerate. Prompts are routing-aware per scope type.
- **Rail scope rows** — rail's Composed block shows `organization:` and `journey:` rows when reception activates them. GET `/mirror` derives all three axes from the last assistant entry's meta, so scope awareness survives page reloads.
- **Composed-prompt drawer — organization + journey dropdowns.** Alongside the existing persona + adapter selectors. Shared `ComposedDrawer` component extracted from map.tsx and layer-workshop.tsx.
- **Chat message badges** — each assistant message displays up to three badges (`◇ persona`, `◈ organization`, `↝ journey`). Populated from the SSE `routing` event during streaming, from `_persona` / `_organization` / `_journey` meta for stored history.
- **Concept docs** — `docs/product/journey-map.md` (the fourth peer surface and its two scopes) and `docs/product/memory-map.md` (placeholder for CV1.E6 — browses accumulated memory across mechanisms).
- **Scope-routing eval** — `evals/scope-routing.ts` with 11 probes covering the four scope quadrants (org only, journey only, both, neither) plus persona + scope combined cases. Threshold 80%.
- **Auto-commit per round** — explicit commit cadence in `docs/process/development-guide.md`. Every finished round of changes commits automatically; push remains user-triggered.

### Changed
- **Reception default model: Gemini Flash Lite → Claude Haiku 4.5** in `config/models.json`. Existing installations keep DB-stored config; new installs and "revert to default" use Haiku. Scope routing exceeded Flash Lite's 3-axis capacity.
- **SSE `persona` event → `routing` event.** Now carries `{persona, organization, journey}`. Chat client updates badges independently per axis.
- **Reception prompt** — scopes listed as `- <key> ("<name>"): <descriptor>` so the classifier can match natural name mentions. Explicit complementarity between persona and scope ("persona gives voice, scope gives situational content"). Sole-scope-in-domain rule mandatory.
- **`deleteUser` cascade** — now includes `organizations` and `journeys`. Order: journeys before organizations (FK dependency), consistent with the existing leaf-to-root pattern.

### Deprecated / Removed
- **CV1.E5.S1 — Organization layer** — deleted. The spike's framing of organization as an identity layer is superseded by CV1.E4 (organization is a scope, not a layer). CV1.E5 keeps S2 (per-persona personal context) and S3 (semantic memory).

### Fixed
- **Create-form placeholders** — `/organizations` and `/journeys` create forms used "Software Zen" / "O Espelho" as placeholders, which read like pre-filled values. Switched to generic `display name` / `slug-like-this`.

## [0.7.0] — 2026-04-19

### Upgrade notes

From v0.6.0: `git pull && npm install && systemctl restart mirror-server`

On first boot after upgrade:
- `identity.summary TEXT` column is added via `ALTER TABLE`. Existing rows have `summary = NULL`; consumers fall back to previous behavior (first line of content) until the user saves or regenerates.

No SQL required. No data loss.

Recommended (manual):
- After upgrade, click **regenerate all summaries** on the Cognitive Map's Personas card, and hit **Regenerate summary** per-layer in the workshop for soul and each ego key.
- Add `ego/expression` content. New users get it seeded from template; existing users start with an empty row and the workshop's empty-state invitation. If your expression rules currently live mixed inside `ego/behavior`, move them manually.
- Consider swapping the `main` model to `anthropic/claude-haiku-4.5` at `/admin/models` — respects absolute rules (no em-dash) more consistently than DeepSeek Chat v3. Not automatic.

### Added
- **`ego/expression` layer** — how I speak. Format, vocabulary, punctuation, anti-patterns of style. Separated from `ego/behavior` so form and method diagnose independently. Seeded from `server/templates/expression.md` on user creation.
- **`identity.summary` column** — auto-generated descriptor per layer. Populated fire-and-forget by the lite `title` model on Save; consumed by Cognitive Map cards, reception routing, and persona hover tooltips on the map.
- **Composed-prompt drawer** — slide-in inspector on the Cognitive Map and on every layer workshop. Dropdowns for persona (none + each configured persona) and adapter (none + web + telegram + cli). Reuses `composeSystemPrompt()`; read-only.
- **Bulk summary regeneration** — `POST /map/personas/regenerate-summaries` runs `generateLayerSummary` across all personas in parallel. Triggered by a subtle "regenerate all summaries" button on the Personas card.
- **Evals infrastructure** — top-level `evals/` folder with `_lib/runner.ts`, `_lib/types.ts`, and first eval `routing.ts` (22 probes, threshold 85%). npm script `eval:routing`. Documentation at `docs/process/evals.md`.
- **Persona badge tooltips** — hover on a persona in the Cognitive Map shows its summary. Pure CSS via `data-summary` + `::after`.
- **Chat typing indicator** — three slow pulsing dots in soft terracotta replace the empty white rectangle while waiting for the first SSE delta.
- **Sidebar toggle** — collapse/expand the sidebar on desktop to see the map wider. Mobile's existing `sidebar-open` behavior preserved.
- **Sidebar brand is a link** — clicking "Mirror Mind" opens `/mirror`.
- **Preview truncation with `read more →`** — Cognitive Map card previews clamp at three lines; the affordance appears only when content actually overflows (detected via `scrollHeight > clientHeight` on `DOMContentLoaded`).
- **Favicon 404 suppressed** — inline `data:,` URI stops the browser from requesting a nonexistent `/favicon.ico`.
- **Lab mode gated by `?lab=1`** — the "bypass persona" checkbox at `/mirror` hides by default; surfaces only when the query param is present.

### Changed
- **Compose order** — `self/soul → ego/identity → [persona] → ego/behavior → ego/expression → [adapter]`. Identity cluster first (with persona as a specialization), then form cluster (behavior + expression). Expression sits last so its absolute rules keep recency weight. Display order on the Cognitive Map stays `identity → expression → behavior` for human scanning.
- **Within-ego SQL ordering** — `getIdentityLayers` returns `identity` before `expression` before `behavior`. Other layers keep alphabetical fallback.
- **Reception prompt (`server/reception.ts`)** — explicit null-cases (greetings, meta-questions, open existential) with examples. Action-verb-dominates-topic rule (production verbs route to the writing persona regardless of conceptual subject). Persona-agnostic: no hardcoded persona keys in examples — describes categories abstractly, instructs the model to pick from the runtime-rendered persona list.
- **Summary prompt (`server/summary.ts`)** — full rewrite. Bans formulaic openings ("Esta camada opera", "This layer operates", "Distingue-se por"). Persona variant leads with domain + activation triggers (for routing) followed by posture (for display). Self/ego variant optimizes for essence-distillation. Good/bad few-shot pairs. Language-matching rule at the end in CAPS.
- **D7 compliance** — reception and summary prompts translated to English. User content (identities, mirror responses) continues in whatever language the user writes.
- **`main` model** — swapped locally from `deepseek/deepseek-chat-v3-0324` to `anthropic/claude-haiku-4.5`. Upgrade instructions recommend but do not force the same swap.
- **Layer workshop** — single-column, focused on the textarea. The old inline composed-prompt preview pane is gone; composition moves to the drawer, reachable from the breadcrumb.
- **Prompt composition docs** — updated to reflect six-step composition order with expression layer and cluster rationale.

### Fixed
- **Summaries defaulting to English** — language-matching rule was buried mid-prompt. Moved to end in a CRITICAL block with explicit per-language guidance.
- **"Quem é você?" mis-routing** — meta questions about the mirror were picking a best-guess persona. Now return null and defer to the base voice.
- **"escreva um texto..." routing to conceptual persona** — when the topic was conceptual (antifragility, coherence), the conceptual persona won despite the production verb. Action-verb rule makes the verb dominate.

### Removed
- **`handleWorkshopCompose` + `composeWithOverride` + `/compose` routes** — dead code after the workshop preview removal.
- **`adapters/web/public/workshop.js`** — was 100% dedicated to the removed preview.
- **`.workshop-preview*` and `.workshop-split` CSS** — no longer used.
- **Experimental `FINAL_REMINDER` block** — implemented during voice-probing, failed to prevent listicle under enumeration-shaped questions, removed. Composition reorder (which did land) is the structural improvement.

### Tests
- **161 passing** (down 1 from 162 — the `/compose` endpoint test was removed with the endpoint). One test in `identity.test.ts` replaced ("persona at end" → "persona between identity and form clusters") and two others updated to match new ordering.

### Evals
- **`routing.ts`** — new. 22 probes covering clear-domain routing, previously ambiguous cases, meta/null handling, and production-verb cases. Current score: 20/22 (91%) against threshold 85%. Run with `npm run eval:routing`.

---

## [0.6.0] — 2026-04-18

### Upgrade notes

From any version: `git pull && npm install && systemctl restart mirror-server`

On first boot after upgrade:
- `models` table is created and seeded from `config/models.json` (your current values). Thereafter the DB is the source of truth; JSON becomes seed-only.
- `sessions.title` column is added (nullable — existing rows stay `NULL`).

No SQL required.

If upgrading from v0.1.0: also re-import identity (`identity import --from-poc`) and remove `LLM_MODEL` from `.env`.

### Added
- **Admin Workspace** at `/admin` — landing dashboard with Users, Cost (approximate), Activity, Latest release, Mirror memory, Models, and System cards. Cards reload on page refresh; no polling.
- **Model configuration** at `/admin/models` — edit provider, model ID, input/output prices (BRL per 1M tokens), timeout, and purpose per role. Save takes effect on the next request. Revert to default reloads the shipped seed for that role.
- **User delete** on `/admin/users` — destructive cascade across sessions, entries, identity layers, and telegram links in one transaction. Native confirm. Self-proof on both UI and server.
- **User role toggle** on `/admin/users` — flip admin ↔ user inline. Self-proof.
- **In-app docs reader** at `/docs` — admin-only. Renders the `docs/` tree with a collapsible nav (default collapsed), typography for prose, and internal-link rewriting that keeps navigation inside the app.
- **Begin again** and **Forget this conversation** on the mirror's rail — manual session-lifecycle control. Begin again creates a fresh session and preserves the old one (with an async-generated title via a new cheap `title` model role). Forget destroys entries and the session row.
- **`models` table in SQLite** — holds per-role LLM configuration; seeded from `config/models.json` on first boot.
- **`sessions.title` column** — nullable, populated asynchronously by Begin again's title-generation background task.
- **Dashboard Models card** — live summary of role, model ID, and BRL prices with a "tune →" link back to `/admin/models`.
- Admin dashboard module `server/admin-stats.ts` with per-card helpers.

### Changed
- **CV0.E3 epic renamed** from "Install Administration" to **Admin Workspace**. Folder renamed `cv0-e3-install-administration` → `cv0-e3-admin-workspace` with history preserved.
- **Vocabulary** — "the install" → "this mirror" across all admin-facing copy. Deployment events ("fresh installs", `npm install`, "install the full environment") kept their word.
- **Sidebar** — avatar + name now links to `/map` (Cognitive Map). "Mirror" → "My Mirror". "Admin" section header → "This Mirror". Dashboard added as the first sub-item.
- **Model configuration source** — reads per request from the DB. The old `server/config/models.ts` module is retired; callers (`reception`, `title`, `session-stats`, `index.tsx`, web + telegram adapters) now call `getModels(db)`.
- **`createFreshSession`** ensures its timestamp is strictly greater than any existing session for the user, so same-millisecond collisions don't break "Begin again" determinism.

### Fixed
- Docs reader folder-index links (e.g., `CV0.E2.S7` row in the roadmap) now resolve against the correct base directory. Previously they 404'd because the URL `/docs/project/roadmap` resolved `roadmap/index.md` but relative links computed against `/docs/project/` (the parent).
- Dashboard survives on a fresh DB — R$ 0,00 cost, 0 sessions today, no crash.

### Removed
- `server/config/models.ts` — model config lives in the DB now. `config/models.json` stays as shipped seed + reference for "revert to default".

### Tests
- **151 passing** (up from 123). 28 new tests across reset (Begin again, Forget, title generation), docs reader (auth, rendering, link rewriting), dashboard (rendering, 0-state), user management (cascade delete, role toggle, self-proof), and model config (CRUD, reset, seed-on-boot).

---

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
