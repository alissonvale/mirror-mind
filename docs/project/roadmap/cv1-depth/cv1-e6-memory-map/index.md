[< CV1 — Depth](../)

# CV1.E6 — Memory Map

**Roadmap:** [CV1.E6](../../index.md)
**Status:** Activating 2026-04-22 — S1 (Conversations browse, was draft S3) promoted to next as the first concrete fragment, after S5 of CV1.E4 (scope ateliê) revealed the need for cross-scope browse with filters. Other stories remain drafts until their prerequisites land.
**Conceptual foundation:** [Memory Map](../../../../product/memory-map.md)

The Memory Map is the surface where the user browses what the mirror carries across time — episodic traces, attached documents, extracted insights, and other accumulated records. Fourth peer surface in the [four-surface model](../../../../product/memory-map.md#the-four-surface-model), after Cognitive Map, Journey Map, and Context Rail.

## Prerequisites

This epic depends on mechanisms shipped by earlier epics:

- [CV1.E4.S2 — Attachments subsystem](../cv1-e4-journey-map/) provides the `attachments` + `attachment_chunks` + `attachment_links` tables.
- [CV1.E3.S3 — Long-term semantic memory](../cv1-e3-memory/) provides the extracted-memories pipeline that populates the Insights section.
- [CV1.E3.S1 — Topic shift detection](../cv1-e3-memory/) populates the Episodic section with richer session metadata.

Memory Map can land in fragments as each prerequisite arrives — the landing page renders sections conditionally based on which mechanisms exist.

## Stories

| Code | Story | Status | Depends on |
|------|-------|--------|------------|
| [S1](cv1-e6-s1-conversations-browse/index.md) | **Conversations browse** — `/conversations` with filters by persona / organization / journey, sorted by recency, paginated. The first cross-scope view of episodic memory, sidebar entry "Conversations" alongside "Conversation". URL params survive sharing/bookmarking | ✅ Done | nothing — uses CV1.E4.S4 junctions and S5 helpers |
| `CV1.E6.S7` *(was S1)* | **Memory Map landing** — `/memory` with one card per active mechanism (episodic, attachments, insights), evolving the Psyche Map's memory column into a full surface. Renumbered to land *after* the section views exist | future | at least S1 + one more section |
| `CV1.E6.S2` | **Attachments library view** — `/memory/attachments` as browseable list, per-attachment detail page with all scope associations, upload from library, re-associate, delete | draft | CV1.E4.S2 |
| `CV1.E6.S4` | **Insights browse** — `/memory/insights` with extracted facts, semantic search, per-insight source links back to originating episode | draft | CV1.E3.S3 |
| `CV1.E6.S5` | **Global search across sections** — one search box that queries episodic titles, attachment content, insight facts | draft | S1 + S2 + S4 |
| `CV1.E6.S6` | **Export / data sovereignty** — download a dump of everything the mirror carries for the user. JSON + source files | draft | S2 |

**Ordering rationale:** **S1 (Conversations browse) jumped ahead** of the original landing-first plan — driven by the CV1.E4.S5 (scope ateliê) follow-up where 5-of-N session lists per scope need a destination for "view all (filtered)". S1 lands the first real section without requiring a Memory Map landing first; the landing (S7) becomes the meta-surface that ties sections together once there are multiple. S2 and S4 land their respective sections as the underlying mechanisms (CV1.E4.S2, CV1.E3.S3) ship. S5 and S6 are refinement once the sections coexist.

## Out of scope

- **Editing structural identity** — lives on the [Cognitive Map](../cv0-foundation/cv0-e2-web-experience/cv0-e2-s8-cognitive-map/).
- **Creating or archiving scopes** — lives on the [Journey Map](../cv1-e4-journey-map/).
- **Current-turn composition view** — lives on the [Context Rail](../cv0-foundation/cv0-e2-web-experience/cv0-e2-s9-context-rail/).

See [Memory Map — What this surface does not do](../../../../product/memory-map.md#what-this-surface-does-not-do) for the full boundary.

---

**See also:**
- [Memory Map concept](../../../../product/memory-map.md)
- [Memory Taxonomy](../../../../product/memory-taxonomy.md) — the roles and mechanisms this surface browses
- [CV1.E3 — Memory](../cv1-e3-memory/) — mechanisms this surface reads
- [CV1.E4 — Journey Map](../cv1-e4-journey-map/) — sibling surface that scopes the same memory
