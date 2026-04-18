[< Docs](../../index.md)

# Roadmap — Mirror Mind

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

### Hierarchy

| Level | Name | What it is |
|-------|------|-----------|
| **CV** | Community Value | A stage of delivery with clear user value |
| **E** | Epic | A cohesive block of work with done criteria |
| **S** | Story | An atomic delivery from the user's perspective |

---

## Where we are

Python mirror functional with 13 personas, RAG memory, skills, journeys, economy (Stages 0–0.6 complete). Technical spike performed 11–12/Apr with 8 experiments on the pi framework. Group session validated the path. First deliverable defined: server on VPS with real identity + CLI + Telegram.

**New mirror stack:** TypeScript, pi-ai + pi-agent-core, hono, SQLite, grammy (Telegram).

**Key decisions:** pi as foundation, client-server from day 1, relational DB inspired by SessionManager, greenfield, identity in the database, bearer token auth, English as internal language, strangler fig (Python continues in parallel). Full rationale in [briefing.md](briefing.md).

---

## CV0 — Foundation `autonomy` + `continuity` ← CURRENT FOCUS

> The mirror exists as a server, persists conversations, authenticates users, and accepts remote clients. Each person has their own identity and privacy.

### CV0.E1 — Tracer Bullet ✅ `v0.1.0`

> **Status:** Complete. ✅
> **Done criteria:** send a message from the CLI on a laptop, continue the conversation from Telegram on a phone, the mirror maintains the continuous thread with the real voice.
> **Full spec:** [tracer-bullet.md](cv0-foundation/cv0-e1-tracer-bullet/)

| Code | Story | Description |
|------|-------|-------------|
| [`CV0.E1.S1`](cv0-foundation/cv0-e1-tracer-bullet/cv0-e1-s1-db-identity/) | **The mirror has my real voice** ✅ | Identity layers in the database, imported from POC |
| [`CV0.E1.S2`](cv0-foundation/cv0-e1-tracer-bullet/cv0-e1-s2-server/) | **The server responds with my voice** ✅ | HTTP server with auth, identity composition, and Agent per request |
| [`CV0.E1.S3`](cv0-foundation/cv0-e1-tracer-bullet/cv0-e1-s3-deploy/) | **The server runs 24/7 in the cloud** ✅ | VPS, nginx (Docker), systemd, HTTPS via Cloudflare |
| [`CV0.E1.S4`](cv0-foundation/cv0-e1-tracer-bullet/cv0-e1-s4-cli/) | **I can chat from any machine's terminal** ✅ | CLI pointing to server, config at ~/.mirror/ |
| [`CV0.E1.S5`](cv0-foundation/cv0-e1-tracer-bullet/cv0-e1-s5-web/) | **I can chat and manage from a browser** ✅ | Web UI served from hono — chat + admin (users, identity), SSE streaming |
| [`CV0.E1.S6`](cv0-foundation/cv0-e1-tracer-bullet/cv0-e1-s6-telegram/) | **I can chat from Telegram on my phone** ✅ | Telegram bot as thin adapter over the server |

### [CV0.E2 — Web Experience](cv0-foundation/cv0-e2-web-experience/) `v0.4.0` → `v0.5.0`

> **Status:** S1–S6 done (v0.4.0). S7 and S9 done (pending release). S8, S10 queued.
> **Goal:** the web client is the surface where the mirror's memory becomes **legible** — not a chat + admin page, but a workspace where the user sees and edits what the mirror holds about them.

| Code | Story | Description |
|------|-------|-------------|
| [`CV0.E2.S1`](cv0-foundation/cv0-e2-web-experience/cv0-e2-s1-basic-web/) | **Login + Chat + Admin** ✅ | Basic web UI (done as CV0.E1.S5) |
| [`CV0.E2.S2`](cv0-foundation/cv0-e2-web-experience/cv0-e2-s2-unified-profile/) | **Unified user profile** ✅ | Identity + personas on one page with collapsible cards (v0.3.2) |
| [`CV0.E2.S3`](cv0-foundation/cv0-e2-web-experience/cv0-e2-s3-web-refactor/) | **Move web client to adapters/web/** ✅ | Refactor: consolidate web pages, routes, assets, and auth under adapters/web/ |
| [`CV0.E2.S4`](cv0-foundation/cv0-e2-web-experience/cv0-e2-s4-sidebar/) | **Sidebar navigation** ✅ | Replace top nav with fixed sidebar (Mirror, Admin, Logout) |
| [`CV0.E2.S5`](cv0-foundation/cv0-e2-web-experience/cv0-e2-s5-chat-visual/) | **Chat with visual identity** ✅ | Warm background, persona badge, distinctive assistant bubbles |
| [`CV0.E2.S6`](cv0-foundation/cv0-e2-web-experience/cv0-e2-s6-web-tests/) | **Web route tests** ✅ | Hono app.request() tests for login, auth, admin (13 tests) |
| [`CV0.E2.S7`](cv0-foundation/cv0-e2-web-experience/cv0-e2-s7-auth-roles/) | **I know who's logged in** ✅ | User name + avatar in sidebar. Admin role sees Users; regular users don't; `/admin/*` returns 403 to non-admins |
| [`CV0.E2.S9`](cv0-foundation/cv0-e2-web-experience/cv0-e2-s9-context-rail/) | **Context Rail — attention memory visible** ✅ | Right-side panel: active persona, session stats (messages, tokens, cost, model), composed context. Collapsible, persisted per user. |
| `CV0.E2.S8` | **Memory Workspace** — `/memory` with cards per layer | Dedicated workspace for identity, personas, and (later) journeys and extensions. Evolves the unified profile into a scalable surface — and absorbs self-service edits the admin page doesn't cover today, including changing one's own display name |
| `CV0.E2.S10` | **Empty states as invitations** | Each workspace memory card without content shows a textual invitation instead of a grey placeholder |

S9 is ordered before S8: the rail is smaller, visible on every chat screen, and teaches what signals matter before designing the full workspace.

---

## CV1 — Depth `depth` + `continuity` + `context intelligence`

> The mirror understands more than the current conversation text. It has memory, journey context, and personas. Every piece of context earns its place in the prompt — selective, not exhaustive.

### [CV1.E1 — Personas](cv1-depth/cv1-e1-personas/) ✅ `v0.2.0`

| Code | Story | Description |
|------|-------|-------------|
| [`CV1.E1.S1`](cv1-depth/cv1-e1-personas/cv1-e1-s1-persona-routing/) | **The mirror responds with the right voice for context** ✅ | Automatic persona routing based on the message |
| [`CV1.E1.S2`](cv1-depth/cv1-e1-personas/cv1-e1-s2-admin-personas/) | **I can manage personas from the browser** ✅ | Dedicated admin page for viewing, editing, and adding personas per user |


### [CV1.E2 — Adapter Awareness](cv1-depth/cv1-e2-adapter-awareness/) ✅ `v0.3.0`

| Code | Story | Description |
|------|-------|-------------|
| [`CV1.E2.S1`](cv1-depth/cv1-e2-adapter-awareness/cv1-e2-s1-adapter-prompts/) | **The mirror knows which channel it's talking on** ✅ | Adapter context injected into prompt — Telegram gets short/conversational, Web gets depth |
| [`CV1.E2.S2`](cv1-depth/cv1-e2-adapter-awareness/cv1-e2-s2-formatters/) | **The output fits the channel** ✅ | Formatter per adapter — markdown converted to Telegram MarkdownV2, Web HTML, CLI plain text |

### CV1.E3 — Memory

| Code | Story | Description |
|------|-------|-------------|
| `CV1.E3.S4` | **I can reset my conversation** | Manual session control. Start a fresh conversation (current session preserved in the DB for future recall), and — as a separate, destructive mode — delete the current session's entries entirely. Exact UX for both modes designed when the story lands; the shape matters because one mode protects learning and the other erases it |
| `CV1.E3.S1` | **The mirror knows when the subject changed** | Reception detects topic shifts using recent history; silently creates new session when context switches |
| `CV1.E3.S2` | **Long conversations don't lose context** | Automatic compaction (summary of old history) |
| `CV1.E3.S3` | **The mirror remembers what matters across conversations** | Long-term memory — extraction, embeddings, semantic search |

S4 is ordered before S1: manual boundary setting comes before automatic detection. Giving the user the reset affordance first teaches both the system and the user what a "session boundary" means; S1 then calibrates an automatic version of the same act.

### CV1.E4 — Journeys

| Code | Story | Description |
|------|-------|-------------|
| `CV1.E4.S1` | **The mirror knows which journey I'm on** | Journey context loaded into prompt |
| `CV1.E4.S2` | **The mirror tracks my progress** | Path, tasks, and briefing visible in conversation |

---

## CV2 — Accessibility `accessibility` + `autonomy`

> The mirror meets the user where they are. More channels, more ways to interact.

| Code | Story | Description |
|------|-------|-------------|
| `CV2.S1` | **I can chat with the mirror on WhatsApp** | WhatsApp Business API adapter |
| `CV2.S2` | **I have a dedicated web interface** | Web UI for conversations and management |
| `CV2.S3` | **I can speak instead of type** | Audio input (Web Speech API / Whisper) |

---

## CV3 — Intelligence `depth` + `proactivity`

> The mirror does things only a system with historical context can do — and does them without being asked.

| Code | Story | Description |
|------|-------|-------------|
| `CV3.S1` | **The mirror acts before I ask** | Proactive behavior — surfaces insights, tracks commitments, follows up on unresolved threads without waiting for a command |
| `CV3.S2` | **The mirror notices patterns I don't see** | Transversal meta-reading across journeys |
| `CV3.S3` | **The mirror detects tensions and contradictions** | Self — tension analysis between personas/journeys |
| `CV3.S4` | **The mirror keeps my decisions and reasoning** | Structured decision log |

---

## CV4 — Metacognition `depth` + `proactivity`

> The mirror observes itself — how it responds, where it falls short, what it could do better. Not just memory of what the user said, but awareness of its own performance.

| Code | Story | Description |
|------|-------|-------------|
| `CV4.S1` | **The mirror knows when it's not helping** | Self-assessment of response quality — detects vague, generic, or misaligned answers |
| `CV4.S2` | **The mirror learns what works for each user** | Tracks which approaches land well vs. fall flat, adapts over time |
| `CV4.S3` | **The mirror recognizes its own blind spots** | Shadow applied to itself — topics it avoids, patterns it reinforces, biases in its reasoning |

---

## CV5 — Self-Construction `autonomy` + `depth`

> The mirror programs itself to serve each user's specific needs. The user describes what they want; the mirror builds the capability.

One user needs inventory management. Another needs financial tracking. Another needs a social media workflow. The mirror creates the functions, database tables, and processing logic — all from natural language. Generated code and schemas live in a sandboxed per-user space, strictly isolated from the core (identity, auth, sessions, agent runtime). The core stays stable; each user's mirror grows without limit.

| Code | Story | Description |
|------|-------|-------------|
| `CV5.S1` | **The mirror creates tools on demand** | User describes a need, mirror generates an agent tool (function + schema) and registers it |
| `CV5.S2` | **The mirror manages per-user data** | Sandboxed tables and queries per user — inventory, finances, contacts, whatever the user needs |
| `CV5.S3` | **The mirror composes workflows** | Chains of tools that process, synthesize, and surface information — not just storage, but intelligence over user data |

---

## Radar

| Idea | Description |
|------|-------------|
| **Reception as router** | Reception evolves from `{ persona }` to a multi-signal envelope (`persona`, `journey`, `topicShifted`, `attachmentsNeeded`, `semanticQueries`, `extensionsActivated`). Each signal maps to a [memory mechanism](../product/memory-taxonomy.md). |
| **Prospective memory epic** | A dedicated epic (likely under CV3) for prospective memory — tasks, triggers, deferred intentions. Today's tasks are storage; this adds the triggering side. See [memory taxonomy §Prospective is the least-explored frontier](../product/memory-taxonomy.md#3-prospective-is-the-least-explored-frontier). |
| **Agent tools** | Memory search, journey reading, draft saving as pi-agent-core tools |
| **Client streaming** | SSE on POST /message for real-time tokens (needed for web UI) |
| **Composed identity** | Auto-compose identity from self + ego + persona + journey |
| **CI/CD** | Auto-deploy via git push (currently manual via SSH) |
| **Shadow** | Unconscious pattern detection — biases, avoided topics |
| **Meta-Self** | System governance — audit log, policy engine |
| **Proactive triggers** | Time-based and event-based hooks that let the mirror initiate contact (e.g., deadline approaching, pattern detected, commitment unfulfilled) |

---

## Previous stages (Python mirror)

### Stage 0: Foundation ✅
Ego, Personas, CLI, Persistence, Routing, Artifacts.

### Stage 0.5: Memory ✅
SQLite memory bank, OpenAI embeddings, automatic LLM extraction, hybrid search.

### Stage 0.6: Extensions ✅
Operational skills, journeys, tasks, economy, testimonials, multi-LLM queries, 13 personas.

---

## References

- [Project briefing](briefing.md) — architectural decisions and rationale
- [First deliverable design](cv0-foundation/cv0-e1-tracer-bullet/) — endpoints, schema, deploy spec
- [Spike report](../process/spikes/spike-2026-04-12.md) — technical investigation that led to this project
- Sandbox with experiments: [pi-sandbox](https://github.com/alissonvale/pi-sandbox) (8 runnable exps)
- Reference article: "Making sense of Harness Engineering" (Henrique Bastos)

---

**See also:** [CV0.E1 — Tracer Bullet](cv0-foundation/cv0-e1-tracer-bullet/) (spec for the current deliverable) · [Briefing](briefing.md) (architectural decisions) · [Getting Started](../../getting-started.md) (run it yourself)
