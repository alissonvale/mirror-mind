# Docs

The mirror's internal documentation — project briefing, running decisions, process notes, product design, and release narratives. The avatar menu's **Docs** entry (admin only) opens this tree; this page curates the entry points.

- [Getting Started](getting-started.md) — install, set up your mirror, migrate from the POC

## Latest release

- [v0.24.0 — The mirror reads itself](releases/v0.24.0.md) — Two epics ship and the metabolism flips from edit-by-default to read-by-default. **CV1.E13 Portraits**: every entity link (`/journeys/<key>`, `/organizations/<key>`, `/cenas/<key>`, `/personas/<key>`) lands on a memoir-shaped read with the form behind a discreet "editar" door. Each portrait is structurally driven by data — lede pulled from briefing/situation, "where it lives" / "where it appears" listing adjacencies, conditional structural section, "the live question" surfaced when declared, citable lines per conversation extracted via LLM and `source_hash`-cached. **CV1.E14 Identidade**: the cognitive map metaphor retires; `/identidade` ships as a continuous-read self-portrait (ALMA / PAPEL / COMPORTAMENTO / EXPRESSÃO / ELENCO). The term "ego" leaves the user-facing chrome. `/espelho` gets a name bookplate, the `soul-updated` shift retires, and Vivo's glyph flips from `◌` to `✼`. Avatar dropdown restructures into four groups with Unicode glyphs. Six narrative tenants get authored soul summaries + 3-5 inscriptions each. Three rounds of read-by-default link audits across the chrome. 1194 tests passing.

## Project

- [Briefing](project/briefing.md) — foundational architectural decisions (D1–D8)
- [Decisions](project/decisions.md) — running log of incremental decisions
- [Roadmap](project/roadmap/) — community values (CV0–CV5), epics, and stories
- [Spikes](project/roadmap/spikes/) — technical investigations that shaped the path

Active right now:
- [CV1.E13 — Portraits](project/roadmap/cv1-depth/cv1-e13-portraits/) ✅ — read view for orgs/journeys/scenes; replaces CRUD landing with a memoir-as-essay surface, editing as discreet secondary affordance. All three stories shipped (S1 + S2 on 2026-05-04, S3 on 2026-05-05) ([design](design/entity-profiles.md))
- [CV1.E6 — Memory Map](project/roadmap/cv1-depth/cv1-e6-memory-map/) — fourth peer surface; S1 (Conversations browse) shipped in v0.11.0; S2 (Attachments library), S4 (Insights), and others queued behind their underlying mechanisms ([concept](product/memory-map.md))
- [CV1.E4 — Journey Map](project/roadmap/cv1-depth/cv1-e4-journey-map/) — situational surface peer to the Psyche Map; S1, S4, S5 shipped; S2 (attachments) and S3 (scoped memory) queued ([concept](product/journey-map.md))
- [CV1.E3 — Memory](project/roadmap/cv1-depth/cv1-e3-memory/) — how the mirror holds, loses, and remembers across conversations
- [CV0.E4 — Home & Navigation](project/roadmap/cv0-foundation/cv0-e4-home-navigation/) — full epic shipped; S8 (curated Continue band) queued, plan deferred until usage signal accumulates

## Product

- [Principles](product/principles.md) — product, code, and testing guidelines
- [Product Use Narrative](product-use-narrative/) — four fictional users (a family) whose independent uses of the mirror span the product's surface area; a story, a fixture set, and a design instrument in one
- [Memory Taxonomy](product/memory-taxonomy.md) — cognitive roles × storage mechanisms, and the distinction between the mirror's structure and its memory
- [Journey Map](product/journey-map.md) — situational surface peer to the Cognitive Map; a scope over memory, not an identity layer
- [Memory Map](product/memory-map.md) — planned fourth surface; browses what the mirror carries across time
- [Prompt Composition](product/prompt-composition/) — how the system prompt is built, with example prompts per adapter
- [Conversation Markdown Format](product/conversation-markdown-format.md) — canonical input format for importing conversation history from any source
- [Admin CLI Reference](product/admin-cli.md) — commands and usage

## Design

Design notes — surfaces sketched ahead of construction, with the conversation locked so implementation can move quickly when a window opens.

- [Entity profiles](design/entity-profiles.md) — read view for organizations, journeys, and scenes; the default landing replaces the CRUD form, with editing as a discreet secondary affordance ([2026-05-04](design/entity-profiles.md))
- [Scenes — home design](design/scenes-home-design.md) — `/inicio` as the cena-first home (resolved the scenes pivot)
- [Scenes pivot](design/scenes-pivot.md) — *(historical record)* the insight that scenes are the model, not a feature on top of it

## Process

- [Development Guide](process/development-guide.md) — story lifecycle, commit conventions, review pass, push cadence
- [Evals](process/evals.md) — end-to-end LLM quality probes, distinct from the unit/integration test suite
- [Worklog](process/worklog.md) — what was done, what's next

## All releases

Most recent first:

- [v0.24.0 — The mirror reads itself](releases/v0.24.0.md)
- [v0.23.0 — The mirror has a face](releases/v0.23.0.md)
- [v0.22.0 — Cena pivot: the scene is the model](releases/v0.22.0.md)
- [v0.21.0 — Two new dials, one cast that holds Alma](releases/v0.21.0.md)
- [v0.17.0 — A second mother tongue](releases/v0.17.0.md)
- [v0.16.0 — Every layer earns its place](releases/v0.16.0.md)
- [v0.15.0 — A voice, a cast](releases/v0.15.0.md)
- [v0.14.0 — Finding the voice](releases/v0.14.0.md)
- [v0.13.0 — The Family Moves In](releases/v0.13.0.md)
- [v0.12.0 — Taking Shape](releases/v0.12.0.md)
- [v0.11.0 — The Memory I Carry](releases/v0.11.0.md)
- [v0.10.0 — A Place to Land](releases/v0.10.0.md)
- [v0.9.0 — Subscription, reconsidered](releases/v0.9.0.md)
- [v0.8.1 — Calibration and a path to zero cost](releases/v0.8.1.md)
- [v0.8.0 — The Mirror Knows Where I Am](releases/v0.8.0.md)
- [v0.7.0 — Tuning the Voice](releases/v0.7.0.md)
- [v0.6.0 — The Admin Workspace](releases/v0.6.0.md)
- [v0.5.0 — The Mirror Shows Itself](releases/v0.5.0.md)
- [v0.4.0 — The Web Grows Up](releases/v0.4.0.md)
- [v0.3.2 — One Page to See It All](releases/v0.3.2.md)
- [v0.3.1 — Polish and Clarity](releases/v0.3.1.md)
- [v0.3.0 — One Mirror, Many Tones](releases/v0.3.0.md)
- [v0.2.0 — The Mirror Learns to Listen](releases/v0.2.0.md)
- [v0.1.0 — The Tracer Bullet](releases/v0.1.0.md)
