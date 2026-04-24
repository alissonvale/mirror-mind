[< Story](index.md)

# Refactoring log — CV1.E7.S1

What was cleaned up along the way, and what was deliberately **not** cleaned up (parked, with criteria for revisit).

---

## Applied

### `addMissingModelRoles` instead of ad-hoc migration

Early draft had a one-off ALTER-like block in `migrate()` that would `INSERT OR IGNORE` the new `expression` row. Refactored to a reusable helper in `server/db/models.ts` that walks every seed role and inserts any missing one. Future role additions (next LLM-call step in CV1.E7) cost zero migration code.

**Why this is safer than it looks.** Existing admin-customized rows are untouched (`INSERT OR IGNORE`). Seed drift is a known non-issue: "revert to default" per role at `/admin/models` is the explicit path for admins who want the shipped config back, and it was already wired in CV0.E3.

### `buildAssistantForPersist` helper (adapters/web/index.tsx)

The assistant message persisted in the DB is now the *expressed* text, not the draft. Extracted a small helper to do the "take the pi-ai AssistantMessage shape, replace content with the final text, keep provider / model / usage for billing" transform so it doesn't get reimplemented in three places if API and Telegram adapters ever adopt the same surface.

### `chunkForStream` helper (adapters/web/index.tsx)

Pulled the word-boundary chunking logic into its own function. The expression call is non-streaming — the LLM returns the full rewritten text. Streaming to the client is UX-only, so chunking on whitespace into ~3-word groups lets the bubble fill with the same typing rhythm as before without token-level streaming infrastructure.

### Mode-aware worklog catch-up

The `worklog.md` had drifted from v0.12.0 (it was still naming v0.12.0 as "Current focus" while v0.13.0 had shipped and a full epic had turned over). Phase 9 walks both v0.13.0 and CV1.E7.S1 into the Done list, and replaces the stale "Current focus" with the new state. Follows the project's "status updated" discipline from `CLAUDE.md`.

---

## Parked (with revisit criteria)

### Expression pass streaming from pi-ai directly

Currently, `express()` is non-streaming (one `complete()` call, then the server chunks the full text for SSE). pi-ai does support `stream` mode; we could emit deltas straight from the LLM rather than from a post-hoc chunker.

**Why not now.** Two reasons. (1) The non-streaming version is the simplest shape to prove the contract — streaming adds a second async axis (cancel semantics, partial failure) that would inflate v1. (2) The expression pass is cheap and fast (Flash, ~1-2s). A 2-second non-streaming turn chunked into 200ms of word-by-word reveal feels identical to a streamed 2-second turn.

**Revisit when:** (a) users report the typing reveal feels artificial / uneven, OR (b) the expression prompt grows and per-turn latency moves past ~5s, making the "reveal slower than production" inversion perceptible.

### Draft persistence for debug

Today, only the expressed text is stored in the assistant entry. The draft is discarded after the expression call completes. For debugging "did the expression pass change substance?" this is a gap.

**Revisit when:** we ship a second CV1.E7 story and want to A/B or inspect how the pass performs against itself. At that point, a simple admin-toggle that stores the draft as `entry.data.draft_text` behind a feature flag becomes useful.

### Expression sees conversation history

The pass is deliberately turn-local — it sees the current user message, the draft, persona, and expression layer. It does NOT see prior turns. The rationale was clean separation (form vs substance).

**Revisit when:** in real use, the expressed responses feel tonally inconsistent across a session (e.g., the user writes short on turn 3 after writing long on turn 2, and the mode ping-pong produces jarring shifts). If that happens, threading the last 2–3 assistant entries as "recent-form anchor" into the expression prompt is the smallest change that addresses it.

### Telegram and API adapters don't emit `status` events

The two-phase streaming UX (*Composing…* → *Finding the voice…*) is web-only. Telegram's UX is asynchronous anyway (typing indicator comes from Telegram itself), and the API adapter is meant for machine clients. Nothing to add.

**Revisit:** only if a new streaming client lands (e.g., a mobile app over the same API) and the two-phase signal would serve its UX.

### Mode-aware routing across persona, org, journey

Reception got a fourth axis but it is treated as orthogonal — `mode` doesn't influence how the other three are picked. A strong conversational turn might reasonably suppress persona/scope activation (why bring the mentora's full voice to "Had coffee with Mike"?). Today, the persona and scopes activate independently.

**Revisit:** after a few weeks of real use, see if the persona badges on clearly-conversational turns feel noisy. If yes, the first attempt is a prompt-only tweak ("prefer persona=null when mode=conversational and the message isn't in a strong domain"). Promoting that into a structural rule belongs to CV1.E7.S5 (conditional persona activation).

### Pipeline abstraction

No named-stage runtime, no registry, no `Step<In, Out>` interface was introduced. Expression was wired as a concrete function call on the hot path in each adapter.

**Revisit:** CV1.E7.S7, explicitly. The plan is to extract the abstraction after at least three pipeline steps exist (conditional scope activation, conditional identity layers, semantic retrieval). Premature abstraction before that invents the shape instead of discovering it.
