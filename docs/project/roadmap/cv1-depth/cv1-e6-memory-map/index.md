[< CV1 — Depth](../)

# CV1.E6 — Memory Map

**Roadmap:** [CV1.E6](../../index.md)
**Status:** Future epic — placeholder. Stories listed below are draft sketches; they will be refined closer to implementation following the [story lifecycle](../../../../process/development-guide.md#story-lifecycle).
**Conceptual foundation:** [Memory Map](../../../../product/memory-map.md)

The Memory Map is the surface where the user browses what the mirror carries across time — episodic traces, attached documents, extracted insights, and other accumulated records. Fourth peer surface in the [four-surface model](../../../../product/memory-map.md#the-four-surface-model), after Cognitive Map, Journey Map, and Context Rail.

## Prerequisites

This epic depends on mechanisms shipped by earlier epics:

- [CV1.E4.S2 — Attachments subsystem](../cv1-e4-journey-map/) provides the `attachments` + `attachment_chunks` + `attachment_links` tables.
- [CV1.E3.S3 — Long-term semantic memory](../cv1-e3-memory/) provides the extracted-memories pipeline that populates the Insights section.
- [CV1.E3.S1 — Topic shift detection](../cv1-e3-memory/) populates the Episodic section with richer session metadata.

Memory Map can land in fragments as each prerequisite arrives — the landing page renders sections conditionally based on which mechanisms exist.

## Draft stories

These are sketches. Each will be re-planned with the full story-lifecycle treatment when approached.

| Code | Story (draft) | Depends on |
|------|---------------|------------|
| `CV1.E6.S1` | **Landing page + section cards** — `/memory` with one card per active mechanism; links to per-mechanism views; sidebar link under *My Mirror*. Evolution of the Cognitive Map's memory column into a full surface | CV1.E4.S2 at minimum |
| `CV1.E6.S2` | **Attachments library view** — `/memory/attachments` as browseable list, per-attachment detail page with all scope associations, upload from library, re-associate, delete | CV1.E4.S2 |
| `CV1.E6.S3` | **Episodic browse** — `/memory/episodic` as session timeline with title, date, scope tags, preview; filter by scope; click-through to readonly replay (when that lands) | CV1.E3.S1 ideally, not strictly required |
| `CV1.E6.S4` | **Insights browse** — `/memory/insights` with extracted facts, semantic search, per-insight source links back to originating episode | CV1.E3.S3 |
| `CV1.E6.S5` | **Global search across sections** — one search box on `/memory` that queries episodic titles, attachment content, insight facts | CV1.E6.S2 + S3 + S4 |
| `CV1.E6.S6` | **Export / data sovereignty** — download a dump of everything the mirror carries for the user. JSON + source files | CV1.E6.S2 |

**Ordering rationale (draft):** S1 is the tracer bullet once any mechanism is live. S2 is the natural first section (attachments already exist from CV1.E4). S3 and S4 depend on the mechanisms from CV1.E3 landing. S5 and S6 are refinement and data-sovereignty stories that the earlier sections enable.

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
