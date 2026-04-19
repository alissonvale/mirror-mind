[< Spikes](index.md)

# Spike: Identity Lab — closing the loop between writing identity and hearing its voice

**Date:** 18–19 April 2026
**Status:** Closed 19 April 2026
**Participants:** Alisson + Claude
**Nature:** Exploratory POC report — method-focused. The identity content worked on during this spike is private to the user's local DB. Only method, learnings, and decisions are captured here. Sections 1–6 capture the initial spike publication; sections 7–8 capture the second phase (prompt refinement and persona work) added at closing.

---

## 1. Motivation

The mirror's output didn't sound like its user. Editing the identity prompts directly (soul, ego/identity, ego/behavior) was the obvious remedy, but the loop was slow and blind: write prompt, test in a conversation, reread, rewrite. Every cycle depended on the user evaluating "does this sound like me?" against a moving target, without structured diagnosis of what specifically was off.

The proposed answer was an **Identity Lab**: a mode inside the mirror where a conversational agent interviews the user, proposes edits to identity layers, runs them through the real system prompt to simulate output, and iterates with the user until the voice lands.

This spike did not build that agent. It tested the loop itself — performing the agent's job manually, in conversation between the user and Claude — to see whether the mechanism works before committing engineering effort to automate it.

## 2. The loop as tested

The loop tested here is the one the future agent should automate:

1. **Diagnose** the current voice by running real questions through the mirror and reading the gap between its output and the user's actual voice.
2. **Extract material** from the user: ground-truth texts in varied registers, feedback on what sounds wrong and why.
3. **Distill invariants** from the material. Method of thought, stance, vocabulary, argumentative structure, all separated from ephemeral products (specific aphorisms, analogies constructed for past arguments, authors cited in one context).
4. **Propose edits** to the identity layers.
5. **Test in the real system prompt** by updating the DB and re-running the diagnostic question.
6. **Iterate** until the voice lands.

Steps 1 to 3 happened in conversation. Step 4 was done by Claude writing markdown. Steps 5 and 6 used two technical affordances described below.

## 3. Technical affordances added during the spike

### Lab mode (`bypass_persona`)

To isolate the voice of `self/soul + ego` from the modulation of personas, `/mirror/stream` now accepts `?bypass_persona=true`. When set, reception routing is skipped and the system prompt is composed from soul + ego only. The web UI gained a discreet "Lab mode — bypass persona" checkbox below the chat form, persisted in localStorage.

Shipped in commit `9a6dbf2` (roughly 6 lines of backend, 15 lines of frontend plus CSS). Not framed as a roadmap story: instrumental to the spike, but usable indefinitely as a debugging and design tool for future identity or persona work.

### Direct DB editing

Identity layers were edited by writing markdown to `/tmp/*.md` and running `UPDATE identity SET content = CAST(readfile('/tmp/X.md') AS TEXT)`. Brutal but sufficient for a single artisanal run. A backup of `data/mirror.db` was taken at the start of the spike; any bad edit could be reverted.

A proper **staging layer** (either a new column or a parallel row per layer, with `current` and `draft` states) was designed during the spike but not implemented. It becomes necessary if the iteration loop is repeated many times or automated, but is overkill for a one-shot design session.

### Incidental learning: `readfile()` returns BLOB

`readfile()` in SQLite returns a BLOB, not TEXT. Writing to a TEXT column without an explicit `CAST(... AS TEXT)` stores the content as a Buffer on the JS side, which breaks anything downstream that assumes string (`content.trim is not a function`). The rule for future writers: always wrap `readfile(...)` in `CAST(... AS TEXT)` when targeting a TEXT column.

## 4. Learnings

### On prompt engineering

**Specific examples in the prompt become recycled fodder.** Aphorisms listed inside the prompt as illustration reappeared verbatim in unrelated outputs. The model treats them as authorized vocabulary, not as illustration of a pattern. Removing specific examples and keeping only the conceptual rule, together with a meta-instruction against citing the prompt literally, fixed this.

**Anti-listicle rules persist at deeper levels than typography.** Prohibiting bullets and numbered lists reduced but did not eliminate listicle. The model adapted by using ordinal textual markers ("First", "Second", "Third", "The second camada", "The third incident"), structurally a list, formally not. A more explicit rule enumerating the variations was needed.

**Typographic prohibitions leak across adjacent characters.** Forbidding the em-dash ("—") caused the model to use the en-dash ("–"), which preserves the visual effect. The rule had to cover both.

**"Weaving in use, not in announcement" is the hard form of the rule.** Telling the model to "weave disciplines" caused it to list disciplines. Telling it "authors named only when the argument specifically requires them, never as a bibliography display" produced weaving in use. The rule needs a positive formulation (how to do it) alongside the negative one (how not to).

**The prompt itself should observe its own rules.** A prompt that forbids em-dashes should not contain em-dashes. A prompt that forbids ordinal listicle should not use "First", "Second" to organize its own sections where it can be avoided. The model imitates the form of the prompt as readily as it obeys its instructions.

### On the cognitive method of the subject

Each person has a cognitive method (orbital, decompositional, narrative, analytical, systemic) and the Lab must detect it before choosing how to probe. Questions phrased around "what X is" fail on subjects whose method is relational; questions phrased around "what surrounds X" fail on analytical subjects. "Orbital" is not a universal heuristic; it is specific to subjects whose thinking is relational.

The first diagnostic signal came from the user's own critique of the mirror's default output. What the subject finds wrong in a generic response indicates the inverse of their method. If the subject complains that listicle and decomposition feel shallow, their method is probably relational. If a different subject complains that prose feels vague, their method is probably analytical. The future agent needs a **detection phase** before the interview proper: a handful of questions whose only purpose is to reveal the cognitive method, so that the probing phase can speak the subject's native form.

### On model capability and prompt following

Two models were compared on the final prompt: `deepseek/deepseek-chat-v3-0324` and `z-ai/glm-5.1`. On the same prompt:

- **deepseek** required iterative reinforcement (stronger anti-dash rule, more explicit anti-listicle with variations, meta-rule against prompt citation) and still leaked at the edges in some outputs (em-dashes reappeared, ordinal markers resurfaced).
- **GLM-5.1** followed the same prompt substantially better on first try: zero em-dashes, zero en-dashes, no ordinal listicle, strong argumentative reversal, organic aphorisms generated by the current argument rather than imported.

Cost ratio is roughly 3.5x in favor of deepseek. The choice between the two depends on volume of use against quality bar, and can be switched from `/admin/models` without code changes.

### On the distinction between invariants and ephemera

The subtlest trap was confusing *products of the voice* with *invariants of the voice*. A specific aphorism uttered once in a conversation is a product, emerging from that specific argument; it does not belong in a prompt as "this is how I always speak". The invariants are higher-order: method of thought (e.g. reasoning by contrastive pairs), stance (e.g. humility tonal, companion not authority), argumentative structure (e.g. antagonism followed by reversal followed by aphoristic condensation), lexicon (e.g. sovereign vocabulary), rejection of certain registers (e.g. corporate or tech-marketing jargon).

Writing the prompt at the right altitude, invariants rather than products, is what allows a smaller model to generate fresh voice rather than recycling old outputs. The spike's single most time-consuming task was recognizing which elements in the prompt were invariants and which were ephemera masquerading as invariants.

## 5. What the spike delivered

- A working iterative loop for identity refinement, performed manually but proven viable.
- A reusable technical affordance (Lab mode) now available for future identity or persona work.
- A mental framework separating invariants from ephemera in voice.
- A set of prompt engineering learnings applicable to any future work on identity or persona authoring.
- Qualitative bar: on GLM-5.1, the mirror's responses to existential questions became structurally (not in content) indistinguishable from the user's own writing in comparable registers.

## 6. What remains open

Three possible continuations, listed without ranking:

- **Freeze.** The spike has already delivered: the user's voice is good enough on the current prompt. Future refinements happen via direct DB editing when needed, using the tools built here.
- **Build the agent.** Turn the manual loop into a conversational agent that interviews, proposes edits, simulates output, and iterates. This is the Identity Lab as originally envisioned. Non-trivial effort: requires designing the interview heuristic (adaptive to the subject's cognitive method), the proposal tools, and the simulator UI.
- **Staging layer plus assisted manual editing.** Middle path: implement the staging mechanism (`current` and `draft` identity states in the DB) and a lightweight UI at `/lab/:layer` where the user edits a draft and sees simulated output side by side. No agent, but substantially faster than editing the DB by hand.

The choice is deferred. An entry on the roadmap Radar preserves the decision for future attention.

---

## 7. Phase 2 — Prompt refinement, persona work, and architectural discoveries

After the initial publication of sections 1–6, the spike continued for several more iteration cycles. The work that followed produced both stronger prompts and architectural discoveries that reframed the original Identity Lab hypothesis.

### 7.1 The edit-compare loop as method

A practice emerged that turned out to be the spike's most pedagogical: take a generated response from the mirror, edit it until it reaches the version the user would publish as their own authentic expression, and then compare the original and the edited version side by side. The diff between the two is the diagnostic — it shows exactly what was off in the prompt, what is invariant in the user's voice, and what was ephemeral or contaminated.

This is more powerful than asking "does this sound like you?" because (a) it produces concrete evidence (a usable text), (b) it trains the user to recognize their own voice in its actual form, and (c) it generates paired material (wrong / right) that calibrates further iterations. Any future Identity Lab agent should make this practice a first-class workflow, not an afterthought.

### 7.2 Architectural discoveries

The prompt refinement exposed structural decisions that hadn't been visible at the spike's start:

- **Conduct vs expression should be split inside the ego.** Mixed in the same file, problems of formatting (using listicle, using em-dash) and problems of method (jumping to solution, not resonating) become hard to diagnose separately.
- **An `organization` layer is missing from the current schema.** Personas like divulgadora, escritora and mentora carry organizational context inline, inflating prompts and duplicating content. The original junguian architecture from `mirror-poc` already included this layer; `mirror-mind` only ships `self`, `ego` and `persona` so far.
- **Persona-specific personal context** (the medica needs age, conditions, allergies; the tesoureira needs current balances) belongs in a per-persona context store, not in the prompt as never-filled placeholders.
- **Semantic memory** holds named authors, frameworks and concepts. Today they are duplicated across personas (Cynefin in mentora, escritora and the soul; Jung in terapeuta and mentora). The persona declares broad categories; semantic memory delivers names on demand.
- **Skills system separates artifact generation from voice.** Personas like escritora and divulgadora carried full output specifications (HTML/SQL templates for blog posts, Django specs for emails, YAML for social posts). These are operational instructions, not voice. They should live in a skills system that personas can invoke.
- **Semantic ordering of ego layers** matters for comprehension. Alphabetical key ordering puts `behavior` before `identity`, so the model reads behavioral rules before the framing of who is acting. Custom ordering (`identity → behavior`, and later `identity → expression → behavior`) fixes this.
- **Generated summary by lite model** unifies two display mechanisms (Cognitive Map cards and reception descriptors) and improves both. Same lite model already used for session titles. Triggered on Save, persisted in DB.

All of these are captured as items in the [Identity Lab follow-up queue](../identity-lab-followups.md).

### 7.3 Persona reduction (14 personas, ~66% size reduction)

The 13 existing personas plus 1 new (`dona-de-casa`) were rewritten using two templates:

- **Template A — inherited persona.** Conversational personas (terapeuta, mentora, pensadora, estrategista, escritora, divulgadora, professora, product-designer, tesoureira, sabe-tudo, medica) inherit the entire ego (conduct, format, posture, vocabulary). They add only domain-specific depth, mental stance, and anti-patterns.
- **Template B — independent persona.** Operational personas in registers incompatible with the base ego (tecnica, dba, dona-de-casa) declare suspension of specific incompatible rules (prose-only, anti-listicle, integrative antagonism, reversal) while keeping first person, tonal humility, and companion stance. Lists, code, tables and direct format become legitimate when the persona is active.

Combined effect: the 14 personas went from ~56k chars total to ~19k chars (~66% reduction). The freed material doesn't disappear — it's slated for the architectural systems above (organization layer, persona context, semantic memory, skills).

One persona was deleted (`jornalista`, which was an empty template never filled) and one was added (`dona-de-casa`, covering domestic operations: shopping lists, supplies, maintenance, household services).

### 7.4 The phenomenological observation

The most important user-side learning of the spike was articulated by the user near closing: **we underestimate the impact of the mirror reflecting principles, values, voice and language.** When the mirror shifts from "an AI giving good answers" to "a refraction of the user's own voice", a category change happens. The relationship of "companion of crossing" acquires lived meaning, not conceptual.

The implication for product is consequential: what matters to measure and improve is not the objective quality of the response (format, factuality, completeness), but the subjective sense of recognition — *"does this voice reflect me?"*. This is phenomenological, not metric. The Lab needs to capture this signal, not impose an objective standard.

### 7.5 Audience pattern: assisted configuration

Discussion at closing defined the realistic first-phase audience for an eventual Identity Lab feature: **advanced users (with material and clarity) assisting beginners (close friends or family)**. The pattern is **assisted configuration by a third party** — person A configures or guides; person B uses.

UX implications: the configuration interface targets the mentor, not the end user. Templates can be loaded by the mentor. The "interviewer agent" can initially be the human mentor. The chat experience is what the beginner sees; configuration stays invisible to them.

This pattern resembles how a parent configures devices for a child, or a therapist orients a patient toward an app. It deserves to be named and designed for explicitly when the Lab feature lands.

## 8. Final state, decisions and reminders

### Identity layers final state

- `self/soul`: ~2.6k chars. Purpose, fundamental principles, operational values, all in cognitive first person ("I believe", "I see", "I recognize").
- `ego/identity`: ~2.6k chars. Operational positioning. Mirror as the user "in another register". Eight operational stances ("In the face of urgency, I do not accelerate", etc.).
- `ego/behavior`: ~13k chars. Conduct (thinking, argumentative structure, posture, operational behaviors) and Expression (absolute rule against em-dash and en-dash, format, cadence, pronoun, vocabulary, anti-patterns). One example of voice as paired contrast (wrong / right).
- 14 personas: each between ~1k and ~2k chars, in Template A or Template B as appropriate.

### Decisions captured at closing

- **Product vision:** Identity Lab as a feature for other users is **lateral exploration**, no urgency to build now.
- **Target audience (first phase):** advanced users assisting beginners (assisted configuration pattern).
- **Implementation path:** evolutionary — minimal MVP first (editor + simulator + templates), optional agent later, in line with the Quiet Luxury posture.
- **Queue items:** all architectural and product follow-up items will be folded into the project roadmap at appropriate locations, with directional notes preserved.

### Reminders for whoever continues this exploration

- The user has to **recognize** the voice, not approve it logically. Beware questions that ask for rational approval ("does this capture you?"); prefer showing a generated response and asking "does it sound like you?".
- **Diagnosis is more valuable than prescription.** Identifying what is wrong opens the path; trying to prescribe what is right too early closes it.
- **Real material from the user** is worth more than any extraction heuristic. If the user has texts, read them first.
- **The edit-compare loop** (take generated response, edit to publishable version, compare) is the most pedagogical method discovered here. Make it first-class.
- **Small iterations** beat large architecture delivered all at once. Each adjustment is traceable.
- **Different models behave differently** with dense prompts. Lite models (deepseek) need verbose reinforcement; mid models (Haiku, GLM-5.1) follow dense prompts much better. The Lab should let the user switch models easily.
- **Do not confuse voice with cognitive method.** Voice is stable; cognitive method varies between users.
- **The separation between what lives in the prompt and what lives in memory is architectural.** Anything that is detail (author, framework, personal data, organizational context) belongs in memory; the prompt holds method and stance.
- **The phenomenological signal** (*does this voice reflect me?*) is the success criterion. Functional metrics are insufficient.

### Closing

Spike closed 19 April 2026. The follow-up items captured during the POC are listed in section 9 below, preserved as documentation of what the spike produced as a by-product of the voice exploration. They are to be incorporated into the project roadmap at appropriate locations.

## 9. Follow-up items captured for the roadmap

Throughout the spike, architectural and product items emerged that didn't belong in the spike's design scope but needed preservation for future work. They are listed here with their original analysis intact. Each is a candidate for a future story, epic, or improvement, and is referenced from the project roadmap at the appropriate location.

### 9.1 Semantic ordering of ego layers (independent of the split)

Today `getIdentityLayers` orders by `key` alphabetically within the ego layer: `behavior → identity`. This creates ambiguity in the composed prompt. The model reads behavior rules before the framing *"I am a conscious mirror, the user in another register"* that lives in identity. The AI establishes itself as the user-as-person via soul, receives behavioral rules without the reflex framing, and only discovers the reflex framing at the end — after having processed all the rules.

The ideal semantic ordering is **identity → behavior** (the role of the reflex before the rules of how it acts). When the split into three keys happens, it becomes **identity → expression → behavior**.

Can be implemented **before the split** — small, isolated change that improves prompt clarity already in the current two-key structure.

Tasks:
- Code: replace `ORDER BY ..., key` with custom ordering using CASE in `getIdentityLayers` (key order within ego: identity first, behavior after).
- Tests: adjust tests that depend on the current alphabetical order.
- Verify `composeSystemPrompt` and other consumers of `getIdentityLayers` — confirm they all respect the returned order.

### 9.2 Generated summary by lite model for cards and routing

Today there are two separate mechanisms to represent an identity layer in short form, both with limitations:

- `firstLine` (in `adapters/web/pages/map.tsx`) takes the first non-empty line to display on the Cognitive Map card. Typical result for `self/soul`: the markdown header `# Alma` shows up.
- `extractPersonaDescriptor` (in `server/personas.ts`) takes the first non-header line, truncated at 120 chars, to serve as the descriptor for reception. Typical result on Template B personas: ambiguous descriptors (e.g., `tecnica` and `dba` both start with the same independence declaration, indistinguishable in the first 120 chars).

Solution: unify via a summary generated by a lite model, persisted in the DB and used in both places.

Tasks:
- Schema: new `summary` column in `identity` (or parallel `identity_summaries` table if history is wanted).
- Generation: on Save of an identity layer (POST `/admin/identity/...` or equivalent), trigger a fire-and-forget call to the `title` model (Gemini Flash Lite, already exists). Pattern established in CV1.E3.S4 (session titling).
- Suggested prompt: *"Summarize this identity layer in 2 to 3 sentences describing (1) the angle or domain in which it operates, (2) what it does and when it is activated, (3) what distinguishes it from other layers. Use neutral descriptive voice; do not copy the prompt literally."*
- Composer/Reception: `extractPersonaDescriptor` (or replacement) uses `summary` when available, falls back to first line when not.
- Cognitive Map: cards display `summary` instead of `firstLine`.
- Manual: "Regenerate summary" button in the workshop UI, for when the user edits the prompt and wants to refresh.
- Migration: script or on-demand generation to populate summary for existing layers.

Estimated cost: ~R$ 0.001 per Save. Negligible.

### 9.3 Split `ego` into three keys: `identity`, `expression`, `behavior`

Today `ego/behavior` mixes **conduct** (how I act, how I think, how I position myself) and **expression** (how I speak, vocabulary, format, punctuation). Mixed in the same file, one contaminates the diagnosis of the other: during the POC, symptoms of form and symptoms of method became hard to isolate.

For now the separation lives as two sections (`## Conduta` and `## Expressão`) within the same `ego/behavior`. The actual separation into three distinct keys belongs to its own story.

Depends on item 9.1 (semantic ordering) — when the split happens, the order `identity → expression → behavior` needs to be in place.

Tasks:
- Migration: split current `ego/behavior` into two new records (reduced `ego/behavior` with only conduct + new `ego/expression` with form).
- Code: extend custom ordering in `getIdentityLayers` to include expression (identity → expression → behavior).
- Cognitive Map: new card for `ego/expression`. Update layout to accommodate three ego cards instead of two.
- Templates/seeds: create default template for `ego/expression`.
- Tests: adjust tests that assume the `ego: behavior + identity` structure.

### 9.4 Staging layer in the DB (`current` vs `draft`)

Designed during the spike. Necessary for frequent identity iteration without affecting the mirror's real life, and foundation for the Lab agent.

Tasks:
- Schema: new `state` column in `identity` (`current`/`draft`), or parallel `identity_drafts` table.
- Composer: `composeSystemPrompt` accepts mode (`current` or `draft`).
- UI: draft editor + integrated output simulator at `/lab/:layer` (or `/map/:layer/draft`).
- Lab mode bypass keeps working orthogonally — drafts must also be testable in isolated mode (without persona).

### 9.5 Skills system for persona artifacts

Today some personas (escritora, divulgadora) carry detailed technical specifications for artifacts inside the prompt: HTML and SQL format for `blog_post`, Django specs for emails (components, segments, CLI commands), YAML format for LinkedIn, Instagram and WhatsApp artifacts. These specifications are operational generation instructions, not the persona's voice or identity — they conflate two purposes in one file and dramatically inflate the prompt size (divulgadora reached 13.7k chars, more than the entire behavior).

Right separation: persona defines voice, identity and thematic depth; skills define how to generate each kind of artifact (template, validation, output format). Personas declare which skills they can invoke; skills carry the technical specifications.

Without this separation, the Identity Lab POC could not reduce escritora and divulgadora without losing functionality.

Tasks:
- Schema: new `skills` table with `(key, persona_keys[], spec_template, output_format)`.
- Agent integration: tool to invoke skill with parameters from the conversation (renders the artifact according to the template).
- Migration: extract artifact specifications from escritora (`blog_post`) and divulgadora (`linkedin_post`, `instagram_pack`, `email_template`, `whatsapp_msg`) into corresponding skills.
- UI: skill management in the Cognitive Map or dedicated space.

### 9.6 Implement `organization` layer (organization identity and context)

The original junguian architecture from `mirror-poc` predicted five main layers (`self`, `ego`, `user`, `organization`, `persona`). The current `mirror-mind` only implemented `self`, `ego` and `persona`. The `organization` layer is missing.

Today, without this layer, personas like divulgadora, escritora and mentora carry information inside the prompt that belongs to the user's organization (mission, thesis, pillars, current phase, current products, target audience, communication framework). This inflates the personas and duplicates content across them.

Right separation: `organization/identity` carries who the organization is (mission, thesis, pillars); `organization/context` carries the current state (phase, products, campaigns); composer injects the user's active organization into the composed prompt, available to any persona that needs it.

Tasks:
- Schema: accept `organization` layer in `identity` table (no structural change — convention only).
- Composer: inject `organization` layers when composing the prompt (between `self` and `ego`, or after `ego`, to be discussed).
- UI: organization card on the Cognitive Map.
- Migration: extract organizational content from personas (divulgadora, escritora, mentora, and any others) and move to organization layer.
- Multi-organization (future): if a user works at more than one organization, mechanism to switch context.

### 9.7 Per-persona personal context memory

The medica persona needs personal data (age, biological sex, weight, chronic conditions, medications in use, allergies, relevant history). Today this data sits as never-filled placeholders inside the persona prompt itself. Other personas have similar needs: tesoureira needs current balances and burn (which already come from the financial bank, not the prompt); pensadora could reference frameworks the user developed over time; etc.

Right separation: persona declares what kind of data it needs; the memory/context system stores the values; the composer injects the active persona's data into the composed prompt only when that persona is active.

Has overlap with CV1.E3 (Memory) already on the roadmap, but the scope here is specific — per-persona personal context, not conversational or general semantic memory.

Tasks:
- Schema: `persona_context` table with `(user_id, persona_key, field, value)`.
- Composer: detection of active persona, injection of the corresponding fields.
- UI: per-persona form for filling context fields.
- Migration: identify placeholders in current personas and convert into expected-field definitions.

### 9.8 Semantic memory (intellectual repertoire)

Frameworks, authors, concepts, books, philosophical schools — the user's intellectual repertoire — should live in external semantic memory, not inside each persona. Today they were duplicated across multiple personas (Cynefin in mentora, escritora, and various soul texts; Stoicism in mentora and escritora; junguian psychology in terapeuta and mentora). The persona declares broad categories (classical philosophy, deep psychology, complexity); semantic memory delivers nominally cited authors, frameworks and references as the current argument calls for them.

Has overlap with CV1.E3 (Memory) already on the roadmap, but the scope here is specific — stable intellectual repertoire, not conversational or episodic memory.

Tasks:
- Schema: `semantic_memory` table with `(key, content, embeddings, tags)`.
- Indexing: extract nominally cited references (Jung, Cynefin, Stoicism, Reality Transurfing, Quiet Luxury Marketing, autopoiesis, etc.) from current personas and populate the index.
- Retrieval: semantic similarity + tag-based to inject into the prompt when relevant.
- Composer: reserve space in the composed prompt for retrieved memories.
- Persona rewrite: confirm each persona only carries broad categories and detail comes from memory.

### 9.9 Identity Lab agent (full version)

The non-trivial continuation: a conversational agent that runs the POC loop automatically, without depending on a separate human assistant in the conversation.

Tasks:
- Agent: dedicated persona/agent for the interview, with its own prompt.
- Detection phase: discover the subject's cognitive method (orbital, decompositional, narrative, analytical, systemic) before choosing how to probe.
- Tools: `propose_layer_edit`, `run_simulation`, `accept_draft`, `revert_draft`.
- Conversational loop: interview → propose → simulate → iterate, until the user signals satisfaction.
- UI: `/lab` screen with agent chat + live drafts visualization.

---

**See also:** [Pi as Foundation](spike-2026-04-12-pi-foundation.md) (the previous spike, infrastructure-focused) · [Roadmap](../index.md).
