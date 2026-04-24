[< Docs](../index.md)

# Decisions

Incremental decisions made during construction. For foundational architectural decisions (D1–D8), see the [Briefing](briefing.md).

---

### 2026-04-24 — Multi-persona per turn, integrated voicing first (CV1.E7.S5)

The cast-vs-scope model from S2 implied multi-persona turns — UI shipped ready for it (`personaColors: Record<k, c>`, Cast avatar list, set-based bubble signature in the data shape). S5 turns the pipeline on: reception returns `personas: string[]`, composer renders all active lenses simultaneously under a shared instruction, expression pass preserves the list in the "one unified voice" frame.

**Voicing default: integrated.** A single coherent reply whose depth comes from multiple lenses cooperating — not segmented prose with explicit `◇ X ...` markers inside the text. The canonical probe from the design conversation (*"qual seria a estratégia de divulgação do espelho para o público da Software Zen?"* → estrategista + divulgadora) produces one woven answer, not two stitched perspectives. The expression-pass prompt explicitly forbids segment markers in the output.

**Backward compatibility.** Meta persistence stamps both shapes: `_personas: string[]` is the canonical new field; `_persona: string | null` carries the first element for downstream consumers (conversation-list filter, me-stats, scope-sessions) that still read singular. Readers normalize at the edge: prefer `_personas`, wrap singular into one-element array, empty array when neither present.

**Set-based bubble signature.** `computeBubbleSignatures` tracks the previous assistant's persona **set**. Each turn's rendered badges are the set-diff against the previous turn. Reordering `[A, B]` to `[B, A]` produces no fresh badges — the comparison ignores order, and the continuity is visible through the color bar (which uses the primary persona, first in the list).

**Routing SSE event emits both shapes.** `personas: string[]` and `personaColors: Record<key, color>` are canonical; `persona` (first) and `personaColor` (first's color) stay for any out-of-tree consumer. Client code prefers the plural.

**What S5 does not do — parked for S5b:** segmented voicing (opt-in reply style with `◇ X ... ◇ Y ...` markers), gradient/dual-tone color bars on multi-persona bubbles, explicit UI cap when 4+ personas participate on one turn.

---

### 2026-04-24 — Personas are a cast; orgs and journeys are a scope (CV1.E7.S2)

Three axes that carry conversation context — persona, organization, journey — have been treated symmetrically in the UI since CV1.E4.S4: each renders as a pill, each edits the same way, each displays with equal weight in the rail. A product-designer review of `/conversation` flagged this symmetry as a source of clutter, and a user insight reframed the underlying model:

> *"Personas serão múltiplas em uma conversa, como se fosse um time que vai se formando, cada uma dando uma opinião diferente a cada momento. Journeys e orgs tendem a ser mais estáveis."*

**Decision:** treat persona and scope asymmetrically in the UI and in the forward roadmap.

- **Personas = cast.** A mutable ensemble that forms across a conversation. Multiple can participate over time; [CV1.E7.S5](roadmap/cv1-depth/cv1-e7-response-intelligence/) will allow multiple to participate *within a single turn*. The visual language is **cast** — avatars, accumulation, timeline, "who spoke when."
- **Scope = context.** Orgs and journeys establish what the conversation is *about*. They change rarely. The visual language is **pills** — stable, secondary, quiet.

**Consequences:**

- **CV1.E7.S2** reshapes `/conversation` around this asymmetry: a new **conversation header** above the chat with a Cast zone (avatars) and a Scope zone (pills), plus a mode pill and a menu. The rail slims to two disclosures (`Edit scope ›`, `Look inside ›`). Message bubbles gain a persona signature — lateral color bar + a mini-avatar that renders only when the persona changes from the previous turn.
- **The per-message `◇ persona` text badge retires.** Its signal is carried by the bubble signature (richer and more legible). The corresponding suppression rule for persona (added during CV1.E7.S1 refinement) becomes dead weight and is removed.
- **`◈ organization` and `↝ journey` badges stay** with their existing pool-suppression rule. Scope stability fits the badge-in-pool pattern exactly; cast mutability does not.
- **Voicing for multi-persona turns.** When S5 enables multiple personas per turn, the ego remains the single voice (CLAUDE.md principle: *"o espelho tem uma única voz — o ego. As personas são lentes especializadas"*). Two voicing modes: **integrated** (one coherent response that uses multiple lenses implicitly — default) and **segmented** (explicit `◇ X` / `◇ Y` transitions within the response — opt-in when the user asks for distinct perspectives or when domains genuinely diverge). Reception will classify the voicing alongside the persona set.

**What this reopens from S1:** the badge-in-pool suppression for persona, shipped as a refinement to S1, gets removed in S2 Phase 8. Not a bug fix — a design evolution. Orgs/journeys keep the suppression rule.

---

### 2026-04-24 — Response intelligence moves from prompt to pipeline (CV1.E7)

From CV0 through CV1.E6, the mirror's intelligence lived almost entirely **in the prompt**. Every turn composed a single system prompt (`self/soul → ego/identity → persona → organization → journey → ego/behavior → ego/expression → adapter`) and sent the whole bundle to one LLM call. Reception was the only exception — a pre-classification pass that already proved the pattern works.

Starting with [CV1.E7.S1](roadmap/cv1-depth/cv1-e7-response-intelligence/cv1-e7-s1-expression-pass/), response generation becomes a **pipeline** of named steps. Each step earns its place: classification when routing is needed, expression when form is needed, retrieval when context is needed, composition when the prompt is assembled. Identity layers stop being concatenated wholesale and start being activated conditionally.

**Why now.** The v0.13.0 Product Use Narrative populated the system with four family members whose natural interactions are short, lived-in exchanges ("Had coffee with Mike Fraser this morning."). The current single-prompt architecture answers all messages with the same compositional shape — long, structured, list-shaped by default — because form rules (`ego/expression`) compete with substance rules (`self/soul`, personas, scopes) inside a single weight budget. Separating form from substance, and activating layers only when the turn warrants them, is the first real move to honor the briefing's premise #5: *"Every token in the prompt must earn its place."*

**Tracer bullet (S1).** `ego/expression` is the smallest identity footprint and the clearest pain signal. It moves out of compose and becomes input to a dedicated second LLM call (small model, `expression` role in `config/models.json`, same ops shape as `reception` and `title`). A response mode (`conversational` / `compositional` / `essayistic`) is auto-detected by reception as a fourth axis and overridable from the Context Rail, persisted per session. Always on in v1; conditional skipping waits for real latency / cost signal.

**What S1 explicitly does not do.** No general pipeline runtime, no stage registry, no `Step<In, Out>` abstraction. Expression is wired as a concrete function on the hot path. Abstraction earns its place after 3+ steps exist ([CV1.E7.S7](roadmap/cv1-depth/cv1-e7-response-intelligence/)). Agent-per-request ([briefing D7](briefing.md)) stands; pipeline steps are called inside a single HTTP request.

**UX commitment.** Two-phase status indicator during generation: *Composing…* while the main Agent produces the draft (hidden from UI), then *Finding the voice…* as the expression pass starts, then the final text streams. Accepts a worse total p95 latency in exchange for honest staging — the old direct-stream is the UX cost of the pass.

**What this re-sequences.** CV1.E4.S2 (Attachments) attaches to the future retrieval step (CV1.E7.S6). CV1.E4.S3 (Filter memory by scope) folds into CV1.E7.S3 (Conditional scope activation). CV1.E3.S3 (Long-term memory) couples with CV1.E7.S6. CV0.E4.S8 (Continue curated) is unaffected.

---

### 2026-04-21 — `resolveApiKey` as the single seam for API-key resolution (CV0.E3.S8)

Before this story, five call sites read `process.env.OPENROUTER_API_KEY` directly: `server/reception.ts`, `server/title.ts`, two paths in `server/summary.ts`, and the `Agent` callbacks in `adapters/web/index.tsx`, `adapters/telegram/index.ts`, and `server/index.tsx`. All five now go through `server/model-auth.ts :: resolveApiKey(db, role)`.

**Why a single seam instead of inline auth branches at each call site.** Extending to a new auth variant (per-user keys, vault integration, additional OAuth provider with a non-default shape) requires a one-file edit rather than a six-file grep-and-patch. Future work on usage logging (radar S6) also gets a natural hook — the resolver is the one place that sees every LLM call's role and credential source.

**Why the Agent callbacks wrap resolveApiKey in try/catch.** `pi-agent-core`'s `getApiKey` contract says *must not throw, must not reject*. `resolveApiKey` throws `OAuthResolutionError` when credentials are missing or refresh fails — by design, so direct callers (like `reception`) can decide their fallback. The Agent callbacks translate that into `return undefined`, which surfaces as a normal provider failure in the stream.

---

### 2026-04-21 — OAuth credentials stored as a JSON TEXT blob, one row per provider (CV0.E3.S8)

`oauth_credentials(provider TEXT PRIMARY KEY, credentials TEXT NOT NULL, updated_at INTEGER NOT NULL)`. The `credentials` column is the full JSON object pi-ai returns from its login flow (refresh, access, expires, plus provider-specific fields like `project_id` for Google).

**Why not a sparse column-per-field schema.** The blob shape differs per provider — `project_id` is Google-only; GitHub Copilot carries a few others. A flat schema either sprouts provider-conditional columns or collapses into a TEXT catch-all. JSON serialization is simpler, survives pi-ai schema additions without migrations, and round-trips fine through `getOAuthApiKey` which expects the full shape.

**Why not merged into the `models` table.** Credentials are per-provider; models are per-role; multiple roles may share a provider. Credential rotation has a different lifecycle than model config. Keeping them in separate tables matches the real shape of the data.

---

### 2026-04-21 — Reception default changes to Gemini 2.5 Flash with reasoning=minimal

Post-release validation of CV1.E4.S1 opened a calibration step: with reception now a three-axis classifier, which model actually handles the job best *per real evidence*? A three-model eval ran against the production DB (14 personas, 1 organization, 2 journeys) using the 11-probe scope-routing eval.

**Results:**

| Model | Score | Latency (min–max) | BRL/1M in+out |
|-------|-------|-------------------|----------------|
| Claude Haiku 4.5 | 9/11 (82%) ✅ | 1.3s – 2.6s | 5 / 25 |
| Gemini 2.5 Flash (w/ reasoning=minimal) | **9/11 (82%)** ✅ | 1.1s – 3.0s | 1.5 / 12.5 |
| Gemini 2.5 Pro | — (blocked) | — | 6.25 / 50 |

**Key finding:** Gemini 2.5 Flash needed `reasoning: "minimal"` to match Haiku. Without it, Flash scored 8/11 — the model was over-activating scopes by inferring connections across them ("financial question → also ping the user's financial journey even when the question named a different scope"). Disabling reasoning made Flash more decisive and more conservative, closing the gap with Haiku on the probe that differentiated them.

**Gemini 2.5 Pro** performed well upstream (direct curl to OpenRouter returned valid content + reasoning) but pi-ai returned `content: [], stopReason: "error"` — a parsing issue in the OpenAI-compatible adapter's handling of Gemini 2.5 Pro's response shape. Revisit when pi-ai patches, when `google-gemini-cli` OAuth provider is wired (different path), or if the reception prompt grows complex enough to justify a custom fetch bypass.

**Rule:** `reception` seeds to `google/gemini-2.5-flash` via OpenRouter in `config/models.json`. Running installations on Haiku keep their DB config unchanged. The `reasoning: "minimal"` option is applied universally in `server/reception.ts` — across all providers, reception is classification, not reasoning.

**Cost:** drops from ~R$0.002/call (Haiku) to ~R$0.0008/call (Flash) — 2–3× reduction. For typical single-user traffic (200 msg/day), savings of R$5–10/month, trivial in absolute terms but meaningful across future multi-user deployments.

**Path to zero:** when the OAuth story lands (Code Assist for Individuals via pi-ai's `google-gemini-cli` provider), Gemini 2.5 Flash runs inside Google's free tier for individual developers. The migration is a credential swap plus a provider rename — the model is already validated at 9/11 accuracy.

**Supersedes** the 2026-04-20 decision ("Reception defaults to Haiku 4.5") — that decision was made before the eval with real data existed. The prompt engineering learnings preserved there (complementarity, sole-scope-in-domain rule, display name in listing) still stand and apply across all three tested models.

---

### 2026-04-20 — Reception defaults to Haiku 4.5 for scope-aware routing

During manual validation of CV1.E4.S1, reception consistently failed to activate a journey when the user asked a question whose domain clearly matched a single journey (the "sole-scope-in-domain" case). The concrete scenario that surfaced the problem:

- User: `vida-economica` (personal journey about the financial crossing, descriptor mentions burn, runway, budget).
- Message: *"quanto sobrou no caixa este mês?"*.
- Reception on Gemini Flash Lite: `persona: tesoureira, journey: null`.

The persona activated (finance domain handled), but the journey was skipped — the LLM treated persona and scope as competitors rather than complementary axes. Three rounds of prompt engineering (make axes independent, replace "loosely overlaps" with positive activation criteria, mandatory sole-scope rule with a pre-return self-check) did not recover the journey on Flash Lite.

Swapping reception to `anthropic/claude-haiku-4.5` (same model as `main` since v0.7.0) fixed the routing immediately, with the same prompt. The conclusion is that scope routing across three axes and 17+ candidates exceeds what lite models can do consistently — not a prompt problem but a capacity problem.

**Rule:** reception role seeds to Haiku 4.5 in `config/models.json`. Admins can downgrade via `/admin/models` per install; reception falls back silently on any classification failure, so a weaker model degrades gracefully (persona and scopes come back null) rather than routing wrong.

**Cost:** ~R$0.002 per reception call at current Haiku pricing vs ~R$0.0002 for Flash Lite. ~10× more expensive but still trivial in absolute terms — for a single user at 100 messages/day, roughly R$6/month extra. Worth the fidelity: scope routing is the value proposition of CV1.E4, and a mirror that fails to know where the user is makes the whole Journey Map surface less useful than it should be.

**The title role stays on Flash Lite.** Title generation is one-shot summarization on a single layer's content, not multi-axis routing. Flash Lite handles it fine; the cost asymmetry argues strongly for keeping it cheap.

**What this says about future design:** multi-axis classification is harder than single-axis. If reception grows more axes (topic shift detection, attachments needed, semantic queries — see [memory taxonomy §Reception envelope](../product/memory-taxonomy.md#how-the-reception-layer-routes-across-this-map)), expect the cost curve to justify even stronger models, or to motivate splitting reception into a pipeline rather than a single call.

**Prompt-engineering learnings preserved**, even though they didn't fix this specific case:
- Scope and persona are complementary, not competing (persona = voice, scope = situational content).
- Sole-scope-in-domain is a valid heuristic — when the user has exactly one journey covering a domain, questions in that domain activate it.
- Display name in candidate listing matters (`- key ("Name"): descriptor`) — natural mentions need the name visible to the classifier.

---

### 2026-04-20 — Four-surface model: Cognitive Map, Journey Map, Memory Map, Rail

When the CV1.E4.S2 attachments design surfaced, the question came up: where do attachments live in the UI? The options were *inside the scope workshop only*, *inside the Cognitive Map's memory column*, or *a new surface for memory*. Each first two option fails under scale: attachments are cross-scope (one PDF attaches to multiple journeys or to an organization), and the Cognitive Map's memory column was designed as a lateral teaser, not a full surface.

Zooming out revealed a model already implicit in the [memory taxonomy](../product/memory-taxonomy.md) from its first draft — which promised *"future surfaces (episodic browse, reflexive summaries) show other memory roles"*. Attachments made that future concrete, and named a fourth surface.

**Rule — four surfaces, four questions:**

| Surface | Question | Timeframe |
|---------|----------|-----------|
| **Cognitive Map** (`/map`) | *Who am I — structurally?* | Stable — psychic architecture |
| **Journey Map** (`/organizations`, `/journeys`) | *Where am I — contextually?* | Situational — active crossings |
| **Memory Map** (`/memory`) — planned CV1.E6 | *What do I carry — across time?* | Accumulated — grows through use |
| **Context Rail** (on `/mirror`) | *What's active — right now?* | Ephemeral — the composed turn |

Three persistent surfaces + one transient view. Each answers a distinct question in a distinct temporal register.

**Corollaries:**

1. **The Cognitive Map's memory column evolves into a teaser.** Stays on `/map` as the spatial anchor for "memory runs perpendicular to structure", shows aggregate counts, links to `/memory`. Not a replacement.
2. **Journey Map's detail pages remain the *scoped* cut.** Same memory data, filtered by scope FK. Memory Map is the *global* cut.
3. **Attachments are the first mechanism that crosses all three persistent surfaces.** They appear inside scope workshops (Journey Map), in the library (Memory Map), and in the aggregate counts (Cognitive Map's teaser). This is expected, not a bug — polymorphic associations (see [Attachments are first-class](#2026-04-20--attachments-are-first-class-with-polymorphic-scope-associations)) make it coherent.
4. **Future memory mechanisms get a home by default.** Extracted memories, tasks (when agentic lands), reflexive logs — each slots into a Memory Map section without needing a new surface. The model prevents surfaces from absorbing concerns they weren't designed for.

**Concept doc:** [Memory Map](../product/memory-map.md) — full definition of the surface, what it contains, and what it does not do.

---

### 2026-04-20 — Attachments are first-class with polymorphic scope associations

When designing how documents and URLs attach to scopes, the naive path was a per-scope attachment table: `journey_attachments`, `organization_attachments`, and eventually `persona_attachments`, `session_attachments`, etc. Each would carry its own upload, chunking, embedding, retrieval, UI. The same PDF would be uploaded multiple times if the user wanted it on more than one scope. Replicating the infrastructure across scopes is the shape the architecture must avoid.

**Rule — three parts:**

1. **Attachments are a first-class memory entity.** A single `attachments` table holds the document itself (`source_type`, `source_ref`, `title`, `content_summary`, timestamps). A single `attachment_chunks` table holds the chunked, embedded text for retrieval. Upload, chunking, embedding, summary generation, and retrieval all live once.

2. **Scopes associate, don't own.** A polymorphic `attachment_links(attachment_id, target_type, target_id)` table expresses the many-to-many relationship. One attachment can link to an organization, a journey, a persona (future), the user themselves, etc. Any new scope becomes attach-able without a new table — just a new `target_type` value.

3. **Many-to-many is accepted for attachments specifically.** The general rule (one data point, one scope) stays for structured scope data; attachments are the exception because reference material is inherently cross-cutting — a philosophy PDF can legitimately inform vida-filosofica *and* mirror-mind design reasoning. Duplicate uploads for the same content would be a worse outcome than the complexity of the association table.

**Why this shape matters beyond CV1.E4:**

The same polymorphic pattern extends naturally to the other cross-cutting memory mechanisms. When extracted semantic memories (CV1.E3.S3) land, they follow the same shape: `semantic_memories` + optional polymorphic links, not `journey_memories` + `organization_memories`. When the agentic turn lands and tasks return, the same logic applies: `tasks(journey_id nullable, organization_id nullable)` — the exception for attachments is that *both* scope types can apply simultaneously, hence polymorphic links rather than two nullable FKs.

**Briefing-from-attachments as a derived flow:** once attachments live under a scope, a lite-model summarization over their `content_summary` fields can draft a briefing for the user to edit. Same pattern the identity-layer summaries established. Not in CV1.E4.S1; lands in S2 or later.

**Concept doc:** [Journey Map § Channels and attachments discussion](../product/journey-map.md) and the CV1.E4.S2 plan (when written).

---

### 2026-04-20 — Journey Map as a peer surface; a scope is not a layer

CV1.E4's original sketch placed journeys as a new `identity` layer alongside `self`, `ego`, `persona`. CV1.E5.S1 (from the Identity Lab spike §9.6) planned the same thing for organizations. Both framings break as soon as the scope needs to carry more than text — situation that evolves, attached documents, filtered sessions, journeys belonging to an organization. None of that fits the `(layer, key, content, summary)` shape the identity table was built for.

**Rule — four parts:**

1. **Both organizations and journeys are scopes over memory, not identity layers.** Each gets its own table: `organizations(briefing, situation, summary, status, ...)` and `journeys(briefing, summary, status, organization_id nullable, ...)`. Future memory mechanisms (sessions, attachments, extracted memories) gain nullable `journey_id` and/or `organization_id` FKs — the ligaments that scope each role from the memory taxonomy. One piece of data belongs to at most one scope (many-to-many rejected).

2. **Organization is a broader scope that may contain journeys.** One organization has many journeys (1:n). A journey has at most one organization; personal journeys have none. Organization briefing has a sibling `situation` field because real organizational content carries a stable identity *and* a distinct current phase. Journey gets the same `situation` field in S2, with the same semantic — symmetric naming for symmetric roles.

3. **The Journey Map is two peer surfaces to the Cognitive Map.** `/organizations` and `/journeys` each list and author their scope. Journeys group visually by organization on `/journeys`, but editing an organization happens on its own page. The Cognitive Map stays tuned to psychic structure; neither scope gets a card there. The Cognitive Map's memory column remains *global*; the Journey Map shows the *scoped* cut.

4. **The composer injects both scopes, broader before narrower.** Slot: `soul → identity → persona → organization → journey → behavior → expression → adapter`. Reception returns `{ persona, organization, journey }` — three independent signals chosen in one LLM call. A user can talk about an organization without a specific journey, or vice versa — independence is required.

**Why this shape matters beyond CV1.E4:**

The structure-vs-scope distinction parallels the structure-vs-memory distinction [already in the memory taxonomy](../product/memory-taxonomy.md#a-note-on-structure-vs-memory). The Cognitive Map edits the *continent* (who the mirror is). The Journey Map operates the *regions* (where the user is crossing, and what broader containers those regions belong to). The rail shows the *composition* of this turn. Three surfaces, three different questions, three shapes that don't compete for the same card grid.

**Consequence:** CV1.E5.S1 (*Organization layer*) is deleted. CV1.E5 keeps only S2 (per-persona personal context) and S3 (semantic memory).

**Concept doc:** [Journey Map](../product/journey-map.md) — the canonical description.

---

### 2026-04-20 — Agentic turn deferred; CV1.E4 stays in the prompt/chat paradigm

The first CV1.E4 plan considered task management as the MVP for a shift into agentic behavior (the mirror does small things via tool use, not only responds). After talking to users, the direction changed: there is still substantial unexplored value in the chat/prompt paradigm itself, and forcing the agentic turn now is engineering chasing a destination the product hasn't yet needed.

**Rule — three parts:**

1. **Tasks are removed from CV1.E4 entirely.** The epic stays pure scope substrate — briefing, situation, documents, filtered memory. All through the chat/prompt paradigm. No tool use inside CV1.E4.

2. **After CV1.E4, focus shifts to memory (CV1.E3).** Scope without a rich substrate of scoped memory is partial. The order — scopes first, then memory — stacks cleanly: when CV1.E3 lands, sessions and extracted memories get scope FKs naturally.

3. **Agentic turn stays on the Radar as a future direction.** When reached: spike on pi-agent-core tool use first, tasks as the MVP (bounded verbs, visually verifiable, low blast radius), task management as the first scope-aware agent capability. Proactive triggers depend on that foundation landing first.

**Why defer matters:**

The v0.7.0 voice-tuning work revealed that prompt-level investment still produces meaningful product improvements. A premature pivot to agentic would have abandoned a productive seam to chase a harder one. Deferring lets the scope substrate (CV1.E4) and the memory mechanisms (CV1.E3) land well before agentic complexity (tool protocols, oversight UX, permission model, agent evals) needs to be addressed.

---

### 2026-04-18 — Session titles via a fire-and-forget cheap model role

CV1.E3.S4 preserves old sessions in the DB when the user clicks *Begin again*, so that a future episodic-browse surface can list them. Without titles, that list would be a wall of timestamps. Generating titles is the moment's responsibility; deferring meant piling up untitled rows to backfill later, which is more effort than bolting title generation onto the natural "session ends" event.

**Rule — three choices:**

1. **New model role `title`** in `config/models.json`, semantically distinct from `reception` (classification) and `main` (response). Conceptually clean: classification ≠ summarization. Practically, today both reception and title point at the same cheap model (Gemini Flash lite), but the split means the admin-models UI (CV0.E3.S1) can tune them independently.
2. **Fire-and-forget.** The HTTP response redirects immediately; the title generation runs async, writing the result to `sessions.title` whenever the model responds. Begin again stays instantaneous.
3. **Fail-silent fallback.** If the API errors, times out, or returns garbage, the session stays with `title = NULL` and the future browse surface falls back to "Untitled conversation". A single log line records the failure. Users never wait on a title; the worst case is a session with no label, not a broken user flow.

**Why this shape matters beyond S4:**

The pattern — cheap background LLM call, own model role, fire-and-forget — is the template for future background tasks like compaction (summarizing old history) and semantic memory extraction. Establishing it cleanly now means the next time we want a background LLM call, the tooling is already there.

**Destructive Forget doesn't generate a title** — the session is about to be deleted, so there's nothing to label.

---

### 2026-04-18 — New user creation seeds only ego/behavior, not self or identity

User creation (both the admin web UI at `POST /admin/users` and the admin CLI `admin user add`) used to seed all three base layers — `self/soul`, `ego/identity`, `ego/behavior` — from template files in `server/templates/`. Surfaced during S10: because everything was pre-filled, the Cognitive Map's empty-state invitations never appeared for a newly created user. Worse, the `soul.md` template carried parenthetical placeholders inside the content (*"(Describe the mirror's primary function for you.)"*), functioning as an invitation in disguise that was easy to miss and gave the user a generic voice that wasn't theirs.

**Rule:** only `ego/behavior` is seeded on user creation. `self/soul` and `ego/identity` are left empty, so the new user lands on `/map` and sees those two cards' invitations immediately — teaching what each layer is for and inviting them to declare it themselves.

**Why ego/behavior stays seeded:** it's the operational baseline the mirror needs on turn one — tone, constraints, posture. Without it, `composeSystemPrompt` would return either nothing or only the user's own writing, leaving the LLM with no behavioral guardrails until the user wrote behavior rules themselves. Functional safety outweighs onboarding purity for this one layer. The template is small and practical (not a personal voice) so it reads as framework, not identity.

**What was deleted:** `server/templates/soul.md` and `server/templates/identity.md`. Both were either empty shells or half-baked placeholders that served no real purpose once the map's invitations existed.

**Implication — self-sovereignty of identity:** the deeper layers (self, identity) are now always the user's own writing. Templates for them can come back later as *optional* starting points offered inside the Workshop editor (radar), but imposing them on creation was the wrong default.

---

### 2026-04-18 — Identity layers are ordered by psychic depth, not alphabetically

`getIdentityLayers` used to return layers with `ORDER BY layer, key` — alphabetical, which meant `ego` preceded `self` and `persona` preceded `self`. The inversion was harmless when layers were internal config but became visible and wrong the moment the Cognitive Map's Layer Workshop (S8 phase 2) started surfacing the composed system prompt to users.

**Rule:** layers are ordered by their position on the psychic depth gradient — `self` (essence) → `ego` (operational) → `persona` (specialized voice) → anything else — with `key` as the tiebreaker within a layer.

**Where it matters:**

- `composeSystemPrompt` consumes layers in order. With the old alphabetical ordering, the composed prompt opened with `ego/behavior` and ended with `self/soul` — foundation at the bottom, operational rules at the top. With depth ordering, the LLM reads the foundation first and the behavioral rules last, which matches the narrative logic of the psyche (ego emerges from self, behavior refines ego).
- The Workshop preview now reads top-to-bottom exactly as the user expects from the map's vertical layout: self at the top, ego below, persona when present.
- UIs that list layers (admin pages, future map views) inherit the narrative order for free.

**Why the fix lives in the SQL, not in callers:** psychic-depth order is intrinsic to the domain. Pushing the sort into each caller would duplicate the rule and risk drift. Ordering at the source means every consumer inherits the correct narrative order without thinking about it.

**Cost of the change:** one test had to be updated; behavior of existing installations changes silently (every composed prompt now leads with `self` instead of `ego`), which is the intended correction, not a regression. No data migration needed.

---

### 2026-04-18 — Dedicated Identity Workshop page per layer, not inline edit

The initial S8 plan had cards on `/map` expanding inline to a textarea for editing. A design review flipped this: each structural layer (self/soul, ego/identity, ego/behavior) gets its **own dedicated workshop page** at `/map/<layer>/<key>`. The `/map` route becomes a dashboard of layer overviews; real configuration happens one level deeper.

**Why the pivot:**

- **Weight matches the act.** Editing the prompt that defines the mirror's soul is not a quick tweak — it's a considered act of identity configuration. An inline textarea punishes that act: cramped, distracted, no room to think. A focused page honors it.
- **Opens the door to test surfaces.** A dedicated page has room for more than an editor — a composed prompt preview (v1), and later a test chat where the user iterates against the mirror using their draft identity (follow-up story). These surfaces don't fit inline; they need space.
- **Better mental model.** `/map` as dashboard + layer pages as workshops matches how the user will actually work: open the map to see the whole, drill into a layer when you want to shape it.
- **Scales.** Future psyche layers (shadow, meta-self) slot in as their own workshop pages without bloating the dashboard.

**V1 scope of the workshop page:**

- Breadcrumb + large editor (textarea with generous height).
- **Composed prompt preview panel** alongside the editor — shows the full system prompt with the user's *draft* content applied (not the saved content). Updates live as the user types, so the effect of each word is visible. No LLM call, no cost — just the composition function already used in `server/identity.ts`.
- Save / Cancel buttons. Save persists and redirects to `/map`. Cancel navigates back without persisting.

**Out of scope for v1, registered as follow-up:**

- **Test chat per layer.** A mini-chat on the workshop page that lets the user send messages and see the mirror's response using the draft identity. Valuable but substantial: requires reception + LLM calls, streaming, cost accounting. Deserves its own design and plan. Registered on the CV0.E2 radar as "Identity Workshop test chat."
- **Edit history / diff view.** How the layer has evolved over time.
- **Side-by-side compare** with another user's equivalent layer.

**What this changes in /map:**

Cards on the dashboard stop expanding. They become clickable, each one a link to its workshop. The card body shows overview content — word count, a preview of the first line, maybe last-edited date. Empty layers show invitations with a CTA to open the workshop and write.

---

### 2026-04-18 — Personas render as a single card with badges, not a card each

In the Cognitive Map (S8), structural layers each get their own card (self, ego, skills). Personas are the exception: rendered as a single "Personas" card containing a grid of persona badges (initials + color avatar + name), with an inline editor appearing inside the card when a badge is clicked.

**Why:**

- **Hierarchy is honest.** Personas are specialized expressions of the ego, not peers of the self or the ego. Giving each persona a top-level card would flatten a real structural distinction — 13 persona cards next to 1 self card would claim equal weight for things that don't have equal weight.
- **Scale.** Today there are 13 personas; more will come. A card-per-persona map would dominate visually and scroll past the structural layers that actually shape the psyche.
- **Scan frequency vs edit frequency.** Users look at which personas exist often; they edit a specific prompt rarely. The grid of badges optimizes for fast survey; the inline editor keeps the edit path short when it happens.
- **Visual consistency with the rail.** The rail already uses initials + color avatar for the active persona. The map's Personas card speaks the same visual vocabulary — the reader recognizes "same persona" across surfaces without explanation.

**What this doesn't include (v1):**

- **Tooltip descriptors.** Not viable on mobile; risk of clutter if added to the visible badge. If scan-by-name proves insufficient, revisit with a subtle one-liner under the name rather than hover.
- **Persona filter.** Badges + visual grouping handle today's count. A filter input at the top of the card kicks in past ~20-25 personas; not before.
- **Drag-to-reorder.** Order is alphabetical or insertion-based in v1. Reorder is a future refinement.

**Rejected alternative:** a separate `/map/personas` route. Would have kept the main map clean but made personas feel second-class when they're central to the mirror's voice. The single-card-with-badges form keeps personas *in* the map, not adjacent to it.

---

### 2026-04-18 — Cognitive Map and Memory are distinct concepts (S8 renamed)

S8 was framed as "Memory Workspace" — a page where the user edits identity, personas, and future journey/extension layers. During a product-designer review, the framing broke: **the mirror's structure is not its memory**. The structure (self, ego, personas, and future skills, shadow, meta-self) is *who the mirror is*; memory (attention in the moment, episodic across conversations, extracted semantic facts) is *what the mirror carries*. Calling the structural workspace "Memory" conflated the two and would have crammed future features (shadow, episodic browsing) into the wrong surface.

**Rule — three consequences:**

1. **S8 renamed** from "Memory Workspace" to "Cognitive Map". Route moves from `/memory` to `/map`. The page edits the psyche's architecture, not its accumulation.
2. **"Extensions" renamed to "Skills"** everywhere the concept means "what the mirror knows how to do" — as a map layer, as a reception envelope field (`skillsActivated`), and in all forward-looking references. The word *extensions* is software vocabulary (plugins, add-ons); *skills* is psychological vocabulary and fits the Jungian framing. The one exception is the repo-packaging discussion in [Monorepo vs submodules](#2026-04-14--open-question--monorepo-vs-submodules-vs-convention), where "plugins (extensions)" refers to code distribution, not the map layer — that sense stays as-is.
3. **Memory now has three explicit surfaces in the epic:** the rail (attention, shipped in S9), the map (structure, S8), and — as a radar item — an episodic browse surface that comes when CV1.E3 long-term memory lands. Naming each one separately keeps them from colliding.

**Amendment (same-day design session):** memory also has a **portal card on the map itself**, placed as a **lateral column on the right** rather than as a row below skills. The lateral placement encodes something the bottom-of-stack placement would have hidden: **memory is perpendicular to structure, not sequential to it**. It traverses all psychic layers — self has memory (origin story), ego has memory (patterns), personas have memory (developed styles), skills have memory (procedural). Putting memory alongside the whole stack spatially says "this flows through everything you see"; putting it below would have said "this comes after." The card is read-only, holds high-level stats + shortcuts to other memory surfaces (rail, future episodic browse, future insights), and is visually distinct — outside the warm cream→amber→clay gradient, rendered in a neutral-cool tone to signal it's a different category of content, not a psyche layer. This also creates consistent spatial grammar with `/mirror`: the rail sits on the right on the mirror page, memory sits on the right on the map page — "what the mirror carries" always lives in the right periphery.

**Why it matters beyond naming:**

- **Scales with the Jungian framing.** Shadow, meta-self, and whatever comes after are structural layers. They fit as map cards. They don't fit as "memories."
- **Vocabulário soberano.** "Mapa" is in the user's lexicon (distinção mapa ≠ território); "memory workspace" isn't. Language that ressoa with the project's filosofia.
- **Prevents future surface collisions.** Without this distinction, a future "conversations browse" feature would have no honest home — the map is wrong, the rail is wrong. With the distinction, episodic browse has a slot reserved.

**Docs updated to match:**

- Epic index goal rewritten to describe both surfaces (structure + live memory) instead of conflating them under "memory."
- `memory-taxonomy.md` gained a charnière paragraph at the top clarifying that the cognitive roles (Attention, Identity, Episodic, etc.) are *content* roles; the structure (map) holds them but isn't equal to any single role.
- Top-level roadmap S8 row rewritten. Radar gained an "Episodic memory surface" entry.
- Earlier decisions that mentioned "extensions" as a map concept were updated to "skills" where relevant.

---

### 2026-04-18 — Push at story completion, not per-release

The project's earlier rule was "push only when asked," which in practice meant completed stories accumulated locally without a remote mirror. After shipping S7, the `origin/main` branch was three commits behind — a real backup gap for a symbolic win (tidy push history).

**Rule:** push `main` to `origin` once a story is truly done — review pass closed, status docs updated, tests green, user confirmed. One story = one push event, regardless of how many commits it contains.

**Why not per-commit:** review passes generate multiple commits that make sense together. Pushing each one separately scatters the narrative.

**Why not per-release:** releases bundle three to five stories across weeks; waiting trades a real backup cost for nothing. Release becomes a tag event (`git tag vX.Y.Z && git push --tags`) on commits already on origin.

**Backlog and doc-only commits** ride along with the next story's push. They don't earn a push on their own because they don't ship user value, and the cost of letting them wait is zero.

**Escape valve:** if a story stretches across sessions and needs a remote backup mid-flight, push a WIP branch (`wip/<story>`) rather than `main`. Rebase into `main` when the story closes. Frequent use of this valve is a signal that stories are too big.

The user still confirms "it works" before status update and push. The rule is about *when*, not *whether*.

---

### 2026-04-18 — Primary route renamed from `/chat` to `/mirror`

The primary workspace route is now `/mirror` (was `/chat`), and the menu entry follows. The rename reflects what the page actually is: a place where the user meets the mirror, not a chat window. The chat affordance is one element inside the mirror page; attention memory (rail), composed identity, and future journey/workspace integration are others.

**Backward compatibility:** `/chat` stays as a thin redirect to `/mirror`, so bookmarks and shared links keep working indefinitely. Removing it would be cosmetic — the cost is a couple of lines, the benefit is zero broken links forever.

**Internal names preserved:** `chat.js`, `.chat-shell`, `.chat-form`, `#chat-input` stay. They describe the chat affordance within the mirror page, not the page concept. Renaming them would churn DOM without clarifying anything.

---

### 2026-04-18 — Retroactive admin promotion on migration, not a CLI command

When adding the `role` column to `users`, existing installations have no admin — every legacy user would default to `'user'` and lose access to admin features. We considered a CLI command (`promote --user <name>`) but rejected it: zero-friction upgrades matter more than explicit control here.

**Rule:** `migrate()` detects the "no admin" state and promotes the oldest user by `created_at` to admin. Same rule as the first-user-at-creation path, applied retroactively. Idempotent — once an admin exists, the promotion never runs again.

**Why:** the single-owner-per-install assumption holds for every known install (mine, Henrique's, anyone cloning the repo). The oldest user is the owner. Making them admin on upgrade is the boring correct answer, and no user has to know the migration happened.

**Edge case — multi-user installs:** for installs with multiple users and no admin, the *first* person who registered becomes admin. Newer users stay as `user` and an admin can promote them later (today via SQL; future: UI). Acceptable because multi-user-without-admin is a transitional state during upgrade, not a steady state.

---

### 2026-04-18 — 403 Forbidden for non-admin `/admin/*`, not a redirect

Non-admin users hitting admin routes get `403 Forbidden` with a plain response body. The alternative — redirecting to `/mirror` — was rejected.

**Why:** redirecting hides the permission boundary. A friendly redirect teaches users that admin URLs "don't exist" when they actually do and they aren't allowed to see them. 403 is honest about the system's shape: there is authority, you don't have it, this URL is real and protected. It also makes debugging authorization bugs straightforward — a 403 is unambiguous where a redirect looks like a routing issue.

---

### 2026-04-17 — Memory taxonomy organized in two axes (cognitive × storage)

Memory in the mirror is not a single shape. We adopt a taxonomy with two perpendicular axes:

- **Cognitive axis** (what role does this memory play): Attention, Identity, Episodic, Procedural, Semantic, Prospective, Reflexive.
- **Storage axis** (where it lives and how it's accessed): Identity layers (DB), Episodic entries (append-only), Records (typed SQL), Attachments (chunked + embedding), Semantic index (embeddings + hybrid search), KV (pointers and ephemeral state).

Any memory artifact is classified on both axes. A task is Prospective (role) stored as Records (mechanism). A PDF is Episodic/Semantic (role) stored as Attachments (mechanism).

**Why two axes:** a flat list conflates questions that should stay separate — "what is this memory for?" vs. "how do I read and write it?". Separating them lets us evolve storage without relocating meaning, and lets new cognitive roles (e.g., Prospective becoming first-class) reuse existing mechanisms.

**Origin:** the cognitive axis was drawn from a conceptual conversation by Henrique Bastos on agent memory types. Crediting him as conceptual co-author of [`docs/product/memory-taxonomy.md`](../product/memory-taxonomy.md), where the full map lives.

---

### 2026-04-17 — KV memory is for pointers and ephemeral state only

KV store is the most seductive and most dangerous shape. Without discipline it becomes an untyped landfill.

**Rule:** KV only for pointers and ephemeral state. If it has a schema, it's Records. If it's meaningful enough to search later, it's Semantic. If it describes the user, it's Identity.

Positive examples: `focus.current = "mirror-mind"`, `ui.rail.collapsed = false`, `last_topic_shift_at`.
Negative examples: burn rate (Records), mentor style preference (Identity), liked books (Semantic).

---

### 2026-04-17 — CV0.E2 expanded with Memory Workspace, Context Rail, and empty states

CV0.E2 grows from 7 stories to 10. The framing shifts: the web client is not a chat + admin page, it's the surface where the mirror's memory becomes **legible**. New stories:

- **S8 — Memory Workspace** (`/memory`) — a page with cards per layer, replacing the unified profile. Designed to grow — journeys and skills slot in as new card types without restructure. *(Later renamed to Cognitive Map at `/map`; see [2026-04-18 entry](#2026-04-18--cognitive-map-and-memory-are-distinct-concepts-s8-renamed).)*
- **S9 — Context Rail** — a right-side panel that shows **Attention Memory made visible**: active persona, session stats (messages, tokens, cost, model), composed context (identity layers loaded, persona active; journey and attachments when those mechanisms exist). Collapsible, persisted per user.
- **S10 — Empty states as invitations** — each memory card without content shows a textual invitation instead of a grey placeholder.

S9 is ordered before S8: the rail is smaller, visible on every chat screen, and produces usable feedback about what matters to show. That feedback refines S8.

---

### 2026-04-17 — Context Rail reflects composition, not reception decisions

Early thinking had the rail showing `reception → product-designer` — i.e., what the reception layer decided. That's wrong.

**What the rail reflects:** what entered the composed system prompt this turn. Layers loaded, persona applied, journey in play, attachments pulled in.

**What the rail does NOT reflect:** reception's raw classification output, log-level metadata, or internal routing decisions that didn't affect composition.

**Why this matters:** reception will soon emit many signals (persona, journey, topic shift, skills, semantic queries). Listing every decision in the rail would pollute it fast. Reflecting composition keeps the rail stable as reception grows — if a new signal affects the prompt, it appears naturally; if it doesn't, it's not the rail's business.

---

### 2026-04-17 — No soul/ego summary always visible in the rail

Condensing soul/ego into a persistent rail card was considered and rejected. Depth cannot live as wallpaper — within a couple of days, a permanent summary becomes invisible.

**Replacement:** a discrete footer link (`Grounded in your identity · open →`) that opens the Memory Workspace in a side sheet. Depth stays reachable, but keeps its weight.

---

### 2026-04-17 — Activity trail per-message discarded; the rail absorbs it

An earlier proposal added a thin line under each assistant message (`◇ persona · journey · N memories recalled`). With the rail showing the same signals continuously, per-message trails became redundant echo.

**Kept:** the `◇ persona` signature inside the message bubble (visual marker of the voice that responded, already part of v0.3.0).

---

### 2026-04-16 — Topic shift detection over manual "new conversation"

When the user changes subject mid-conversation, the accumulated history pollutes the new context. Instead of a "new conversation" button (which violates the principle of no commands — the user talks, the mirror acts), the **reception layer detects topic shifts** by analyzing recent history alongside the current message.

When a shift is detected, the server silently creates a new session. The user never sees a button, never issues a command. The mirror decides autonomously that the context has changed.

**Why:** the mirror's design principle is natural language as interface. Forcing the user to manage sessions breaks that premise. The reception layer already runs on every message — adding topic awareness is an extension of its existing role, not a new mechanism.

**Implementation:** reception gains a `topic_shift: boolean` field in its response. It receives the last N messages as context (phase 2 of the reception evolution, as planned). When `topic_shift: true`, the server creates a new session before composing the prompt.

**Registered as:** CV1.E3.S1 — first story of the Memory epic, before compaction and long-term memory.

---

## Open discussions

### Separation of mirror, identity, and plugins

**Raised by:** Henrique (April 2026)
**Status:** Open — no decision yet

Three concerns that need to evolve independently:

1. **Mirror (harness)** — the engine, shared by all users. Evolves as a product.
2. **Identity (user data)** — personal and private. Soul, ego, personas, journeys, database. Evolves with the person. Never shared.
3. **Plugins (extensions)** — per-user customizations (scripts, tools, integrations like WhatsApp processors, session-intelligence, xdigest). Sometimes shareable, sometimes not.

**The tension:** if mirror absorbs identity, you can't share code without fighting personal files. If identity absorbs mirror, same problem. If plugins enter either, they pollute the shared space or the personal space. Three separate repos is too bureaucratic.

**Options discussed:**

- **Monorepo with boundaries** — everything in one repo, `.gitignore` protects personal files. Simple but muddy.
- **Mirror as dependency** — user has their own repo, mirror is a package/submodule. Clean separation, more ceremony.
- **Convention-based** — `~/.mirror/` holds identity + plugins + data, the mirror repo is just the engine. Server-side, identity lives in the DB (already the case).

**Why it's not urgent now:** the group is small (4 people), all on the same VPS, identity is in the DB. The pain will grow when more people self-host and want to version their identity/plugins independently. Revisit when the first person forks the repo to customize.

**Key insight from Henrique:** "If we have 3 repositories, it's too bureaucratic. But if we don't separate, we'll always be fighting the wrong files." The right answer is probably a convention that *feels* like one repo but *behaves* like three.

---

### 2026-04-13 — Identity as layers, not a single column

The `users` table doesn't store identity. A separate `identity` table stores layers (`user_id`, `layer`, `key`, `content`). System prompt composed at runtime by joining layers.

**Why:** preserves the structured model from the POC (self/soul, ego/identity, ego/behavior). Each layer editable independently. Migration is layer-by-layer. Future layers (personas, knowledge, journeys) follow the same pattern.

**Supersedes:** briefing D5 originally described identity as a single TEXT column in `users`.

---

### 2026-04-13 — Docs organized by roadmap hierarchy

Docs for epics and stories follow the roadmap structure: `docs/project/roadmap/cv0-foundation/cv0-e1-tracer-bullet/` for the epic, `cv0-e1-s1-db-identity/` for stories within it. Each level contains its own docs (plan, test guide). Transversal docs (principles, admin CLI reference) stay in `docs/product/`.

**Why:** the folder structure mirrors the roadmap codes. Finding docs for a given story is navigating a path, not searching filenames.

---

### 2026-04-13 — POC Mirror as migration source, not just reference

The admin CLI includes `identity import --from-poc` to read layers directly from `~/.espelho/memoria.db`. New users get starter templates via `user add`.

**Why:** two onboarding paths from day one — migration for existing users, templates for new ones. Reduces friction for both.

---

### 2026-04-13 — Self-construction layer isolated from core

The mirror will be able to program itself (create tools, tables, logic) to serve each user's specific needs. This generated layer is strictly sandboxed — it cannot touch the core (identity, auth, sessions, agent runtime).

**Why:** the mirror needs to be genuinely useful for diverse needs (inventory, finances, social media) without becoming a monolith. Isolation protects stability while enabling unlimited per-user growth.

---

### 2026-04-13 — Roadmap hierarchy: CV → Epic → Story

Renamed the roadmap levels: Milestone (M) → Epic (E), Epic (E) → Story (S). CV remains. An epic is a cohesive block of work with done criteria. A story is an atomic delivery from the user's perspective. Folder structure follows: `docs/project/roadmap/cv0-foundation/cv0-e1-tracer-bullet/cv0-e1-s1-db-identity/`.

**Why:** the old Milestone/Epic naming was inconsistent — sometimes milestones existed, sometimes not. Epic/Story aligns better with what each level actually represents.

---

### 2026-04-13 — Nginx (Docker) instead of standalone Caddy for reverse proxy

The VPS already runs a Docker container (Zenith) with nginx on ports 80/443, with a Cloudflare Origin wildcard cert for *.softwarezen.com.br. Instead of installing a standalone Caddy, we added a server block to the existing nginx for `mirror.softwarezen.com.br`, proxying to `172.17.0.1:3000` (host from container). SSL handled by Cloudflare (Full/Strict) + Origin cert.

**Why:** ports 80/443 were already occupied by Docker. Fighting for ports or reconfiguring the existing infra would be more complex than adding a server block. The Caddy files remain in `deploy/` as reference but aren't used in production.

---

### 2026-04-13 — Web UI before Telegram in the tracer bullet

Web UI (chat + admin) moved from CV2 to CV0.E1.S5, before Telegram (now S6). Served from the existing hono server using JSX — no separate frontend build.

**Why:** the web is 100% under our control (no third-party dependency like BotFather), serves as admin interface immediately, and is easier to iterate on. Telegram can come after.

---

### 2026-04-14 — Reception as a dedicated layer before response

Personas (and later journeys, intents, topic shifts) require analyzing the user's message before composing the system prompt. This analysis happens in a dedicated **reception** step — a lightweight LLM call that classifies multiple signals at once and returns structured JSON.

**Decisions:**

- **Personas per user, in the DB.** Each user has their own personas (layer `persona`, key = persona id). Not global.
- **LLM-first routing.** No keyword matching. The reception model decides which persona(s) fit the message.
- **Structured output.** Reception returns JSON with multiple signals (`personas`, later `journey`, `intent`, etc.). One call, many signals.
- **Separate model for reception.** Configurable via `LLM_RECEPTION_MODEL` env var. Default: a fast/cheap model (Gemini Flash Lite or similar). Main response uses the quality model.
- **5s timeout.** Experience over latency. If reception fails, fall back to base identity (no persona layer).
- **Sum, not replace.** Personas add as a lens on top of `self/soul + ego/identity + ego/behavior`. They enrich, don't substitute.
- **Signature in code.** The `◇ persona-name` prefix is added by the server after reception decides the persona — not by the LLM.

**Why reception is strategic:** it's the critical step that makes the mirror *feel* alive. Over time, reception will evolve:

1. Stateless — classify current message (S1)
2. With recent history — detect topic shifts, reclassify
3. Metacognitive — detect patterns, suggest journeys, notice when the mirror isn't helping

Each stage adds context to the reception call. The architecture starts prepared: `receive(message, context)` where `context` is empty today and grows over time.

**Radar:** topic shift detection, caching of similar classifications, reception log in entries for post-hoc review.

---

### 2026-04-14 — Model config centralized in config/models.json

Models are an **application resource**, not an installation setting. Each model has a defined purpose (reception, main response, future: summary, embeddings, meta-review). Env vars don't scale — they can't express relationships, purposes, or typed defaults.

**Structure:** `config/models.json` versioned in the repo, one entry per purpose:

```json
{
  "main": {
    "provider": "openrouter",
    "model": "deepseek/deepseek-chat-v3-0324",
    "purpose": "Primary response model — quality and identity fidelity matter most."
  },
  "reception": {
    "provider": "openrouter",
    "model": "google/gemini-2.0-flash-lite-001",
    "timeout_ms": 5000,
    "purpose": "Fast classification — persona, intent. Speed over nuance."
  }
}
```

Loaded through `server/config/models.ts` as typed objects. Code does `models.main`, `models.reception` — no `process.env` reads for model choices.

**`.env` stays for secrets only:** API keys, tokens, ports.

**Why a `purpose` field:** future contributors and AI agents reading the config need to understand *why* each model was chosen. The purpose field is the instruction that guides model swaps (e.g., "we need faster reception" signals that `reception.model` should change, not `main.model`).

**Future evolution:** user-level overrides via a `user_config` table become possible without touching the code — `models.main` becomes the global default, DB provides overrides when present.

---

### 2026-04-15 — Telegram webhook processes updates asynchronously

grammy's `webhookCallback` waits for the handler to finish before returning HTTP 200 to Telegram. With reception (5s) + LLM (variable), total processing regularly exceeds grammy's internal 10s timeout. When that happens, grammy throws, Telegram never receives 200, and redelivers the same update — creating an infinite loop of duplicate replies.

**Fix:** the webhook route now returns 200 immediately and calls `bot.handleUpdate(update)` in a fire-and-forget pattern. Secret validation is done manually before processing. Errors are caught and logged.

**Why this matters for the architecture:** any future webhook handler (WhatsApp, etc.) must follow the same pattern: ACK fast, process async. Never hold the HTTP response open while waiting for an LLM.

---

### 2026-04-13 — Clients moved to adapters/ directory

CLI moved from `cli/` to `adapters/cli/`. Telegram will be at `adapters/telegram/`. All client adapters live under `adapters/`, each in its own subdirectory.

**Why:** clients are thin adapters that translate between a channel's protocol and the server. Grouping them under `adapters/` makes the architecture visible in the folder structure — server is the core, adapters are the edges.
