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

Creates a user with a bearer token and a starter identity — a template with placeholders for your values, voice, and behavior. The mirror is functional immediately; refine the identity over time.

The command prints the token. Save it — you'll need it to authenticate from any client.

To edit the identity later:

```bash
npx tsx server/admin.ts user set-identity <name> --text "Your identity text here"
```

### Migrate from POC Mirror

If you already have an identity in the POC Mirror (`~/.espelho/memoria.db`), import it directly:

```bash
npx tsx server/admin.ts user import <name> --from-poc
```

This reads your soul, ego identity, and ego behavior from the POC database, composes them into a single identity text, and stores it in the mirror-mind database. No manual copy-paste needed.

## Clients

_Coming soon — CLI and Telegram setup instructions will be added here._
