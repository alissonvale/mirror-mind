# Docs

- [Getting Started](getting-started.md) — install, setup your mirror, migrate from POC

## Project

What we're building and why.

- [Briefing](project/briefing.md) — architectural decisions and rationale (D1–D8)
- [Roadmap](project/roadmap.md) — where we are, where we're going (CV0–CV5)
- [Decisions](project/decisions.md) — incremental decisions made during construction

## CV0.E1 — Tracer Bullet

First deliverable: mirror server + CLI + Telegram.

- [Design](cv0-e1/tracer-bullet.md) — spec: endpoints, schema, deploy
- [S1 — DB + Identity Transfer](cv0-e1/s1-db-identity/) — plan, test guide, refactoring
- [S2 — Server](cv0-e1/s2-server/) — plan, test guide, refactoring
- [S3 — Deploy](cv0-e1/s3-deploy/) — runbook, test guide
- [S4 — CLI](cv0-e1/s4-cli/) — plan, test guide
- [S5 — Web UI](cv0-e1/s5-web/) — plan, test guide
- [S6 — Telegram](cv0-e1/s6-telegram/) — plan, test guide

## CV1.E1 — Personas

The mirror responds with the right voice for each context.

- [Design](cv1-e1/tracer-bullet.md) — reception architecture and persona composition
- [S1 — Persona Routing](cv1-e1/s1-persona-routing/) — plan, test guide

## CV1.E2 — Adapter Awareness

The mirror adapts to the channel — tone, length, formatting.

- [Design](cv1-e2/tracer-bullet.md) — architecture and stories
- [S1 — Adapter Prompts](cv1-e2/s1-adapter-prompts/) — plan, test guide
- [S2 — Formatters](cv1-e2/s2-formatters/) — plan, test guide

## Design

Transversal guidelines.

- [Principles](design/principles.md) — product, code, and testing guidelines
- [Admin CLI Reference](design/admin-cli.md) — commands and usage

## Releases

- [v0.3.0 — One Mirror, Many Tones](releases/v0.3.0.md) — adapter-aware prompts, Telegram formatting
- [v0.2.0 — The Mirror Learns to Listen](releases/v0.2.0.md) — reception layer, personas, identity rewrite
- [v0.1.0 — The Tracer Bullet](releases/v0.1.0.md) — server, CLI, web, Telegram, deploy

## Process

How we operate.

- [Worklog](process/worklog.md) — what was done, what's next
- [Spike: Pi as Foundation](process/spikes/spike-2026-04-12.md) — technical investigation (11–12 Apr 2026)
