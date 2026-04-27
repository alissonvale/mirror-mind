[< Docs](../index.md)

# Worklog

What was done, what's next. Updated each session.

Current focus: **CV2.E1 Localization — S1, S2 (user-facing), S3, S4 shipped; S2b (admin) and S5 (narrative) deferred** (2026-04-27). Every user-facing surface localizes end-to-end. A Brazilian user picks "Português (Brasil)" in `/me` and the sidebar, login, home, `/me`, `/conversation` (cast + context + mode + menu + Look-inside rail + composed-prompt drawer), `/conversations` browse, `/organizations` (list + workshop + lifecycle), `/journeys` (list + workshop + lifecycle), `/map` (Psyche Map structural cards + persona badges + memory section), `/personas`, `/docs` nav, and the layer workshops (soul/identity/expression/behavior/persona) all render in pt-BR. The admin workspace (`/admin` dashboard + users/budget/models/oauth) stays in English and is split off as **S2b** — the Brazilian tenant is non-admin so the gap doesn't block onboarding. **S5** (Brazilian narrative tenant) needs a persona alignment with the user before authoring; left open at the index for a future session.

Built across the day:
- **S1 (rail)** — `t(key, locale, params?)` with a fallback chain, two resource files, Hono middleware on the `web` sub-app, AsyncLocalStorage scope so JSX components call `ts(key, params?)` without prop drilling. The middleware is also registered on the parent `app` so `/login` localizes from `Accept-Language` pre-auth.
- **S2 (externalize)** — sidebar/layout, login, home, /me, conversation surfaces (mirror, conversation-header, context-rail, composed-drawer), /conversations browse. Saved/error flows refactored: redirects carry short key ids (`?saved=name`) which the GET handler resolves via `c.get("t")(...)`. Login + /me handler error messages localized in-place.
- **S3 (user pref)** — `users.locale TEXT NOT NULL DEFAULT 'en'`, `updateUserLocale` helper, `/me/locale` POST, Language card on `/me` (universal — not admin-gated; the BRL toggle stays admin-only). Defensive cast in middleware shrinks; `isLocale()` still gates unsupported values.
- **S4 (pt-BR fill)** — `pt-BR.json` translated authorially. Voice: "você" + 3rd person, no Lusitanian conjugation. Vocabulary aligned to project: Travessias (not Jornadas), Espelho, Mapa da Psique, Elenco (theatrical metaphor for the persona cast).

Tests: 715/715 (was 689 at v0.16.0; +26 across i18n unit, middleware smoke, /me/locale POST, pt-BR rendering on /me and /conversation).

Decision recorded: [user-facing locale ≠ D7](../project/decisions.md).

Before that: **CV1.E7.S8 — Out-of-pool rail suggestion** shipped. Reception flags would_have_persona / would_have_organization / would_have_journey alongside the canonical pick when an out-of-pool candidate is a strictly better fit. The rail surfaces a non-modal suggestion card below the assistant bubble; click triggers a divergent one-turn response through the suggested persona/scope, rendered inline as a sub-bubble. New `divergent_runs` table (separate from `entries` so the agent's history feed automatically excludes divergent runs); new `POST /conversation/divergent-run` endpoint. The session pool is never modified — divergence is paid in tokens but free in commitment. Resolves the cast-vs-scope tension surfaced empirically during S3's manual smoke (engineer-flavored answer to a woodwork question).

Before that: **CV1.E7.S4 — Conditional identity layers** shipped. `self/soul` and `ego/identity` now compose only when reception flags the turn as touching identity / purpose / values. New `touches_identity: boolean` axis on reception with identity-conservative defaults — silence (missing field, parse drift, reception failure) skips both layers; only an explicit `true` activates them. Composer gates the pair together (single boolean from reception, not split). Three adapters wired (`web`, `telegram`, `server` API). Snapshot's `layers` array filters out `self.soul` and `ego.identity` when they didn't compose, so Look inside reflects the truth. 670 tests passing (was 650; +20 new across reception, identity, composed-snapshot test files).

Before that: **CV1.E7.S3 — Conditional scope activation** shipped. Reception is the single source of truth for which scope content composes. Session tags continue to constrain reception's candidate pool, but they no longer force composition — a pinned scope absent from this turn's pick produces no prompt block. The conversation header pill (session-level) and the bubble badge (per-turn) now agree with what the prompt actually carried.

Before that: **CV1.E7.S5 — Multi-persona per turn (integrated voicing)** shipped on top of v0.14.0. Reception now returns `personas: string[]`, the composer renders multiple lenses simultaneously active under a "one voice, multiple lenses" instruction, the expression pass preserves the list, and the bubble signature uses set-based transitions so reordered casts don't re-badge. The canonical probe from the design conversation (*"qual seria a estratégia de divulgação do espelho..."* → estrategista + divulgadora) now activates both personas and produces one integrated reply. Segmented voicing parked for S5b.

Before that: **Persona colors improvement** shipped on top of CV1.E7.S2. Each persona now carries a persistent, editable color across every surface where it appears (Cast avatars, bubble color bar + ◇ badge, /conversations tag, Psyche Map card, /personas listing, streaming). Backed by a new `identity.color` column and a picker at `/map/persona/<key>`. Full context in the [improvement docs](../project/roadmap/improvements/persona-colors/).

Before that: **CV1.E7.S2 — Conversation header + slim rail** shipped earlier today. The `/conversation` page redesigned around an asymmetry the user surfaced — personas form a **cast** (mutable ensemble), orgs and journeys are a **scope** (stable context). The old rail-as-junk-drawer collapsed into a compact header (Cast avatars + Scope pills + Mode pill + `⋯` menu) and a slim side panel with two disclosures (`Edit scope ›`, `Look inside ›`). Message bubbles gained a **persona signature** — lateral color bar on every persona'd assistant turn, plus a mini-avatar chip that renders only on persona transitions. The per-message `◇ persona` text badge retired; org and journey badges stay with their pool-suppression rule. The data shape is forward-compatible with multi-persona turns ([CV1.E7.S5](../project/roadmap/cv1-depth/cv1-e7-response-intelligence/)). 584 tests passing (was 552 at S1 close).

**Origin:** a product-designer review of the v0.13.0+ UI flagged the rail as having seven blocks with equal weight — info mixed with action, composed section (dev metadata) competing visually with editable controls, destructive actions (Forget) right next to persistent buttons. The user, in parallel, named the core mental model: *"personas serão múltiplas em uma conversa, como se fosse um time que vai se formando, cada uma dando uma opinião diferente a cada momento. Journeys e orgs tendem a ser mais estáveis."* That broke the symmetry — S2 redesigns around cast-vs-scope instead of a single tag taxonomy.

**Next directions** (informed by what S2 installs):
- **CV1.E7.S3 — Conditional scope activation** (orgs/journeys compose only when a signal warrants, not "always if present"). Direct technical follow-on to S2 — the header now makes scope state legible, the next move is making scope injection *smarter*.
- **CV1.E7.S4 — Conditional identity layers** (soul / identity compose only when the turn touches identity / purpose / values).
- **CV1.E7.S5 — Multi-persona per turn + voicing** (integrated vs segmented). Reception returns `personas: string[]`; the header and bubble signature absorb it without rework (S2 data shape is prepared).
- **CV1.E7.S6 — Semantic retrieval step** (couples with CV1.E3.S3, CV1.E4.S2 Attachments).
- Worklog and release notes for CV1.E7.S1–S2 will be bundled into the next tagged release.

---

## Next

**CV1.E7 — Response Intelligence**:
- **S2b — Reception calibration** — revisit reception's classification rules if real use surfaces mis-classification on any axis (mode, persona under constrained pool, identity-touching detection, S8 suggestion frequency).
- **S6 — Semantic retrieval before composition** — attaches to CV1.E4.S2 Attachments and CV1.E3.S3.
- **S7 — Pipeline generalization** — abstract into named stages after 4–5 steps exist.

**CV1.E8 — Pipeline Observability & Evaluation** (new epic, opened 2026-04-26):
- **S1 — LLM call logging with admin toggle** — every model invocation writes a row to a log table (model, prompt, response, tokens, cost, latency, session/entry refs); admin toggle to start/stop globally; admin page to filter/export. Foundation for finding optimization points (token bloat, prompt drift, mode mis-classification, scope leakage).
- **S2 — Per-turn model switching for admin re-runs** — admin re-runs any past assistant turn through a different model or role config; alternative response renders alongside the original for visual comparison; doesn't mutate the canonical conversation. Complements S1: logs show what happened; re-runs ask "what if the model were different?". Natural way to evaluate model swaps against real conversation moments.

**Re-sequenced:**
- CV1.E4.S2 (Attachments) attaches to CV1.E7.S6 — no retrieval, no use.
- CV1.E3.S3 (Long-term memory) couples with CV1.E7.S6.

## Done

### 2026-04-26 — CV1.E7.S8 Out-of-pool rail suggestion ✅

Reception now emits three new "would have picked" axes — `would_have_persona`, `would_have_organization`, `would_have_journey` — alongside its canonical pick. When an out-of-pool candidate is a strictly better fit AND the in-pool options would all be a stretch, reception flags it. The rail surfaces a non-modal card below the assistant bubble; click triggers a divergent one-turn response through the suggested persona/scope, rendered inline as a sub-bubble. The session pool is never modified.

**Why now.** S3's manual smoke (Test 4: Stanley plane on a session with cast=[engineer]) surfaced the canonical use case empirically: engineer responded to a woodwork question because pool-as-constraint forbade better alternatives, and the user had no signal that `maker` existed in their data. S8 makes the lockout visible and opt-in.

**Shipped across 9 phases:**

1. **Reception extension** — three new fields in `ReceptionResult`; NULL_RESULT carries null for each. Prompt expanded to show SESSION POOL + OUT-OF-POOL listings when they differ, with rules for picking canonical from session pool only and flagging would_have_X for clear out-of-pool wins. Strict parser — out-of-pool keys validated against the actual out-of-pool set; any drift falls to null. 8 new tests.
2. **Persistence** — new `divergent_runs` table with FK cascade on parent_entry_id deletion. Helpers in `server/db/divergent-runs.ts`. 9 new tests covering insert/load/cascade/scoping.
3. **Endpoint** — `POST /conversation/divergent-run` validates ownership, reads parent meta, applies override on chosen axis, composes with override, runs main + expression, persists, returns one-shot JSON. Reception is NOT re-run — the user's click is the signal.
4. **SSE event extension** — routing event payload gains `wouldHavePersona/wouldHaveOrganization/wouldHaveJourney`.
5. **Suggestion card UI** — below the canonical bubble, dashed-card style, one per non-null axis. Click handler posts to the divergent endpoint with loading state.
6. **Sub-bubble render** — both client (post-click) and server (F5 / page load via `MirrorPage`) render divergent runs as indented sub-bubbles inside the parent's `.msg-body`. Markdown applies to both paths.
7. **History exclusion** — divergent_runs lives outside `entries` so `loadMessages` automatically excludes them (no filter logic needed). Regression test pins this contract.
8. **Manual smoke** — to be performed; test-guide.md describes the six-test roteiro.
9. **Docs close-out** — story folder, epic + top-level roadmap indices, decisions.md, prompt-composition § Reception output table updated, S8 promoted from "parked alternatives" to shipped, this entry.

**Tests:** 689 passing (was 670 at S4 close; +19 new).

**Asset version bumps:** `chat.js?v=out-of-pool-1`, `style.css?v=out-of-pool-1`.

**User-visible behavior.** When reception detects a strictly better out-of-pool candidate, the user sees a small dashed card below the canonical bubble: *"`maker` may have something to say. [Hear it]"*. Clicking produces a sub-bubble with the divergent persona's response — indented, smaller font, with the persona's color bar and a "divergent run" label. The cast doesn't grow; the next turn is processed against the same session pool as before.

Docs: [story](../project/roadmap/cv1-depth/cv1-e7-response-intelligence/cv1-e7-s8-out-of-pool-rail-suggestion/) · [plan](../project/roadmap/cv1-depth/cv1-e7-response-intelligence/cv1-e7-s8-out-of-pool-rail-suggestion/plan.md) · [test guide](../project/roadmap/cv1-depth/cv1-e7-response-intelligence/cv1-e7-s8-out-of-pool-rail-suggestion/test-guide.md) · [decisions — Out-of-pool rail suggestion](../project/decisions.md#2026-04-26--out-of-pool-rail-suggestion-cv1e7s8).

### 2026-04-26 — CV1.E7.S4 Conditional identity layers ✅

`self/soul` and `ego/identity` are the heaviest two layers in the prompt's identity cluster. Until S4, both composed on every turn regardless of relevance — a casual greeting carried the full existential framing. S4 makes both conditional via a new boolean axis on reception (`touches_identity`), gated together (single boolean, not split per layer).

**Identity-conservative defaults.** Silence skips both layers — missing field, non-boolean, or any reception drift defaults to `false`. Only an explicit `true` activates. Identity-touching turns are the minority case; the defaults reflect that.

**Shipped across 6 phases:**

1. **Reception** — `ReceptionResult.touches_identity: boolean`. NULL_RESULT carries `false`. System prompt gains a fifth axis with identity-conservative tiebreaker rules and ten worked examples. Strict parser (literal `true` only). 8 new tests.
2. **Composer** — `ComposeScopes.touchesIdentity?: boolean` gates `self/soul` + `ego/identity` together. Default `true` for back-compat with legacy callers (the canonical caller passes the explicit boolean from reception). 8 new tests.
3. **Composed snapshot** — `composedSnapshot` accepts `includeIdentity?: boolean`; when false, filters `self.soul` + `ego.identity` from layers. 4 new tests.
4. **Adapter wiring** — three adapters (web stream, telegram, server API) read `reception.touches_identity` → pass to composer → stamp `_touches_identity` on assistant entry meta → threaded through `buildRailState`'s override + DB-derive paths.
5. **Manual smoke** — Dan walkthrough's casual + operational + identity-touching turns, plus reload check.
6. **Docs close-out** — story folder, epic index, prompt-composition (full §1 Reception canonical refactor + §2 layer activation table updated), decisions.md, this entry.

**Tests:** 670 passing (was 650; +20 new).

**Backward compatibility.** Composer default `true` keeps existing test paths and any legacy caller composing identity. Reception NULL_RESULT carries `false`; the canonical reception-driven path is the only one that meaningfully gates identity off.

**User-visible change.** Casual and operational turns no longer carry soul + identity into the prompt. Token cost on those turns drops by the size of the soul + identity blocks (~2-4k tokens typically). Reply tone on operational turns sheds existential framing — closer to *"yes, here's how"* than *"as a mirror with these values, here's how I see your question..."*.

Docs: [story](../project/roadmap/cv1-depth/cv1-e7-response-intelligence/cv1-e7-s4-conditional-identity/) · [plan](../project/roadmap/cv1-depth/cv1-e7-response-intelligence/cv1-e7-s4-conditional-identity/plan.md) · [test guide](../project/roadmap/cv1-depth/cv1-e7-response-intelligence/cv1-e7-s4-conditional-identity/test-guide.md) · [decisions — Conditional identity layers](../project/decisions.md#2026-04-26--conditional-identity-layers-cv1e7s4) · [prompt-composition](../product/prompt-composition/).

### 2026-04-25 — CV1.E7.S3 Conditional scope activation ✅

Reception is now the single source of truth for which scope content composes. Session tags continue to express "this conversation operates within this context" and constrain reception's candidate pool, but they no longer force composition. A pinned scope absent from this turn's pick produces no prompt block — the composer is as quiet as reception was already trying to be.

**Why now.** v0.13.0 populated sessions with multiple stable scopes pinned per conversation. A small-talk turn on a session tagged with `software-zen` + `vida-economica` carried both full briefing+situation blocks into every system prompt, regardless of whether the message had anything to do with either. The composer was loud where reception had been deliberately quiet. S3 closes the gap by inverting the priority: reception's pick wins; tags constrain the pool only.

**Shipped in two commits:**

1. **Composer + adapter + tests** — `server/identity.ts` drops the `tags && tags.organizationKeys.length > 0` branch in scope rendering; `ComposeScopes.sessionTags` removed from the interface (with `SessionTags` import dropped along with it). `adapters/web/index.tsx` stops passing `sessionTags` to `composeSystemPrompt` (still loads them for reception's pool constraint). `tests/identity.test.ts` deletes the 5-test "session tag pool (CV1.E4.S4)" describe block (defunct semantics) and adds a 4-test "conditional scope activation (CV1.E7.S3)" describe block pinning the new contract.
2. **Docs close-out** (this commit). [`prompt-composition/index.md`](../product/prompt-composition/index.md) updated — the "Pre-S3 caveat" subsection rewritten as "Conditional scope activation"; the layer activation rules table simplified; the cast-vs-scope table now shows symmetric composition rules. [`decisions.md`](../project/decisions.md) entry. Story folder under [`cv1-e7-s3-conditional-scope/`](../project/roadmap/cv1-depth/cv1-e7-response-intelligence/cv1-e7-s3-conditional-scope/) with `index.md`, `plan.md`, `test-guide.md`. Epic index marks S3 ✅.

**Tests:** 639 passing (was 640 at S5 close; net -1: 5 deleted, 4 added).

**Backward compatibility.** No DB migration. No data shape change. Singular `organization: string | null` and `journey: string | null` stay — plural shape deferred to S3b if real use surfaces a need; today's sole-scope-in-domain rule and journey-plus-parent-org pair cover the practical cases.

**User-visible change.** The conversation header pill (session-level, stable) and the bubble badge (per-turn, conditional) no longer disagree. The "Look inside" snapshot matches turn-by-turn reality — a small-talk turn on a tagged session shows no scope block. Token cost on tagged sessions drops in proportion to the fraction of turns that don't activate the tagged scope.

Docs: [story](../project/roadmap/cv1-depth/cv1-e7-response-intelligence/cv1-e7-s3-conditional-scope/) · [plan](../project/roadmap/cv1-depth/cv1-e7-response-intelligence/cv1-e7-s3-conditional-scope/plan.md) · [test guide](../project/roadmap/cv1-depth/cv1-e7-response-intelligence/cv1-e7-s3-conditional-scope/test-guide.md) · [decisions — Conditional scope activation](../project/decisions.md#2026-04-25--conditional-scope-activation-reception-is-the-source-of-truth-cv1e7s3) · [prompt-composition](../product/prompt-composition/index.md).

### 2026-04-24 — CV1.E7.S5 Multi-persona per turn (integrated voicing) ✅

The cast visually declared itself in S2 but the pipeline still picked one persona per turn. S5 closes the gap: reception returns an array, the composer renders multiple lenses together, and the bubble signature becomes set-based.

**Shipped in six commits:**
1. **Reception plural shape** (`b29dce0`). `ReceptionResult.persona: string | null` → `.personas: string[]`. LLM prompt updated; parser accepts canonical plural + legacy singular (wraps into one-element array). 7 new/migrated reception tests.
2. **Composer multi-persona** (`55818f7`). `composeSystemPrompt` accepts `personaKeys: string[]`. Multi-lens instruction prefix renders when length > 1: *"Multiple persona lenses are active simultaneously… Speak with one coherent voice that integrates all of them."* Single persona renders identically to before. 4 new identity tests.
3. **Expression pass plural** (`1f13893`). `ExpressionInput.personaKeys: string[]`. System prompt gains a "multiple lenses produced this turn together" block that explicitly forbids segment markers in the output. 1 new test.
4. **Adapters rewired** (`d3b05aa`). Web + Telegram + API adapters all consume the array and feed it to composer/expression. Meta stamps `_personas` (canonical array) + `_persona` (first element, backward-compat). Routing SSE event carries `personas` + `personaColors` alongside legacy scalars. Telegram reply signature lists every persona.
5. **UI set-based signature** (`bf633c5`). `computeBubbleSignatures` tracks the previous assistant's **set**. Each turn's rendered badges are the personas new to this turn. Reordering the same cast produces no fresh badges. Bubble color bar uses the primary persona. Client-side `attachPersonaSignature` migrates to accept an array + color map. 5 new web tests.
6. **Close-out** (this commit). Worklog, decisions, refactoring log, status marks.

**Tests:** 640 passing (was 627 at v0.14.0; +13 new).

**Backward compatibility:** historical sessions whose meta only carries `_persona` singular still render correctly — every reader path checks `_personas` first and falls back to the singular. No migration needed.

**Parked for S5b:** segmented voicing (explicit `◇ X ... ◇ Y ...` markers inside a reply), gradient/dual-tone color bars, persona-set UI cap for 4+ personas.

Docs: [story](../project/roadmap/cv1-depth/cv1-e7-response-intelligence/cv1-e7-s5-multi-persona/) · [plan](../project/roadmap/cv1-depth/cv1-e7-response-intelligence/cv1-e7-s5-multi-persona/plan.md) · [refactoring](../project/roadmap/cv1-depth/cv1-e7-response-intelligence/cv1-e7-s5-multi-persona/refactoring.md).

### 2026-04-24 — Persona colors improvement ✅

Deliberate improvement bundled on top of CV1.E7.S2. Gives each persona a persistent, editable color stored in the DB (`identity.color`) and applies it consistently across every surface where a persona appears.

**Five phases, five commits:**

1. **Schema + helpers + backfill** ([`2c1a39e`](../../)). New `identity.color` TEXT nullable column; migration backfills existing personas with their hash-derived color so upgrades don't shift visually. New shared module `server/personas/colors.ts` with `PERSONA_COLORS`, `hashPersonaColor`, `normalizeHexColor`, `resolvePersonaColor`. New `setPersonaColor(db, userId, key, color | null)` DB helper with validation; fresh personas seed the hash color on insert. 24 new unit + DB tests.
2. **Color picker UI + endpoint** ([`3579184`](../../)). `/map/persona/<key>` gains a Color section (current swatch, 8-color palette, custom hex input, reset-to-hash). New POST `/map/persona/:key/color` endpoint validates and writes. Custom hex wins over swatch when both posted. 8 new web tests.
3. **Existing consumers read from DB** ([`f660ba2`](../../)). `RailState` gains `personaColors: Record<key, color>` populated once per render. Header Cast, bubble color bar, `/personas` listing, and the streaming `routing` SSE event all read from the map. Server is the single source of truth.
4. **New colored surfaces** ([`9c26bae`](../../)). `◇ persona` text badge in bubbles (both server-rendered and streamed), `/conversations` persona tag, and Psyche Map persona card now carry inline color from the stored value. 4 new web tests.
5. **Close-out** (this commit). Improvement docs: [index](../project/roadmap/improvements/persona-colors/), [plan](../project/roadmap/improvements/persona-colors/plan.md), [test guide](../project/roadmap/improvements/persona-colors/test-guide.md).

**Tests:** 628 passing (was 592 at S2 close). +36 new.

**Non-goals honored:** no journey/org colors (scopes stay neutral pills with iconography), no contrast/accessibility picker tooling, no dark-mode remap, no gradient/multi-color personas, no undo beyond the Reset button.

### 2026-04-24 — CV1.E7.S2 Conversation header + slim rail (cast-as-ensemble scaffolding) ✅

Redesign of `/conversation` around the asymmetry between persona (cast) and scope (context). Implemented in nine phases, across four commits landing in sequence.

**What shipped:**

1. **New `<ConversationHeader>` above the chat** — a single fixed strip with four zones: **Cast** (persona avatars, `+` convokes, click-avatar popover with descriptor + turn count + dismiss), **Scope** (org `◈` + journey `≡` pills, overflow collapses beyond 3, click-to-add inline editor), **Mode** (pill showing active mode, click expands segmented control inline — click commits, no Save button), **Menu ⋯** (New topic / Look inside / Forget, destructive styled warm).
2. **Rail slimmed to two disclosures** — [`Edit scope ›`](../../adapters/web/pages/context-rail.tsx) opens the full three-group tag editor (same behavior as before, now quieter). [`Look inside ›`](../../adapters/web/pages/context-rail.tsx) opens the composed snapshot + session stats + model + cost — the ficha técnica that no longer fights for eyeballs. The old `rail-persona` block, `rail-session-actions`, and `rail-footer` ("Grounded in your identity →") removed entirely.
3. **Bubble persona signature** — 3px lateral color bar on each assistant bubble with a persona (color from `avatarColor()`). A circular `.msg-avatar-chip` at top-left renders **only on persona transitions** (first in session, or differs from previous assistant). Same-persona runs keep the color bar without repeating the chip. Persona-less turns reset the tracker.
4. **`◇ persona` text badge retired** — its signal moved to the bubble signature. `◈ organization` and `↝ journey` badges keep their pool-suppression rule (divergence cases still render).
5. **New `getPersonaTurnCountsInSession()` helper** in `server/session-stats.ts` — reads `_persona` meta off assistant entries, returns `Record<key, count>`. Used by the cast popover.
6. **Forward-compatible data shape.** Cast reads from the pool (`session_personas`); bubble signature reads per-turn pick (`_persona` meta). When [CV1.E7.S5](../project/roadmap/cv1-depth/cv1-e7-response-intelligence/) enables multi-persona per turn, the UI absorbs the change without rework.

**Commits (4):**
- `c466dd4` — Phases 1-5: header with Cast, Scope, Mode, Menu.
- `98e93c0` — Phase 6: rail slims to two disclosures.
- `ff58157` — Phases 7-8: bubble signature + retire persona text badge.
- (this commit) — Phase 9: worklog, status marks, refactoring log.

**Tests:** 584 passing (was 552 at S1 close). +7 new for the header, +6 for the bubble signature, +1 rewritten for the badge retirement; several older rail-side tests rewritten for the new element locations.

**Non-goals honored (parked for later):**
- Reception returning `personas: string[]` → CV1.E7.S5.
- Integrated vs segmented voicing for multi-persona turns → CV1.E7.S5.
- Mobile-specific header layout → responsive rules flex-wrap today; a dedicated mobile pass waits until friction surfaces.

**Design decision logged:** [*Personas are a cast; orgs and journeys are a scope*](../project/decisions.md) — the asymmetry principle, the badge retirement, and the voicing model for future multi-persona turns.

Docs: [epic](../project/roadmap/cv1-depth/cv1-e7-response-intelligence/) · [story](../project/roadmap/cv1-depth/cv1-e7-response-intelligence/cv1-e7-s2-conversation-header/) · [plan](../project/roadmap/cv1-depth/cv1-e7-response-intelligence/cv1-e7-s2-conversation-header/plan.md) · [refactoring](../project/roadmap/cv1-depth/cv1-e7-response-intelligence/cv1-e7-s2-conversation-header/refactoring.md) · [decisions — cast vs scope](../project/decisions.md#2026-04-24--personas-are-a-cast-orgs-and-journeys-are-a-scope-cv1e7s2).

### 2026-04-24 — CV1.E7.S1 Expression as a post-generation pass ✅

First story of [CV1.E7 — Response Intelligence](../project/roadmap/cv1-depth/cv1-e7-response-intelligence/). Pipeline-over-prompt pattern lands as a tracer bullet: `ego/expression` peels off the main prompt and becomes input to a second LLM call that reshapes the draft to match the chosen response mode (conversational / compositional / essayistic) and the user's expression rules.

**Shipped across nine phases, each its own commit:**

1. **Remove expression from compose** ([`server/identity.ts`](../../server/identity.ts)). Composition order shortens to `self/soul → ego/identity → [persona] → [org] → [journey] → ego/behavior → [adapter]`. Regression guard test pins expression's ABSENCE.
2. **`expression` model role** ([`config/models.json`](../../config/models.json)). Defaults to Gemini 2.5 Flash, 10s timeout, `reasoning: "minimal"`. Same ops shape as reception/title. `addMissingModelRoles()` migrates existing installs on next boot without touching admin-customized rows.
3. **Expression pass** ([`server/expression.ts`](../../server/expression.ts)). `express()` with `ExpressionInput { draft, userMessage, personaKey, mode }` → `ExpressionResult { text, mode, applied }`. Silent fallback to the unchanged draft on any failure — callers never need a branch. 16 unit tests.
4. **Reception's fourth axis — mode** ([`server/reception.ts`](../../server/reception.ts)). Same LLM call routes persona / org / journey / mode in one pass. Non-null mode, defaults to `conversational` on silence or failure (the loud shape never wins by accident). 8 new mode tests + existing assertions updated.
5. **`sessions.response_mode` column** ([`server/db/sessions.ts`](../../server/db/sessions.ts)). `getSessionResponseMode` / `setSessionResponseMode`, both ownership-scoped. Null = follow reception. 6 new DB tests.
6. **Pipeline wire-up** in all three adapters ([`adapters/web/index.tsx`](../../adapters/web/index.tsx), [`adapters/telegram/index.ts`](../../adapters/telegram/index.ts), [`server/index.tsx`](../../server/index.tsx)). Web emits new `status` SSE events (`composing` → `finding-voice`) and streams the expressed text in word-boundary chunks. Assistant entry persists the expressed text, not the draft. New POST `/conversation/response-mode` endpoint (5 route tests).
7. **Rail UI** ([`context-rail.tsx`](../../adapters/web/pages/context-rail.tsx)). Four-option radio group (auto / conversational / compositional / essayistic) + Save button. `auto` maps to NULL override. 3 new rail tests.
8. **Client microtext** ([`chat.js`](../../adapters/web/public/chat.js)). Handles the two `status` frames so the assistant bubble reads *Composing…* then *Finding the voice…* before deltas arrive. No separate JS test (browser-only).
9. **Docs + close-out.** This entry. Refactoring log in the story folder.

**Test suite:** 552 passing (was 513 at v0.13.0) — +39 new across expression, reception (mode), db (response_mode), and web (response-mode endpoint + rail).

**Known UX trade-offs (accepted for v1):**
- Total turn latency regresses by ~1–3s (one extra LLM call).
- Main-generation stream is hidden — the user only sees the expressed stream.
- Mode on Telegram / CLI follows reception with no override surface (rail is web-only).
- Drafts are not persisted (assistant entry carries the expressed text). Debug toggle possible in a follow-up.

**What this story installs for the rest of CV1.E7:** a named pipeline step after the main Agent. The same extension point receives conditional-layer activation (S3–S5), semantic retrieval pre-composition (S6), and eventual generalization (S7).

Docs: [epic](../project/roadmap/cv1-depth/cv1-e7-response-intelligence/) · [story](../project/roadmap/cv1-depth/cv1-e7-response-intelligence/cv1-e7-s1-expression-pass/) · [plan](../project/roadmap/cv1-depth/cv1-e7-response-intelligence/cv1-e7-s1-expression-pass/plan.md) · [refactoring](../project/roadmap/cv1-depth/cv1-e7-response-intelligence/cv1-e7-s1-expression-pass/refactoring.md) · [decision](../project/decisions.md#2026-04-24--response-intelligence-moves-from-prompt-to-pipeline-cv1e7).

### 2026-04-23 — v0.13.0 published — *The Family Moves In*

Four fictional users (Dan Reilly, Elena Marchetti, Eli Reilly, Nora Reilly) moved into the empty system as a family. 92 markdown files under `docs/product-use-narrative/` authoring each character's profile, identity stack (self/soul, three ego layers, five-to-six personas), organizations, journeys, and five sample conversations. New `narrative load` admin command provisions them idempotently from the docs tree; `.tokens.local` (gitignored) stores generated bearer tokens. Three UI gaps surfaced by the populated system and closed alongside: Docs link in the sidebar footer, clickable "Last conversation" cards on scope list pages, and hyperlinked CV1.E6.S6 reference on `/me`. 513 tests passing (unchanged from v0.12.0). Release notes at [`docs/releases/v0.13.0.md`](../releases/v0.13.0.md).

### 2026-04-23 — v0.12.0 published — *Taking Shape*

### 2026-04-23 — v0.12.0 published — *Taking Shape*

Bundled and tagged. Seven improvements under `docs/project/roadmap/improvements/` — one deliberate (sidebar-ordering-and-visibility) and six refinements — covering ordering/visibility, concluded lifecycle, flat journeys, Psyche Map sub-navigation + read/edit mode, personas listing + polish, summary-regen feedback on both Regenerate and Save. 513 tests passing (was 444). `package.json` bumped 0.11.0 → 0.12.0. Release notes in `docs/releases/v0.12.0.md`.

Codified the flexible improvement-doc policy in `development-guide.md`: `index.md` always required; `plan.md` and `test-guide.md` optional, warranted only when there's design or manual steps worth recording. Six of this release's seven improvements ship as refinements (single index.md with Problem / Fix / Commit SHA / Tests).

### 2026-04-23 — Production configuration polish (3 improvements)

A session of friction-driven refinements hit while the user was
configuring scopes in production. Three improvements shipped:

- **[Sidebar ordering and visibility](../project/roadmap/improvements/sidebar-ordering-and-visibility/)** — `sort_order` and `show_in_sidebar` columns on `journeys` and `organizations`; ↑/↓ and ●/◎ row controls on `/journeys` and `/organizations`; sidebar filters by visibility, listing still shows everything. Deliberate-style improvement (plan + test guide). 17 DB tests + 8 route tests.
- **[Regenerate Summary feedback](../project/roadmap/improvements/regenerate-summary-feedback/)** — typed `ScopeSummaryResult` return + `?summary=...` redirect + banner. 30s timeout floor for scope summaries (title role's 8s was calibrated for titles, not briefing+situation). Refinement-style improvement (single index.md). 6 unit + 5 route tests.
- **[Save awaits summary regen when content changed](../project/roadmap/improvements/save-triggers-summary-regen/)** — Save form on workshops now awaits `generateScopeSummary` when briefing or situation changed, shows the same banner. Name-only edits skip the LLM call. Refinement-style improvement. 4 route tests.

Also codified a flexible doc policy in `development-guide.md`: `index.md` is always required; `plan.md` and `test-guide.md` are warranted only when there's design or manual steps worth recording. "Refinement" improvements (obvious fix, small commit) can ship with just an index.md.

Total: 484 tests passing (was 444). Not a release — improvements bundle with the next story's push.

### 2026-04-22 — v0.11.0 published — *The Memory I Carry*

Bundled and tagged. Six stories + corrections covering: conversation import (CV0.E3.S9), scope ateliê (CV1.E4.S5), Conversations browse (CV1.E6.S1 — first piece of Memory Map), sidebar restructure with Conversation as a section + nested scope entries (CV0.E4.S9), the current=activity correction, plus polish (sidebar scroll, third-level styling, link tones). 444 tests passing (was 311 at v0.9.0). Tag at HEAD; `package.json` bumped 0.9.0 → 0.11.0 (catches the deferred 0.10.0 bump too). Release notes in `docs/releases/v0.11.0.md`.

### 2026-04-22 — CV0.E4.S9 Sidebar 'Conversations' entry ✅

Added a second top-of-nav link in the sidebar: `Conversations` (plural) goes to `/conversations`, sitting right under `Conversation` (singular, drop-into-active-session). Visual differentiation via `.sidebar-link--secondary` (smaller, quieter color) so the singular reads as the primary daily action and the plural reads as its complement. One commit, one test.

### 2026-04-22 — CV1.E4.S5 follow-up: trim ateliê + View all ✅

The workshop page (`/organizations/<X>` and `/journeys/<X>`) now shows a teaser of 5 sessions instead of all. When the scope has more than 5, a quiet "View all (N) conversations →" link points to `/conversations?organization=<key>` (or `?journey=<key>`). Header reads "5 of N" instead of "N conversations" when truncated. When ≤ 5, no link.

`getOrganizationSessions` / `getJourneySessions` extended to accept an optional `limit` and now return `{ rows, total }` (was a flat array). The route handlers pass `limit=5`. Existing callers without limit get everything (backward-compatible behavior preserved by defaulting limit to undefined → no LIMIT clause).

### 2026-04-22 — CV1.E6.S1 follow-up: 'current' = last activity ✅

Phase 2 of S5 added `markSessionActive` that bumped `sessions.created_at` when a session was opened via `/conversation/<sessionId>`. Real use revealed the conflation: opening an old session to re-read context shouldn't move the user's active anchor. Reading != continuing.

`getOrCreateSession` now resolves via `MAX(entry.timestamp)` with `created_at` fallback for sessions with no entries. `markSessionActive` deleted. Opening doesn't bump anything; sending a message in the opened session naturally updates activity and that session becomes current.

### 2026-04-22 — CV1.E6.S1 Conversations browse ✅

New top-level surface at `/conversations` listing every session the user has, with filters by persona / organization / journey, recency-sorted, paginated. First cross-scope view of episodic memory and the first concrete piece of CV1.E6 (Memory Map), promoted ahead of the original landing-first plan.

**Why now:** CV1.E4.S5 (scope ateliê) gave each scope a Conversations section. Two follow-on needs surfaced from use: (a) full lists per scope overwhelm a quick "what's going on here" glance, and (b) finding "where did we discuss X?" requires knowing the scope first — no cross-scope view existed. This story adds the destination; the sibling stories (S5 trim, sidebar update) wire the app around it.

**Route + filters:**
- `/conversations` — all eligible sessions (any session with at least one assistant message), recency-sorted.
- `?persona=<key>`, `?organization=<key>`, `?journey=<key>` — narrow via existing entities. AND semantics. Unknown values silently degrade to no-filter.
- `?offset=N` — pagination. Page size fixed at 50; "Show N more" anchor preserves filter params.

**Row format:** title link → `/conversation/<sessionId>` (S5's route), persona/org/journey tag pills, relative time, 2-line preview of first user message. Same shape as S5's `ScopeSessionsList` with optional scope-badge slots — separate component since the cross-scope context needs scope tags inline (the user is no longer on a single-scope page).

**Active-session badge:** the session that `/conversation` resolves to gets a "current" badge in the list — the user can locate their active thread at a glance without changing its behavior.

**Empty states with voice:** "No conversations yet" (no data, no filters) vs "No conversations match these filters" + Clear filters affordance (filtered narrowly).

**Implementation across three phases:**

1. **`getConversationsList(db, userId, opts)`** in `server/conversation-list.ts` — same meta-based source as S5/S7, with EXISTS-clauses per filter and a separate COUNT(*) for `total`. Eligibility requires ≥1 assistant message in the session. 12 unit tests.
2. **Route `/conversations`** in `adapters/web/index.tsx` + new `ConversationsListPage` component in `adapters/web/pages/conversations.tsx`. Filter dropdowns populated from existing personas/orgs/journeys; CSS bumped to `?v=conversations-list-1`. 12 web tests.
3. **'current' badge** — implemented inline with Phase 2; explicit test pins it to fire exactly once on the active session.

**432 tests passing** (was 413). Zero regressions.

**Non-goals deferred:**
- Sidebar entry for `/conversations` (sibling story CV0.E4.S9)
- Trim of scope ateliê to 5 + "View all" link (sibling follow-up to CV1.E4.S5)
- Multi-select filters, date range, text search, sort options
- Cursor pagination
- Sessions without scope meta (visible without badges, not filterable — acceptable for v1)
- Performance with thousands of sessions (json_extract over `entries` is fine for current scale; indexes when needed)

Docs: [story](../project/roadmap/cv1-depth/cv1-e6-memory-map/cv1-e6-s1-conversations-browse/) · [plan](../project/roadmap/cv1-depth/cv1-e6-memory-map/cv1-e6-s1-conversations-browse/plan.md).

### 2026-04-22 — CV1.E4.S5 Scope page becomes an ateliê ✅

`/organizations/<X>` and `/journeys/<X>` evolve from briefing+situation+last-conversation card into a complete workshop: same identity panels at the top, plus a full Conversations section listing every session tagged to that scope. Each row shows title (clickable), persona badge, relative time, and a 2-line preview of the first user message. Clicking opens `/conversation/<sessionId>` — the session loads, becomes active, and the user can resume.

**Why now:** S9 (conversation import) revealed an acute gap. 27 imported sessions in `software-zen` had nowhere to be browsed; the Begin again worklog had already noted *"no UI surfaces the preserved sessions yet"* with the expectation that CV1.E6 (Memory Map) would handle it. With imports, that latency wasn't acceptable. S5 closes the gap for scoped sessions without building the global Memory Map yet.

**Anti-pattern to chatbot sidebar.** Sessions live *inside* their context, not in a global flat list. There is no `/conversations/all` surface — discovery happens through the scope (org or journey). The mirror's distinguishing structure is honored at the navigation level.

**Implementation across four phases:**

1. **Full session list per scope** — `getOrganizationSessions(db, userId, key)` and `getJourneySessions(db, userId, key)` in `server/scope-sessions.ts`, returning every session tagged to that scope with title, last activity, persona key, and a truncated preview of the first user message. Same meta-based approach as the existing latest-* helpers (S7) — keeps the parallel-mechanism debt parked instead of paying it down halfway. 9 unit tests.
2. **Session-by-id helpers** — `getSessionById` (with user ownership check, returns undefined for foreign sessions) and `markSessionActive` (bumps `created_at` past every other session for the user) in `server/db/sessions.ts`. The chat path resolves "active" via `getOrCreateSession` (`ORDER BY created_at DESC LIMIT 1`), so a one-line UPDATE flips active without a dedicated column. 6 unit tests.
3. **Route `/conversation/:sessionId`** in `adapters/web/index.tsx` — UUID-shape constrained param to avoid colliding with sibling endpoints. 404s for non-owned sessions. Loads + marks-active + renders MirrorPage. 5 web tests covering happy path, foreign-user 404, unknown-id 404, non-UUID 404, and the active-after-load semantic.
4. **Conversations section** on the workshop pages — new `ScopeSessionsList` component shared between `organizations.tsx` and `journeys.tsx` (same precedent as `ScopeRow`). Empty state has voice. CSS bumped to `?v=scope-atelier-1` to invalidate cached stylesheets.

**413 tests passing** (was 391). Zero regressions.

**Non-goals deferred:**
- Global "all sessions" surface (Memory Map / CV1.E6 territory; not built here).
- Sessions without org/journey — orphan handling. Today's sessions all have at least a persona; persona-only sessions don't disappear (they're reachable via the rail and the home Continue band) but don't surface here. Open question: which surface *does* show them — persona detail page, `/me`, or treating persona as scope here too. Resolution deferred.
- Read-only preview mode. Click opens for continuation; the chat surface already lets you scroll up.
- Filters and search.
- Pagination — render all rows; revisit if any one scope passes ~50 sessions.

Docs: [story](../project/roadmap/cv1-depth/cv1-e4-journey-map/cv1-e4-s5-scope-atelier/) · [plan](../project/roadmap/cv1-depth/cv1-e4-journey-map/cv1-e4-s5-scope-atelier/plan.md).

### 2026-04-22 — v0.10.0 published — *A Place to Land*

CV0.E4 (Home & Navigation, S1–S7) + CV1.E4.S4 (Manual session scope tagging) bundled and tagged as [v0.10.0](../releases/v0.10.0.md). Tag points to commit `924a92f` (the cv1-e4-s4 docs commit, which is the actual code state of the release). Release notes were written retroactively after S9 was already on main; package.json bump deferred to v0.11.0 per the same retroactive convention.

### 2026-04-22 — CV0.E3.S9 Import conversation history from markdown ✅

The admin can now import existing conversation history into the mirror as new sessions, tagged with persona and optional organization/journey. New CLI command `conversation import <user> --dir <path> --persona <key> [--organization <key>] [--journey <key>] [--dry-run]`.

**Why it exists:** the strangler fig works both ways — the new mirror replaces other tools (Gemini, ChatGPT, Claude) for users who already accumulated months of conversation context elsewhere. Without an import path, every new user starts cold. Driven by the immediate need to migrate Alisson's Gemini "Zenith" threads (parsed by `szen_mind` into segmented markdown) into mirror-mind, with the wife as second user once the path proves stable.

**Canonical format documented at [`docs/product/conversation-markdown-format.md`](../product/conversation-markdown-format.md)** — frontmatter (optional `title:`, `source:`) + body alternating `**User:**` / `**Assistant:**` blocks. Strict format on purpose: the importer accepts no flexibility flags. Per-source variations (e.g., szen_mind's `**Zenith:**` and `topico:`) normalize at the source via a one-line `sed` before import. The mirror stays clean; the burden of variation lives where the variation is.

**Implementation across four phases**, each committed individually, all green:

1. **DB helpers** — `appendEntry` gains an optional timestamp; new `createSessionAt` for explicit-title-and-timestamp session creation. The importer needs both: monotonic timestamps so `loadMessages` returns conversational order, deterministic `created_at` so `listRecentSessionsForUser` ordering survives same-millisecond collisions.
2. **Markdown parser** (`server/import/markdown-conversation.ts`) — pure function via `gray-matter` for frontmatter + regex for body alternation. Throws typed `MarkdownConversationError` on alternation violations so the importer can report which file failed and skip the rest. 8 unit tests.
3. **Importer orchestrator** (`server/import/conversation-importer.ts`) — fail-stop validation of user/persona/org/journey before any write. Per-file failures don't abort the run. Each file goes through a single transaction (session + entries + tags). Entry data shape mirrors organic chat writes (content as typed text-block array). 13 unit tests.
4. **Admin CLI command** — `conversation import` group/action wired into `server/admin.ts`. Dry-run mode reports what would happen without writing. Smoke tests for happy path + missing-persona rejection. 389 tests passing total (was 376).

**Non-goals deliberately deferred:**
- Web UI for import (CLI suffices for the few migrations on the immediate horizon)
- Per-file persona/org/journey overrides (one persona per invocation; batch via shell loop)
- Source provenance metadata on the session (the badge "imported from Gemini" is desirable but adds an additive migration; deferred until felt)
- Tolerance for non-canonical labels (no `--assistant-label` / `--title-key` flags — over-engineering)
- Compaction at import time (sessions imported verbatim; if a long imported session causes context overflow, that becomes the concrete need that earns CV1.E3.S2 its first user)

Docs: [story](../project/roadmap/cv0-foundation/cv0-e3-admin-workspace/cv0-e3-s9-import-conversation/) · [plan](../project/roadmap/cv0-foundation/cv0-e3-admin-workspace/cv0-e3-s9-import-conversation/plan.md) · [conversation markdown format](../product/conversation-markdown-format.md).

### 2026-04-21 — CV1.E4.S4 Manual session scope tagging ✅

The session↔scope relationship flips from 1:N (one persona / one org / one journey per turn, implicit via assistant message meta) to **N:N explicit** — three junction tables — so the user can curate the pool of contexts a whole conversation operates within. Derived from a product-designer conversation where the user surfaced that perfect reception can't be guaranteed and manual override needed to be first-class.

**Hybrid model (user's choice):**
- Session declares a **pool** of personas / orgs / journeys
- Reception picks **within** the pool each turn (empty pools = considers all, backward-compatible)
- User can **correct** by editing the pool from the Context Rail at any time
- **First turn** of a fresh session auto-populates the pool from reception's picks — the "sugeridas" default
- Persona stays singular per reply (the mirror has one voice); orgs and journeys compose multi into the prompt

**Implementation across four phases** plus docs:

1. **Schema + helpers** — 3 junction tables (`session_personas`, `session_organizations`, `session_journeys`) with composite PK, string keys (consistent with reception output). `getSessionTags` + add/remove per type + `clearSessionTags`. `forgetSession` cascades. 9 unit tests.
2. **Reception filtering** — `ReceptionContext.sessionTags` narrows candidates before the LLM call. 4 new tests covering empty / partial / full filter.
3. **Composer multi-scope** — `ComposeScopes.sessionTags` renders all tagged orgs and all tagged journeys; persona stays singular. Backward fall-back to reception's single pick when a type has no tags. 5 new tests.
4. **Rail UI + endpoints** — new "Scope of this conversation" section on the Context Rail with three tag groups. Each group: pills (× removes via POST `/conversation/untag`) + dropdown-add (POST `/conversation/tag`). RailState gains `tags` with candidate lists. 5 new tests.

**First-turn suggestion** — `/conversation/stream` detects `entries.count === 0 && totalTags === 0` before reception runs, and if so writes reception's non-null picks into the session tags before composing the prompt. The next turn already operates within the newly-seeded pool.

**362 tests passing** (+14 new across db, reception, composer, web). Zero regressions.

**Non-goals parked:**
- Per-turn persona override (future story if the need sharpens)
- Tag editing from Telegram / API adapters (no UI; reception picks unfiltered there)
- Migrating S7's last-conversation-per-scope to use junctions (both signals exist in parallel)
- Backfilling existing sessions with reception's past picks

Docs: [story](../project/roadmap/cv1-depth/cv1-e4-journey-map/cv1-e4-s4-manual-scope-tagging/) · [plan](../project/roadmap/cv1-depth/cv1-e4-journey-map/cv1-e4-s4-manual-scope-tagging/plan.md) · [test guide](../project/roadmap/cv1-depth/cv1-e4-journey-map/cv1-e4-s4-manual-scope-tagging/test-guide.md).

### 2026-04-21 — CV0.E4.S7 Last conversation per scope ✅

The `/organizations` and `/journeys` list pages pair each scope card with a **Last conversation** card showing the title + relative time of the most recent session tagged with that scope. The list surface stops being pure structure and starts carrying a trace of use.

**No schema change.** Reception has been stamping `_organization` and `_journey` meta on every web assistant message since CV1.E4.S1. A window-function SQL query (`ROW_NUMBER() OVER PARTITION BY json_extract(...)`) returns the most recent entry per scope key, joined to the session for title + timestamp.

**New helper:** `server/scope-sessions.ts` exports `getLatestOrganizationSessions(db, userId)` and `getLatestJourneySessions(db, userId)`, each returning `Map<string, LatestScopeSession>` keyed by scope key.

**Shared component:** `ScopeRow` lives in `organizations.tsx`, is exported, and is imported by `journeys.tsx`. One component renders both pages.

**Responsive layout:** one pair per row on narrow screens; two pairs per row at ≥900px; single column below 540px.

**Adapter coverage caveat:** Telegram and API currently stamp only `_persona`, so scopes used only on those channels show "No conversations tagged yet." Backfilling is a no-op once those adapters carry the scope meta too.

**339 tests passing** (+2 new). Zero regressions.

Docs: [story](../project/roadmap/cv0-foundation/cv0-e4-home-navigation/cv0-e4-s7-scope-last-conversation/) · [plan](../project/roadmap/cv0-foundation/cv0-e4-home-navigation/cv0-e4-s7-scope-last-conversation/plan.md) · [test guide](../project/roadmap/cv0-foundation/cv0-e4-home-navigation/cv0-e4-s7-scope-last-conversation/test-guide.md).

### 2026-04-21 — CV0.E4.S6 Single-currency cost display ✅

Cost surfaces stop showing USD and BRL side by side. The admin picks one currency in `/me` preferences — USD or BRL — and every cost number across the app renders that choice.

**Before:** `/admin/budget` rendered `$8.40 · R$42` cells when the admin had BRL enabled; Context Rail already rendered single-currency.

**After:** one currency everywhere, driven by the same preference. The dual display is gone from `/admin/budget`; the home admin band also now respects the preference (it used to hardcode USD).

**Data layer — no migration.** The `users.show_brl_conversion` column stays. Its meaning reinterprets: `1` now means *"prefer BRL over USD"* (was *"show BRL in addition to USD"*); `0` continues to mean USD-only. Every existing user's experience is preserved — toggled-on users see BRL only (small reduction in noise), toggled-off users see USD only (unchanged). The column name is a historical artifact, noted in a one-line comment at each read site.

**UI change on `/me`.** Checkbox "Show cost in BRL alongside USD" becomes two radios: `USD — $` / `BRL — R$`. The form field stays `name="show_brl"` with `value="0"` and `value="1"` — the server handler is unchanged.

**`formatUsdAndMaybeBrl` removed**, replaced by `formatCost(usd, rate, preferBrl)` returning one currency string. Variable `showBrl` renamed to `preferBrl` throughout budget.tsx, me.tsx, and the home admin band.

**Tests:** the `/me` admin-badge test updated to assert the radio shape (`type="radio"`, label text "USD — $" / "BRL — R$"). Total **337**, zero regressions.

Docs: [story](../project/roadmap/cv0-foundation/cv0-e4-home-navigation/cv0-e4-s6-single-currency/) · [plan](../project/roadmap/cv0-foundation/cv0-e4-home-navigation/cv0-e4-s6-single-currency/plan.md) · [test guide](../project/roadmap/cv0-foundation/cv0-e4-home-navigation/cv0-e4-s6-single-currency/test-guide.md).

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
