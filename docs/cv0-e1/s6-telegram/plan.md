[< Docs](../../index.md)

# Plan: CV0.E1.S6 — Telegram adapter

**Roadmap:** [CV0.E1.S6](../../project/roadmap.md)
**Design:** [CV0.E1 — Tracer Bullet](../tracer-bullet.md)

## Goal

Chat with the mirror from Telegram on any device. Same identity, same session, same continuous thread as CLI and Web.

---

## Architecture

Thin adapter using [grammy](https://grammy.dev). Runs as a webhook route inside the same hono process (not a separate service).

### Flow

```
Telegram → POST /telegram/webhook
  → bot extracts telegram_id and text
  → getUserByTelegramId(db, telegram_id)
    → not found: reply "Unknown user", log telegram_id
    → found: load session, compose prompt, run Agent, reply, persist
```

### Auth
Telegram updates are authenticated by a webhook secret (set via Telegram API). The `telegram_users` table (telegram_id → user_id) resolves which mirror user sent the message.

---

## Deliverables

- `adapters/telegram/index.ts` — grammy webhook handler
- `server/db/telegram.ts` — `linkTelegramUser`, `getUserByTelegramId`
- `server/admin.ts` — `telegram link <name> <telegram_id>` command
- `server/index.tsx` — registers webhook route before web auth middleware
- `.env.example` — `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`

### Graceful degradation
If `TELEGRAM_BOT_TOKEN` is not set, the adapter logs "disabled" and doesn't register the route. The server runs normally without Telegram.

---

## Setup flow (user-facing)

1. Create bot via @BotFather on Telegram, get token
2. Generate webhook secret (`openssl rand -hex 32`)
3. Add both to `.env` on the server
4. Restart server
5. Set webhook via Telegram API
6. Send a message to the bot (returns "Unknown user")
7. Admin links: `admin.ts telegram link <name> <telegram_id>`
8. Send another message — mirror responds

Full runbook: [Getting Started — Connect with Telegram](../../getting-started.md#7-connect-with-telegram)

---

## Key files

- `adapters/telegram/index.ts`
- `server/db/telegram.ts`
- `server/admin.ts` (telegram link command)
- `server/index.tsx` (webhook route registered before web routes)

---

**See also:** [Test Guide](test-guide.md) · [Admin CLI Reference](../../design/admin-cli.md)
