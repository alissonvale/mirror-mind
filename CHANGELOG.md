# Changelog

## [Unreleased]

### Added
- **[CV0.E3.S9 — Import conversation history from markdown](docs/project/roadmap/cv0-foundation/cv0-e3-admin-workspace/cv0-e3-s9-import-conversation/)** (shipped 2026-04-22) — admin CLI imports prior conversations as new sessions tagged with persona and optional org/journey. Canonical markdown format documented at [`docs/product/conversation-markdown-format.md`](docs/product/conversation-markdown-format.md). Strangler-fig enabler: years of context from other AI tools (Gemini, ChatGPT, Claude) can move into the mirror without losing depth. Imported assistant messages are stamped with `_persona` / `_organization` / `_journey` meta so the existing aggregations (`/me` active persona, `/organizations/:key` last conversation) treat imported sessions identically to organic ones.
- **[CV1.E4.S5 — Scope page becomes an ateliê](docs/project/roadmap/cv1-depth/cv1-e4-journey-map/cv1-e4-s5-scope-atelier/)** (shipped 2026-04-22) — `/organizations/<X>` and `/journeys/<X>` gain a Conversations section listing every session tagged to that scope (title, persona, relative time, 2-line preview). Click opens `/conversation/<sessionId>`, which loads the named session and bumps its `created_at` to make it active. Anti-pattern to the chatbot sidebar: sessions live *inside* their scope, no global flat list. New `getOrganizationSessions` / `getJourneySessions` / `getSessionById` / `markSessionActive` helpers; new `ScopeSessionsList` shared UI component. 22 new tests.
- **[CV1.E6.S1 — Conversations browse](docs/project/roadmap/cv1-depth/cv1-e6-memory-map/cv1-e6-s1-conversations-browse/)** (shipped 2026-04-22) — new `/conversations` cross-scope surface with filters by persona / organization / journey via query string, recency sort, paginated (50/page, "Show N more"). The active session gets a "current" badge in the list. First concrete piece of CV1.E6 (Memory Map), promoted ahead of the original landing-first plan after S5 surfaced the cross-scope need. New `getConversationsList` helper; new `ConversationsListPage` component. 19 new tests.
- **CV1.E4.S5 follow-up — scope ateliê trimmed to 5 + "View all (N)" link** (shipped 2026-04-22) — workshop pages show a teaser of 5 most-recent sessions; "View all (N) conversations →" links to `/conversations?organization=<key>` (or `?journey=<key>`) when there are more. `getOrganizationSessions` / `getJourneySessions` now return `{rows, total}` and accept optional `limit`.
- **[CV0.E4.S9 — Sidebar 'See All' entry](docs/project/roadmap/cv0-foundation/cv0-e4-home-navigation/)** (shipped 2026-04-22) — sidebar gains `See All` link to `/conversations` directly under `Conversation`, framed as the listing companion to the primary chat action. `.sidebar-link--secondary` styling makes it visually subordinate.

### Changed
- **`getOrCreateSession` resolves via `MAX(entry.timestamp)`, not `created_at`** (shipped 2026-04-22, correction to Phase 2 of CV1.E4.S5). Reading a different session via `/conversation/<sessionId>` no longer changes which session is "current" — that follows behavior (sending a message), not attention (clicking). `markSessionActive` removed; the `/conversation/:sessionId` route stops bumping `created_at` on open.

## [0.10.0] — 2026-04-22

The mirror gains a **home** — a landing page (`/`) that greets the user and surfaces what's active before dropping into chat. The sidebar reorganizes around three questions (*Who Am I* / *What I'm Doing* / *Where I Work*); admin links collapse to a single **Admin Workspace** entry that opens a workspace page with shortcut cards. A new **About You** page (`/me`) absorbs clerical concerns — name, currency preference, light self-portrait — separately from the structural identity that lives on the Psyche Map (renamed from Cognitive Map). URLs realign: `/mirror` and `/chat` redirect to `/conversation`. Cost displays a single currency per admin preference. Each scope card on `/organizations` and `/journeys` now shows a "Last conversation" readout.

In parallel, sessions gain explicit scope context: each session carries an editable **pool** of personas, organizations, and journeys. Reception picks within the pool each turn; the user can curate from the Context Rail at any time. First turn of a fresh session auto-populates the pool from reception's picks. Persona stays singular per reply (the mirror has one voice); orgs and journeys compose multi into the prompt. Three new junction tables; backward-compatible with existing per-message meta.

### Upgrade notes

From v0.9.0: `git pull && npm install && systemctl restart mirror-server`.

On first boot after upgrade, `migrate()` runs additive changes:
- **`session_personas`**, **`session_organizations`**, **`session_journeys`** tables created (CV1.E4.S4). Empty until the user tags a session from the rail.

`users.show_brl_conversion` is **reinterpreted, not migrated**. Meaning shifts from "show BRL alongside USD" to "prefer BRL over USD". One-line comment at each read site notes the historical artifact.

No SQL required. No data loss.

Recommended (manual, after upgrade):
1. Visit `/` to see the new home — login redirects here now; bookmarks of `/mirror` redirect via `/conversation`.
2. Visit `/me` to set currency preference (USD or BRL).
3. Open `/conversation` and look at the rail — the new "Scope of this conversation" section is below the persona; first turn of a fresh session auto-populates it.
4. Open `/organizations` or `/journeys` for the "Last conversation" readouts.

### Added
- **Landing home `/`** (CV0.E4.S1) with greeting, *State of the mirror* (admin only), *Latest from the mirror* digest band, *Continue* (active session + up to 3 earlier threads). Login redirects here instead of `/conversation`.
- **`digest:` frontmatter on all 11 existing release files** plus retroactive digests so the home page's "Latest from the mirror" band has content (CV0.E4.S1).
- **About You page `/me`** (CV0.E4.S4) — name editing, currency preference, light self-portrait stats (most active persona, session count), data export placeholder. Replaces the avatar-click target (was Psyche Map).
- **Three-section sidebar** (CV0.E4.S3) — context links restructured into *Who Am I* (Psyche Map), *What I'm Doing* (Journeys), *Where I Work* (Organizations).
- **Admin Workspace shortcut cards on `/admin`** (CV0.E4.S2) — five cards (Users, Budget, Models, OAuth, Docs) replace the sidebar's six-link expansion.
- **Last conversation per scope** (CV0.E4.S7) — `/organizations` and `/journeys` list pages pair each scope with title + relative time of the most recent tagged session. New `server/scope-sessions.ts` with `getLatestOrganizationSessions` / `getLatestJourneySessions`. Shared `ScopeRow` component.
- **Three new junction tables** (CV1.E4.S4) — `session_personas`, `session_organizations`, `session_journeys` with composite PK and string keys consistent with reception output.
- **`server/db/session-tags.ts`** (CV1.E4.S4) — `getSessionTags`, `addSessionPersona/Organization/Journey`, `removeSessionPersona/Organization/Journey`, `clearSessionTags`. `forgetSession` cascades to all three.
- **Reception filtering by session tag pool** (CV1.E4.S4) — `ReceptionContext.sessionTags` narrows candidates before the LLM call. Empty pool = considers all candidates (backward-compatible).
- **Composer multi-scope rendering** (CV1.E4.S4) — orgs and journeys compose multi from session tags; persona stays singular. Falls back to reception's single pick when a type has no tags.
- **Context Rail "Scope of this conversation" section** (CV1.E4.S4) — three tag groups (personas / orgs / journeys) with pills (× to remove) and dropdown-add. New endpoints `POST /conversation/tag` and `POST /conversation/untag`.
- **First-turn scope suggestion** (CV1.E4.S4) — fresh session with empty pool auto-populates from reception's picks before composing the first prompt; subsequent turns operate within the seeded pool.

### Changed
- **`/mirror/*` URLs renamed to `/conversation/*`** (CV0.E4.S5). `/mirror` and `/chat` redirect to `/conversation`. Page component renamed `MirrorPage` → `ConversationPage`. Internal DOM names preserved.
- **Cognitive Map renamed to Psyche Map** throughout (CV0.E4.S3). Promoted to first-class sidebar link.
- **Sidebar avatar opens `/me`** instead of the Psyche Map (CV0.E4.S4) — operational *you* separated from structural *you*.
- **Cost display becomes single-currency** (CV0.E4.S6) — admin picks USD or BRL in `/me`; every cost surface respects the choice. `formatUsdAndMaybeBrl` removed; replaced by `formatCost(usd, rate, preferBrl)` returning one currency string. `users.show_brl_conversion` reinterpreted from "show BRL alongside" to "prefer BRL over USD".
- **`This Mirror` sidebar section** (six sub-links) **collapsed into a single `Admin Workspace` link** (CV0.E4.S2). Dashboard at `/admin` becomes the navigation hub via shortcut cards.
- **Brand link** in the sidebar header now points to `/` (Home) instead of the chat surface (post-S2 polish).
- **Session metadata first-turn write** (CV1.E4.S4) — assistant messages no longer carry the per-turn `_persona` / `_organization` / `_journey` *only* via reception output; the pre-existing meta keys remain, but the source of truth for "what scope this session is in" is now the junction tables. The aggregations that read meta still work, in parallel, until they migrate (parked as a non-goal of S4).

### Fixed
- **Budget card on `/admin` dashboard respects currency preference** — was hardcoded to USD; now reads `show_brl_conversion`.
- **Scope+conversation pair fills full row width** on `/organizations` and `/journeys` cards.

### Non-goals (deferred)
- **Per-turn persona override** — future story if the need sharpens.
- **Tag editing from Telegram / API adapters** — no UI; reception picks unfiltered there.
- **Migrating the meta-based aggregations** (`/me` active persona, `/organizations/:key` last conversation) **to use the junction tables** — both signals exist in parallel; aggregations stay on per-message meta until the parallel-mechanism debt is paid.
- **Backfilling existing sessions with reception's past picks** into the new junction tables.

## [0.9.0] — 2026-04-21

Two stories land in one day: CV0.E3.S8 (OAuth credentials) and CV0.E3.S6 (budget as simulated subscription). The subscription-OAuth hypothesis from the 2026-04-21 spike opened and closed within the same release window — Google Code Assist free tier proved unusable for reception (latency + quota), GitHub Copilot closed individual plans — so S6 was written to replace the infrastructure bet with a UX bet: dedicated OpenRouter account, prepaid credit, real per-call cost tracking, admin-visible budget dashboard.

### Upgrade notes

From v0.8.1: `git pull && npm install && systemctl restart mirror-server`.

On first boot after upgrade, `migrate()` runs three additive changes:
- **`oauth_credentials`** table created (S8). Empty until an admin pastes credentials at `/admin/oauth`.
- **`usage_log`** and **`settings`** tables created (S6). Empty; populate on first LLM call / first admin edit.
- **`models.auth_type`** column added with default `'env'` (S8). All existing rows preserve current behavior.
- **`users.show_brl_conversion`** column added with default `1` (S6). All existing admins see BRL alongside USD in the budget page.
- **`settings.usd_to_brl_rate`** seeded to `5.0` on first boot. Adjust from `/admin/budget`.

No SQL required. No data loss.

Recommended (manual, after upgrade):

1. **Create a dedicated OpenRouter account** for this mirror if you don't have one. Keeps costs isolated from any other OpenRouter usage. Deposit initial credit ($10 is a good starting point).
2. **Set a monthly spending cap** at `openrouter.ai/settings/keys` on the mirror's key. Without a cap, `/admin/budget`'s progress bar and low-balance alert can't fire.
3. **Add env vars** to `.env` (or systemd unit on VPS):
   - `MIRROR_ENV=dev` locally, `MIRROR_ENV=prod` on the server.
   - `MIRROR_BASE_URL=https://your-prod-url` on the server (optional; defaults to `http://localhost:3000`).
4. **Visit `/admin/budget`** to confirm the hero shows credit remaining. Adjust the exchange rate if 5.0 isn't current. Toggle BRL display off if you track expenses in USD.
5. **Visit `/admin/oauth`** only if you want to experiment with one of the five supported OAuth providers. The infra is live; practical value is thin today (see release notes).

### Added
- **`oauth_credentials` table** and full CRUD helpers (S8). One row per provider, JSON-serialized credential blob carries pi-ai's shape (`refresh`, `access`, `expires`, plus provider-specific fields).
- **`models.auth_type` column** (`env` | `oauth`). Per-role choice between the env-var API key (default, unchanged behavior) and an OAuth credential resolved at call time (S8).
- **`server/model-auth.ts :: resolveApiKey(db, role)`** — single seam every LLM call now uses in place of `process.env.OPENROUTER_API_KEY`. For OAuth roles, calls pi-ai's `getOAuthApiKey()`, persists refreshed credentials back to the DB, wraps failures as `OAuthResolutionError` (S8).
- **`/admin/oauth` page** — lists pi-ai's five supported OAuth providers (Anthropic, OpenAI Codex, GitHub Copilot, Google Cloud Code Assist, Antigravity). Per-provider card: configured/not, relative expiry, paste-JSON save (accepts pi-ai's `auth.json` envelope or just the inner object), delete. Validation surfaces malformed JSON and missing required fields clearly (S8).
- **`/admin/models` auth-type awareness** — env/OAuth badge per role, shared datalist of known provider ids, inline warning with a link to `/admin/oauth` when an OAuth provider lacks credentials. `auth_type` is derived implicitly from the chosen provider on save (S8).
- **`usage_log` table** (S6) — one row per LLM call, indexed on `(created_at)`, `(role, created_at)`, `(env, created_at)`. Tokens populated from pi-ai's `AssistantMessage`, cost resolved asynchronously via OpenRouter's `/api/v1/generation/{id}` endpoint with exponential backoff retry.
- **`settings` table** (S6) — generic key/value store for install-wide tunables. Seeds `usd_to_brl_rate = 5.0` on first boot.
- **`users.show_brl_conversion` column** (S6) — per-admin display preference. Default on; toggle from `/admin/budget`.
- **`server/openrouter-billing.ts`** — `getKeyInfo()` (credit balance + lifetime usage + spending cap, cached 60s) and `getGeneration(id)` (exact per-call cost with exponential retry on 404/202). Both degrade gracefully to `undefined` + log, never throw (S6).
- **`server/usage.ts`** — `logUsage(db, {role, env, message, user_id, session_id})` fire-and-forget writer with background cost reconciliation. `currentEnv()` reads `MIRROR_ENV` at call time (S6).
- **`/admin/budget` page** (S6) — credit remaining hero with progress bar; this-month total + reconciled vs pending; 7-day burn rate + projected days of credit left; breakdowns by role, environment, model; exchange rate editor (global) and BRL display toggle (per-admin); top-up link. Full admin-only guard.
- **`/admin/budget-alert.json`** endpoint (S6) — returns `{alert: {pct, remaining_usd, remaining_brl, show_brl}}` when credit is below 20% of the spending cap; `{alert: null}` otherwise or when no cap is set. Polled client-side by `layout.js` on every admin page load.
- **Soft low-balance banner** (S6) — sticky top strip on `/admin/*` when balance drops under 20%. Injected client-side by `layout.js` so it doesn't require wiring through every admin page.
- **`X-Title: mirror-mind`** and **`HTTP-Referer: $MIRROR_BASE_URL`** headers on every OpenRouter call. Centralized in `buildLlmHeaders()`; Agent-based paths use `headeredStreamFn` that wraps `streamSimple` with headers merged in. OpenRouter dashboard displays the Referer URL in its "App" column (observed behavior — X-Title is sent but the dashboard prefers Referer for display).
- **`MIRROR_ENV`** and **`MIRROR_BASE_URL`** env vars documented in `.env.example`. `MIRROR_ENV` defaults to `dev`; `prod` and `production` both normalize to `prod`.
- **`auth.json` and `auth.*.json`** added to `.gitignore` — pi-ai's login CLI writes these in the current working directory; guarding against accidental commits.

### Changed
- **Context Rail cost visibility becomes admin-only** (S6, behavior change on existing code). Regular users no longer see cost at all on `/mirror`. For admins, cost respects `show_brl_conversion`: on → BRL (as before), off → USD (derived from the BRL heuristic ÷ stored rate).
- **Admin sidebar** gains **Budget** and **OAuth** links under the This Mirror section.
- **Release workflow** — per-story push cadence now applies to two stories shipped in the same release window; commits for both S8 and S6 are pushed together with this release tag.

### Fixed
- **OAuth paste accepts pi-ai's full `auth.json` envelope** — pi-ai's login CLI writes `{provider-id: {refresh, access, expires, ...}}`. The POST handler at `/admin/oauth/:provider` now unwraps the matching provider key when present; pasting just the inner object continues to work. Placeholder and hint updated to show the envelope shape admins actually receive.

### Known issues / observations
- **Subscription-via-OAuth remains a moving target.** Google Code Assist for Individuals (the free-tier path the spike targeted) proved unusable for reception — latency ~6s and quota behavior caused the scope-routing eval to collapse to 5/11 from the OpenRouter baseline 9/11. GitHub Copilot individual plans changed mid-April, closing the pattern. Anthropic has been tightening the Claude Code OAuth surface for third-party apps. The S8 infra is intact and functional; concrete legitimate use cases for it are thinner than the spike projected.
- **OpenRouter `/auth/key` reports `label` as a truncated key fingerprint, not a human label, unless the admin set one at OpenRouter.** No mirror-side workaround; set the label at `openrouter.ai/settings/keys` if you want a readable key name in `/admin/budget`.
- **Rail cost remains heuristic (char/4 × model price)**, unreconciled against `usage_log`'s real cost. The two values can diverge 10-30%. Admins who care about precision read `/admin/budget`. Documented in the S6 refactoring notes with a revisit criterion.
- **Gemini 2.5 Pro via OpenRouter still blocked** by the pi-ai parsing issue carried over from v0.8.1. The main path was briefly tested with Pro; response arrived empty for the user. Reverted to `gemini-2.5-flash` for main. CV0.E3.S8 opens the bonus path — `google-gemini-cli` provider via OAuth — but Google Code Assist latency makes validation unreliable.

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
