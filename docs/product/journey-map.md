[< Docs](../index.md)

# Journey Map

A **journey** is a context the user is living through — a period, a pursuit, a relationship, a deliberate crossing. An **organization** is a broader context that can contain several journeys — a venture, a community, a role. The mirror supports many of each at once, each with its own briefing, its own situation, its own tasks, its own attached material. The **Journey Map** is the surface that makes these scopes legible and operable.

**Status:** concept document. The Journey Map is introduced as the frame for epic [CV1.E4](../project/roadmap/cv1-depth/cv1-e4-journey-map/); this page defines what it *is* so the stories under it stay coherent.

---

## Why this exists as its own concept

The Cognitive Map answers *who am I?* — the mirror's structure, organized by psychic depth (self → ego → persona → skills). It's a continent.

The Journey Map answers *where am I, right now?* — the contexts the mirror's user is actively crossing, and what each crossing carries. It's a set of regions the user moves between, sometimes nested inside larger ones.

These are orthogonal. A mirror with a rich cognitive map but no active journeys or organizations still knows who it is. A mirror with five active journeys but an empty map has no voice. The two surfaces evolve independently, and confusing them crams unrelated concerns into the same workshop.

Two other surfaces complete the four-surface model. The **[Context Rail](../project/roadmap/cv0-foundation/cv0-e2-web-experience/cv0-e2-s9-context-rail/)** is the view of *what's composed right now*: persona, active organization, active journey, session stats, composed layers. The **[Memory Map](memory-map.md)** (planned, CV1.E6) is the view of *what the mirror carries across time* — the accumulated episodic, attachments, and extracted insights. The Cognitive Map is the potential; the Journey Map is the situational; the Memory Map is the accumulated; the rail is the actualized.

---

## Two scopes, one idea

Both organizations and journeys are **scopes over memory**. They share the same pattern; they differ in breadth.

- **Organization** — broader, slower-moving context. A venture, a community, a role the user holds. Contains zero or more journeys. Examples (from the user's own practice): *Software Zen*, *Nova Acrópole*.
- **Journey** — narrower, faster-moving context. A pursuit, a period, a specific crossing. May belong to an organization or stand alone as personal. Examples: *vida-economica* (personal, no org), *o-espelho* (belongs to *Software Zen*), *vida-filosofica* (personal).

The hierarchy is strict: an organization contains many journeys; a journey belongs to at most one organization; one piece of data belongs to at most one scope (many-to-many rejected — see *Open questions*).

Both scopes are **not identity layers**. The first instinct was to introduce layer keys like `organization/identity` and `journey/briefing` in the `identity` table. That framing breaks as soon as either scope needs to carry more than a briefing — tasks, documents, evolving situation, filtered episodic and semantic memory. A scope isn't a voice; it's a **namespace over memory**.

---

## The shape of a scope

Both organizations and journeys share the same two-field identity shape, scaled to their breadth:

| Field | Role | Changes |
|-------|------|---------|
| `briefing` | Who / what this scope *is* | Rarely. Only on identity shifts. |
| `situation` | Where this scope is *right now* | Often. Weeks or months. |

A **briefing** tells the mirror *from what position* to reason. A **situation** tells the mirror *what reality it has to work with*. Separating them lets the user edit situation casually without touching briefing, and keeps briefing clean from transitional state.

Both scopes ship with both fields from S1. Symmetric schema, symmetric semantics, symmetric vocabulary — organization situation and journey situation mean the same thing at different breadths.

---

## Scope × memory role matrix

Each cognitive role from the [memory taxonomy](memory-taxonomy.md) gets an instance scoped to an organization or a journey:

| Role | Instance in the scope |
|------|------------------------|
| **Identity** | Briefing — who/what the scope is |
| **Reflexive** | Situation — evolving state of the scope |
| **Prospective** | Tasks bound to the scope (deferred — not in CV1.E4; will return with the agentic epic) |
| **Semantic / Attachments** | Documents attached to the scope — reference material scoped to it |
| **Episodic** | Sessions filtered to the scope — conversations that happened *in* that context |
| **Semantic (extracted)** | Insights filtered to the scope — facts distilled from episodes in the crossing |

The scope id propagates into tables that serve each role:

```
organizations                journeys (organization_id nullable)
  ↖                             ↖
   journey_id / organization_id (one of the two, nullable)
     ├── attachments            — semantic / documents (planned)
     └── extracted_memories     — semantic index (planned)

   journey_id (nullable)
     └── sessions               — episodic
```

A row with both foreign keys null is cross-scope. Sessions only carry `journey_id` because the organization is derived transitively (the journey's own `organization_id`). Attachments and extracted memories carry either key so a document or insight can attach directly to an organization without a journey.

---

## What the Journey Map surface is

Two top-level pages in the web client, both peer to `/map` and `/mirror`. Sidebar links under *My Mirror*.

**`/journeys`** — the user's journeys. Each card shows name, one-line briefing excerpt (via the summary mechanism), status (active / archived), and the organization it belongs to when any. Journeys are grouped visually by organization to make the hierarchy visible; the grouping is read-only — editing an organization happens on its own page.

**`/journeys/:key`** — the journey's workspace. Composition grows by story:

- S1: briefing + situation (both editable) + regenerable summary + organization selector.
- S2: documents section — attached files with chunk index.
- S3: related sessions (episodic) and related insights (semantic extracts).

**`/organizations`** — the user's organizations. Each card shows name, briefing excerpt, status, and the count of journeys it contains.

**`/organizations/:key`** — the organization's workspace. Briefing editor, situation editor, regenerable summary, list of journeys that belong to it, archive action.

**Reception surface** — when reception detects a journey and/or an organization from the user's message, the rail displays *organization: software-zen* / *journey: vida-economica* alongside the active persona. The composed prompt includes both briefings in the slots described below.

---

## Composition order

The composed system prompt places both scopes inside the identity cluster, broader before narrower:

```
self/soul → ego/identity → persona → organization → journey → ego/behavior → ego/expression → adapter
```

Rationale: `self → ego → persona` is the mirror's own structure (continent). `organization → journey` is the situational context (regions). The LLM reads from the mirror's identity into the context's breadth, then into its specificity, then applies form rules last. Organization before journey because organization is broader — when both are active, the narrower one refines the broader.

Only scopes with `status = 'active'` are eligible for composition. Archived scopes can still be read on the surface but cannot be routed to.

---

## How reception activates scopes

Reception returns `{ persona, organization, journey }` in a single LLM call — three independent signals, each nullable. A message can activate all three, just persona, just journey, just organization, or none.

Why independent rather than derived: a user can talk about an organization without being in any specific journey ("o que é a Software Zen?"). Forcing organization to come via journey would fail that case. Independence costs nothing at inference time — same prompt, one more output field.

---

## Relationship to other surfaces

**Cognitive Map's memory column stays global.** It summarizes the total memory the mirror carries across all scopes, and evolves into a teaser that links to the full [Memory Map](memory-map.md) when that surface lands. The Journey Map is the *scoped* cut of the same memory; the Memory Map is the *global* cut — not a replacement for either.

**Rail shows scope lines.** The rail is ephemeral — it shows attention of this turn. When reception routes to a scope, the rail reflects it; when it doesn't, the rail shows nothing scope-related.

**Cognitive Map does not gain a scope card.** Neither journey nor organization is psychic structure; both are situational scope. Forcing a card into the map conflates concerns and makes the map drift with scope lifecycle.

---

## Channels

A scope is not bound to a single adapter. The same organization or journey can surface on web, Telegram, WhatsApp (planned), CLI — whichever channel carries the conversation. Channel preferences per scope are rejected for v1.

---

## Lifecycle

Both scopes in v1 are **active** or **archived**:

- **Active** — routing eligible; surfaces on the landing; contributes to the rail when detected.
- **Archived** — hidden from routing; preserved in the DB; readable via the detail page for history. Archiving is manual in v1.

Finer states (*draft*, *paused*, *completed*) may return in later stories if the need proves real.

---

## Open questions (registered, not resolved)

- **Many-to-many scoping.** Rejected for v1. A piece of data belongs to one scope or none. Revisit when a concrete need appears.
- **Automatic consolidation.** Should the mirror propose *"this looks like a new journey"* when it sees a thread forming? Out of scope until explicit routing proves itself.
- **Project path.** The POC carries a `project_path` per journey. Not needed in v1; revisit when code-work contexts need it.
- **Tasks.** Task management was the original MVP for the agentic shift; decoupled from CV1.E4 and postponed with the agentic epic. Journey and organization carry no task-side in CV1.E4.
- **Rail display policy.** Name only, or briefing excerpt? Start with name only.
- **Journeys without organizations.** Handled natively (nullable FK). A personal journey like *vida-economica* has no organization and never activates one transitively.

---

## What this concept is for

Writing this page before the stories land is deliberate. It gives the epic a shared vocabulary (scope vs layer, briefing vs situation, nested scopes, sections vs sub-surfaces) and a principle to test each story against: *does this story light up one cell of the "cognitive role × scope" matrix?* If yes, the story fits; if no, it probably belongs on a different epic.

---

**See also:**
- [Memory Taxonomy](memory-taxonomy.md) — the roles and mechanisms this concept composes over
- [CV1.E4 — Journey Map](../project/roadmap/cv1-depth/cv1-e4-journey-map/) — the epic that implements it
- [Prompt Composition](prompt-composition/) — where briefings slot into the composed prompt
