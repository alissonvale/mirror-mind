[< Docs](../../index.md)

# Spike: Pi as Foundation for the New Mirror

**Date:** 11–12 April 2026
**Participants:** Alisson, Henrique, Alê, Vini (group session); Alisson + Claude (experiments)
**Nature:** Technical investigation report (spike/PoC). Historical document — records what happened and what we learned. Decisions and specs are in separate documents.

---

## 1. Motivation

The current mirror (Python, CLI, SQLite, memoria/) grew organically. It works, but has structural limitations: single-user, single-device, coupled to Claude Code as its harness. The idea to reconstruct came from the convergence of three needs:

- **Ubiquity** — access the mirror from any device (CLI, WhatsApp, Telegram, web)
- **Multi-user with privacy** — spouses, family, friends using the same server
- **Continuous thread** — all clients join the same conversation, no fragmentation

Pi (github.com/badlogic/pi-mono) emerged as a foundation candidate by offering: unified multi-provider API, agent runtime with tool-calling, and clean separation between agent and transport.

## 2. Group context

Before the session, two contributions shaped the plan:

**Alê** proposed three learning tracks: Pi (the tool), Mirror (the conceptual foundations), Harness (the opinion layer on top of pi). The term "opinion layer" came from Henrique's article.

**Henrique** published "Making sense of Harness Engineering" — an article defining harness as infrastructure that transforms ad-hoc processes into loops with decreasing marginal cost. Core thesis: XP was always harness engineering; AI made the cost of not doing XP personal and immediate. He had also already done an exploratory migration of the mirror to pi, and identified the need to "componentize" — draw clear boundaries between memory, personas, journeys, providers, etc.

The convergence between the two: "opinion layer" (Alê) and "components with clear boundaries" (Henrique) are the same concept from different angles.

## 3. What was done

### 3.1 Pi Track — learning the tool (Exps 01–04)

Four progressive experiments, each a runnable TypeScript file:

**Exp 01 — Hello pi.** Simple `complete()` call via OpenRouter. Validated that pi-ai works as a boundary over raw LLM APIs. Swapping models = swapping a string, zero lines change.

**Exp 02 — Streaming.** Same call with `stream()`. Same boundary, two consumption modes. Granular event protocol: `text_delta`, `text_start`, `text_end`, `thinking_delta`, `toolcall_delta`, `done`, `error`.

**Exp 03 — First tool.** Declaration of a `get_time` tool + manual tool-calling loop. The model requests the tool (stopReason="toolUse"), the code executes, builds toolResult, calls complete() again. ~60 lines, half is orchestration. Pedagogical: shows the pain of being the harness.

**Exp 04 — Agent runtime.** Same tool, now using `Agent` from pi-agent-core. `AgentTool` packages `execute` alongside the declaration. `agent.prompt()` runs the entire loop. ~40 lines, zero orchestration. Observation via `subscribe()` with typed events. The difference between 03 and 04 materializes the concept "move state from your head to an artifact" from Henrique's article.

### 3.2 Harness+Mirror Track — building the MVH (Exps 05–08)

**Exp 05 — Server as MVH.** HTTP server (hono) with `POST /message`. The Agent runs inside, encapsulated. One entry, one exit, non-determinism contained. This is the Minimum Viable Harness from the article. Bug found and resolved: Agent doesn't always emit `text_delta` (depends on provider); fallback via `agent.state.messages` solves it.

**Exp 06 — Context in artifact.** Addition of SQLite (better-sqlite3) to the server. Schema inspired by pi's SessionManager: `sessions` and `entries` tables (append-only, with `id`/`parent_id` for tree). Conversation survives server restart. Fourth property from the article inverted: context in artifact, not in heads.

**Exp 07 — Identity as boundary + multi-user + auth.** `users` table with `token_hash` (SHA-256). Bearer token auth middleware. Identity loaded from `identities/<name>.md` as system prompt. Admin CLI script for user provisioning. Two independent mirrors on the same server, proven with curl: each token resolves a different session and identity. No token = 401.

**Exp 08 — Thin client.** CLI REPL (~40 lines) that reads token from `config.json` and fetches from the server. Zero dependencies beyond native Node. Proves that clients are cheap when the HTTP boundary is well designed. Continuous thread proven: messages sent in one session are remembered in subsequent requests.

### 3.3 Technical investigations

**Pi's SessionManager.** 7 internal elements: entry types, tree navigation, context building, append, storage, branching, lifecycle. Storage is coupled to the filesystem (direct fs.appendFileSync, no interface), but tree navigation and context building are decoupled — they operate on an in-memory Map. `buildSessionContext()` is a standalone function that accepts entries from any source. Decision: use as design reference, implement in relational DB.

**Pi's RPC protocol.** Three layers: Transport (Agent→LLM, SSE/WebSocket), Proxy (LLM calls through an intermediary server), RPC (full control via stdin/stdout JSONL). RPC mode (`pi --mode rpc`) allows embedding the coding-agent in any application. Decision: don't use RPC, instantiate Agent directly in the server (more control over multi-user and auth boundaries).

**Compaction.** Solution for session growth. CompactionEntry summarizes old messages; `buildSessionContext()` knows how to interpret it. In the relational implementation: same logic, entry of type 'compaction' in the database, query that loads the latest compaction + recent entries. The Agent never sees more than ~50–100 messages per request, regardless of total session size.

**Full request flow in the real mirror.** 7 steps designed: auth → route (persona/journey) → load context (identity + persona + journey + memories) → compose system prompt → load history → Agent.prompt() → persist. Routing and context loading are deterministic (no LLM); only the optional routing and the response use LLM.

## 4. Key insights

1. **Pi is a good foundation.** Clean API, clear separation between pi-ai (provider) and pi-agent-core (runtime), TypeScript-first, extensible via tools and events. The Agent is portable — works the same inside a script, an HTTP server, or a bot.

2. **The opinion layer is the real work.** Pi provides primitives; the mirror needs: how identity is loaded, how personas route, how memory is structured, how sessions persist, how clients authenticate. This is the "opinion" that Alê and Henrique identified.

3. **Client-server from day 1 works.** The overhead of having HTTP in the middle is minimal and the gain (ubiquity, multi-user, separate deploy) is enormous. Exp 05 proved the wrapper is thin (~35 lines).

4. **Clients are cheap.** The CLI (Exp 08) is 40 lines. A Telegram adapter would be ~60–80. The HTTP boundary does the heavy lifting; the client just translates protocol.

5. **Streaming doesn't always happen.** Depending on the provider and the response, the Agent may not emit `text_delta`. Production code needs the fallback via `agent.state.messages`.

6. **SessionManager is a good reference, not a good base.** Excellent design (append-only, tree, compaction), but coupled to filesystem and single-user. Take the design, implement in relational DB with native multi-user — that's the right path.

## 5. Decisions made

(Recorded in detail in the project briefing — only the list here)

- Pi as foundation (TypeScript, pi-ai + pi-agent-core)
- Client-server architecture from day 1
- Multi-user with privacy by design
- Relational DB (SQLite → PostgreSQL), schema inspired by SessionManager
- Greenfield (clean start, informed by prior explorations)
- Identity in .md files (text = system prompt)
- Bearer token auth with SHA-256 hash
- Continuous thread: all clients join the same user session

## 6. Next steps

Defined after the session: first deliverable is the mirror-server deployed on a VPS with real identity, accessible via CLI and Telegram. Specified in the deliverable design document.

---

**See also:** [Briefing](../../project/briefing.md) (decisions that came from this spike) · [CV0.E1 — Tracer Bullet](../../project/roadmap/cv0-foundation/cv0-e1-tracer-bullet/) (spec for the first deliverable) · [Roadmap](../../project/roadmap/) (full delivery path)
