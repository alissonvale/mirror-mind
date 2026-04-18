[< Docs](../index.md)

# Worklog

What was done, what's next. Updated each session.

Current focus: **[CV0.E2 — Web Experience](../project/roadmap/cv0-foundation/cv0-e2-web-experience/)** `v0.4.0` → `v0.5.0`

---

## Next

v0.5.0 shipped. CV1.E3.S4 shipped in the session after the release. Next in the agreed sequence: CV0.E3.S3 (docs reader inside the app), then CV0.E3.S1 (admin customizes models via browser). After both of those, a v0.6.0 bundle with S4 + S3 + S1 together — or a pair of smaller patch releases if they come in staggered.

## Done

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
