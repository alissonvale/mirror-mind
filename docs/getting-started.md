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
EOF
```

Get an API key at [openrouter.ai](https://openrouter.ai).

Models are configured in `config/models.json` (versioned in the repo — shared across installations). Only secrets go in `.env`.

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

For the full reference of admin commands, see [Admin CLI Reference](design/admin-cli.md).

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

### Two things you'll need

The Telegram integration requires two secrets:

- **`TELEGRAM_BOT_TOKEN`** — given to you by Telegram (via @BotFather) when you create the bot. This is what authorizes your server to act as the bot.
- **`TELEGRAM_WEBHOOK_SECRET`** — a random string **you generate yourself**. Telegram sends it back in every webhook request so your server can verify the request really came from Telegram and not from an attacker.

### Step 1 — Create the bot (get TELEGRAM_BOT_TOKEN)

1. Open Telegram and message **@BotFather**
2. Send `/newbot`
3. Choose a display name (e.g., `My Mirror`)
4. Choose a unique username ending in `bot` (e.g., `yourname_mirror_bot`)
5. BotFather replies with a token like `1234567890:ABCdef...` — this is your `TELEGRAM_BOT_TOKEN`. Save it.

### Step 2 — Generate the webhook secret (create TELEGRAM_WEBHOOK_SECRET)

This is any random string. On your local machine:

```bash
openssl rand -hex 32
```

The output is your `TELEGRAM_WEBHOOK_SECRET`. Save it.

### Step 3 — Configure on the server

SSH into the server and add both secrets to `/opt/mirror/.env`:

```
TELEGRAM_BOT_TOKEN=<the token from BotFather>
TELEGRAM_WEBHOOK_SECRET=<the string you generated>
```

Restart the service:

```bash
systemctl restart mirror-server
```

Check the logs — you should see `Telegram adapter enabled`.

### Step 4 — Tell Telegram where to send updates

Now you register your webhook URL with Telegram. This call goes **to Telegram's API** (not to your server) — it uses the bot token to authorize and passes your webhook secret so Telegram includes it in every future update.

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

**See also:** [Admin CLI Reference](design/admin-cli.md) (all commands) · [Principles](design/principles.md) (how we build) · [CV0.E1 — Tracer Bullet](cv0-e1/tracer-bullet.md) (technical spec)
