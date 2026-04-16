[< Docs](../../../../../index.md)

# Plan: CV0.E1.S3 — Deploy Runbook

**Roadmap:** [CV0.E1.S3](../../../index.md)
**Design:** [CV0.E1 — Tracer Bullet](../index.md)
**Date:** 13 April 2026

## Prerequisites

- VPS: Ubuntu 20.04 with IP Address in hand
- SSH access as root
- Domain DNS managed (to create A record)
- GitHub token or SSH key on VPS to clone the repo

---

## Steps

### 1. Create DNS record

Add an A record in your DNS provider:

```
mirror.softwarezen.com.br → 51.222.160.3
```

Wait for propagation (can take minutes to hours). Verify:

```bash
dig mirror.softwarezen.com.br
```

### 2. SSH into VPS

```bash
ssh root@51.222.160.3
```

### 3. Install Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt-get install -y nodejs
node -v   # should show v20.x
```

### 4. Install Caddy

```bash
apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update
apt install caddy
```

### 5. Clone the repo

```bash
mkdir -p /opt
cd /opt
git clone https://github.com/alissonvale/mirror-mind.git mirror
cd mirror
npm install
```

### 6. Create .env

```bash
cat > /opt/mirror/.env << 'EOF'
OPENROUTER_API_KEY=sk-or-v1-...
LLM_MODEL=google/gemini-2.0-flash-001
PORT=3000
EOF
```

Replace the API key with the real one.

### 7. Create user and import identity

```bash
cd /opt/mirror
npx tsx server/admin.ts user add alisson
# Save the token!

npx tsx server/admin.ts identity import alisson --from-poc
```

**Note:** `--from-poc` requires `~/.espelho/memoria.db` on the VPS. If not available, use `identity set` to set each layer manually, or copy the db file from your local machine:

```bash
# From local machine
scp ~/.espelho/memoria.db root@51.222.160.3:/root/.espelho/memoria.db
```

### 8. Install and start systemd service

```bash
cp /opt/mirror/deploy/mirror-server.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable mirror-server
systemctl start mirror-server

# Verify
systemctl status mirror-server
journalctl -u mirror-server -f   # watch logs
```

### 9. Configure Caddy

```bash
cp /opt/mirror/deploy/Caddyfile /etc/caddy/Caddyfile
systemctl restart caddy

# Verify
systemctl status caddy
```

Caddy will automatically obtain a Let's Encrypt certificate for `mirror.softwarezen.com.br`.

### 10. Verify from local machine

See [Test Guide](test-guide.md).

---

## Future deploys

After the initial setup, deploy is just:

```bash
ssh root@51.222.160.3 /opt/mirror/deploy/deploy.sh
```

Or SSH in and run it manually.

---

**See also:** [Test Guide](test-guide.md) · [CV0.E1 — Tracer Bullet](../index.md)
