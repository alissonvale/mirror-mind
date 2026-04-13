[< Docs](index.md)

# Getting Started

## Prerequisites

- Node.js 20+
- npm

## Install

```bash
git clone https://github.com/alissonvale/mirror-mind.git
cd mirror-mind
npm install
cp .env.example .env
# Edit .env with your OpenRouter API key
```

## Setup your mirror

### New user

```bash
npx tsx server/admin.ts user add <name>
```

Creates a user with a bearer token and starter identity layers (soul, ego/identity, ego/behavior) filled with editable templates. The mirror is functional immediately; refine each layer over time.

The command prints the token. Save it — you'll need it to authenticate from any client.

To view your identity layers:

```bash
npx tsx server/admin.ts identity list <name>
```

To edit a specific layer:

```bash
npx tsx server/admin.ts identity set <name> --layer ego --key behavior --text "Your behavior rules here"
```

### Migrate from POC Mirror

If you already have an identity in the POC Mirror (`~/.espelho/memoria.db`), import it directly:

```bash
npx tsx server/admin.ts user add <name>
npx tsx server/admin.ts identity import <name> --from-poc
```

This reads your soul, ego/identity, and ego/behavior layers from the POC database and writes them into mirror-mind. Each layer is preserved individually — no flattening, no manual copy-paste.

## Clients

### CLI

1. Create the config directory and file:

```bash
mkdir -p ~/.mirror
cp cli/config.json.example ~/.mirror/config.json
```

2. Edit `~/.mirror/config.json` — paste your token (from `user add`):

```json
{
  "serverUrl": "https://mirror.softwarezen.com.br",
  "token": "your-token-here"
}
```

3. Run the CLI:

```bash
npx tsx cli/index.ts
```

Works from any directory — config lives in `~/.mirror/`, not in the repo.

### Telegram

_Coming soon._

---

**See also:** [CV0.E1 — Tracer Bullet](cv0-e1/tracer-bullet.md) (schema, endpoints, deploy) · [Principles](design/principles.md) (design guidelines) · [Briefing](project/briefing.md) (why these decisions)
