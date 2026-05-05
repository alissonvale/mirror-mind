# Docs

The mirror's internal documentation — project briefing, running decisions, process notes, product design, and release narratives. The avatar menu's **Docs** entry (admin only) opens this tree; this page curates the entry points.

- [Getting Started](getting-started.md) — install, set up your mirror, migrate from the POC

## Latest release

- [v0.23.0 — The mirror has a face](releases/v0.23.0.md) — CV1.E12 (The Mirror page) ships end-to-end: the ◆ Mirror Mind logo finally points at what its name promises — a contemplative surface at `/` that reads as one self-portrait. Three depth panes (Vivo / Estou / Sou) answer the user's three foundational questions, color-coded and linked to drill-downs. Synthesizes from current state (active voices and focus journey of the week, dominant org, recurring themes, last conversation), surfaces shifts since last visit, and carries pinned phrases (Ímãs) at the top. Sou pane ships noble typography (EB Garamond italic + amber drop-cap) for the soul summary. Operational home moves to `/inicio`; new ▶ Iniciar pill takes the operational role. CV1.E11 follow-up: `/territorio` splits from `/memorias`. Naming polish: Mapa Cognitivo → Mapa Interior; Inscrições → Ímãs. Data-layer fixes (cena response_mode/length propagation, editable summaries on workshops, conversation count consistency). Big silent bug found: hono/jsx HTML-escapes `<style>` children — `raw()` sweep restores typography that had been silently falling back to system sans for months. 1097 tests passing.

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
