[< Docs](../index.md)

# Briefing: Mirror Mind Reconstruction on Pi

**Last updated:** 13 April 2026
**Nature:** Architectural and scope decisions. Living document — updated as decisions evolve.

---

## What this project is

Reconstruction of the mirror (AI Espelho) on the pi framework, migrating from a CLI-first Python architecture to a client-server TypeScript architecture. The goal is not to replicate the current mirror feature by feature, but to build a new foundation that meets premises the current mirror cannot.

The current mirror continues running in parallel (strangler fig). Capabilities migrate to the new one as they become ready. The old mirror shrinks until it's no longer needed.

## Premises

Six premises that justify the reconstruction:

**1. Client-server from day 1.** The mirror is no longer a local CLI — it's a server that accepts clients. Logic (Agent, identity, memory) lives on the server. Clients are thin adapters that translate protocol.

**2. Ubiquity.** The mirror must be available 24/7, accessible from any device. CLI, Telegram, WhatsApp, web — each channel is an adapter over the same HTTP API. Same server, same Agent, same identity.

**3. Multi-user with privacy.** Multiple users on the same server, each with their own identity, session, and history. Isolation by design (auth + user_id on all tables). No multiple installations.

**4. Continuous thread.** All devices and clients join the same conversation. The experience is one single conversation — no parallelism or segmentation by channel. The server maintains one active thread per user; any client that connects joins it.

**5. Context intelligence.** Every token in the prompt must earn its place. The system composes context deliberately — the right information, and only the right information, reaches the model. Identity layers, conversation history, memory, journey context: each is loaded selectively, not dumped wholesale. The goal is maximum response quality with minimum token waste.

**6. Proactive mirror.** The mirror doesn't wait for commands. It observes context, anticipates needs, and acts. If the user mentions a deadline, the mirror tracks it. If a pattern emerges across conversations, the mirror surfaces it. The interaction model is not request-response — it's an ongoing relationship where the mirror takes initiative when it has something valuable to contribute.

## Architectural decisions

### D1. Pi as foundation

**Decision:** use `@mariozechner/pi-ai` (unified multi-provider API) and `@mariozechner/pi-agent-core` (agent runtime) as the base.

**Rationale:** clean API, TypeScript-first, clear separation between provider and runtime, extensible via tools and events. The Agent is portable — works the same inside a script, a server, or a bot. Validated in Exps 01–04 of the spike.

**What we don't use from pi:** `pi-coding-agent` (it's a product, not a library), the SessionManager (coupled to filesystem/single-user), the RPC mode (we want direct control of the Agent).

### D2. TypeScript as language

**Decision:** TypeScript for the entire new mirror.

**Rationale:** pi is TypeScript-first. Trying to use pi from Python (via subprocess or HTTP) would add a fragile bridge. The Node ecosystem has everything we need (hono, better-sqlite3, grammy).

**Consequence:** the current `memoria/` package (Python, SQLite, OpenAI embeddings) is not ported now. Long-term memory is out of scope for the first deliverable.

### D3. Relational DB, schema inspired by SessionManager

**Decision:** SQLite (evolving to PostgreSQL), with append-only schema inspired by pi's SessionManager.

**Rationale:** the SessionManager's design is excellent (append-only, tree via id/parentId, typed entry types, compaction). But its implementation is coupled to the filesystem and single-user. Take the design, implement in a relational DB, and it's born multi-user and server-friendly.

**Core schema:**
```sql
users    (id, name, token_hash, created_at)
identity (id, user_id, layer, key, content, updated_at)
sessions (id, user_id, created_at)
entries  (id, session_id, parent_id, type, data, timestamp)
```

Initial entry types: `message`. Future: `compaction`, `model_change`, `custom`.

### D4. Greenfield

**Decision:** build from scratch.

**Rationale:** starting from zero avoids inheriting couplings from prior explorations. Clean boundaries from day one, informed by what was learned in the spike and group sessions.

### D5. Identity as layers in the database

**Decision:** each user's identity is stored as layers in an `identity` table (`user_id`, `layer`, `key`, `content`). The system prompt is composed at runtime by joining layers in a defined order.

**Rationale:** preserves the structured identity model from the POC (self/soul, ego/identity, ego/behavior) instead of flattening into a single text blob. Each layer can be edited independently. Migration from the POC is layer-by-layer, no manual composition needed. Future layers (personas, knowledge, journeys) follow the same pattern naturally.

**Source of truth:** the database, not the filesystem. New users get starter layers with editable templates. Existing users import layers from the POC via admin CLI.

### D6. Bearer token auth

**Decision:** each user has a random token; the server stores the SHA-256 hash; every request sends `Authorization: Bearer <token>`.

**Rationale:** minimum viable approach that solves authentication and identification. Token generated once by the admin script, hashed in the database, never stored in cleartext. Future evolution: OAuth, magic link, etc.

### D7. English as internal language

**Decision:** all code, variable names, commands, endpoints, table/column names, comments, technical documents, and internal terms are in English.

**Rationale:** the project is collaborative and may grow beyond the current group. English as the internal language removes ambiguity, aligns with ecosystem conventions (pi, Node, TypeScript), and avoids the Portuguese/English mix that makes code hard to read. Endpoints are `/message`, not `/mensagem`. Tables are `users`, `sessions`, `entries` — not `usuarios`, `sessoes`, `entradas`.

**Exception:** user-facing content (identities, mirror responses, user-visible error messages) can be in any language. Alisson's identity is in Portuguese. Another user's may be in English, Spanish, or any language. The system is language-agnostic for content — only the skeleton is in English.

### D8. Agent instantiated per request

**Decision:** each `POST /message` creates a new `Agent`, loads history from the database, runs, persists, and the Agent dies.

**Rationale:** simple, stateless on the server (state lives in the database), no concurrency issues. The cost of instantiating an Agent is negligible compared to the LLM call cost.

**Consequence:** there is no "resident" Agent in memory. Each request is independent. This simplifies deploy (no state in the process) but prevents features that depend on a live Agent between requests (e.g., steering mid-turn). Acceptable for the first deliverable.

## What's consciously left out

Each item below enters the roadmap when its absence hurts in daily use:

- **Personas** — base voice (ego) only for now
- **Journeys** — no journey context in the prompt
- **Long-term memory** — no embeddings, no extraction, no semantic search
- **Tools** — the Agent has no tools in the first deliverable
- **Compaction** — we accept that short conversations fit in the context window
- **Persona routing** — no automatic message classification
- **Web UI** — CLI and Telegram only
- **Admin web** — provisioning via SSH script
- **Client streaming** — synchronous response (full JSON)

## Glossary

Recurring terms and what they mean in this context:

- **Harness** — infrastructure that turns an ad-hoc process into a loop with decreasing marginal cost
- **MVH** — Minimum Viable Harness: one entry, one exit, clear boundaries
- **Opinion layer** — the set of decisions and conventions that turns "programming with pi" into "building a mirror"
- **Boundary** — clear interface between two components; what changes inside doesn't affect the outside
- **Adapter** — thin client that translates between a channel (Telegram, CLI, web) and the server's HTTP API
- **Entry** — unit of persistence in the database, append-only, with id/parentId for tree structure
- **Continuous thread** — single conversation experience that spans devices and usage sessions

---

**See also:** [CV0.M1 — Tracer Bullet](../design/cv0-m1-tracer-bullet.md) (how these decisions become code) · [Roadmap](roadmap.md) (delivery sequence) · [Spike report](../process/spikes/spike-2026-04-12.md) (experiments that informed these decisions)
