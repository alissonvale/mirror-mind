[< Docs](../index.md)

# PATH — Mirror Mind

> Where the system is headed. Previous phases (Python) are at the bottom.
> Updated 13/Apr/2026 (reconstruction on pi started, first deliverable defined).

---

## Problem

The mirror is the primary personal intelligence asset for its users. But in its current form (Python, CLI, coupled to Claude Code) it is single-user, single-device, and requires a terminal session. Anyone who wants to use it must install the full environment. Family and friends can't use it. Conversations don't travel across devices.

The reconstruction fixes this: the mirror becomes a server accessible from any device, any time, by any authorized person — each with their own voice, their own history, their own privacy.

## Community Value

Each delivery must generate concrete value for the mirror's user community. Value types:

| Type | Definition |
|------|-----------|
| **Autonomy** | Each person has their own mirror, with their own voice and context |
| **Continuity** | Conversations persist and accumulate context over time |
| **Accessibility** | The mirror is available from any device, any time |
| **Depth** | The mirror understands more, remembers more, and connects more dots |

---

## Where we are

Python mirror functional with 13 personas, RAG memory, skills, journeys, economy (Stages 0–0.6 complete). Technical spike performed 11–12/Apr with 8 experiments on the pi framework. Group session validated the path. First deliverable defined: server on VPS with real identity + CLI + Telegram.

**New mirror stack:** TypeScript, pi-ai + pi-agent-core, hono, SQLite, grammy (Telegram).

**Key decisions:** pi as foundation, client-server from day 1, relational DB inspired by SessionManager, greenfield, identity in the database, bearer token auth, English as internal language, strangler fig (Python continues in parallel). Full rationale in [briefing.md](briefing.md).

---

## CV0 — Foundation `autonomy` + `continuity` ← CURRENT FOCUS

> The mirror exists as a server, persists conversations, authenticates users, and accepts remote clients. Each person has their own identity and privacy.

### CV0.M1 — First Deliverable 🚧

> **Status:** Not started. Tasks created.
> **Done criteria:** send a message from the CLI on a laptop, continue the conversation from Telegram on a phone, the mirror maintains the continuous thread with the real voice.
> **Full spec:** [cv0-m1-tracer-bullet.md](../design/cv0-m1-tracer-bullet.md)

| Code | Epic | Description |
|------|------|-------------|
| `CV0.M1.E1` | **The mirror has my real voice** | Convert soul + ego + behavior into user identity in the database |
| `CV0.M1.E2` | **The server runs 24/7 in the cloud** | VPS provisioned, mirror-server deployed with HTTPS |
| `CV0.M1.E3` | **I can chat from any machine's terminal** | CLI pointing to VPS, config at ~/.mirror/ |
| `CV0.M1.E4` | **I can chat from Telegram on my phone** | Telegram bot as thin adapter over the server |
| `CV0.M1.E5` | **The conversation is one, regardless of channel** | Continuous thread CLI ↔ Telegram proven |
| `CV0.M1.E6` | **My friends have their own mirrors** | Provision group users with token + stub identity |

---

## CV1 — Depth `depth` + `continuity` + `context intelligence`

> The mirror understands more than the current conversation text. It has memory, journey context, and personas. Every piece of context earns its place in the prompt — selective, not exhaustive.

### CV1.M1 — Personas

| Code | Epic | Description |
|------|------|-------------|
| `CV1.M1.E1` | **The mirror responds with the right voice for context** | Automatic persona routing based on the message |
| `CV1.M1.E2` | **Each persona has domain depth** | Personas loaded as layers on top of base identity |

### CV1.M2 — Memory

| Code | Epic | Description |
|------|------|-------------|
| `CV1.M2.E1` | **Long conversations don't lose context** | Automatic compaction (summary of old history) |
| `CV1.M2.E2` | **The mirror remembers what matters across conversations** | Long-term memory — extraction, embeddings, semantic search |

### CV1.M3 — Journeys

| Code | Epic | Description |
|------|------|-------------|
| `CV1.M3.E1` | **The mirror knows which journey I'm on** | Journey context loaded into prompt |
| `CV1.M3.E2` | **The mirror tracks my progress** | Path, tasks, and briefing visible in conversation |

---

## CV2 — Accessibility `accessibility` + `autonomy`

> The mirror meets the user where they are. More channels, more ways to interact.

| Code | Epic | Description |
|------|------|-------------|
| `CV2.E1` | **I can chat with the mirror on WhatsApp** | WhatsApp Business API adapter |
| `CV2.E2` | **I have a dedicated web interface** | Web UI for conversations and management |
| `CV2.E3` | **I can speak instead of type** | Audio input (Web Speech API / Whisper) |

---

## CV3 — Intelligence `depth` + `proactivity`

> The mirror does things only a system with historical context can do — and does them without being asked.

| Code | Epic | Description |
|------|------|-------------|
| `CV3.E1` | **The mirror acts before I ask** | Proactive behavior — surfaces insights, tracks commitments, follows up on unresolved threads without waiting for a command |
| `CV3.E2` | **The mirror notices patterns I don't see** | Transversal meta-reading across journeys |
| `CV3.E3` | **The mirror detects tensions and contradictions** | Self — tension analysis between personas/journeys |
| `CV3.E4` | **The mirror keeps my decisions and reasoning** | Structured decision log |

---

## CV4 — Metacognition `depth` + `proactivity`

> The mirror observes itself — how it responds, where it falls short, what it could do better. Not just memory of what the user said, but awareness of its own performance.

| Code | Epic | Description |
|------|------|-------------|
| `CV4.E1` | **The mirror knows when it's not helping** | Self-assessment of response quality — detects vague, generic, or misaligned answers |
| `CV4.E2` | **The mirror learns what works for each user** | Tracks which approaches land well vs. fall flat, adapts over time |
| `CV4.E3` | **The mirror recognizes its own blind spots** | Shadow applied to itself — topics it avoids, patterns it reinforces, biases in its reasoning |

---

## CV5 — Self-Construction `autonomy` + `depth`

> The mirror programs itself to serve each user's specific needs. The user describes what they want; the mirror builds the capability.

One user needs inventory management. Another needs financial tracking. Another needs a social media workflow. The mirror creates the functions, database tables, and processing logic — all from natural language. Generated code and schemas live in a sandboxed per-user space, strictly isolated from the core (identity, auth, sessions, agent runtime). The core stays stable; each user's mirror grows without limit.

| Code | Epic | Description |
|------|------|-------------|
| `CV5.E1` | **The mirror creates tools on demand** | User describes a need, mirror generates an agent tool (function + schema) and registers it |
| `CV5.E2` | **The mirror manages per-user data** | Sandboxed tables and queries per user — inventory, finances, contacts, whatever the user needs |
| `CV5.E3` | **The mirror composes workflows** | Chains of tools that process, synthesize, and surface information — not just storage, but intelligence over user data |

---

## Radar

| Idea | Description |
|------|-------------|
| **Agent tools** | Memory search, journey reading, draft saving as pi-agent-core tools |
| **Client streaming** | SSE on POST /message for real-time tokens (needed for web UI) |
| **Composed identity** | Auto-compose identity from self + ego + persona + journey |
| **CI/CD** | Auto-deploy via git push (currently manual via SSH) |
| **Shadow** | Unconscious pattern detection — biases, avoided topics |
| **Meta-Self** | System governance — audit log, policy engine |
| **Proactive triggers** | Time-based and event-based hooks that let the mirror initiate contact (e.g., deadline approaching, pattern detected, commitment unfulfilled) |

---

## Previous milestones (Python mirror)

### Stage 0: Foundation ✅
Ego, Personas, CLI, Persistence, Routing, Artifacts.

### Stage 0.5: Memory ✅
SQLite memory bank, OpenAI embeddings, automatic LLM extraction, hybrid search.

### Stage 0.6: Extensions ✅
Operational skills, journeys, tasks, economy, testimonials, multi-LLM queries, 13 personas.

---

## References

- [Project briefing](briefing.md) — architectural decisions and rationale
- [First deliverable design](../design/cv0-m1-tracer-bullet.md) — endpoints, schema, deploy spec
- [Spike report](../process/spikes/spike-2026-04-12.md) — technical investigation that led to this project
- Sandbox with experiments: [pi-sandbox](https://github.com/alissonvale/pi-sandbox) (8 runnable exps)
- Reference article: "Making sense of Harness Engineering" (Henrique Bastos)

---

**See also:** [CV0.M1 — Tracer Bullet](../design/cv0-m1-tracer-bullet.md) (spec for the current deliverable) · [Briefing](briefing.md) (architectural decisions) · [Getting Started](../getting-started.md) (run it yourself)
