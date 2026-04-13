[< Docs](../../index.md)

# Test Plan: CV0.E1.S2 — The server responds with my voice

**Epic:** [Plan](plan.md)
**Design:** [CV0.E1 — Tracer Bullet](../tracer-bullet.md)

---

## Automated tests

### Unit tests (`tests/identity.test.ts`)

```bash
npm run test:unit
```

- composeSystemPrompt returns empty string for user with no layers
- composeSystemPrompt joins layers with `---` separators
- composeSystemPrompt preserves layer ordering (ego before self)

---

## Manual test script

### Prerequisites

- User `alisson` created with real identity (S1)
- Token stored in `$MIRROR_TOKEN` env var or `.env`

### 1. Start the server

```bash
npx tsx server/index.ts
```

Expect: `mirror-server running at http://localhost:3000`

### 2. Send a message with valid token

```bash
curl -s http://localhost:3000/message \
  -H "Authorization: Bearer $MIRROR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text": "Quem é você? Responda em uma frase."}' | jq .
```

Expect: `{ "reply": "..." }` with response in Portuguese, first person, mirror voice.

### 3. Check the thread

```bash
curl -s http://localhost:3000/thread \
  -H "Authorization: Bearer $MIRROR_TOKEN" | jq .
```

Expect: `{ "sessionId": "...", "messages": [...], "count": 2 }` — both user and assistant messages persisted.

### 4. Send another message (verify continuity)

```bash
curl -s http://localhost:3000/message \
  -H "Authorization: Bearer $MIRROR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text": "O que eu acabei de perguntar?"}' | jq .
```

Expect: the mirror references the previous question — history is loaded.

### 5. No token → 401

```bash
curl -s http://localhost:3000/message \
  -H "Content-Type: application/json" \
  -d '{"text": "hello"}' | jq .
```

Expect: `{ "error": "Missing token" }` with HTTP 401.

### 6. Bad token → 401

```bash
curl -s http://localhost:3000/message \
  -H "Authorization: Bearer invalidtoken" \
  -H "Content-Type: application/json" \
  -d '{"text": "hello"}' | jq .
```

Expect: `{ "error": "Invalid token" }` with HTTP 401.

---

**See also:** [Plan](plan.md) · [Admin CLI Reference](../../design/admin-cli.md)
