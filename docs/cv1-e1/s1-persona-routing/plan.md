[< Docs](../../index.md)

# Plan: CV1.E1.S1 — Reception v1 (persona routing)

**Roadmap:** [CV1.E1.S1](../../project/roadmap.md)
**Design:** [CV1.E1 — Personas](../tracer-bullet.md)

## Goal

The mirror responds with the right voice for each context. Introduces the **reception layer** — a lightweight LLM classifier that runs before every response.

---

## Architecture

### Centralized model config
`config/models.json` defines each model with its purpose. Reception uses a fast/cheap model; main response uses a quality model. Loaded via `server/config/models.ts`.

### Reception module
`server/reception.ts` exports `receive(db, userId, message, context?)` → `{ persona: string | null }`.

- Loads user's `persona` layers from the identity table
- If none, returns `{ persona: null }` immediately (no LLM call)
- Calls reception model with a structured JSON prompt
- 5-second timeout — falls back to null on any failure
- Validates that the returned persona exists for this user

### System prompt composition
`composeSystemPrompt(db, userId, personaKey?)` now accepts an optional persona. Persona layers are excluded from base composition and only appended when selected. Base = `self/*` + `ego/*` layers joined with `---`. Persona appended last.

### Metadata pattern
The selected persona is persisted as `_persona` on the entry's data. Fields with `_` prefix are stripped by `loadMessages` before feeding back to the Agent — metadata for UI, not for the LLM. `loadMessagesWithMeta` returns metadata separately for rendering.

### Signature
Added by server code (not by the LLM):
- `/message` returns `{reply: "◇ persona\n\n...", persona}`
- `/chat/stream` emits a first SSE event `{type: 'persona', persona}` so the UI prefixes the bubble before tokens arrive
- Telegram prepends `◇ persona\n\n` to the reply text

---

## Deliverables

- `config/models.json` — main + reception entries with `purpose` field
- `server/config/models.ts` — typed loader
- `server/reception.ts` — receive() function
- `server/identity.ts` — composeSystemPrompt with personaKey
- `server/db/entries.ts` — loadMessagesWithMeta, strips `_*` fields
- `server/admin.ts` — `identity import --from-poc` includes persona layer
- `server/index.tsx` — wire reception, emit SSE persona event, persist `_persona`
- `adapters/telegram/index.ts` — wire reception, prefix signature
- `server/public/chat.js` — render signature from SSE
- `server/public/style.css` — signature styling
- `server/web/chat.tsx` — render signature from history

## Tests

- `tests/reception.test.ts` (6): no personas, LLM failure, invalid JSON, unknown persona, valid persona, null persona
- `tests/identity.test.ts` (2 new): persona excluded from base, persona appended when specified, falls back on unknown persona
- `tests/db.test.ts` updated: import includes personas, excludes organization/other layers
- `tests/smoke.test.ts` adjusted: flexible persona count

---

**See also:** [Test Guide](test-guide.md) · [CV1.E1 — Personas](../tracer-bullet.md)
