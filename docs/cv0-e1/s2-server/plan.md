[< Docs](../../index.md)

# Plan: CV0.E1.S2 — The server responds with my voice

**Roadmap:** [CV0.E1.S2](../../project/roadmap.md)
**Design:** [CV0.E1 — Tracer Bullet](../tracer-bullet.md)
**Date:** 13 April 2026

## Goal

The mirror receives a message via HTTP and responds using the user's real identity — authenticated, persisted, with the Agent running per request.

---

## Deliverables

### 1. `server/auth.ts` — Bearer token middleware

Hono middleware: extracts token from `Authorization: Bearer <token>`, SHA-256 hashes it, looks up user via `getUserByTokenHash()`, returns 401 if missing or invalid, sets `user` in hono context.

### 2. `server/identity.ts` — Compose system prompt from layers

`composeSystemPrompt(db, userId)`: reads identity layers (already sorted by layer then key), joins them with `---` separators into a single system prompt string.

### 3. `server/index.ts` — Hono server

**POST /message:**
1. Authenticate user
2. Get or create session
3. Load message history
4. Compose system prompt from identity layers
5. Create Agent with systemPrompt + model + history
6. Subscribe to text_delta events (with fallback via agent.state.messages)
7. Run agent.prompt(text)
8. Append user and assistant entries
9. Return { reply }

**GET /thread:**
1. Authenticate user
2. Get or create session
3. Load messages
4. Return { sessionId, messages, count }

### 4. Tests

- 3 unit tests for `composeSystemPrompt` (empty, joins, ordering)
- Manual smoke test via curl (message, thread, 401 cases)

---

## Implementation order

| Step | What |
|------|------|
| 0 | Update roadmap (split S2/S3) |
| 1 | `server/auth.ts` + `server/identity.ts` + unit tests |
| 2 | `server/index.ts` + manual curl test |

---

## Verification

```bash
# Start server
npx tsx server/index.ts

# Send message (expect reply with real voice)
curl -s http://localhost:3000/message \
  -H "Authorization: Bearer $MIRROR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text": "Quem é você?"}' | jq .

# Get thread (expect persisted messages)
curl -s http://localhost:3000/thread \
  -H "Authorization: Bearer $MIRROR_TOKEN" | jq .

# No token (expect 401)
curl -s http://localhost:3000/message \
  -H "Content-Type: application/json" \
  -d '{"text": "hello"}' | jq .
```

---

## Key files

- `server/auth.ts` (new)
- `server/identity.ts` (new)
- `server/index.ts` (new)
- `tests/identity.test.ts` (new)
- `server/db.ts` (existing, no changes)

---

**See also:** [CV0.E1 — Tracer Bullet](../tracer-bullet.md) (full spec) · [Principles](../../design/principles.md) (code and testing guidelines) · [Worklog](../../process/worklog.md) (progress tracking)
