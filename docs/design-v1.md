# Design: First Deliverable — Mirror Server + CLI + Telegram

**Last updated:** 12 April 2026
**Nature:** Technical specification for the first deliverable. What will be built, how, and what won't.

---

## Deliverable vision

A mirror-server running on a VPS, accessible 24/7, with the user's real identity. Two clients: CLI (from any machine) and Telegram (from any device). Multiple isolated users on the same server. Conversations persisted, surviving restarts.

**Done criteria:** Alisson can send a message from the CLI on his laptop, continue the conversation from Telegram on his phone, and the mirror maintains the continuous thread with his real voice (not a generic stub).

**Internal language:** all code, endpoints, schema, variables, comments, and technical documents in English (decision D7 from the briefing). User-facing content (identities, mirror responses) in each user's language.

---

## Architecture

```
┌─────────────┐   HTTPS    ┌──────────────────────────┐
│  mirror-cli │◄──────────►│     mirror-server         │
│  (any       │            │     (VPS, Node.js)        │
│   machine)  │            │                           │
└─────────────┘            │  ┌────────────────────┐   │
                           │  │  hono (HTTP)        │   │
┌─────────────┐   HTTPS    │  │  ├─ POST /message   │   │
│  Telegram   │◄──────────►│  │  └─ GET  /thread    │   │
│  Bot        │  webhook   │  └────────────────────┘   │
│  (adapter)  │            │           │               │
└─────────────┘            │  ┌────────▼───────────┐   │
                           │  │  auth middleware    │   │
                           │  │  (bearer token)     │   │
                           │  └────────┬───────────┘   │
                           │           │               │
                           │  ┌────────▼───────────┐   │
                           │  │  identity loader    │   │
                           │  │  (users.identity)   │   │
                           │  └────────┬───────────┘   │
                           │           │               │
                           │  ┌────────▼───────────┐   │
                           │  │  pi-agent-core      │   │
                           │  │  (Agent per request) │   │
                           │  └────────┬───────────┘   │
                           │           │               │
                           │  ┌────────▼───────────┐   │
                           │  │  SQLite             │   │
                           │  │  (users, sessions,  │   │
                           │  │   entries)           │   │
                           │  └────────────────────┘   │
                           └──────────────────────────┘
```

## Components

### 1. mirror-server

HTTP server, heart of the system. Direct evolution of Exp 07 from the spike.

**Stack:** Node.js + hono + @hono/node-server + pi-ai + pi-agent-core + better-sqlite3

**Endpoints:**

```
POST /message
  Headers: Authorization: Bearer <token>, Content-Type: application/json
  Body:    { "text": "...", "client": "cli" | "telegram" | "web" }
  Response: { "reply": "..." }
  
  Internal flow:
    1. Auth middleware → resolve user
    2. getOrCreateSession(user.id) → session_id
    3. loadMessages(session_id) → history
    4. user.identity → system prompt
    5. new Agent({ systemPrompt, model, messages: history })
    6. agent.prompt(text)
    7. Extract reply (accumulated text_delta OR fallback via agent.state.messages)
    8. appendEntry(user msg) + appendEntry(assistant msg)
    9. Return { reply }

GET /thread
  Headers: Authorization: Bearer <token>
  Query:   ?limit=50 (optional)
  Response: { "sessionId": "...", "messages": [...], "count": N }
  
  Usage: new client syncs context from the ongoing conversation.
```

**`client` field in POST:** optional, stored in the entry's `data` to track message origin. Useful for future debug and analytics. Does not affect behavior.

### 2. Database

**Engine:** SQLite (file on disk on the VPS). Evolves to PostgreSQL when necessary.

**Schema:**

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  token_hash TEXT NOT NULL,
  identity TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL
);

CREATE TABLE entries (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  parent_id TEXT,
  type TEXT NOT NULL,        -- 'message' (future: 'compaction', 'model_change')
  data TEXT NOT NULL,        -- JSON: full pi-ai message object
  timestamp INTEGER NOT NULL
);

CREATE TABLE telegram_users (
  telegram_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id)
);

CREATE INDEX idx_entries_session ON entries(session_id, timestamp);
CREATE INDEX idx_sessions_user ON sessions(user_id);
```

**Table `telegram_users`:** maps telegram_id → user_id. When the bot receives a message, it looks up this table to resolve the user. Provisioned by admin alongside the user.

**Append-only:** entries are never edited or deleted. parent_id forms the tree (preparation for future branching/compaction, even though not used now).

### 3. Identity

Each user's identity is stored in the `identity` column of the `users` table. The content is markdown that becomes the Agent's system prompt.

**For Alisson**, the initial identity will be composed from the current YAMLs:

```
soul.yaml + ego/identity.yaml + ego/behavior.yaml → single markdown text
```

Manual conversion: extract text from YAMLs, compose into coherent markdown, edit until it sounds right. Not automatic parsing — editorial work. The result is stored via the admin CLI.

**For other users**, admin creates the user with a stub identity that the person can update later.

**Admin commands for identity:**
```bash
# Set identity from a file
npx tsx admin.ts user set-identity <name> --file path/to/identity.md

# Set identity inline
npx tsx admin.ts user set-identity <name> --text "I am..."
```

### 4. mirror-cli

Evolution of Exp 08. REPL that reads config, sends POST, prints reply.

**Config:** `~/.mirror/config.json`

```json
{
  "serverUrl": "https://mirror.example.com",
  "token": "..."
}
```

**Change from Exp 08:** config moves from the project folder to the user's home directory (`~/.mirror/`). This allows running the CLI from any directory without loading the repo.

**Installation for the group:** each person clones the repo, runs `npm install`, copies config.json.example to `~/.mirror/config.json`, pastes their token, and `npx tsx cli/index.ts` works from anywhere.

### 5. Telegram bot (adapter)

Thin adapter that translates between the Telegram API and the mirror-server.

**Stack:** grammy (modern, typed Telegram library)

**Flow:**

```
Telegram sends update via webhook
  → bot extracts telegram_id and message text
  → looks up user_id in telegram_users table
  → if not found → replies "Unknown user. Ask admin to register you."
  → if found → fetches user token
  → POST /message to mirror-server with Authorization: Bearer <token>
  → receives { reply }
  → sends reply back to Telegram
```

**Where it runs:** in the same process as mirror-server (webhook route) OR as a separate process. For the first deliverable: **same process**, route `POST /telegram/webhook` in hono. Simplifies deploy — one process only.

**BotFather setup:**
1. Create bot via @BotFather on Telegram
2. Obtain bot token
3. Set webhook: `https://mirror.example.com/telegram/webhook`

**Additional env vars:**
```
TELEGRAM_BOT_TOKEN=...
TELEGRAM_WEBHOOK_SECRET=...  (webhook authenticity validation)
```

### 6. Admin

CLI script for user provisioning. Evolution of Exp 07.

```bash
# Create user
npx tsx admin.ts user add <name>

# Reset token
npx tsx admin.ts user reset-token <name>

# Link Telegram
npx tsx admin.ts telegram link <name> <telegram_id>
```

`user add` generates token, creates user in the database with a stub identity, creates session, prints token. `user set-identity` updates the identity column from a file or inline text. `telegram link` inserts into `telegram_users`.

To discover someone's `telegram_id`: the person sends any message to the bot, the bot replies "Unknown user" and logs the telegram_id to the console. Admin picks the id and runs `telegram link`.

---

## Repository structure

```
mirror-mind/
├── server/
│   ├── index.ts                  ← hono server + routes
│   ├── db.ts                     ← SQLite schema + helpers
│   ├── auth.ts                   ← bearer token middleware
│   ├── identity.ts               ← loads identity from user record
│   ├── telegram.ts               ← Telegram adapter (webhook + grammy)
│   └── admin.ts                  ← admin CLI
├── cli/
│   ├── index.ts                  ← REPL client
│   └── config.json.example
├── seeds/
│   └── identities/               ← template .md files for seeding
├── data/                         ← SQLite (gitignored)
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
└── README.md
```

**Note:** this is the `mirror-mind` repo, not `pi-sandbox`. The sandbox was for learning; this is the real project. Sandbox experiments were the PoC; code here is written from scratch, informed by the experiments. See [roadmap.md](roadmap.md) for the full path.

---

## Deploy

**VPS:** Hetzner or DigitalOcean, minimum plan (~5 EUR/month). Ubuntu 24.04.

**Deploy stack:**
- Node.js 20+ (via nvm or nodesource)
- Caddy as reverse proxy (automatic HTTPS via Let's Encrypt)
- systemd to keep the process running
- Domain: `mirror.softwarezen.com` (or existing subdomain)

**Caddy config:**
```
mirror.softwarezen.com {
    reverse_proxy localhost:3000
}
```

**systemd unit:**
```ini
[Unit]
Description=mirror-server
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/mirror
ExecStart=/usr/bin/node --import tsx server/index.ts
Restart=always
EnvironmentFile=/opt/mirror/.env

[Install]
WantedBy=multi-user.target
```

**Deploy flow:** git pull on VPS → npm install → systemctl restart mirror-server. No CI/CD for now — manual via SSH.

---

## Model and provider

**Provider:** OpenRouter (key already available, multi-model)
**Initial model:** `google/gemini-2.0-flash-001` (fast, cheap — good for iteration)
**Model for real identity:** `anthropic/claude-3.7-sonnet` or `anthropic/claude-sonnet-4` (writing quality)

Configurable via env var. Not hardcoded. Future: configurable per user.

```
LLM_PROVIDER=openrouter
LLM_MODEL=anthropic/claude-sonnet-4
```

---

## Known limitations

Consciously accepted for the first deliverable:

1. **No compaction.** Long conversations will exceed the context window. Workaround: manually start a new session when it gets long. Compaction is the natural next step.

2. **No client streaming.** Response arrives as a complete JSON. Acceptable for CLI. Natural for Telegram (Telegram doesn't show "typing..." with partial streaming anyway). Future web UI will need SSE.

3. **No automatic retry.** If the LLM fails (rate limit, timeout), the request fails and the client sees an error. Retry is a next step.

4. **No personas.** Base voice only. The system prompt is the user's .md file, no dynamic routing. When the absence of personas hurts, it's time to implement.

5. **Manual deploy.** SSH, git pull, restart. No CI/CD. Acceptable while the team is 4 people.

6. **Non-composed identity.** One identity text per user, manually set via admin CLI. Automatic composition (self + ego + persona + journey) is future.

7. **No tools.** The Agent has no tools — it only responds with text. Memory searches, draft writing, file reading — all future.
