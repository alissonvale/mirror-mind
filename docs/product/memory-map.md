[< Docs](../index.md)

# Memory Map

The **Memory Map** is the surface where the user sees what the mirror carries across time — episodic traces, attached documents, extracted insights, and every other accumulated record. Where the Cognitive Map answers *who am I?* and the Journey Map answers *where am I?*, the Memory Map answers *what do I carry?*

**Status:** concept document. The Memory Map is the planned surface for epic [CV1.E6](../project/roadmap/cv1-depth/cv1-e6-memory-map/); this page defines what it *is* so the mechanisms built before it lands (attachments in CV1.E4.S2, extracted memories in CV1.E3.S3) are designed with a coherent destination in mind.

---

## The four-surface model

Mirror Mind's web client resolves around four surfaces, each answering a different question about the mirror in a different timeframe.

| Surface | Question | Timeframe | Editability |
|---------|----------|-----------|-------------|
| [Cognitive Map](../project/roadmap/cv0-foundation/cv0-e2-web-experience/cv0-e2-s8-cognitive-map/) (`/map`) | Who am I — structurally? | Stable — psychic architecture | Edited deliberately |
| [Journey Map](journey-map.md) (`/organizations`, `/journeys`) | Where am I — contextually? | Situational — active crossings | Edited often |
| **Memory Map** (`/memory`) | What do I carry — across time? | Accumulated — grows through use | Mostly read + curated |
| [Context Rail](../project/roadmap/cv0-foundation/cv0-e2-web-experience/cv0-e2-s9-context-rail/) (on `/mirror`) | What's active — right now? | Ephemeral — the composed turn | Not editable |

The three persistent surfaces ([Cognitive](../project/roadmap/cv0-foundation/cv0-e2-web-experience/cv0-e2-s8-cognitive-map/), Journey, Memory) each have a distinct temporal register. The rail is the transient view over all three. Keeping the questions separate keeps the surfaces honest — no single page bloats into a dashboard of everything.

This split was implicit in the [memory taxonomy](memory-taxonomy.md) from its first version, which promised *"future surfaces (episodic browse, reflexive summaries) show other memory roles"*. The Memory Map is that surface named and consolidated.

---

## What the Memory Map contains

One section per [storage mechanism](memory-taxonomy.md#axis-b--storage-mechanisms). Each section is a card on the landing; click-through opens a view tuned to that mechanism's shape.

| Section | Mechanism | What the user sees |
|---------|-----------|---------------------|
| **Episodic** | Episodic entries | Timeline of sessions — title, date, scope tags, preview of first exchange |
| **Attachments** | Attachments | Library — files + URLs + notes, with associated scopes, full-text retrieval |
| **Insights** | Semantic index | Extracted facts from conversations, searchable semantically (when CV1.E3.S3 lands) |
| **Records** | Records | Structured entries — tasks when the agentic epic lands; journals; testimonials |
| **[future: Reflexive]** | Episodic (log) + Semantic | Self-assessment logs, when CV4 lands |
| **[future: Procedural overrides]** | Identity + KV | User-level preferences and tool definitions, when CV5 lands |

Not every section ships at once. The Memory Map grows as mechanisms come online. A section that has no data yet shows an invitation, following the S10 empty-states pattern — *"insights will appear here as conversations accumulate significant facts"*.

---

## Two lenses over the same memory

**Global (Memory Map).** The full set. All sessions, all attachments, all insights the user has accumulated — unfiltered. This is where the user goes to search, remember, consolidate.

**Scoped (Journey Map detail page).** When the user opens `/journeys/o-espelho` or `/organizations/software-zen`, the detail page shows *that scope's cut* of memory: sessions tagged to this journey, attachments associated with this scope, insights filtered to it. Same data, filtered lens.

The mechanism is simple: memory tables carry nullable scope FKs (`journey_id`, `organization_id`, polymorphic `attachment_links` for attachments). The Memory Map queries without the filter; the Journey Map detail page queries with it. No duplication.

Cross-navigation: clicking a session on the Memory Map links to `/mirror` reopened in that session (when readonly-replay ships) or to the scope detail page if the session belongs to one. Clicking the scope tag on a Memory Map row navigates to the Journey Map detail page.

---

## Relationship to the Cognitive Map

The Cognitive Map's existing **memory column** stays — but its role changes.

**Before the Memory Map exists:** the memory column is the entire memory UI. It shows aggregate stats (session counts) because that's all there is.

**After the Memory Map exists:** the memory column becomes a **teaser + entry point**. It displays high-level counts (*"1,240 entries · 23 attachments · 156 insights"*) and links out to `/memory` for the real browse. The card stays small, perpendicular to the structural grid — the same spatial encoding it always had.

This preserves the Cognitive Map's purpose (psychic structure) and gives Memory Map its own real estate without burying it.

---

## Attachments as the transversal mechanism

Attachments deserve a specific note because they're the first memory mechanism where a single entity crosses all three persistent surfaces:

- On the **Journey Map**, they appear inside scope workshops — associated to the active org or journey.
- On the **Memory Map**, they appear as the Attachments library — the global view, independent of any scope.
- On the **Cognitive Map**, the memory teaser counts them among the aggregate.

This is by design: an attachment is first-class (its own table with its own polymorphic associations — see [CV1.E4.S2 plan](../project/roadmap/cv1-depth/cv1-e4-journey-map/)). Scopes don't own attachments; scopes *associate* with them. The Memory Map is the library surface that makes the attachment's full life legible — upload date, all its scope associations, its retrieval history.

The same principle will apply to extracted memories (insights) when they land in CV1.E3.S3. Scoped views from journeys; global view from Memory Map.

---

## What this surface does not do

- **Does not edit structural identity.** Editing soul or ego happens on the Cognitive Map. Memory Map reads memory; it doesn't configure the mirror.
- **Does not manage scopes.** Creating/archiving organizations and journeys happens on the Journey Map. Memory Map surfaces memory *associated with* scopes, but doesn't create them.
- **Does not surface attention.** What's active *right now* lives on the Rail. Memory Map shows what's been carried — not what's in the current turn.
- **Does not replace the in-conversation retrieval.** When reception decides to pull attachments into the prompt, that happens invisibly in the reception/composer pipeline. The Memory Map is the *browse* surface, not the *retrieval* mechanism.

Keeping these boundaries sharp is what lets four small surfaces collectively carry a rich product.

---

## Epic ownership and timing

The Memory Map is scheduled as **[CV1.E6](../project/roadmap/cv1-depth/cv1-e6-memory-map/)**, after the mechanisms that populate it have landed:

- [CV1.E3 — Memory](../project/roadmap/cv1-depth/cv1-e3-memory/) ships the mechanisms (topic-shift detection, compaction, extracted memories).
- [CV1.E4 — Journey Map](../project/roadmap/cv1-depth/cv1-e4-journey-map/) ships the scopes and the attachments subsystem that the Memory Map will browse.

Naming CV1.E6 now, before implementation, is deliberate: it prevents the attachments subsystem (CV1.E4.S2) from growing an improvised library surface that would later need to be re-integrated. When attachment workshop panels need a "browse all attachments" link, that link points to a future `/memory/attachments` instead of somewhere ad-hoc.

---

## Open questions (registered, not resolved)

- **URL:** `/memory`? Alternatives: `/remembered`, `/archive`, `/library`. Lean toward `/memory` — shortest, clearest, honors the taxonomy's vocabulary.
- **Search across sections.** Global search box on `/memory` that hits episodic titles, attachment content, insight facts — one search, multiple result types. Valuable but not a blocker for v1 of the surface; can be a follow-up story.
- **Consolidation actions.** Buttons to *"extract semantic facts from this session"* or *"create an attachment from this message"*. These are the consolidation operations mentioned in the taxonomy's §2 — promotable from Episodic into Semantic. Worth their own story when the time comes.
- **Export.** "Download all my memory" — fits naturally on the Memory Map. Not urgent, but a good signal that the Memory Map is also where data sovereignty affordances live.
- **Scope filter on the global view.** Should Memory Map's sections have a scope-filter affordance (*"show only Software Zen"*) that complements the Journey Map's detail-page scoping? Lean yes — same data, two entry points, consistent filter.

---

## What this concept is for

Writing this page before the surface is built keeps the four-surface model honest. When a new mechanism is planned, the test is: *which surface does this land on?* If the answer is *"unclear, maybe we need to create a new surface"*, the proposal either fits one of the four, or it reveals a genuine fifth axis. So far, four has been enough.

---

**See also:**
- [Memory Taxonomy](memory-taxonomy.md) — the roles and mechanisms this surface browses
- [Journey Map](journey-map.md) — the sibling surface for situational scope
- [CV1.E6 — Memory Map](../project/roadmap/cv1-depth/cv1-e6-memory-map/) — the epic that implements it
- [CV1.E3 — Memory](../project/roadmap/cv1-depth/cv1-e3-memory/) — the mechanisms this surface reads
