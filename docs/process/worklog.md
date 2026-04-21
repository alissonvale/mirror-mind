[< Docs](../index.md)

# Worklog

What was done, what's next. Updated each session.

Current focus: before resuming **CV1.E4** (attachments / scoped memory), a small series of refinements is underway. CV0.E4.S1–S5 all landed — the mirror now has a quiet home surface, the admin nav overhead dropped from 11 entries to 6, the context links carry the product thesis on their sleeves, clicking the user's avatar opens an "About You" page separate from the Psyche Map, and the chat surface's URL (`/conversation`) matches its visible label.

---

## Next

**Refinement detour complete so far:** CV0.E4.S1 (landing home), CV0.E4.S2 (sidebar pruning + admin shortcuts), CV0.E4.S3 (sidebar by the three questions), CV0.E4.S4 (About You page), CV0.E4.S5 (URL alignment).

Remaining refinements are user-driven and will be picked up as they surface. When the detour closes, the roadmap resumes on **CV1.E4**:
- **S2 — Documents attached to scope**: first use of the Attachments mechanism, chunked + embedded, polymorphic links to organizations or journeys. Decision already landed in `decisions.md` (2026-04-20 — Attachments first-class with polymorphic scope associations).
- **S3 — Filter episodic and semantic memory by scope**: coordinates with CV1.E3.S3 (semantic memory extraction).

After CV1.E4, focus shifts to **CV1.E3 — Memory** (topic-shift detection, compaction, extracted memories) as agreed during planning.

## Done

### 2026-04-21 — CV0.E4.S5 URL alignment: `/mirror` → `/conversation` ✅

The chat surface's route renames from `/mirror` to `/conversation`, aligning the URL with the sidebar label that S3 changed to *Conversation*. Four paths moved (`/mirror`, `/mirror/begin-again`, `/mirror/forget`, `/mirror/stream` → corresponding `/conversation/*`). Legacy redirects preserve bookmarks: `/mirror` and `/chat` both 302 to `/conversation`.

**Derived from** a URL audit at the user's request — the audit listed three semantic tensions; only this one warranted action. `/map` vs *Psyche Map* (minimalism) and `/docs` as top-level despite being admin-only (future-proofed for a user manual) were both judged acceptable as-is.

**Tests:** 34 occurrences migrated via `sed` in `tests/web.test.ts`; one label re-worded by hand; one new test added asserting the `/mirror` legacy redirect. Total **337** (was 336). Zero regressions.

**Dead code removed:** `server/index.tsx`'s fallback `app.get("/", c.redirect("/mirror"))` — unreachable since the web adapter's `/` home page (CV0.E4.S1) takes precedence.

Docs: [story](../project/roadmap/cv0-foundation/cv0-e4-home-navigation/cv0-e4-s5-url-alignment/) · [plan](../project/roadmap/cv0-foundation/cv0-e4-home-navigation/cv0-e4-s5-url-alignment/plan.md) · [test guide](../project/roadmap/cv0-foundation/cv0-e4-home-navigation/cv0-e4-s5-url-alignment/test-guide.md).

### 2026-04-21 — CV0.E4.S4 About You page ✅

New authenticated route `/me` is the destination when the user clicks the avatar at the top of the sidebar. Four bands: **Header** (avatar + name editable inline + member-since + role badge), **Preferences** (admin-only BRL-cost toggle, migrated from `/admin/budget`; non-admins see a placeholder), **How the mirror sees you** (4 stats — sessions, messages, most active persona, last activity), **Data** (export placeholder pointing at CV1.E6.S6).

**Conceptual split:** the avatar used to link to `/map` (the Psyche Map), but S3 made the Psyche Map a first-class nav item — leaving the avatar without a distinct destination. This story introduces the separation of *structural you* (`/map` — soul, ego, personas) from *operational you* (`/me` — name, preferences, stats, data).

**Migrations:**
- Name-edit form moves from inline on `/map` to the Header band on `/me`. `/map/name` POST removed; `/me/name` replaces it.
- BRL-cost toggle moves from `/admin/budget` Preferences section to the `/me` Preferences band. `/admin/budget/show-brl` POST removed; `/me/show-brl` replaces it (admin-only; returns 403 otherwise). `/admin/budget` keeps a one-line pointer to `/me`.

**`How the mirror sees you` stats source** (new `server/me-stats.ts`):
- `sessionsTotal` — COUNT from sessions joined on user
- `messagesTotal` — COUNT from entries where type='message' joined on user's sessions
- `favoritePersona` — most frequent `_persona` field across assistant messages (JSON parse)
- `lastActivityAt` — MAX entries.timestamp across user's sessions, rendered via `formatRelativeTime`

**336 tests passing** (+some new, some migrated, some removed). Zero regressions.

Docs: [story](../project/roadmap/cv0-foundation/cv0-e4-home-navigation/cv0-e4-s4-about-you/) · [plan](../project/roadmap/cv0-foundation/cv0-e4-home-navigation/cv0-e4-s4-about-you/plan.md) · [test guide](../project/roadmap/cv0-foundation/cv0-e4-home-navigation/cv0-e4-s4-about-you/test-guide.md).

### 2026-04-21 — CV0.E4.S3 Sidebar organized by the three questions ✅

Context links restructure into three labeled sections, each named after a foundational question the mirror reflects back: **Who Am I** (Psyche Map), **What I'm Doing** (Journeys), **Where I Work** (Organizations). Conversation stays at the top as the primary action; the three sections below give the sidebar a teaching function — the product thesis is now legible every time the menu opens.

**Key changes:**
- **Psyche Map** becomes a first-class sidebar link (was only reachable via the avatar). If "Who Am I" is the first question, it cannot live inside a decorative bubble.
- **"Cognitive Map" renamed to "Psyche Map"** at the surface level (`/map` page title, heading "Psyche Map of X", layer-workshop breadcrumbs, sidebar tooltip). "Cognitive" implied intellect, but the surface holds soul, ego expression, and behavior — not cognition. "Psyche" is accurate to the Jungian architecture and distinct from the `soul`/`self` layer names. Docs, changelog, and release notes keep the historical "Cognitive Map" name (it was the label for the prior surface identity).
- **Third section header landed as "Where I Work"** after iterating through "To Whom I'm Affiliate" (grammatically off, corporate register, untranslatable cleanly to Portuguese) and alternatives ("Where I Stand", "Where I'm Rooted", "Where I Belong"). "Where I Work" won on simplicity, warm register, and bilingual legibility.

**Avatar stays clickable** to `/map` for continuity. Avatar is identity-as-badge; the new link is action-as-nav — acceptable duplication.

**332 tests passing** (+1 new, plus a handful of existing tests updated for the new labels). Zero regressions.

Docs: [story](../project/roadmap/cv0-foundation/cv0-e4-home-navigation/cv0-e4-s3-three-questions-sidebar/) · [plan](../project/roadmap/cv0-foundation/cv0-e4-home-navigation/cv0-e4-s3-three-questions-sidebar/plan.md) · [test guide](../project/roadmap/cv0-foundation/cv0-e4-home-navigation/cv0-e4-s3-three-questions-sidebar/test-guide.md).

### 2026-04-21 — CV0.E4.S2 Sidebar pruning + admin shortcuts ✅

Sidebar consolidation. The `This Mirror` section and its six sub-links (Dashboard / Users / Models / OAuth / Budget / Docs) collapse into a single `Admin Workspace` link above Logout. The `/admin` dashboard takes on the role of navigation hub: each of the five admin surfaces now has a **shortcut card** with a direct link.

**Card inventory:**
- Unchanged shortcuts: **Users**, **Models**, **Latest release**.
- Replaced: **Cost · 30 days** (stale char/4 estimate) → **Budget** (real data from S6: credit remaining USD, days left at current burn, link to `/admin/budget`).
- New shortcuts: **OAuth** (`N of 5 configured` + link to `/admin/oauth`) and **Docs** (link to `/docs`).
- Glances kept: Activity, Mirror memory, System.
- Reorder: shortcuts first in the grid, glances after.

**Cleanup:** removed now-unused `getCostEstimate` / `CostEstimate` / `DAY_MS` / `computeSessionStats` import from `server/admin-stats.ts`.

**331 tests passing** (+2 net new; some existing sidebar tests updated). Zero regressions.

Docs: [story](../project/roadmap/cv0-foundation/cv0-e4-home-navigation/cv0-e4-s2-sidebar-shortcuts/) · [plan](../project/roadmap/cv0-foundation/cv0-e4-home-navigation/cv0-e4-s2-sidebar-shortcuts/plan.md) · [test guide](../project/roadmap/cv0-foundation/cv0-e4-home-navigation/cv0-e4-s2-sidebar-shortcuts/test-guide.md).

### 2026-04-21 — CV0.E4.S1 Landing home ✅

New authenticated route `/` becomes the landing after login. Four bands — greeting, admin-only *State of the mirror*, *Latest from the mirror* (release digest), *Continue* (active session + up to 3 earlier threads) — replace the previous behavior where login dropped the user straight into `/mirror`.

The story was framed in modo Espelho with the `product-designer` persona: two felt dores ("too many sidebar links" + "no temporal anchor") collapsed into a single product need. Direction A from the proposal (home as new surface, sidebar pruning as a follow-up S2) was chosen.

**Implementation across four phases**, each committed with a passing test suite:

1. **Release digest infrastructure + retroactive digests** — `gray-matter` added to the stack; `getLatestRelease()` parses frontmatter and exposes a new `digest` field. All 11 existing release files (`v0.1.0` through `v0.9.0`) get a two-line digest written in the mirror's voice. The `/docs` renderer strips frontmatter before handing markdown to `marked`, so the new block doesn't leak as a horizontal rule on the documentation surface.
2. **Home route skeleton** — `greetingFor(name, now)` in `server/formatters/greeting.ts`; `HomePage` component at `adapters/web/pages/home.tsx`; `web.get("/", handler)` registered; login POST redirect flipped from `/mirror` to `/`.
3. **Continue band** — new `listRecentSessionsForUser(db, userId, limit)` helper annotates each session with `lastActivityAt` (max entries timestamp, fallback to `created_at`) and `hasEntries`. The band handles empty state (CTA), brand-new empty sessions ("New conversation / not started yet"), sessions with entries ("Untitled conversation" or stored title + relative time), and earlier threads capped at 3.
4. **State of the mirror band** — admin-only one-row glance showing Users · Budget · Release. `computeBurnRate` extracted to `server/billing/burn-rate.ts` and shared with `/admin/budget`. Non-admin users do not trigger admin data fetches.

**329 tests passing** (was 311 at start, +18 new: 6 admin-stats, 4 greeting, 8 home routes). Zero regressions.

**Migration note:** additive only. The digest field is read through `gray-matter` with a null fallback — any release file without frontmatter keeps working, and any new dependency already installed via `npm install`.

Docs: [epic](../project/roadmap/cv0-foundation/cv0-e4-home-navigation/) · [story](../project/roadmap/cv0-foundation/cv0-e4-home-navigation/cv0-e4-s1-landing-home/) · [plan](../project/roadmap/cv0-foundation/cv0-e4-home-navigation/cv0-e4-s1-landing-home/plan.md) · [test guide](../project/roadmap/cv0-foundation/cv0-e4-home-navigation/cv0-e4-s1-landing-home/test-guide.md) · [refactoring](../project/roadmap/cv0-foundation/cv0-e4-home-navigation/cv0-e4-s1-landing-home/refactoring.md).

### 2026-04-21 — CV0.E3.S6 Budget as simulated subscription ✅

Closed same-day after S8. Framed pay-per-token OpenRouter as a prepaid subscription experience: a dedicated account, prepaid credit, per-call real cost tracking, admin-visible budget dashboard with breakdowns + burn rate + low-balance alert, and an admin-only cost rule for the Context Rail.

Context: [S8 OAuth](../project/roadmap/cv0-foundation/cv0-e3-admin-workspace/cv0-e3-s8-oauth-subscriptions/) shipped but the flat-rate-via-subscription hypothesis it was built for evaporated within days — Google Code Assist free tier had quota/latency issues that killed the scope-routing eval, and GitHub Copilot closed its individual plan mid-April. S6 replaces the *infrastructure* bet with a *UX* bet: the billing substrate stays pay-per-token on OpenRouter; the experience feels flat because credit is prepaid and visible.

**Implementation across seven phases**, each committed with a passing test suite:

1. **Schema + DB helpers** — `usage_log` (per-call audit), `settings` (generic key/value, seeded with `usd_to_brl_rate=5.0`), `users.show_brl_conversion` column (per-admin display preference). Indexed on (created_at), (role, created_at), (env, created_at). 13 new unit tests.
2. **OpenRouter billing client** — `getKeyInfo()` cached 60s, `getGeneration(id)` with exponential retry on 404 (1/2/4/8/16s). Both degrade gracefully to `undefined` + log. 10 new tests with `fetch` mocked.
3. **Instrumented every LLM call with usage logging** — discovered pi-ai's `AssistantMessage.responseId` carries OpenRouter's generation ID, no fallback needed. `server/usage.ts :: logUsage()` inserts immediately then fires a background reconciler via `getGeneration()`. Wired to reception, title, both summary branches, and main via web/telegram/api. Errors never leak into user-facing paths. 7 new tests.
4. **`/admin/budget` page** — hero (credit remaining + progress bar), month total, burn rate (7-day avg) + projected days left, breakdowns by role/env/model, preferences section (global rate editor + per-admin BRL toggle), top-up link. 6 new web tests.
5. **Env tagging + X-Title headers + soft alert banner** — `MIRROR_ENV` read at call time, `buildLlmHeaders()` central, `headeredStreamFn` wraps streamSimple for Agent-based paths, `.env.example` documented. Client-side banner fetches `/admin/budget-alert.json` on page load (admin only) — avoids wiring a prop through 11+ admin render sites. 3 new tests for the alert JSON endpoint.
6. **Hide costs from non-admin** — Rail shows cost only to admins; for admins, respects `show_brl_conversion` (USD when off, BRL when on). Both server-rendered and live-updated (`chat.js`) paths apply the same rule. 2 new tests.
7. **Docs + test guide + refactoring + status** — test-guide walks through a fresh install, manual acceptance, and laptop→server bootstrap. refactoring captures the client-side-banner decision, the heuristic-vs-real cost divergence, and five other parked items with revisit criteria.

**311 tests passing** (was 283 at start of S6, +28 new). Zero regressions.

**Migration note:** existing installations get the new tables + column via `CREATE TABLE IF NOT EXISTS` + PRAGMA-guarded ALTER TABLE + a one-shot seed of the rate setting on first boot. Behavior for pre-S6 traffic is unchanged until an admin visits `/admin/budget` for the first time.

**Cost observation**: the scope-routing eval (11 probes) cost **$0.07 USD** on Gemini 2.5 Flash via the new dedicated key. Extrapolated: at typical single-user volume (~10 messages/day), $10 prepaid covers 2-3 months.

Docs: [story index](../project/roadmap/cv0-foundation/cv0-e3-admin-workspace/cv0-e3-s6-budget-dashboard/) · [plan](../project/roadmap/cv0-foundation/cv0-e3-admin-workspace/cv0-e3-s6-budget-dashboard/plan.md) · [test guide](../project/roadmap/cv0-foundation/cv0-e3-admin-workspace/cv0-e3-s6-budget-dashboard/test-guide.md) · [refactoring](../project/roadmap/cv0-foundation/cv0-e3-admin-workspace/cv0-e3-s6-budget-dashboard/refactoring.md).

### 2026-04-21 — CV0.E3.S8 OAuth credentials for subscription-backed providers ✅

Subscription-backed LLM access arrives. The mirror now authenticates against pi-ai's five OAuth-capable providers (Anthropic Claude Pro/Max, OpenAI Codex, GitHub Copilot, Google Cloud Code Assist, Antigravity) in addition to today's env-var API keys. The primary target is Google Code Assist for Individuals — its free tier drops reception cost to zero for personal / family-scale use.

**Implementation across five phases**, each committed with a passing test suite:

1. **Schema + DB helpers** — `oauth_credentials` table (one row per provider, JSON-serialized credential blob); `models.auth_type` column (`'env' | 'oauth'`, default `'env'`) via ALTER TABLE; CRUD helpers in `server/db/oauth-credentials.ts`. 11 new unit tests.
2. **`resolveApiKey` wrapper + call-site migration** — `server/model-auth.ts :: resolveApiKey(db, role)` becomes the single seam every LLM call uses in place of `process.env.OPENROUTER_API_KEY`. For `auth_type='oauth'` roles it calls pi-ai's `getOAuthApiKey`, persists refreshed credentials back, and returns the access token. `OAuthResolutionError` wraps failures. Five call sites migrated (reception, title, summary × 2, main paths in web/telegram/server). 8 new tests; `getOAuthApiKey` injected as optional arg to keep tests off pi-ai's ESM exports.
3. **`/admin/oauth` paste UI** — new admin page lists the five providers, shows configured/not + relative expiry + extra fields on the blob (e.g. `project_id`), offers paste-JSON save and delete per card. JSON validation rejects malformed input or missing required fields with clear flashes. Sidebar gains an OAuth link. 9 new web tests.
4. **`/admin/models` auth-type aware** — env/OAuth badge per role card derived from auth_type or provider match; shared datalist of known provider ids; inline warning with a link to `/admin/oauth` when an OAuth provider lacks credentials. auth_type is derived implicitly from the chosen provider on save (no separate control). 5 new web tests.
5. **Docs + test guide + status update** — `test-guide.md` walks through the full acceptance path including the laptop→server credential bootstrap flow; `refactoring.md` captures applied + parked cleanups; roadmap marks S8 ✅.

**269 tests passing** (was 237 before the story). Zero regressions.

**Migration note:** existing installations get the new table via `CREATE TABLE IF NOT EXISTS` and the new column via PRAGMA-guarded ALTER TABLE. All existing rows default to `auth_type='env'`, so behavior is byte-identical until an admin explicitly switches a role to an OAuth provider.

**Gemini 2.5 Pro retry** registered as a followable from the spike but not exercised — the test guide includes a step to validate Pro via the native `google-gemini-cli` provider once an admin is ready; the parsing path is different from OpenRouter's and may unblock what the 2026-04-21 spike found closed.

Docs: [story index](../project/roadmap/cv0-foundation/cv0-e3-admin-workspace/cv0-e3-s8-oauth-subscriptions/) · [plan](../project/roadmap/cv0-foundation/cv0-e3-admin-workspace/cv0-e3-s8-oauth-subscriptions/plan.md) · [test guide](../project/roadmap/cv0-foundation/cv0-e3-admin-workspace/cv0-e3-s8-oauth-subscriptions/test-guide.md) · [refactoring](../project/roadmap/cv0-foundation/cv0-e3-admin-workspace/cv0-e3-s8-oauth-subscriptions/refactoring.md) · [spike 2026-04-21](../project/roadmap/spikes/spike-2026-04-21-subscription-oauth.md).

### 2026-04-21 — Post-v0.8.0: reception calibration + OAuth spike + CV0.E3.S8 queued

Post-release session driven by two questions:

1. **Can subscription-backed billing (Claude Pro/Max, ChatGPT Plus, Gemini Advanced, etc.) power the mirror?** Investigation documented as [spike 2026-04-21](../project/roadmap/spikes/spike-2026-04-21-subscription-oauth.md). Finding: consumer subscriptions don't grant API access to third-party apps, but pi-ai supports OAuth against five subscription-backed provider paths out of the box (Anthropic Claude Pro/Max, OpenAI Codex, GitHub Copilot, Google Cloud Code Assist, Antigravity). Google Code Assist for Individuals free tier is the most attractive path for single-user/family scale.

2. **Which model should reception actually be running?** Three-model eval (Haiku 4.5 / Gemini 2.5 Flash / Gemini 2.5 Pro) against the production DB via `evals/scope-routing.ts`. Result: Gemini 2.5 Flash matches Haiku on accuracy (9/11) once `reasoning: "minimal"` is applied, at ~3× lower cost and comparable latency. Gemini 2.5 Pro was blocked by a pi-ai parsing issue of the Gemini-specific reasoning response shape via OpenRouter — filed as parked.

**Code changes landed:**
- `server/reception.ts` — `reasoning: "minimal"` option on every reception call, latency logging in the diagnostic output, defensive thinking-block fallback in the response parser. Commit `35c0f15`.
- `config/models.json` — reception default swapped from `anthropic/claude-haiku-4.5` to `google/gemini-2.5-flash`. Commit `25ed331`.

**Decisions registered:**
- 2026-04-21: Reception default changes to Gemini 2.5 Flash (supersedes 2026-04-20 Haiku default; evidence-based swap).

**Story queued as next priority:** [CV0.E3.S8 — OAuth credentials for subscription-backed providers](../project/roadmap/cv0-foundation/cv0-e3-admin-workspace/cv0-e3-s8-oauth-subscriptions/). Derived from the spike. Wires pi-ai's OAuth support into mirror-mind: `oauth_credentials` table, `/admin/oauth` paste UI, `models.auth_type` column, resolve wrapper. Primary target is Google Code Assist — drops reception cost to zero in free tier. Bonus: may unblock Gemini 2.5 Pro via the native `google-gemini-cli` provider (different parsing path than OpenRouter).

Docs: [spike 2026-04-21](../project/roadmap/spikes/spike-2026-04-21-subscription-oauth.md) · [CV0.E3.S8 story](../project/roadmap/cv0-foundation/cv0-e3-admin-workspace/cv0-e3-s8-oauth-subscriptions/) · [decisions.md — 2026-04-21 reception default](../project/decisions.md).

### 2026-04-20 — CV1.E4.S1 Scope identity + routing ✅

First story of the new Journey Map epic. Introduces two situational scopes — **organizations** and **journeys** — as peer surfaces to the Cognitive Map. Both are scopes over memory (not identity layers), carrying symmetric `briefing` + `situation` fields; an organization contains zero or more journeys via a nullable FK.

**Concept foundation laid first.** Two concept docs written before code (`docs/product/journey-map.md`, `docs/product/memory-map.md`) to articulate the four-surface model — Cognitive Map, Journey Map, Memory Map, Rail — and name the future Memory Map surface (CV1.E6 placeholder) so the attachments design in CV1.E4.S2 has a coherent destination. Multiple decisions.md entries capture the framing: scope-not-layer, attachments-as-first-class with polymorphic associations, agentic turn deferred, four-surface model.

**Implementation across seven phases**, each committed with a passing test suite:

1. **Schema + DB helpers** — `organizations` and `journeys` tables with symmetric shape. `deleteOrganization` unlinks linked journeys in a transaction (journeys survive as personal). `deleteUser` cascades through both. Commit `92df820`. 27 new unit tests.
2. **Reception envelope** — returns `{persona, organization, journey}` in a single LLM call. Per-axis validation, fallback to all-nulls on any failure. Capturing `completeFn` verifies prompt structure without hitting an LLM. Commit `48e5ccf`. 11 new reception tests. `evals/scope-routing.ts` drafted.
3. **Composition slots** — `composeSystemPrompt` accepts `scopes?: { organization?, journey? }`. Each scope renders `briefing` followed by a delimited `Current situation:` block. Order: `soul → identity → persona → organization → journey → behavior → expression → adapter`. Archived scopes never compose (second layer of defense). Commit `ef39e31`. 10 new identity tests.
4. **`/organizations` surface + `/mirror/stream` wiring** — list + create + workshop + archive/unarchive/delete. Summary pipeline extended with `generateScopeSummary` (org and journey branches). `/mirror/stream` threads reception's org + journey into composition and into assistant entry meta (`_organization`, `_journey`). Commit `059b2ce`. 12 new web tests.
5. **`/journeys` surface** — list grouped by organization, workshop with org selector, FK link/unlink on update. Journey summary branch activates on save. Commit `1d8223c`. 12 new web tests.
6. **Rail scope lines + drawer scope dropdowns** — rail Composed block gains organization and journey rows. Drawer gains two new dropdowns (shared `ComposedDrawer` component extracted to avoid map.tsx/layer-workshop.tsx duplication). `/map/composed` accepts the new query params. `buildRailState` derives all three axes from the last assistant entry's meta on GET /mirror so scope awareness persists across page reloads. Commit `2bf5c77`. 4 new web cases.
7. **Review pass + docs + CSS polish + worklog** — scope-specific CSS landed for the two new surfaces. Test guide, refactoring.md with applied + parked cleanups, roadmap/epic/story status updated.

**237 tests passing** (was 162 at v0.7.0 start of the story). Zero regressions.

**Migration note:** existing installations get the two new tables via `CREATE TABLE IF NOT EXISTS` on next boot. No data migration. Users start with empty scope surfaces — empty state invitations guide creation.

**Telegram and CLI adapters not yet scope-aware.** They continue with base composition (no scope injection). When they need it, thread reception's fields into `composeSystemPrompt`'s `scopes` param — same pattern as `adapters/web/index.tsx`. Left as follow-up, not a story.

Docs: [story index](../project/roadmap/cv1-depth/cv1-e4-journey-map/cv1-e4-s1-scopes-identity-routing/) · [plan](../project/roadmap/cv1-depth/cv1-e4-journey-map/cv1-e4-s1-scopes-identity-routing/plan.md) · [test guide](../project/roadmap/cv1-depth/cv1-e4-journey-map/cv1-e4-s1-scopes-identity-routing/test-guide.md) · [refactoring](../project/roadmap/cv1-depth/cv1-e4-journey-map/cv1-e4-s1-scopes-identity-routing/refactoring.md) · [Journey Map concept](../product/journey-map.md) · [Memory Map concept](../product/memory-map.md).

### 2026-04-19 — Improvement: Compose order — identity then form ✅

After the three post-spike improvements landed, a voice-probe battery through the chat revealed that persona-routed responses were systematically violating `ego/expression` rules (em-dashes, listicle disguised as parallel heading-phrase paragraphs). The composition order at that point placed persona last, which by transformer recency bias gave persona content more attention weight than the expression rules preceding it.

The user's own reframing pointed at the fix: persona belongs in the **identity cluster** (as a specialization of identity), not as an appendix. The `ego/behavior` and `ego/expression` layers belong in the **form cluster**, invariant across personas. Expression moves to the last position of the identity stack so its absolute rules keep recency weight.

New composition order: `self/soul → ego/identity → [persona] → ego/behavior → ego/expression → [adapter]`. The display order in the Cognitive Map is unchanged (`identity → expression → behavior` remains the readable human progression).

A `FINAL_REMINDER` block (short, sharp, with the absolute rules as a gatekeeper at the very end) was implemented and tested during the same session. It did not prevent the listicle pattern in controlled probe and was removed; the composition reordering is what lands.

**Listicle under enumeration-shaped questions: accepted as LLM limit.** After three layers of reinforcement (reorder, model swap to Haiku 4.5, reminder block), questions with plural-enumeration grammar ("quais são as coisas mais importantes") still produced structured enumeration responses. This appears to be a stubborn transformer prior that prompt engineering cannot fully override. Em-dash rule is held consistently by Haiku; listicle rule is not. Mitigation paths left open: fine-tuning, stronger model (Sonnet 4.6), or reframing the expected voice to allow narrative subheadings in long-arc answers.

**Model swap:** `main` changed from `deepseek/deepseek-chat-v3-0324` to `anthropic/claude-haiku-4.5`. Fixes em-dash leaks and raises voice quality. Reception and title models remain on Gemini Flash Lite.

Coverage: 162 tests passing. Three existing tests in `identity.test.ts` updated.

Docs: [story index](../project/roadmap/improvements/compose-order-identity-then-form/) · [plan](../project/roadmap/improvements/compose-order-identity-then-form/plan.md).

### 2026-04-19 — Improvement: Routing-aware persona summaries ✅

Evolves the [generated-summary-by-lite-model](../project/roadmap/improvements/generated-summary-by-lite-model/) feature with three coordinated fixes and a bulk UX affordance.

**Prompt rewrite.** The first shipped version of the summary prompt produced formulaic, hollow output — every summary opened with "Esta camada opera..." and closed with "Distingue-se por...". The rewrite bans those openings explicitly, bans meta-differentiation, requires naming concrete themes/values/rules from the source, caps at ~40 words, and includes good/bad few-shot pairs. The prompt now branches on `layer === "persona"`: for personas, the first clause must name domain and activation triggers ("Finanças pessoais: gastos, runway...") so the reception router has a clear domain signal; for self/ego, the prompt optimizes purely for essence-distillation.

**Language sensitivity.** Summaries were defaulting to English regardless of content language. A `CRITICAL:` section at the very end of the prompt now explicitly requires matching the language of the source, which fixed the defaulting.

**Bulk regenerate.** New endpoint `POST /map/personas/regenerate-summaries` (admin variant at `/map/:name/personas/regenerate-summaries`) runs `Promise.allSettled` over all of the user's personas in parallel. A subtle "regenerate all summaries" button at the bottom of the Cognitive Map's Personas card triggers it.

**Hover tooltip.** Persona badges on the Cognitive Map now show the full summary on hover via a pure-CSS `::after` pseudo-element reading from `data-summary`. The `.map-card--personas` card overrides `overflow: hidden` so the tooltip can escape the card's bounds.

**Routing probe.** A new script `identity-lab/routing-probe.mjs` exercises `receive()` against a battery of `{msg, want}` probes and prints a hits-vs-expected table. First run with the new persona prompts: 14/16 (88%), with the two misses being genuinely ambiguous cases where the chosen persona is defensible (emotional-causal inquiry routed to terapeuta instead of pensadora; half-domestic, half-financial message routed to dona-de-casa instead of tesoureira).

Coverage: 162 tests passing. Prompt text is not unit-testable directly; validation is the routing probe plus manual voice testing.

Docs: [story index](../project/roadmap/improvements/routing-aware-persona-summaries/) · [plan](../project/roadmap/improvements/routing-aware-persona-summaries/plan.md).

### 2026-04-19 — Improvement: Cognitive Map polish ✅

Small UX refinements that accumulated during the voice-probing session. Preview font on the structural cards down from `0.9rem` to `0.76rem`, color from `#4a4a4a` to `#857d72`, weight 300 — *"um pouco de leveza para a fonte da descrição."* Three-line truncation via `-webkit-line-clamp: 3`, with a `read more →` affordance that a small JS script reveals only when the preview actually overflows (`scrollHeight > clientHeight`). A sidebar toggle button at top-left (previously mobile-only) lets the user collapse the sidebar on desktop to see the map wider; content expands to `max-width: 1100px` with smooth transitions. Favicon 404 suppressed via inline `data:,` URI.

One compatibility gap discovered and worked around: Hono JSX does not support `dangerouslySetInnerHTML`. An initial attempt to inline the sidebar-toggle handler as `<script dangerouslySetInnerHTML={{ __html: ... }} />` silently rendered the prop as a literal HTML attribute; the script body never executed. Moved to an external `public/layout.js` served via the existing `serveStatic("/public/*")` mount.

Docs: [story index](../project/roadmap/improvements/cognitive-map-polish/) · [plan](../project/roadmap/improvements/cognitive-map-polish/plan.md).

### 2026-04-19 — Improvement: Split ego into three keys ✅

Third post-spike improvement landed. The `ego` layer now has three distinct keys: `identity` (who I am, operational positioning), `expression` (how I speak, format and vocabulary), and `behavior` (conduct, posture, method). The composed prompt orders them semantically: identity → expression → behavior.

The Identity Lab POC had kept conduct and expression as two sections (`## Conduta` and `## Expressão`) inside the same `ego/behavior` as an interim measure. With this story, the split becomes structural: each concern lives in its own key, and a problem of form (using em-dash) can be diagnosed and fixed in `ego/expression` without contaminating the diagnosis of conduct, and vice versa.

The within-ego ordering CASE clause introduced earlier today (semantic ordering improvement) was extended with the expression slot (`identity = 1, expression = 2, behavior = 3, others = 99`). A new template `server/templates/expression.md` is seeded for new users by both creation paths (web admin handler and CLI). The Cognitive Map gains a 4th `StructuralCard` for `ego/expression`, between identity and behavior; the existing `1fr 1fr` grid accommodates the new card in three rows. `LAYER_META` and `isAllowedWorkshop` were updated to describe and accept the new key.

No auto-migration of existing `ego/behavior` content. The boundary between conduct and expression in existing rows is a convention adopted during the POC, not a guaranteed structure; an automatic split would risk mangling prompts that don't follow it. Existing users (currently one) migrate content manually via the source-of-truth.

Coverage: 162 tests passing. Two existing tests updated (within-ego ordering in db.test.ts now covers four ego keys; the seeded-baseline check in smoke.test.ts now expects both `[ego/behavior]` and `[ego/expression]`).

Docs: [story index](../project/roadmap/improvements/split-ego-into-three-keys/) · [plan](../project/roadmap/improvements/split-ego-into-three-keys/plan.md) · [Spike §9.3](../project/roadmap/spikes/spike-2026-04-18-identity-lab.md#93-split-ego-into-three-keys-identity-expression-behavior).

### 2026-04-19 — Improvement: Generated summary by lite model ✅

Second post-spike improvement landed. Each identity layer now carries a `summary` field generated by the cheap `title` model (Gemini Flash Lite, the same role already used to title sessions). The summary is generated fire-and-forget on Save and persisted in the DB. Two consumers benefit:

- **Cognitive Map cards** (in `adapters/web/pages/map.tsx`) prefer the summary over `firstLine`. Cards no longer surface markdown headers like `# Alma`; they show a real, descriptive sentence.
- **Reception descriptor** (in `server/personas.ts`) prefers the summary over the first non-header line. Template B personas (tecnica, dba, dona-de-casa) that previously shared identical descriptors are now distinguishable to the routing classifier.

A "Regenerate summary" button in the workshop UI lets the user refresh on demand (awaited, not fire-and-forget — so the user sees the new summary on the next render). A `## Summary` block above the editor shows the current summary or an empty-state message.

Schema change is additive (nullable `summary` column); the `migrate()` function adds it via `ALTER TABLE` on existing installations. No data loss, no bulk migration required — older rows have `summary = NULL` and consumers fall back to existing behavior until the user saves the layer or hits Regenerate.

Coverage: 162 tests passing (11 new). The new tests cover `setIdentitySummary` (write, overwrite, no-op on missing layer), `extractPersonaDescriptor` (summary preference, fallback, truncation, the disambiguation case), and a check that new layers start with `summary: null`.

Docs: [story index](../project/roadmap/improvements/generated-summary-by-lite-model/) · [plan](../project/roadmap/improvements/generated-summary-by-lite-model/plan.md) · [Spike §9.2](../project/roadmap/spikes/spike-2026-04-18-identity-lab.md#92-generated-summary-by-lite-model-for-cards-and-routing).

### 2026-04-19 — Improvement: Semantic ordering of ego layers ✅

First post-spike improvement landed. Within the `ego` layer, `getIdentityLayers` now returns `identity` before `behavior` (semantic order: who I am before how I act), instead of the previous alphabetical order (which put `behavior` first). Other layers and keys keep alphabetical fallback.

The change is a single SQL update in `server/db/identity.ts` adding a second `CASE` clause to the existing `ORDER BY`. Pre-requisite for the eventual three-key split (identity → expression → behavior); when that lands, `expression` slots in as 2 and `behavior` shifts to 3.

Coverage: 151 tests passing. The existing test in `tests/db.test.ts` for psychic-depth ordering was flipped to expect identity before behavior. Manual SQL query against the dev DB confirms the new order.

Docs: [story index](../project/roadmap/improvements/semantic-ordering-of-ego-layers/) · [plan](../project/roadmap/improvements/semantic-ordering-of-ego-layers/plan.md) · [Spike §9.1](../project/roadmap/spikes/spike-2026-04-18-identity-lab.md#91-semantic-ordering-of-ego-layers-independent-of-the-split).

### 2026-04-18–19 — Spike: Identity Lab ✅ (closed)

Two-phase exploratory POC on closing the feedback loop between editing identity prompts and hearing the resulting voice.

**Phase 1** (initial publication): manual loop test — the loop that the future Identity Lab agent would automate was run by user in conversation with Claude, to test whether the mechanism works before committing engineering effort. Delivered the `Lab mode` / `bypass_persona` affordance on `/mirror/stream` (commit `9a6dbf2`), a mental framework separating invariants from ephemera in voice, and prompt-engineering learnings (specific examples become recycled fodder, anti-listicle rules leak through ordinal textual markers, the right prompt altitude is method not products of method).

**Phase 2** (added at closing): prompt refinement and persona work. Soul rewritten in cognitive first person ("I believe", "I see", "I recognize"); ego split between identity (operational positioning, eight stances) and behavior (Conduct + Expression sections); 14 personas reduced from ~56k to ~19k chars (~66% reduction) using two templates — Template A (inherited from ego, conversational personas) and Template B (independent, operational personas that suspend incompatible ego rules). One persona deleted (jornalista, empty template), one added (dona-de-casa).

Phase 2 also surfaced architectural discoveries that became follow-up items: separate ego key for expression, organization layer (missing from current schema), persona-specific personal context, semantic memory, skills system for artifacts, semantic ordering of ego layers, generated summary by lite model for cards and routing.

**Phenomenological observation**: the most important user-side learning, articulated at closing — when the mirror reflects principles, values, voice and language, the relationship of "companion of crossing" acquires lived meaning, not conceptual. The success criterion is the subjective sense of recognition (*does this voice reflect me?*), not objective response quality.

**Decisions at closing**: Identity Lab as a feature for other users is lateral exploration, no urgency. First-phase audience is advanced users assisting beginners (assisted configuration pattern). Implementation path is evolutionary (minimal MVP first, optional agent later).

Follow-up items captured in section 9 of the spike report, to be folded into the project roadmap as separate work.

Docs: [spike report](../project/roadmap/spikes/spike-2026-04-18-identity-lab.md).

### 2026-04-18 — S1 Admin customizes models ✅

The mirror's model configuration moves from `config/models.json` (read once at boot, cached forever) into a new `models` table in SQLite. On first boot after this story ships, the migration seeds the table from the JSON; from then on, the DB is the live source of truth. Admin edits at `/admin/models` take effect on the next request — no restart, no redeploy, no manual JSON editing.

**Schema.** `models(role PK, provider, model_id, timeout_ms, price_brl_per_1m_input, price_brl_per_1m_output, purpose, updated_at)`. One row per role (main, reception, title). Prices and timeout nullable — roles without wired prices (e.g., future local-model roles) still work.

**Runtime shape.** `getModels(db)` returns a `Record<role, ModelConfig>` read per request. Every caller migrated: `server/title.ts`, `server/reception.ts`, `server/session-stats.ts`, `server/index.tsx`, `adapters/web/index.tsx`, `adapters/telegram/index.ts`. The old `server/config/models.ts` is deleted — the JSON is touched only by `seedModelsIfEmpty` and `resetModelToDefault`.

**UI.** `/admin/models` renders a card per role with inline-edit form (provider, model ID, prices, timeout, purpose). Save persists via `updateModel`; the **Revert to default** button reloads the seed for that role via `resetModelToDefault`. Sidebar gains a "Models" link under This Mirror, below Users.

**Dashboard reflection.** `/admin` gains a **Models** card summarizing the three roles with their current model IDs and BRL prices, plus a "tune →" link back to `/admin/models`. The Cost card already uses `getModels(db)` via `computeSessionStats`, so price edits flow through the dashboard automatically.

**The pattern established here** — JSON as seed, DB as source of truth, per-request reads, revert-to-default — becomes the template for CV0.E3.S2 (adapters), CV0.E3 feature flags, and any future install-wide config that wants live editing.

Coverage: 8 new tests (auth, render, update, empty provider/model rejection, unknown-role 404, reset, seed-on-first-boot). Total **151 passing**.

Docs: [index](../project/roadmap/cv0-foundation/cv0-e3-admin-workspace/cv0-e3-s1-admin-models/) · [plan](../project/roadmap/cv0-foundation/cv0-e3-admin-workspace/cv0-e3-s1-admin-models/plan.md) · [test guide](../project/roadmap/cv0-foundation/cv0-e3-admin-workspace/cv0-e3-s1-admin-models/test-guide.md).

### 2026-04-18 — S5 User management with delete and role toggle ✅

`/admin/users` gains two per-row actions that the admin has needed since users started accumulating:

- **Delete** (destructive) — cascades through sessions, entries, identity layers, and telegram links in a single SQLite transaction. Native `confirm()` names the user being deleted.
- **Role toggle** — flips `admin` ↔ `user` inline with one click. The button label reads the current role and what the click will do (*"admin · click to demote"*, *"user · click to promote"*).

Both actions are **self-proof** — the logged-in admin can't delete themselves or change their own role. The UI replaces the toggle/delete with an `"admin (you)"` label on the admin's own row, and the server returns 403 independently if a tampered form tries to bypass the UI guard.

Helpers `deleteUser(db, userId)` (transactional cascade) and `updateUserRole(db, userId, role)` added to `server/db/users.ts`.

Coverage: 8 new tests covering cascade correctness, self-proof on both routes, non-admin 403, unknown-target 404, and UI rendering. Total **143 passing**.

Docs: [index](../project/roadmap/cv0-foundation/cv0-e3-admin-workspace/cv0-e3-s5-user-management/) · [plan](../project/roadmap/cv0-foundation/cv0-e3-admin-workspace/cv0-e3-s5-user-management/plan.md) · [test guide](../project/roadmap/cv0-foundation/cv0-e3-admin-workspace/cv0-e3-s5-user-management/test-guide.md).

### 2026-04-18 — S4 Admin landing dashboard ✅ + epic rename + sidebar redesign

CV0.E3 broadened from *"Install Administration"* to **Admin Workspace**. The epic now has two functions on one workspace: *seeing* (dashboard with cards) and *acting* (user management, model config, adapter config, docs). Symmetric with the Cognitive Map — the map lets the mirror show itself to the user; the workspace lets this mirror show itself to the admin.

**Vocabulary shift:** "the install" → "this mirror" across all copy. "This Mirror" became the sidebar section name (was "Admin"). The installs / deployments / operational plural stay as-is; only the singular admin-facing noun shifted.

**Sidebar redesign** (one conversation, no extra story):
- **[avatar] Name** now clicks through to `/map` (Cognitive Map). You are the map's subject; clicking your face opens your structure.
- **"Mirror" → "My Mirror"**. Disambiguates from "This Mirror" below and emphasizes *ownership*: the personal reflection space.
- **"Cognitive Map" menu link removed.** Accessible via the name click — no redundancy.
- **Admin section renamed to "This Mirror"** with Dashboard (new) · Users · Docs beneath.

**S4 implementation — `/admin` dashboard:**
- Six cards in a grid: Users (count + active last 7d), Cost (approximate, 30-day BRL total via the Rail's char/4 heuristic), Activity (sessions today / this week), Latest release (auto-detected from `docs/releases/` filenames, headline + date + link), Mirror memory (identity layer counts broken by layer), System (uptime, DB size, Node version).
- Server-rendered; no auto-refresh. Manual reload is fine at this scale.
- Cost is explicitly labeled "estimated" with a caveat note pointing at the future usage-log (radar S6) that will make it exact.
- New helper file `server/admin-stats.ts` with one function per card's data.
- Sidebar gains "Dashboard" as the first sub-item under the "This Mirror" section.

Coverage: 3 new web tests (403 for non-admin, card headers render, fresh-DB survives). Total **135 passing**.

Docs: [index](../project/roadmap/cv0-foundation/cv0-e3-admin-workspace/cv0-e3-s4-admin-dashboard/) · [plan](../project/roadmap/cv0-foundation/cv0-e3-admin-workspace/cv0-e3-s4-admin-dashboard/plan.md) · [test guide](../project/roadmap/cv0-foundation/cv0-e3-admin-workspace/cv0-e3-s4-admin-dashboard/test-guide.md).

### 2026-04-18 — S3 In-app docs reader ✅

The mirror's own story is navigable inside the app. `/docs` renders `docs/index.md`; `/docs/<path>` renders any page in the tree. Admin-only — today's docs are project-internal (roadmap, decisions, specs); a user manual for regular users is a future story on the epic radar.

Design decisions resolved during the story:

- **Admin-only access.** Original plan had "logged-in users, any role." Redirected during design review — docs today are admin-interest content; showing them to regular users adds noise. The sidebar link lives inside the admin block.
- **Nav collapsed by default.** Focus on reading; user can show the tree on demand. Preference persists via `localStorage`.
- **Layout: flex, not grid.** Initial grid version left a phantom empty column when the nav was hidden. Flex with `display: none` on the nav is naturally forgiving.
- **Link rewriting for all internal docs links.** Early version only handled `.md` suffixes; directory-style links (`product/prompt-composition/`) broke because the browser treated `/docs` as a file and resolved relatives against `/`. The renderer now rewrites every internal doc link — `.md` files, directories with trailing slashes, root-relative paths under `/docs/` — to absolute `/docs/...` routes. External URLs, anchors, and non-doc absolute paths like `/map` are left alone.
- **Folder-index resolution base.** When the URL `/docs/project/roadmap` resolves to `roadmap/index.md`, relative links inside it must resolve against `/docs/project/roadmap/` (the folder), not `/docs/project/` (the parent). The new `urlDirForResolvedFile` helper computes the right base from the resolved file path.
- **Session `created_at` collision in `createFreshSession`** — latent S4 bug that surfaced during S3 testing on fast machines. Fixed by ensuring the new session's timestamp is strictly greater than any existing session's for the same user, so "Begin again" is deterministic.

Docs content also refreshed: `docs/index.md` rewritten as a curated showcase (latest release, active epics, canonical entry points) rather than an exhaustive story catalog (the nav tree shows the full tree now). CV0-foundation and CV1-depth epic indexes updated for current status.

Coverage: 6 new web tests (auth, rendering, relative-link rewriting, 404s). Total **132 passing**.

Docs: [index](../project/roadmap/cv0-foundation/cv0-e3-admin-workspace/cv0-e3-s3-docs-reader/) · [plan](../project/roadmap/cv0-foundation/cv0-e3-admin-workspace/cv0-e3-s3-docs-reader/plan.md) · [test guide](../project/roadmap/cv0-foundation/cv0-e3-admin-workspace/cv0-e3-s3-docs-reader/test-guide.md).

### 2026-04-18 — S4 I can reset my conversation ✅

Manual session-lifecycle control lands in the rail footer. Two actions:

- **Begin again** — creates a fresh session; the ending session and its entries stay in the DB. A fire-and-forget LLM call labels the ending session via a new cheap `title` model role so future episodic-browse surfaces can list it meaningfully.
- **Forget this conversation** — destructive. Deletes the session's entries and its row, then starts fresh. Native confirm because the act is irreversible.

Design choices captured in the [plan](../project/roadmap/cv1-depth/cv1-e3-memory/cv1-e3-s4-reset-conversation/plan.md): rail-footer placement (action on attention belongs next to attention), progressive disclosure (primary button for the common case, small italic link for the destructive one), mirror-voiced copy (*Begin again* / *Forget this conversation* rather than *Reset* / *Delete*).

Title generation runs asynchronously — the HTTP redirect doesn't wait for it. If the API errors or times out, the session stays with `title = NULL` and a single log line records the failure; the user never waits on a title. Pattern established here becomes the template for future background LLM tasks (compaction, semantic memory extraction). See [decisions.md](../project/decisions.md#2026-04-18--session-titles-via-a-fire-and-forget-cheap-model-role).

Known incomplete: no UI surfaces the preserved sessions yet. The Episodic memory surface on the CV0.E2 radar is where browsing lands, likely alongside CV1.E3's semantic memory work (S3). S4's preservation is the foundation for that future surface.

Coverage: 3 new web tests (begin-again creates + preserves, forget deletes cleanly, rail renders both actions). Total **126 passing**.

Docs: [index](../project/roadmap/cv1-depth/cv1-e3-memory/cv1-e3-s4-reset-conversation/) · [plan](../project/roadmap/cv1-depth/cv1-e3-memory/cv1-e3-s4-reset-conversation/plan.md) · [test guide](../project/roadmap/cv1-depth/cv1-e3-memory/cv1-e3-s4-reset-conversation/test-guide.md). The CV1.E3 epic folder was created as part of this story — S4 is the first story to land in the Memory epic.

### 2026-04-18 — v0.5.0 The Mirror Shows Itself

CV0.E2 closed and bundled as [v0.5.0](../releases/v0.5.0.md). The epic grew a Cognitive Map, a Context Rail, role-aware identity, self-service editing, and empty-state invitations — four stories that together turned an opaque mirror into one that can show itself to the user it reflects. Tag pushed. 17 commits landed on origin across the release window.

### 2026-04-18 — S10 Empty states as invitations ✅

Every structural card on the Cognitive Map now speaks when empty. Instead of a blank body or a terse "no content" line, each card renders a paragraph that answers two questions: *what is this layer?* and *what do I do with it?* The Skills card's two-tier invitation from S8 was the prototype; S10 extends the voice across Self, Ego·Identity, Ego·Behavior, and a new invitation on the Personas card (which previously rendered an empty badge grid with only the `+ add persona` button).

**Design tension surfaced and resolved during the story:** new users didn't see any of these invitations because `POST /admin/users` and the admin CLI were seeding self/soul, ego/identity, and ego/behavior from template files — so every fresh user landed on a pre-populated map. Worse, the `soul.md` template carried parenthetical placeholders *inside the content* (`(Describe the mirror's primary function for you.)`), an invitation-in-disguise that was easy to miss and gave the user a generic identity that wasn't theirs.

**Decision:** stop seeding `self/soul` and `ego/identity`. Keep seeding `ego/behavior` — it's the operational baseline (tone, constraints) the mirror needs to respond sensibly on turn one. Self and identity are the most personal layers; the user should declare them, not inherit them. Obsolete `soul.md` and `identity.md` templates deleted from `server/templates/`.

Docs: [index](../project/roadmap/cv0-foundation/cv0-e2-web-experience/cv0-e2-s10-empty-invitations/) · [plan](../project/roadmap/cv0-foundation/cv0-e2-web-experience/cv0-e2-s10-empty-invitations/plan.md) · [test guide](../project/roadmap/cv0-foundation/cv0-e2-web-experience/cv0-e2-s10-empty-invitations/test-guide.md).

2 new tests + 1 smoke test updated; total suite at **123 passing**.

### 2026-04-18 — S8 Cognitive Map ✅

The `/map` surface ships. The mirror's structure — self, ego, personas, skills — becomes a workspace of cards with per-layer depth encoded vertically and layer identity encoded by color. Memory sits perpendicular on the right, shortcutting to the rail (attention), future episodic browse, and future long-term memory surfaces.

Design pivots registered as decisions:
- **Cognitive Map ≠ Memory.** The structure the mirror *is* vs the memory the mirror *carries*, separated in name and surface so future layers (shadow, meta-self) and future memory surfaces (episodic, semantic) have honest homes. "Extensions" renamed to "Skills" throughout.
- **Identity Workshop page per layer.** Clicking a card navigates to `/map/:layer/:key` — a focused page with a large editor and a composed prompt preview that updates live as the user types (debounced, no LLM call). Honors the weight of identity configuration; opens the door to the test-chat follow-up story.
- **Personas as single card with badges.** The one deliberate exception to workshop-per-layer. 13+ personas would flatten the map's structural hierarchy; one card with a badge grid respects scan-frequency and edit-frequency asymmetry.
- **Identity layers ordered by psychic depth** (`self` → `ego` → `persona`), not alphabetically. Surfacing the composed prompt exposed the old order; fixing it at the SQL source lets every consumer inherit the correct narrative.
- **Memory as lateral column**, not a row below skills. Perpendicular placement spatially encodes that memory traverses every psychic layer rather than following them — also rhymes with the rail's right-side position on `/mirror`.
- **Pastel per-layer palette**, replacing the originally planned warm single-hue gradient. Vertical position carries depth; color now carries layer identity (lavender/peach/rose/sage + neutral gray for memory).

Work shipped across nine phases:
- Shell + layout + gradient + memory column
- Dashboard + Self/Ego workshop pages with live preview
- Personas card with badges and inline editor
- Skills card invitation
- Memory card with real session stats
- Self-service name edit on the identity strip
- Admin modality (`/map/:name/...` with per-route admin guard)
- Legacy `/admin/users/:name` redirects + UserProfilePage removed (198 lines deleted)
- 24 new tests, total suite at 121 passing

Review pass produced additional small edits:
- `memory-taxonomy.md` charnière paragraph tightened (removed narrative reference to an earlier draft)
- Epic index and top-level roadmap marked S8 ✅ with link + updated goal statement
- `plan.md` reconciled with reality: D2/D3 moved from "Open" to "Confirmed", files list updated to what actually shipped, Post-plan additions populated
- Dead props (`saved`, `deleted`, `error`) removed from MapPage and LayerWorkshopPage — no handler ever set them
- `test-guide.md` and `refactoring.md` created (automated + manual guide; applied cleanups + parked items)

Story docs:
- [index](../project/roadmap/cv0-foundation/cv0-e2-web-experience/cv0-e2-s8-cognitive-map/)
- [plan](../project/roadmap/cv0-foundation/cv0-e2-web-experience/cv0-e2-s8-cognitive-map/plan.md)
- [test guide](../project/roadmap/cv0-foundation/cv0-e2-web-experience/cv0-e2-s8-cognitive-map/test-guide.md)
- [refactoring](../project/roadmap/cv0-foundation/cv0-e2-web-experience/cv0-e2-s8-cognitive-map/refactoring.md)

### 2026-04-18 — S7 I know who's logged in ✅ + `/chat` → `/mirror` rename

Sidebar makes identity and authority visible. Two-line change in scope, larger change in ergonomics: the mirror now has real roles, not just accounts. During the visual pass, the primary route was also renamed from `/chat` to `/mirror` (see [decisions.md](../project/decisions.md#2026-04-18--primary-route-renamed-from-chat-to-mirror)) — the page is a mirror that contains a chat, not a chat that happens to have a rail.

- **Schema + migration** ([`server/db.ts`](../../server/db.ts)): `users.role` column (`'admin' | 'user'`, default `'user'`). `migrate()` runs after schema bootstrap — adds the column to pre-existing tables via `ALTER TABLE` and retroactively promotes the oldest user to admin when none exists. Keeps existing installations functional after `git pull` without SQL.
- **First-admin seeding** ([`server/db/users.ts`](../../server/db/users.ts)): `createUser` defaults the role based on whether the table is empty (first user → admin) and accepts an explicit override for subsequent creations.
- **Admin guard** ([`adapters/web/auth.ts`](../../adapters/web/auth.ts)): new `adminOnlyMiddleware` returns `403 Forbidden` (not a redirect — permission boundary stays honest). Applied by mounting a sub-app at `/admin/*` in [`adapters/web/index.tsx`](../../adapters/web/index.tsx).
- **Sidebar role-aware** ([`adapters/web/pages/layout.tsx`](../../adapters/web/pages/layout.tsx)): `Layout` now takes `user` as a required prop, renders an avatar (initials + color, reusing the rail helpers) + name in the footer above Logout, and hides the Admin section when the user isn't an admin.
- **Create form** ([`adapters/web/pages/admin/users.tsx`](../../adapters/web/pages/admin/users.tsx)): `is_admin` checkbox + a Role column in the users table. The POST handler threads role into `createUser`.
- **Dead code removed**: `adapters/web/pages/admin/personas.tsx` and `identity.tsx` were orphans since the unified profile landed; deleted in the same ripple.
- **Route rename**: `/chat` → `/mirror` (menu label and route), `/chat/stream` → `/mirror/stream`. `/chat` kept as a redirect for backward compatibility. Page component renamed `ChatPage` → `MirrorPage`, file `chat.tsx` → `mirror.tsx` via `git mv` (history preserved). Internal DOM names (`.chat-shell`, `chat-form`, `chat.js`) kept — they describe the chat affordance within the mirror page.
- **Sidebar polish**: user card moved from footer to top (below brand), with a border separator below it. Logout stays alone in the footer. Identity at the top, actions at the bottom.
- **Coverage**: 4 new DB tests + 10 new web tests (9 role-related + 1 redirect) — `95 passing` total.
- **Story docs**: [index](../project/roadmap/cv0-foundation/cv0-e2-web-experience/cv0-e2-s7-auth-roles/) · [plan](../project/roadmap/cv0-foundation/cv0-e2-web-experience/cv0-e2-s7-auth-roles/plan.md) · [test guide](../project/roadmap/cv0-foundation/cv0-e2-web-experience/cv0-e2-s7-auth-roles/test-guide.md).

### 2026-04-17 — S9 Context Rail ✅

Right-side panel on the chat page that shows Attention Memory made visible. Implementation + validation + review pass completed in one session.

- Server helpers: [`session-stats.ts`](../../server/session-stats.ts) approximates tokens and derives BRL cost; [`composed-snapshot.ts`](../../server/composed-snapshot.ts) lists layers + persona that entered the prompt; [`personas.ts`](../../server/personas.ts) holds the shared descriptor extractor used by reception and the rail.
- Web adapter: [`context-rail.tsx`](../../adapters/web/pages/context-rail.tsx) is the component; the SSE `/chat/stream` done event ships a full `rail` payload on every turn.
- Tests: [`tests/session-stats.test.ts`](../../tests/session-stats.test.ts) (6 unit tests) + 5 rail route tests appended to `tests/web.test.ts`. 79 passing total.
- Story docs: [plan](../project/roadmap/cv0-foundation/cv0-e2-web-experience/cv0-e2-s9-context-rail/plan.md) · [test guide](../project/roadmap/cv0-foundation/cv0-e2-web-experience/cv0-e2-s9-context-rail/test-guide.md) · [refactoring log](../project/roadmap/cv0-foundation/cv0-e2-web-experience/cv0-e2-s9-context-rail/refactoring.md).
- Process update: the development guide now describes the **Review pass** (step 5) as an explicit story lifecycle phase, with order, rhythm, and heuristics drawn from this session.

Follow-up task registered: split `adapters/web/index.tsx` into route modules (chat, admin, rail) when capacity allows.

### 2026-04-17 — CV0.E2 scope expanded + memory taxonomy adopted

Design session with the product-designer persona. Outcomes:

- **Reframed CV0.E2.** The web client is not a chat + admin page — it's the surface where the mirror's memory becomes legible. Two complementary surfaces: the rail (live Attention) and the Memory Workspace (durable memory).
- **Queued three new stories:** S9 Context Rail (attention memory visible), S8 Memory Workspace (cards per layer), S10 Empty states as invitations. S9 ordered before S8 so the rail teaches what signals matter.
- **Adopted a two-axis memory taxonomy** in [`docs/product/memory-taxonomy.md`](../product/memory-taxonomy.md). Seven cognitive roles (Attention, Identity, Episodic, Procedural, Semantic, Prospective, Reflexive) × six storage mechanisms (Identity layers, Episodic entries, Records, Attachments, Semantic index, KV). Cognitive axis credited to a conceptual conversation with Henrique Bastos.
- **Key decisions logged** (see [decisions.md](../project/decisions.md)): rail reflects composition not reception decisions; no soul/ego summary always visible; activity trail per-message discarded; KV scope strictly limited to pointers and ephemeral state.
- **Radar updated:** reception as multi-signal router, Prospective memory epic for CV3.

No code changed this session — docs and direction only.

### 2026-04-16 — Web Experience (CV0.E2) ✅

- [x] S3: Web client moved to adapters/web/ — server/index.tsx down to ~120 lines
- [x] S4: Sidebar navigation — fixed sidebar, mobile hamburger, login excluded
- [x] S5: Chat visual identity — warm cream background, persona badges, markdown rendering
- [x] S6: Web route tests — 13 tests via app.request(), 68 total

## Done

### 2026-04-16 — v0.3.2 — Unified user profile ✅

- [x] Base identity + personas on one page with collapsible cards
- [x] Old identity/personas routes redirect to unified profile

### 2026-04-16 — v0.3.1 — Polish and Clarity ✅

- [x] Admin personas page (later unified into v0.3.2)
- [x] Release notes navigation (prev/next)
- [x] Prompt composition reference — architecture docs + 3 example prompts

### 2026-04-15–16 — v0.3.0 — Adapter Awareness (CV1.E2) ✅

- [x] `config/adapters.json` — per-channel prompt instructions
- [x] `server/formatters.ts` — Telegram MarkdownV2 with 3-tier fallback
- [x] Adapter flows through all endpoints
- [x] 55 tests passing

### 2026-04-14–15 — v0.2.0 — Personas (CV1.E1) ✅

- [x] `config/models.json` — centralized model config with `purpose` field
- [x] `server/reception.ts` — LLM classifier, 5s timeout, graceful fallback
- [x] Persona routing wired into all endpoints + chat UI
- [x] `identity import --from-poc` extended to include personas
- [x] Telegram webhook async fix (infinite reply loop)
- [x] Release process: CHANGELOG, git tags, release notes

### 2026-04-13 — v0.1.0 — Tracer Bullet (CV0.E1) ✅

- [x] Server (hono, auth, identity composition, Agent per request)
- [x] DB schema (users, identity layers, sessions, entries, telegram_users)
- [x] Admin CLI (user add/reset, identity set/list/import, telegram link)
- [x] Deploy (VPS, systemd, nginx, HTTPS)
- [x] CLI client (adapters/cli/)
- [x] Web UI (login, chat with SSE streaming, admin)
- [x] Telegram adapter (grammy webhook)
- [x] Docs wiki (roadmap, principles, decisions, story docs, getting-started)
