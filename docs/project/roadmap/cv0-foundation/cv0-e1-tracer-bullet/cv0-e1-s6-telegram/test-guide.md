[< Docs](../../../../../index.md)

# Test Guide: CV0.E1.S6 — Telegram adapter

**Plan:** [Plan](plan.md)

---

## Prerequisites

- Bot created via @BotFather with token
- Server deployed and accessible via HTTPS
- `TELEGRAM_BOT_TOKEN` and `TELEGRAM_WEBHOOK_SECRET` set in `.env`
- Webhook configured (see [getting-started](../../../../../../getting-started.md#7-connect-with-telegram))

## 1. Adapter enabled on boot

Check server logs:

```bash
journalctl -u mirror-server --no-pager -n 10
```

Expect: line `Telegram adapter enabled`.

## 2. Unknown user reply

Send any message to your bot from Telegram (without linking first).

Expect: bot replies "Unknown user. Ask admin to register you."

Check logs:

```bash
journalctl -u mirror-server --no-pager -n 5
```

Expect: line `Unknown Telegram user: <id> (@<username>)`.

## 3. Link user

```bash
cd /opt/mirror
npx tsx server/admin.ts telegram link yourname <telegram_id>
```

Expect: `Linked Telegram user <id> → yourname`.

## 4. First real message

Send a message to the bot.

Expect: reply with the mirror's real voice (Portuguese, first person, identity-driven).

## 5. Continuity across channels

Send a message on Telegram referencing something. Then open `/thread` in the web:

```bash
curl -s https://mirror.yourdomain.com/thread -H "Authorization: Bearer $TOKEN" | jq .
```

Expect: the Telegram message appears in the thread — same session as CLI/Web.

## 6. Webhook auth

Try hitting the webhook without the secret:

```bash
curl -s https://mirror.yourdomain.com/telegram/webhook -X POST -H "Content-Type: application/json" -d '{}'
```

Expect: request rejected (grammy validates the secret token header).

---

**See also:** [Plan](plan.md) · [Admin CLI Reference](../../product/admin-cli.md)
