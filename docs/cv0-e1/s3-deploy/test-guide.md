[< Docs](../../index.md)

# Test Guide: CV0.E1.S3 — Deploy

**Runbook:** [Plan](plan.md)

Run all tests from your **local machine** (not the VPS).

---

## 1. HTTPS works

```bash
curl -s https://mirror.softwarezen.com.br/message \
  -H "Authorization: Bearer $MIRROR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text": "Quem é você? Responda em uma frase."}' | jq .
```

Expect: `{ "reply": "..." }` with mirror voice in Portuguese.

## 2. Thread persists

```bash
curl -s https://mirror.softwarezen.com.br/thread \
  -H "Authorization: Bearer $MIRROR_TOKEN" | jq .
```

Expect: `{ "sessionId": "...", "messages": [...], "count": 2 }`

## 3. Auth rejects missing token

```bash
curl -s https://mirror.softwarezen.com.br/message \
  -H "Content-Type: application/json" \
  -d '{"text": "hello"}' | jq .
```

Expect: `{ "error": "Missing token" }` with HTTP 401.

## 4. Auth rejects bad token

```bash
curl -s https://mirror.softwarezen.com.br/message \
  -H "Authorization: Bearer invalidtoken" \
  -H "Content-Type: application/json" \
  -d '{"text": "hello"}' | jq .
```

Expect: `{ "error": "Invalid token" }` with HTTP 401.

## 5. Service survives restart

```bash
# On the VPS
sudo systemctl restart mirror-server

# From local machine — repeat test 1
```

Expect: same response, no data loss.

---

**See also:** [Plan (Runbook)](plan.md)
