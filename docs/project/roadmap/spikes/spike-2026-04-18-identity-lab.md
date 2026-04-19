[< Spikes](index.md)

# Spike: Identity Lab — closing the loop between writing identity and hearing its voice

**Date:** 18–19 April 2026
**Participants:** Alisson + Claude
**Nature:** Exploratory POC report — method-focused. The identity content worked on during this spike is private to the user's local DB. Only method, learnings, and decisions are captured here.

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

**See also:** [Pi as Foundation](spike-2026-04-12-pi-foundation.md) (the previous spike, infrastructure-focused) · [Roadmap](../index.md) (where continuations would land if adopted).
