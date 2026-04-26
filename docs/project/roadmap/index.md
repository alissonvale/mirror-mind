[< Docs](../../index.md)

# Roadmap — Mirror Mind

> Where the system is headed. Previous phases (Python) are at the bottom.
> Updated 13/Apr/2026 (reconstruction on pi started, first deliverable defined).

---

## Problem

The mirror is the primary personal intelligence asset for its users. But in its current form (Python, CLI, coupled to Claude Code) it is single-user, single-device, and requires a terminal session. Anyone who wants to use it must install the full environment. Family and friends can't use it. Conversations don't travel across devices.

The reconstruction fixes this: the mirror becomes a server accessible from any device, any time, by any authorized person — each with their own voice, their own history, their own privacy.

## Community Value

Each delivery must generate concrete value for the mirror's user community. Value types:

| Type | Definition |
|------|-----------|
| **Autonomy** | Each person has their own mirror, with their own voice and context |
| **Continuity** | Conversations persist and accumulate context over time |
| **Accessibility** | The mirror is available from any device, any time |
| **Depth** | The mirror understands more, remembers more, and connects more dots |

### Hierarchy

| Level | Name | What it is |
|-------|------|-----------|
| **CV** | Community Value | A stage of delivery with clear user value |
| **E** | Epic | A cohesive block of work with done criteria |
| **S** | Story | An atomic delivery from the user's perspective |

---

## Where we are

Python mirror functional with 13 personas, RAG memory, skills, journeys, economy (Stages 0–0.6 complete). Technical spike performed 11–12/Apr with 8 experiments on the pi framework. Group session validated the path. First deliverable defined: server on VPS with real identity + CLI + Telegram.

**New mirror stack:** TypeScript, pi-ai + pi-agent-core, hono, SQLite, grammy (Telegram).

**Key decisions:** pi as foundation, client-server from day 1, relational DB inspired by SessionManager, greenfield, identity in the database, bearer token auth, English as internal language, strangler fig (Python continues in parallel). Full rationale in [briefing.md](briefing.md).

---

## CV0 — Foundation `autonomy` + `continuity` ← CURRENT FOCUS

> The mirror exists as a server, persists conversations, authenticates users, and accepts remote clients. Each person has their own identity and privacy.

### CV0.E1 — Tracer Bullet ✅ `v0.1.0`

> **Status:** Complete. ✅
> **Done criteria:** send a message from the CLI on a laptop, continue the conversation from Telegram on a phone, the mirror maintains the continuous thread with the real voice.
> **Full spec:** [tracer-bullet.md](cv0-foundation/cv0-e1-tracer-bullet/)

| Code | Story | Description |
|------|-------|-------------|
| [`CV0.E1.S1`](cv0-foundation/cv0-e1-tracer-bullet/cv0-e1-s1-db-identity/) | **The mirror has my real voice** ✅ | Identity layers in the database, imported from POC |
| [`CV0.E1.S2`](cv0-foundation/cv0-e1-tracer-bullet/cv0-e1-s2-server/) | **The server responds with my voice** ✅ | HTTP server with auth, identity composition, and Agent per request |
| [`CV0.E1.S3`](cv0-foundation/cv0-e1-tracer-bullet/cv0-e1-s3-deploy/) | **The server runs 24/7 in the cloud** ✅ | VPS, nginx (Docker), systemd, HTTPS via Cloudflare |
| [`CV0.E1.S4`](cv0-foundation/cv0-e1-tracer-bullet/cv0-e1-s4-cli/) | **I can chat from any machine's terminal** ✅ | CLI pointing to server, config at ~/.mirror/ |
| [`CV0.E1.S5`](cv0-foundation/cv0-e1-tracer-bullet/cv0-e1-s5-web/) | **I can chat and manage from a browser** ✅ | Web UI served from hono — chat + admin (users, identity), SSE streaming |
| [`CV0.E1.S6`](cv0-foundation/cv0-e1-tracer-bullet/cv0-e1-s6-telegram/) | **I can chat from Telegram on my phone** ✅ | Telegram bot as thin adapter over the server |

### [CV0.E2 — Web Experience](cv0-foundation/cv0-e2-web-experience/) `v0.4.0` → `v0.5.0`

> **Status:** S1–S6 done (v0.4.0). S7, S8, S9, S10 done (pending release). Epic closed — ready for v0.5.0 bundle.
> **Goal:** the web client is the surface where the mirror becomes **legible** — both its structure (the Cognitive Map: who it is) and its memory (the rail's live attention, plus future episodic surfaces). Not a chat + admin page, but a workspace where the user sees, edits, and senses both the psyche that shapes responses and the traces that accumulate through use.

| Code | Story | Description |
|------|-------|-------------|
| [`CV0.E2.S1`](cv0-foundation/cv0-e2-web-experience/cv0-e2-s1-basic-web/) | **Login + Chat + Admin** ✅ | Basic web UI (done as CV0.E1.S5) |
| [`CV0.E2.S2`](cv0-foundation/cv0-e2-web-experience/cv0-e2-s2-unified-profile/) | **Unified user profile** ✅ | Identity + personas on one page with collapsible cards (v0.3.2) |
| [`CV0.E2.S3`](cv0-foundation/cv0-e2-web-experience/cv0-e2-s3-web-refactor/) | **Move web client to adapters/web/** ✅ | Refactor: consolidate web pages, routes, assets, and auth under adapters/web/ |
| [`CV0.E2.S4`](cv0-foundation/cv0-e2-web-experience/cv0-e2-s4-sidebar/) | **Sidebar navigation** ✅ | Replace top nav with fixed sidebar (Mirror, Admin, Logout) |
| [`CV0.E2.S5`](cv0-foundation/cv0-e2-web-experience/cv0-e2-s5-chat-visual/) | **Chat with visual identity** ✅ | Warm background, persona badge, distinctive assistant bubbles |
| [`CV0.E2.S6`](cv0-foundation/cv0-e2-web-experience/cv0-e2-s6-web-tests/) | **Web route tests** ✅ | Hono app.request() tests for login, auth, admin (13 tests) |
| [`CV0.E2.S7`](cv0-foundation/cv0-e2-web-experience/cv0-e2-s7-auth-roles/) | **I know who's logged in** ✅ | User name + avatar in sidebar. Admin role sees Users; regular users don't; `/admin/*` returns 403 to non-admins |
| [`CV0.E2.S9`](cv0-foundation/cv0-e2-web-experience/cv0-e2-s9-context-rail/) | **Context Rail — attention memory visible** ✅ | Right-side panel: active persona, session stats (messages, tokens, cost, model), composed context. Collapsible, persisted per user. |
| [`CV0.E2.S8`](cv0-foundation/cv0-e2-web-experience/cv0-e2-s8-cognitive-map/) | **Cognitive Map** — `/map` with a card per psyche layer ✅ | The psyche's architecture made visible and editable: self (soul), ego, personas, skills. Each layer is a card; empty cards (skills, future shadow/meta-self) show invitations rather than blanks. Replaces the unified profile and absorbs self-service edits it doesn't cover today, including changing one's own display name. Structure, not memory — the mirror carries memory *through* the map, not *as* the map |
| [`CV0.E2.S10`](cv0-foundation/cv0-e2-web-experience/cv0-e2-s10-empty-invitations/) | **Empty states as invitations** ✅ | Every empty structural card on the Cognitive Map shows a conceptual paragraph (*what is this layer, what do I do with it*) instead of a blank body. User creation no longer seeds self/soul or ego/identity — those layers stay empty so their invitations appear on the new user's first visit |

S9 is ordered before S8: the rail is smaller, visible on every chat screen, and teaches what signals matter before designing the full workspace.

### [CV0.E3 — Admin Workspace](cv0-foundation/cv0-e3-admin-workspace/)

> **Goal:** the admin sees the state of this mirror and operates it from the browser. Two functions on the same workspace — *seeing* (a dashboard that summarizes users, cost, activity, release, memory, system) and *acting* (user management, model config, adapter config, docs reading). Symmetric with the Cognitive Map: the map lets the mirror show itself to the user, the workspace lets this mirror show itself to the admin.

| Code | Story | Description |
|------|-------|-------------|
| [`CV0.E3.S3`](cv0-foundation/cv0-e3-admin-workspace/cv0-e3-s3-docs-reader/) | **I can read the mirror's documentation inside the mirror** ✅ | A `/docs` surface that navigates and renders the `docs/` tree — sidebar mirrors folder structure via `index.md` files, relative markdown links rewrite to in-app routes, nav collapses by default for focused reading. **Admin-only** in v1; a user manual for regular users is a future story |
| [`CV0.E3.S4`](cv0-foundation/cv0-e3-admin-workspace/cv0-e3-s4-admin-dashboard/) | **Admin landing dashboard** ✅ | `/admin` becomes a glance surface with cards: Users (count + active last 7d), Cost (approximate, based on the Rail's estimation method), Activity (sessions created today/this week), Latest release (headline + link), Mirror memory (total identity layers), System (uptime, DB size). Each card optionally drills down. No auto-refresh — manual reload is fine at this stage |
| [`CV0.E3.S5`](cv0-foundation/cv0-e3-admin-workspace/cv0-e3-s5-user-management/) | **User management with delete and role toggle** ✅ | `/admin/users` gains destructive delete (cascade on sessions + entries + identity + telegram links, admin can't delete themselves), inline role toggle between admin and user (self-proof). Absorbs frustration the admin felt today — created users piled up with no way to remove them |
| [`CV0.E3.S1`](cv0-foundation/cv0-e3-admin-workspace/cv0-e3-s1-admin-models/) | **Admin customizes models via the browser** ✅ | Models live in a new DB table seeded from `config/models.json`. Admin UI at `/admin/models` edits provider, model ID, prices, timeout, purpose per role (main, reception, title). Save takes effect on the next request; revert per row reloads the JSON default. Dashboard gets a Models card reflecting the live config |
| [`CV0.E3.S8`](cv0-foundation/cv0-e3-admin-workspace/cv0-e3-s8-oauth-subscriptions/) | **OAuth credentials for subscription-backed providers** ✅ | Extends `/admin/models` with support for pi-ai's five OAuth providers (Anthropic Claude Pro/Max, OpenAI Codex, GitHub Copilot, Google Cloud Code Assist, Antigravity). New `oauth_credentials` table + admin UI at `/admin/oauth` for paste-from-laptop credential upload. Models table gains `auth_type` column. Runtime resolves API keys through `getOAuthApiKey()` with auto-refresh. Primary target: Google Code Assist free tier for reception — drops reception cost to zero in personal/family use. Derived from [spike 2026-04-21](spikes/spike-2026-04-21-subscription-oauth.md) |
| [`CV0.E3.S9`](cv0-foundation/cv0-e3-admin-workspace/cv0-e3-s9-import-conversation/) | **Import conversation history from markdown** ✅ | Admin CLI command that imports prior conversations (from Gemini, ChatGPT, Claude, custom logs) as new sessions tagged with persona and optional org/journey. Each markdown file becomes one session; alternating `**User:**` / `**Assistant:**` blocks become entries. Canonical format documented in [conversation-markdown-format.md](../../product/conversation-markdown-format.md); per-source variations normalize at the source via tools like `sed`. Strangler-fig enabler — accumulated context from other tools doesn't have to evaporate when the user moves to the mirror |
| `CV0.E3.S2` | **Admin customizes adapters via the browser** | Same shape as S1, applied to `config/adapters.json`. Per-adapter prompt instructions editable from the admin page |

**Ordering rationale:** S3 shipped first because the frustration was concrete and the fix was cheap. S4 is next — it creates the anchor surface everything else hangs off, and its cost visibility contextualizes the model tuning in S1. S5 absorbs a felt pain (delete). S1 rides on S4's cost context. S8 unlocked subscription-backed model access (shipped 2026-04-21). S9 is the next priority — it bridges the strangler fig by letting users bring accumulated conversation context from prior tools into the mirror, removing the cold-start cost of migration. S2 continues queued after S9.

### [CV0.E4 — Home & Navigation](cv0-foundation/cv0-e4-home-navigation/)

> **Goal:** the logged-in user has a **home** — a landing that answers *where is the mirror right now?* before dropping into chat. Reduces the navigation surface as a second-order effect once the home is stable.

| Code | Story | Description |
|------|-------|-------------|
| [`CV0.E4.S1`](cv0-foundation/cv0-e4-home-navigation/cv0-e4-s1-landing-home/) | **Landing home** ✅ | New authenticated route `/` with greeting, *State of the mirror* (admin-only glance), *Latest from the mirror* (release digest), and *Continue* (active session + up to 3 earlier threads). Login redirects here instead of `/mirror`. All 11 existing release files get a `digest:` frontmatter field |
| [`CV0.E4.S2`](cv0-foundation/cv0-e4-home-navigation/cv0-e4-s2-sidebar-shortcuts/) | **Sidebar pruning + admin shortcuts** ✅ | Sidebar's `This Mirror` section + six sub-links collapse into a single `Admin Workspace` link. `/admin` dashboard becomes the navigation hub with shortcut cards for all five admin surfaces (Users, Budget, Models, OAuth, Docs). Stale "Cost" card replaced by a real-data Budget card |
| [`CV0.E4.S3`](cv0-foundation/cv0-e4-home-navigation/cv0-e4-s3-three-questions-sidebar/) | **Sidebar organized by the three questions** ✅ | Context links restructure into three labeled sections: *Who Am I* (Psyche Map), *What I'm Doing* (Journeys), *Where I Work* (Organizations). Psyche Map (renamed from Cognitive Map) promoted to a first-class link; Conversation stays as the top primary action |
| [`CV0.E4.S4`](cv0-foundation/cv0-e4-home-navigation/cv0-e4-s4-about-you/) | **About You page** ✅ | New `/me` route absorbs clerical concerns — name editing, display preferences, light self-portrait stats, data export placeholder. Clicking the avatar now opens this page instead of the Psyche Map; the "operational you" is now separate from the "structural you" |
| [`CV0.E4.S5`](cv0-foundation/cv0-e4-home-navigation/cv0-e4-s5-url-alignment/) | **URL alignment: `/mirror` → `/conversation`** ✅ | The chat surface's URL renames to match the sidebar label. `/mirror` and `/chat` redirect to `/conversation` as legacy entrypoints |
| [`CV0.E4.S6`](cv0-foundation/cv0-e4-home-navigation/cv0-e4-s6-single-currency/) | **Single-currency cost display** ✅ | Cost surfaces go from dual-currency (USD + BRL side by side) to single-currency driven by `/me` preferences. `users.show_brl_conversion` column reinterpreted from "show BRL alongside" to "prefer BRL over USD"; no migration |
| [`CV0.E4.S7`](cv0-foundation/cv0-e4-home-navigation/cv0-e4-s7-scope-last-conversation/) | **Last conversation per scope** ✅ | Organization and journey list pages pair each scope card with a "Last conversation" readout — title + relative time of the most recent session tagged with that scope. Zero schema change; reads `_organization` / `_journey` meta already written on assistant messages |
| [`CV0.E4.S8`](cv0-foundation/cv0-e4-home-navigation/cv0-e4-s8-curated-continue/) | **Continue surface becomes curated** | The home's *Continue* band evolves from "active session + 3 most recent" into a curated surface where the mirror chooses what to surface and *why* — recently active, dormant with open thread, scope under-visited, etc. Replaces chronology with intention. Reopens the epic with one extension story |

---

## CV1 — Depth `depth` + `continuity` + `context intelligence`

> The mirror understands more than the current conversation text. It has memory, journey context, and personas. Every piece of context earns its place in the prompt — selective, not exhaustive.

### [CV1.E1 — Personas](cv1-depth/cv1-e1-personas/) ✅ `v0.2.0`

| Code | Story | Description |
|------|-------|-------------|
| [`CV1.E1.S1`](cv1-depth/cv1-e1-personas/cv1-e1-s1-persona-routing/) | **The mirror responds with the right voice for context** ✅ | Automatic persona routing based on the message |
| [`CV1.E1.S2`](cv1-depth/cv1-e1-personas/cv1-e1-s2-admin-personas/) | **I can manage personas from the browser** ✅ | Dedicated admin page for viewing, editing, and adding personas per user |


### [CV1.E2 — Adapter Awareness](cv1-depth/cv1-e2-adapter-awareness/) ✅ `v0.3.0`

| Code | Story | Description |
|------|-------|-------------|
| [`CV1.E2.S1`](cv1-depth/cv1-e2-adapter-awareness/cv1-e2-s1-adapter-prompts/) | **The mirror knows which channel it's talking on** ✅ | Adapter context injected into prompt — Telegram gets short/conversational, Web gets depth |
| [`CV1.E2.S2`](cv1-depth/cv1-e2-adapter-awareness/cv1-e2-s2-formatters/) | **The output fits the channel** ✅ | Formatter per adapter — markdown converted to Telegram MarkdownV2, Web HTML, CLI plain text |

### [CV1.E3 — Memory](cv1-depth/cv1-e3-memory/)

| Code | Story | Description |
|------|-------|-------------|
| [`CV1.E3.S4`](cv1-depth/cv1-e3-memory/cv1-e3-s4-reset-conversation/) | **I can reset my conversation** ✅ | Manual session control: **Begin again** creates a fresh session and preserves the old one in the DB (future episodic browse will surface it); **Forget this conversation** destroys entries + session row. Title generation runs fire-and-forget on Begin again via a new cheap `title` model role, so preserved sessions are labeled for future browsing |
| `CV1.E3.S1` | **The mirror knows when the subject changed** | Reception detects topic shifts using recent history; silently creates new session when context switches |
| `CV1.E3.S2` | **Long conversations don't lose context** | Automatic compaction (summary of old history) |
| `CV1.E3.S3` | **The mirror remembers what matters across conversations** | Long-term memory — extraction, embeddings, semantic search |

S4 is ordered before S1: manual boundary setting comes before automatic detection. Giving the user the reset affordance first teaches both the system and the user what a "session boundary" means; S1 then calibrates an automatic version of the same act.

### [CV1.E4 — Journey Map](cv1-depth/cv1-e4-journey-map/)

> **Conceptual foundation:** [Journey Map](../../product/journey-map.md) — situational surface peer to the Cognitive Map. Neither an organization nor a journey is a psychic layer; both are **scopes over memory**, with organization as the broader scope that may contain journeys. Each story lights up one cell of the cognitive role × scope matrix. Tasks are deferred to a future agentic epic; CV1.E4 stays in the prompt/chat paradigm.

| Code | Story | Scopes |
|------|-------|--------|
| [`CV1.E4.S1`](cv1-depth/cv1-e4-journey-map/cv1-e4-s1-scopes-identity-routing/) | **Scope identity + routing** ✅ | Identity + Reflexive — both scopes ship with symmetric `briefing` + `situation` fields. `organizations` and `journeys` tables; `journey.organization_id` nullable FK. `/organizations` + `/journeys` surfaces. Reception returns `{persona, organization, journey}`. Composer injects `soul → identity → persona → organization → journey → behavior → expression → adapter` |
| [`CV1.E4.S4`](cv1-depth/cv1-e4-journey-map/cv1-e4-s4-manual-scope-tagging/) | **Manual session scope tagging** ✅ | N:N session↔personas, N:N session↔orgs, N:N session↔journeys. Hybrid model: session carries a pool, reception filters within, composer injects all tagged scopes, first turn auto-suggests from reception. Context Rail gains a tag editor |
| [`CV1.E4.S5`](cv1-depth/cv1-e4-journey-map/cv1-e4-s5-scope-atelier/) | **Scope page becomes an ateliê** ✅ | `/organizations/<X>` and `/journeys/<X>` evolve from "Last conversation" card into a full workshop showing all sessions tagged to the scope. Anti-pattern to chatbot sidebar — sessions live inside their context, no global flat list. Sessions openable for continuation via `/conversation/<sessionId>` |
| `CV1.E4.S2` | **Documents attached to scope** | Semantic / Attachments — first use of the Attachments mechanism, chunked and indexed per scope (journey or organization) |
| `CV1.E4.S3` | **Filter episodic and semantic memory by scope** | Episodic + Semantic extracts — `journey_id` on sessions; `journey_id` / `organization_id` on extracted memories. Coordinated with [CV1.E3.S3](cv1-depth/cv1-e3-memory/) |

**Ordering rationale:** S1 is the tracer bullet. S4 moved ahead of S2 because the user surfaced that reception can't be guaranteed — manual tagging became the foundation attachments and scoped memory both depend on. **S5 jumped ahead of S2** after S9 (conversation import) revealed that 27 imported sessions have nowhere to be browsed — the dor of "I can't see my sessions" is acute, the fix is small, and the surface design (ateliê per scope) honors structure without copying chatbot sidebars. S2 introduces the Attachments mechanism. S3 closes the loop when semantic extraction exists (CV1.E3.S3).

### CV1.E5 — Identity Architecture

> **Background:** Extracted from the [Identity Lab spike, section 9](spikes/spike-2026-04-18-identity-lab.md#9-follow-up-items-captured-for-the-roadmap). For design rationale and reminders captured during the spike, see [section 8](spikes/spike-2026-04-18-identity-lab.md#8-final-state-decisions-and-reminders).
>
> **Goal:** Add the missing identity memory systems that the spike revealed as needed. The original S1 (Organization layer) was superseded by CV1.E4 — organization is a *scope*, not a layer. See [decisions.md — 2026-04-20](decisions.md#2026-04-20--journey-map-as-a-peer-surface-a-scope-is-not-a-layer).

| Code | Story | Description |
|------|-------|-------------|
| `CV1.E5.S2` | **Per-persona personal context** | New `persona_context` table for per-persona personal data (medica → age, conditions, allergies; tesoureira → balances; etc.). Composer injects active persona's fields. Migration converts placeholders to expected-field definitions. [Spike §9.7](spikes/spike-2026-04-18-identity-lab.md#97-per-persona-personal-context-memory) |
| `CV1.E5.S3` | **Semantic memory (intellectual repertoire)** | New `semantic_memory` table for stable intellectual repertoire (frameworks, authors, concepts). Persona declares broad categories; semantic memory delivers names on demand. Has overlap with CV1.E3 — to be coordinated. [Spike §9.8](spikes/spike-2026-04-18-identity-lab.md#98-semantic-memory-intellectual-repertoire) |

### [CV1.E6 — Memory Map](cv1-depth/cv1-e6-memory-map/)

> **Conceptual foundation:** [Memory Map](../../product/memory-map.md) — fourth peer surface, after the Cognitive Map, Journey Map, and Context Rail. Browses what the mirror carries across time: episodic traces, attached documents, extracted insights, and future memory mechanisms as they land.
>
> **Status:** Activating 2026-04-22. S1 (Conversations browse) lands first, ahead of the Memory Map landing — driven by the CV1.E4.S5 follow-up (scope ateliê needs a "view all (filtered)" destination). Other sections (attachments, insights) land as their underlying mechanisms ship.

| Code | Story | Status |
|------|-------|--------|
| [`CV1.E6.S1`](cv1-depth/cv1-e6-memory-map/cv1-e6-s1-conversations-browse/) | **Conversations browse** — `/conversations` with filters by persona / organization / journey, sorted by recency, paginated. Sidebar entry alongside `Conversation` (singular continues to drop into the active session). First cross-scope view of episodic memory | ✅ Done |
| `CV1.E6.S2` | **Attachments library view** — browse all user's attached docs + URLs, with scope associations visible | draft |
| `CV1.E6.S4` | **Insights browse** — extracted facts, semantic search, source links | draft |
| `CV1.E6.S5` | **Global search across sections** | draft |
| `CV1.E6.S6` | **Export / data sovereignty** | draft |
| `CV1.E6.S7` *(was S1)* | **Memory Map landing** — `/memory` with one card per live mechanism, ties sections together | future |

Detailed placement in [CV1.E6 epic index](cv1-depth/cv1-e6-memory-map/). Stories beyond S1 will be re-planned when approached.

### [CV1.E7 — Response Intelligence](cv1-depth/cv1-e7-response-intelligence/)

> **Premise:** *"Every token in the prompt must earn its place"* ([briefing #5](briefing.md)).
> **Goal:** move intelligence out of the mega-prompt and into a pipeline of small, purposeful steps. Identity layers stop being concatenated wholesale and start being activated conditionally; form (expression) separates from substance; retrieval becomes a named step. Reception (CV1.E1) was the first pass; this epic makes the pattern first-class.

| Code | Story | Status |
|------|-------|--------|
| [`CV1.E7.S1`](cv1-depth/cv1-e7-response-intelligence/cv1-e7-s1-expression-pass/) | **Expression as a post-generation pass** — `ego/expression` leaves the main prompt and becomes input to a dedicated LLM call that shapes the draft. Mode (conversational / compositional / essayistic) auto-detected by reception, overridable from the Context Rail | ✅ Done |
| [`CV1.E7.S2`](cv1-depth/cv1-e7-response-intelligence/cv1-e7-s2-conversation-header/) | **Conversation header + slim rail (cast-as-ensemble scaffolding)** — compact header above the chat (cast of personas, scope pills, mode, menu); rail slims to two disclosures; bubble gains a persona signature on change. Forward-compatible with multi-persona turns | ✅ Done |
| [`CV1.E7.S3`](cv1-depth/cv1-e7-response-intelligence/cv1-e7-s3-conditional-scope/) | **Conditional scope activation** — orgs and journeys compose only when reception activates them this turn. Session tags constrain reception's candidate pool, not composition | ✅ Done |
| [`CV1.E7.S4`](cv1-depth/cv1-e7-response-intelligence/cv1-e7-s4-conditional-identity/) | **Conditional identity layers** — soul / identity compose only when reception flags the turn as touching identity / purpose / values. New `touches_identity` boolean axis with identity-conservative defaults | ✅ Done |
| [`CV1.E7.S5`](cv1-depth/cv1-e7-response-intelligence/cv1-e7-s5-multi-persona/) | **Multi-persona per turn (integrated voicing)** — reception returns `personas: string[]`; composer merges under a "one voice, multiple lenses" instruction; bubble signature handles set transitions. Segmented voicing parked for S5b follow-up | ✅ Done |
| `CV1.E7.S6` | **Semantic retrieval before composition** — attaches to CV1.E3.S3 and CV1.E4.S2 | draft |
| `CV1.E7.S7` | **Pipeline generalization** — abstract into named stages after 4–5 concrete steps exist | draft |
| `CV1.E7.S8` | **Out-of-pool suggestion via the rail** — reception flags would-have-picked candidates; rail offers non-modal "Hear `tecnica` on this?" / "Add `vida-economica` context?"; click triggers one-turn divergent response inline, no pool change | draft |
| `CV1.E7.S9` | **Per-turn mode visibility** — `_mode` + `_mode_source` stamped on assistant entry meta; bubble glyph (☰ comp / ¶ essay; silent default for conversational); `mode:` row in `Look inside` snapshot | ✅ Done |

**Ordering:** S1 is the tracer bullet — cheapest layer to peel off, clearest pain signal. S3–S5 peel layers one at a time. S6 rewires retrieval. S7 is the abstraction payoff, deferred until there's shape to abstract. S8 opens an explicit one-turn door across the pool boundary (inverse of S3's tightening). S9 closes the transparency loop on mode.

**Impact on earlier drafts:**
- **CV1.E4.S2 (Attachments)** re-sequences after CV1.E7.S6 — attachments only deliver value through semantic retrieval.
- **CV1.E4.S3 (Filter memory by scope)** folds into CV1.E7.S3.
- **CV1.E3.S3 (Long-term memory)** couples with CV1.E7.S6.
- **CV0.E4.S8 (Continue curated)** unchanged, independent.

### [CV1.E8 — Pipeline Observability & Evaluation](cv1-depth/cv1-e8-pipeline-observability-eval/)

> **Premise:** Once the pipeline of named steps is in place ([CV1.E7](cv1-depth/cv1-e7-response-intelligence/)), the next move is making it inspectable and comparable. To improve it deliberately, we need to see what each step costs, what each step sends, and how alternative models would have behaved on the same turn.

| Code | Story | Status |
|------|-------|--------|
| `CV1.E8.S1` | **LLM call logging with admin toggle** — every model invocation writes to a log table (model, prompt, response, tokens, cost, latency, session/entry refs); admin toggle to start/stop; admin page to view/export. The recorded prompts are the canonical data for finding optimization points | draft |
| `CV1.E8.S2` | **Per-turn model switching for admin re-runs** — admin re-runs any past turn through a different model; alternative response renders alongside the original; doesn't mutate the canonical conversation. Natural complement to S1 (logs show what happened; re-runs ask "what if the model were different?") | draft |

CV1.E7.S9 (mode visibility) is observability-flavored and a natural sibling — kept in E7 because its framing was *closing the loop on E7's pipeline*; if E8.S1 lands first, S9 may collapse into a special case of the log surface.

---

## CV2 — Accessibility `accessibility` + `autonomy`

> The mirror meets the user where they are. More channels, more ways to interact.

| Code | Story | Description |
|------|-------|-------------|
| `CV2.S1` | **I can chat with the mirror on WhatsApp** | WhatsApp Business API adapter |
| `CV2.S2` | **I have a dedicated web interface** | Web UI for conversations and management |
| `CV2.S3` | **I can speak instead of type** | Audio input (Web Speech API / Whisper) |

---

## CV3 — Intelligence `depth` + `proactivity`

> The mirror does things only a system with historical context can do — and does them without being asked.

| Code | Story | Description |
|------|-------|-------------|
| `CV3.S1` | **The mirror acts before I ask** | Proactive behavior — surfaces insights, tracks commitments, follows up on unresolved threads without waiting for a command |
| `CV3.S2` | **The mirror notices patterns I don't see** | Transversal meta-reading across journeys |
| `CV3.S3` | **The mirror detects tensions and contradictions** | Self — tension analysis between personas/journeys |
| `CV3.S4` | **The mirror keeps my decisions and reasoning** | Structured decision log |

### CV3.E1 — Identity Lab

> **Background:** Extracted from the [Identity Lab spike, sections 7–9](spikes/spike-2026-04-18-identity-lab.md). For design rationale, audience pattern, and reminders for whoever picks this up, see [section 8](spikes/spike-2026-04-18-identity-lab.md#8-final-state-decisions-and-reminders) and [section 7.5 (assisted configuration pattern)](spikes/spike-2026-04-18-identity-lab.md#75-audience-pattern-assisted-configuration).
>
> **Goal:** Give users the ability to design and iterate on their own identity layers. The spike validated the loop manually; this epic turns it into a feature. First-phase audience: advanced users assisting beginners (assisted configuration pattern). Implementation path is evolutionary: minimal MVP first, optional agent later — in line with the Quiet Luxury posture.

| Code | Story | Description |
|------|-------|-------------|
| `CV3.E1.S1` | **Staging layer (current vs draft)** | New `state` column or parallel table for `current` / `draft` identity. Composer accepts mode. UI at `/lab/:layer` with draft editor + integrated simulator. Foundation for the agent. [Spike §9.4](spikes/spike-2026-04-18-identity-lab.md#94-staging-layer-in-the-db-current-vs-draft) |
| `CV3.E1.S2` | **Skills system for persona artifacts** | Separate artifact generation specifications (HTML/SQL templates, Django specs, YAML formats) from persona voice. New `skills` table; agent invokes skills with parameters. Migration extracts specs from escritora and divulgadora. [Spike §9.5](spikes/spike-2026-04-18-identity-lab.md#95-skills-system-for-persona-artifacts) |
| `CV3.E1.S3` | **Identity Lab agent (full version)** | Conversational agent that runs the POC loop automatically: detection phase (cognitive method), interview, propose edits, simulate via staging, iterate until user signals satisfaction. UI at `/lab` with agent chat + live drafts. [Spike §9.9](spikes/spike-2026-04-18-identity-lab.md#99-identity-lab-agent-full-version) |

---

## CV4 — Metacognition `depth` + `proactivity`

> The mirror observes itself — how it responds, where it falls short, what it could do better. Not just memory of what the user said, but awareness of its own performance.

| Code | Story | Description |
|------|-------|-------------|
| `CV4.S1` | **The mirror knows when it's not helping** | Self-assessment of response quality — detects vague, generic, or misaligned answers |
| `CV4.S2` | **The mirror learns what works for each user** | Tracks which approaches land well vs. fall flat, adapts over time |
| `CV4.S3` | **The mirror recognizes its own blind spots** | Shadow applied to itself — topics it avoids, patterns it reinforces, biases in its reasoning |

---

## CV5 — Self-Construction `autonomy` + `depth`

> The mirror programs itself to serve each user's specific needs. The user describes what they want; the mirror builds the capability.

One user needs inventory management. Another needs financial tracking. Another needs a social media workflow. The mirror creates the functions, database tables, and processing logic — all from natural language. Generated code and schemas live in a sandboxed per-user space, strictly isolated from the core (identity, auth, sessions, agent runtime). The core stays stable; each user's mirror grows without limit.

| Code | Story | Description |
|------|-------|-------------|
| `CV5.S1` | **The mirror creates tools on demand** | User describes a need, mirror generates an agent tool (function + schema) and registers it |
| `CV5.S2` | **The mirror manages per-user data** | Sandboxed tables and queries per user — inventory, finances, contacts, whatever the user needs |
| `CV5.S3` | **The mirror composes workflows** | Chains of tools that process, synthesize, and surface information — not just storage, but intelligence over user data |

---

## Radar

| Idea | Description |
|------|-------------|
| **Reception as router** | Reception evolves from `{ persona }` to a multi-signal envelope (`persona`, `organization`, `journey`, `topicShifted`, `attachmentsNeeded`, `semanticQueries`, `skillsActivated`). Each signal maps to a [memory mechanism](../product/memory-taxonomy.md). Organization and journey land with CV1.E4.S1. |
| **Agentic turn — tasks as MVP** | Postponed from CV1.E4 after user research showed unexplored value in the prompt/chat paradigm. When reached: spike on pi-agent-core tool use → tasks table with scope FKs → tools exposed to the agent (list, create, complete) → tool trace in the rail → scope-routing evals extended. Task management chosen as MVP because it is bounded in verbs, visually verifiable, and low-blast-radius. |
| **Proactive triggers** | Time-based and event-based hooks that let the mirror initiate contact (e.g., deadline approaching, pattern detected, commitment unfulfilled). Depends on the agentic turn landing first so tools exist for scheduled jobs to invoke. |
| **Agent tools** | Memory search, journey reading, draft saving as pi-agent-core tools. Rolls into the agentic turn radar entry above. |
| **Client streaming** | SSE on POST /message for real-time tokens (needed for web UI) |
| **Composed identity** | Auto-compose identity from self + ego + persona + journey |
| **CI/CD** | Auto-deploy via git push (currently manual via SSH) |
| **Shadow** | Unconscious pattern detection — biases, avoided topics |
| **Meta-Self** | System governance — audit log, policy engine |

---

## Previous stages (Python mirror)

### Stage 0: Foundation ✅
Ego, Personas, CLI, Persistence, Routing, Artifacts.

### Stage 0.5: Memory ✅
SQLite memory bank, OpenAI embeddings, automatic LLM extraction, hybrid search.

### Stage 0.6: Extensions ✅
Operational skills, journeys, tasks, economy, testimonials, multi-LLM queries, 13 personas.

---

## Spikes

Technical investigations that shaped the path. Each spike is a historical document: once closed, it stops being updated, even when the codebase moves on. Full index at [spikes/](spikes/).

- [Pi as Foundation](spikes/spike-2026-04-12-pi-foundation.md) — 11–12 April 2026. Technical investigation that led to the reconstruction of the mirror on top of `pi-mono`, with eight runnable experiments covering provider abstraction, tool-calling, memory, and personas.
- [Identity Lab](spikes/spike-2026-04-18-identity-lab.md) — 18–19 April 2026. Exploratory POC on closing the feedback loop between editing identity prompts and hearing the resulting voice. Shipped `Lab mode` as a reusable affordance, produced prompt engineering learnings, and left three continuation paths open on the Radar.
- [Subscription-based LLM access via OAuth](spikes/spike-2026-04-21-subscription-oauth.md) — 21 April 2026. Investigation into subscription-backed billing paths and an empirical three-model reception comparison. Found pi-ai supports OAuth against five providers; Gemini 2.5 Flash with `reasoning=minimal` matches Haiku on accuracy at 3× lower cost. Reception default swaps to Flash; OAuth integration queued as CV0.E3.S8.

---

## References

- [Project briefing](briefing.md) — architectural decisions and rationale
- [First deliverable design](cv0-foundation/cv0-e1-tracer-bullet/) — endpoints, schema, deploy spec
- Reference article: ["Making sense of Harness Engineering"](https://www.linkedin.com/pulse/making-sense-harness-engineering-henrique-bastos-ezotf/) (Henrique Bastos)

---

**See also:** [CV0.E1 — Tracer Bullet](cv0-foundation/cv0-e1-tracer-bullet/) (spec for the current deliverable) · [Briefing](briefing.md) (architectural decisions) · [Getting Started](../../getting-started.md) (run it yourself)
