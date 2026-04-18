[< Docs](../index.md)

# Memory Taxonomy

Memory in the mirror is not a single shape. It is a map of **roles** (what this memory is for) and **mechanisms** (where it lives and how it's accessed). Any given memory artifact gets a coordinate on both axes.

**Status:** map of the territory — some mechanisms already exist, others are planned. Planned items are marked *planned*.

**Conceptual origin:** the cognitive axis was drawn from a conversation on agent memory types by Henrique Bastos, with extensions from cognitive science and computer science. Credit where it's due.

## A note on Structure vs Memory

Before the axes, a distinction the rest of the document depends on: **the mirror's structure is not its memory**. The structure — the **Cognitive Map** made of self, ego, personas, skills (and future layers: shadow, meta-self) — is *who the mirror is*. Memory is *what the mirror carries*. The structure is the continent; memory is what fills and flows through it.

This matters for how the roles below are read:

- **Identity** as a cognitive role means *information stored in the structure* (the soul layer holds identity memory; the ego layer holds behavioral identity memory). The role doesn't equal the structure — Identity is one kind of content stored in one part of the map.
- **Attention**, **Episodic**, **Semantic**, **Procedural**, **Prospective**, and **Reflexive** are all kinds of content that accumulate across or alongside the structure. They're orthogonal to "which layer of the psyche does this belong to."
- Surfaces in the web client follow the same split: the **Cognitive Map** (`/map`) edits the structure; the **Context Rail** shows attention memory live; future surfaces (episodic browse, reflexive summaries) show other memory roles.

Naming structure by a memory concept conflates the two. A mirror with an empty map still has memory (the attention of this turn); a mirror with a rich map but no conversation history still has structure. Keeping the names separate prevents future features from cramming into the wrong surface.

---

## Axis A — Cognitive roles

What role does this memory play in the agent's behavior?

| Role | What it is | Mirror example | Common analog |
|------|-----------|----------------|---------------|
| **Attention** | What the agent is holding right now — the composed system prompt + current turn | The system prompt this request, the rail's live view | RAM, working memory |
| **Identity** | Compact semantic facts about the user, the agent, their relationship | `self/soul`, `ego/identity`, user profile | Config registers, identity constants |
| **Episodic** | Past conversations and events with narrative structure | `entries` table, `sessions` | Hard drive, personal archive |
| **Procedural** | How to do things — rules, tool definitions, adapter instructions | `ego/behavior`, `config/adapters.json`, persona templates | Muscle memory, skill files |
| **Semantic** | Extracted facts and knowledge distilled from episodes | Memories extracted from conversations (planned) | Library index, consolidated knowledge |
| **Prospective** | Future-oriented intentions — "when X happens, do Y" | Tasks, deadlines, reminders (planned — partial in the POC today) | Reminders, cron, deferred intentions |
| **Reflexive** | Meta-memory — what the agent knows about its own knowledge | Self-assessment of response quality (planned, CV4) | Calibration, confidence |

Every memory artifact plays at least one role. Some play several (an extracted fact is Episodic when created, becomes Semantic once consolidated; a preference is Identity but acts Procedurally when composed into the prompt).

---

## Axis B — Storage mechanisms

Where the memory lives and how it's read and written.

| Mechanism | Status | Shape | Read pattern |
|-----------|--------|-------|--------------|
| **Identity layers** | ✅ exists | `(layer, key, content)` rows per user | Key lookup + full text |
| **Episodic entries** | ✅ exists | Append-only rows per session | Time-ordered |
| **Records** | ✅ exists in POC (`memoria/`), ❌ not yet in mirror-mind | Typed SQL tables (tasks, testimonials, journal) | SQL queries |
| **Attachments** | *planned* | Documents + chunks + embeddings | Semantic + chunk retrieval |
| **Semantic index** | *planned* | Extracted facts with embeddings | Hybrid search (semantic + recency + reinforcement) |
| **KV** | *planned* | Typed pointers and ephemeral state | Key lookup |

Mechanisms can be added without relocating meaning — a memory that played the Identity role in a flat file can migrate to a Records table when it needs schema, without changing what it's *for*.

---

## The grid — how roles map to mechanisms

Not every cell is populated. Some combinations are natural, some are nonsensical. This table shows which mechanism typically serves which role.

| Role ↓ / Mechanism → | Identity | Episodic | Records | Attachments | Semantic | KV |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Attention | — | — | — | — | — | — |
| Identity | ●●● | — | ● | — | — | ● |
| Episodic | — | ●●● | ● | ● | — | — |
| Procedural | ●●● | — | — | — | — | ● |
| Semantic | — | ○ | ● | ● | ●●● | — |
| Prospective | — | — | ●●● | — | — | ● |
| Reflexive | — | ● (log) | ● | — | ○ | ● |

Legend: ●●● primary home · ● valid secondary home · ○ transient or edge case.

**Attention is special.** It has no storage mechanism because it is the composed *view* over other mechanisms at request time. It lives in the LLM's context window and disappears when the request completes.

---

## Concrete examples

| Memory artifact | Role (cognitive) | Mechanism (storage) |
|---|---|---|
| Current session's messages in the rail | Attention | (composed, no storage) |
| `self/soul` content | Identity | Identity layers |
| `config/adapters.json` | Procedural | File (external to the taxonomy today); planned: Identity layers per user |
| Full transcript of a conversation | Episodic | Episodic entries |
| Task "gerar boleto 22/Abr" | Prospective | Records (planned) |
| PDF the user uploaded | Episodic when created, Semantic once indexed | Attachments (planned) |
| Extracted fact "Alisson decided X on 2026-04-12" | Semantic | Semantic index (planned) |
| `ui.rail.collapsed = false` | Procedural (preference) | KV (planned) |
| `focus.current = "mirror-mind"` | Attention pointer | KV (planned) |
| Reception decision log | Reflexive | Episodic entries (type=`reception`) |

*Edge case — configuration files.* `config/adapters.json` and similar JSON/YAML files are Procedural by role but live outside Axis B today. When the need for per-user overrides appears, they migrate into Identity layers (a new `config` layer key) or a dedicated table. Until then, treat them as an acknowledged edge, not a gap in the taxonomy.

---

## Three design principles

Patterns that show up across every memory system we studied. They are how the axes relate in practice.

### 1. Attention vs. archive is the central tension

Every memory shape below Attention trades fidelity for reach. Attention is high-bandwidth and ephemeral; Episodic gives you verbatim but only with intent to retrieve; Semantic gives you compressed recall at scale; Records give you structured query.

The agent's art is choosing the right shape per need, not cramming everything into one. The rail is a window into Attention — intentionally limited, intentionally always-visible.

### 2. Consolidation is a first-class operation

Episodic memory does not stay episodic forever. Recurring facts get promoted into Identity. Repeated patterns become Procedural rules. Significant events extract into Semantic.

This is the agent equivalent of sleep — a periodic reflection pass that compresses noise into structure. In the POC mirror, the LLM-based extraction at the end of each conversation is an early form. In mirror-mind, consolidation is planned as a scheduled operation over Episodic entries.

### 3. Prospective is the least-explored frontier

Most agent frameworks treat memory as backward-looking. The mirror is designed around the proactive premise (briefing P6): it notices deadlines, follows up on unresolved threads, acts before asked. That premise lives or dies on Prospective Memory.

Prospective is partly served today through Records (tasks), but lacks the *triggering* side — time-based or event-based hooks that make stored intentions actionable. That will be an epic of its own in CV3 (Intelligence).

---

## How the reception layer routes across this map

The **reception** layer (see [Decisions 2026-04-14](../project/decisions.md#2026-04-14--reception-as-a-dedicated-layer-before-response)) is the agent's **Reflexive** layer in action. It decides which memories to pull for this request, effectively routing across the map.

Evolved envelope (planned):

```typescript
receive(message, recentContext) → {
  persona: string | null,           // → Identity/Procedural layer to add
  journey: string | null,            // → Identity layer (journey context)
  topicShifted: boolean,             // → Episodic (create new session)
  attachmentsNeeded: string[],       // → Attachments (pull chunks)
  semanticQueries: string[],         // → Semantic index (pull facts)
  skillsActivated: string[],         // → Procedural (add tools the mirror knows how to use)
}
```

Each signal maps to one or more mechanisms. The composer reads the envelope and assembles Attention from the right sources.

---

## What lives where today

| Role | Today | Next step |
|------|-------|-----------|
| Attention | Composed at request time in `server/identity.ts` | Expose as live view in the rail (S9) |
| Identity | `identity` table (layers: self/soul, ego/identity, ego/behavior, persona) | Add `journey` layer (CV1.E4) |
| Episodic | `entries` table (append-only) | Add `reception` entry type for log (CV1.E3) |
| Procedural | Mixed: behavior in Identity, adapter instructions in `config/adapters.json` | Promote adapter instructions to DB per user (future) |
| Semantic | Not implemented in mirror-mind; exists in POC | Port from POC as epic CV1.E3.S3 |
| Prospective | Records exist in POC, not yet in mirror-mind; no triggering system | Dedicated epic under CV3 |
| Reflexive | Reception today is stateless classification | Evolve to metacognitive (CV4) |

---

## What this taxonomy is for

This document exists to **name what we're building** before we build it. When a new story proposes adding "memory," this map asks two questions:

1. **Which role does this memory play?** (picks a cognitive category)
2. **Which mechanism stores it?** (picks a storage category)

If the answers don't fit cleanly, the proposal needs sharpening — not a new shape. Most confusion comes from conflating the two axes; separating them dissolves the tangle.

---

**See also:**
- [Decisions](../project/decisions.md) — incremental decisions including memory-related ones
- [Briefing](../project/briefing.md) — foundational premises including P6 (Proactive mirror)
- [Prompt Composition](prompt-composition/) — how Attention is currently assembled
- [Roadmap](../project/roadmap/) — where each mechanism lands on the delivery path
