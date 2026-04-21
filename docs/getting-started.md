[< Docs](index.md)

# Getting Started

Your own mirror — from zero to running.

---

## 1. Provision a server

You need a machine with a public IP that stays on. A VPS is the simplest path.

- **Provider:** Hetzner, DigitalOcean, OVH, or similar (~5 EUR/month)
- **OS:** Ubuntu 22.04+ (or any Linux with Node.js 20+)
- **Domain:** a subdomain pointing to the server (e.g., `mirror.yourdomain.com`)

Create a DNS A record pointing your subdomain to the server's IP.

## 2. Install on the server

SSH into your server and:

```bash
# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt-get install -y nodejs

# Install Caddy (reverse proxy with automatic HTTPS)
apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update
apt install -y caddy

# Clone and install
cd /opt
git clone https://github.com/alissonvale/mirror-mind.git mirror
cd mirror
npm install
```

## 3. Configure

```bash
cat > /opt/mirror/.env << 'EOF'
OPENROUTER_API_KEY=your-openrouter-key
PORT=3000

# Environment tag — splits dev vs prod usage in /admin/budget breakdowns.
# Use 'prod' on a VPS deploy, 'dev' locally.
MIRROR_ENV=prod

# Base URL the mirror is reachable at — sent as HTTP-Referer on OpenRouter
# calls so the provider's dashboard groups traffic per install. Optional;
# defaults to http://localhost:3000 when unset.
MIRROR_BASE_URL=https://mirror.yourdomain.com
EOF
```

Get an API key at [openrouter.ai](https://openrouter.ai).

**Recommended**: create a **dedicated OpenRouter account** for this mirror and set a **monthly spending cap** at `openrouter.ai/settings/keys`. The `/admin/budget` page treats that cap as the 100% baseline for the progress bar and the low-balance alert — without a cap, those affordances can't calibrate.

Models are configured at `/admin/models` (DB-backed, live-editable) — `config/models.json` is the shipped seed loaded on first boot. Only secrets go in `.env`.

## 4. Create your user and identity

```bash
cd /opt/mirror

# Create user — save the token!
npx tsx server/admin.ts user add yourname
```

The command prints a token. **Save it** — you'll need it to connect from any client, and it won't be shown again.

Your user starts with a template identity (soul, ego/identity, ego/behavior). The mirror works immediately. Refine each layer over time:

```bash
# View your identity layers
npx tsx server/admin.ts identity list yourname

# Edit a specific layer
npx tsx server/admin.ts identity set yourname --layer ego --key behavior --text "Your behavior rules here"
```

For the full reference of admin commands, see [Admin CLI Reference](product/admin-cli.md).

### Migrate from POC Mirror (optional)

If you have an identity in the POC Mirror (`~/.espelho/memoria.db`):

```bash
npx tsx server/admin.ts identity import yourname --from-poc
```

This reads your soul, ego/identity, and ego/behavior from the POC and writes them into mirror-mind.

## 5. Deploy

### Start the server

```bash
# Copy systemd service
cp deploy/mirror-server.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable mirror-server
systemctl start mirror-server

# Verify
systemctl status mirror-server
```

### Configure Caddy

Edit `/etc/caddy/Caddyfile`:

```
mirror.yourdomain.com {
    reverse_proxy localhost:3000
}
```

```bash
systemctl restart caddy
```

Caddy automatically obtains a Let's Encrypt certificate. Your mirror is now live at `https://mirror.yourdomain.com`.

### Future deploys

After code changes:

```bash
cd /opt/mirror
git pull
npm install
sudo systemctl restart mirror-server
```

## 6. Connect with the CLI

On your **local machine** (laptop, desktop — not the server):

```bash
# Clone the repo (if you haven't)
git clone https://github.com/alissonvale/mirror-mind.git
cd mirror-mind
npm install

# Create config
mkdir -p ~/.mirror
cp adapters/cli/config.json.example ~/.mirror/config.json
```

Edit `~/.mirror/config.json` with your server URL and token:

```json
{
  "serverUrl": "https://mirror.yourdomain.com",
  "token": "your-token-here"
}
```

Run:

```bash
npx tsx adapters/cli/index.ts
```

Type a message. The mirror responds with your voice. Type `/exit` to quit.

The CLI works from any directory — config lives in `~/.mirror/`, not in the repo.

## 7. Connect with Telegram

The Telegram integration needs two secrets:

- **`TELEGRAM_BOT_TOKEN`** — given to you by Telegram (via @BotFather) when you create the bot. It authorizes your server to act as the bot.
- **`TELEGRAM_WEBHOOK_SECRET`** — a random string **you generate yourself**. Telegram echoes it back on every webhook request so your server can verify the request really came from Telegram.

### Create the bot

1. Open Telegram and message **@BotFather**
2. Send `/newbot`
3. Choose a display name (e.g., `My Mirror`)
4. Choose a unique username ending in `bot` (e.g., `yourname_mirror_bot`)
5. Save the token BotFather gives you. Store it in TELEGRAM_BOT_TOKEN as I'll show below.

### Generate a webhook secret

On your local machine:

```bash
openssl rand -hex 32
```

Save the output and store it in TELEGRAM_WEBHOOK_SECRET in the next step.

### Configure on the server

SSH into the server and add to `/opt/mirror/.env`:

```
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_WEBHOOK_SECRET=your-webhook-secret
```

Restart the service:

```bash
systemctl restart mirror-server
```

Check the logs — you should see `Telegram adapter enabled`.

### Set the webhook

Now you register your webhook URL with Telegram. This call goes **to Telegram's API** (not to your server) — the bot token authorizes the call, and the secret is what Telegram will send back in every future update.

On the server, with the env vars loaded:

```bash
source /opt/mirror/.env
curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook?url=https://mirror.yourdomain.com/telegram/webhook&secret_token=$TELEGRAM_WEBHOOK_SECRET"
```

Expected response: `{"ok":true,"result":true,"description":"Webhook was set"}`

### Link your Telegram account

Send any message to your bot on Telegram. The server will log your `telegram_id` (the bot replies "Unknown user").

Check the server logs:

```bash
journalctl -u mirror-server --no-pager -n 10
```

Find the line: `Unknown Telegram user: <your-id>`

Link your user:

```bash
cd /opt/mirror
npx tsx server/admin.ts telegram link yourname <your-telegram-id>
```

Now send another message to the bot — it responds with your voice.

---

## Troubleshooting

### Telegram sends duplicate replies in a loop

**Symptom:** you send one message, the bot replies multiple times and keeps replying even after minutes.

**Cause:** pending Telegram updates accumulated in the queue (e.g., from a timeout or failed deployment). Telegram redelivers them until it gets a 200 response.

**Fix:** re-register the webhook with `drop_pending_updates` to flush the queue:

```bash
source /opt/mirror/.env
curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook?url=https://mirror.yourdomain.com/telegram/webhook&secret_token=$TELEGRAM_WEBHOOK_SECRET&drop_pending_updates=true"
```

Then restart the server:

```bash
sudo systemctl restart mirror-server
```

---

**See also:** [Admin CLI Reference](product/admin-cli.md) (all commands) · [Principles](product/principles.md) (how we build) · [CV0.E1 — Tracer Bullet](project/roadmap/cv0-foundation/cv0-e1-tracer-bullet/) (technical spec)
