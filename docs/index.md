# Docs

The mirror's internal documentation — project briefing, running decisions, process notes, product design, and release narratives. Navigate the full tree on the left sidebar; this page curates the entry points.

- [Getting Started](getting-started.md) — install, set up your mirror, migrate from the POC

## Latest release

- [v0.10.0 — A Place to Land](releases/v0.10.0.md) — login lands on a new home page; the sidebar reorganizes around three questions; About You at `/me`; cost displays a single currency per preference; sessions carry an editable pool of personas, organizations, and journeys (CV0.E4 full epic + CV1.E4.S4).

## Project

- [Briefing](project/briefing.md) — foundational architectural decisions (D1–D8)
- [Decisions](project/decisions.md) — running log of incremental decisions
- [Roadmap](project/roadmap/) — community values (CV0–CV5), epics, and stories
- [Spikes](project/roadmap/spikes/) — technical investigations that shaped the path

Active right now:
- [CV0.E3 — Admin Workspace](project/roadmap/cv0-foundation/cv0-e3-admin-workspace/) — admin operates this mirror from the browser; S9 (import conversation history from markdown) landed 2026-04-22, ships next release; S2 (adapters) queued
- [CV1.E4 — Journey Map](project/roadmap/cv1-depth/cv1-e4-journey-map/) — situational surface peer to the Psyche Map; S1 + S4 shipped (v0.8.0, v0.10.0); S2 (attachments) and S3 (scoped memory) queued ([concept](product/journey-map.md))
- [CV1.E3 — Memory](project/roadmap/cv1-depth/cv1-e3-memory/) — how the mirror holds, loses, and remembers across conversations

## Product

- [Principles](product/principles.md) — product, code, and testing guidelines
- [Memory Taxonomy](product/memory-taxonomy.md) — cognitive roles × storage mechanisms, and the distinction between the mirror's structure and its memory
- [Journey Map](product/journey-map.md) — situational surface peer to the Cognitive Map; a scope over memory, not an identity layer
- [Memory Map](product/memory-map.md) — planned fourth surface; browses what the mirror carries across time
- [Prompt Composition](product/prompt-composition/) — how the system prompt is built, with example prompts per adapter
- [Conversation Markdown Format](product/conversation-markdown-format.md) — canonical input format for importing conversation history from any source
- [Admin CLI Reference](product/admin-cli.md) — commands and usage

## Process

- [Development Guide](process/development-guide.md) — story lifecycle, commit conventions, review pass, push cadence
- [Evals](process/evals.md) — end-to-end LLM quality probes, distinct from the unit/integration test suite
- [Worklog](process/worklog.md) — what was done, what's next

## All releases

Most recent first:

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
