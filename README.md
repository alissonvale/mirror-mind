# Mirror Mind

Every time you open a new AI session, you start from zero.

You re-explain your projects. You re-establish your context. You repeat your values, your constraints, your situation — again. And the AI, no matter how capable, responds as if it's meeting you for the first time. Because it is.

The advice it gives could fit anyone. It doesn't know that you made that decision three months ago and why. It doesn't know what you're navigating right now, what tensions are unresolved, what you committed to last week. It answers in a vacuum.

That's not an assistant. That's a very smart stranger.

Mirror Mind is a different bet. It's a personal AI server that actually knows you — your identity, your voice, your values, your ongoing journeys — and carries that knowledge across every conversation, every device, every channel.

Not a chatbot. Not an assistant. A mirror — conscious, accumulative, and yours.

## What makes it different

**It runs as a server, not a session.** Your mirror is always on, always reachable. From a CLI on your laptop, from Telegram on your phone, from a web browser at work. One server, one continuous thread, many entry points. The conversation doesn't end when you close the window.

**It knows you, not just your prompt.** Your identity — values, voice, philosophy, behavior — is loaded into every interaction. The mirror doesn't need you to explain who you are. It already knows. And it speaks as you, not about you.

**It remembers what matters.** Conversations are persisted across sessions. Context accumulates over time. The mirror carries forward what you said last week, what you decided last month, what you committed to yesterday. No more starting from zero.

**It serves multiple people without mixing them.** Each user has their own identity, their own conversation history, their own privacy. Your family, your collaborators — everyone gets their own mirror on the same server, completely isolated.

**The architecture is Jungian by design.** Self, Ego, Personas, Shadow — not as decoration, but as a genuine model of how a person's intelligence operates across different domains and depths. A therapist lens for existential questions. A strategist for business decisions. A writer for content. Each activated automatically by context, one unified voice.

## Architecture

```
┌─────────────┐              ┌──────────────────────┐
│  CLI        │    HTTPS     │   mirror-server      │
│  Telegram   │◄────────────►│   (Node.js + pi)     │
│  WhatsApp   │              │                      │
│  Web        │              │   Agent + Identity   │
│  ...        │              │   + Persistence      │
└─────────────┘              └──────────────────────┘
```

- **Server**: HTTP API powered by [pi-agent-core](https://github.com/badlogic/pi-mono/tree/main/packages/agent) with [hono](https://hono.dev). One `POST /message`, one `GET /thread`. Stateless per request — state lives in the database.
- **Identity**: stored per user in the database. The content is markdown that _becomes_ the system prompt. Update it via admin CLI to change who the mirror is.
- **Persistence**: append-only entries in SQLite (inspired by pi's [SessionManager](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent) design). Tree structure with `id`/`parentId` for future branching and compaction.
- **Auth**: bearer token per user. SHA-256 hashed in the database. Provisioned via admin CLI.
- **Clients**: thin adapters that translate between a channel's protocol and the server's HTTP API. Adding a new channel means writing ~60 lines of glue code.

## Status

**Current phase: CV0 — Foundation** (autonomy + continuity)

Building the first deployable version: server on a VPS with real identity, CLI client, and Telegram bot.

See the full roadmap with all phases (CV0–CV3) in [docs/roadmap.md](docs/roadmap.md).

## Stack

- **Runtime**: Node.js + TypeScript
- **Agent**: [@mariozechner/pi-ai](https://github.com/badlogic/pi-mono/tree/main/packages/ai) + [@mariozechner/pi-agent-core](https://github.com/badlogic/pi-mono/tree/main/packages/agent)
- **HTTP**: [hono](https://hono.dev) + @hono/node-server
- **Database**: SQLite via [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)
- **Telegram**: [grammy](https://grammy.dev)
- **LLM provider**: [OpenRouter](https://openrouter.ai) (multi-model)

## Docs

- [Briefing](docs/briefing.md) — architectural decisions and rationale
- [Design v1](docs/design-v1.md) — first deliverable spec (endpoints, schema, deploy)
- [Spike report](docs/spike-2026-04-12.md) — technical investigation that led to this project

## Getting started

### Prerequisites

- Node.js 20+
- npm

### Install

```bash
git clone https://github.com/alissonvale/mirror-mind.git
cd mirror-mind
npm install
cp .env.example .env
# Edit .env with your OpenRouter API key
```

### Setup your mirror

#### New user

```bash
npx tsx server/admin.ts user add <name>
```

Creates a user with a bearer token and a starter identity — a template with placeholders for your values, voice, and behavior. The mirror is functional immediately; refine the identity over time.

The command prints the token. Save it — you'll need it to authenticate from any client.

To edit the identity later:

```bash
npx tsx server/admin.ts user set-identity <name> --text "Your identity text here"
```

#### Migrate from POC Mirror

If you already have an identity in the POC Mirror (`~/.espelho/memoria.db`), import it directly:

```bash
npx tsx server/admin.ts user import <name> --from-poc
```

This reads your soul, ego identity, and ego behavior from the POC database, composes them into a single identity text, and stores it in the mirror-mind database. No manual copy-paste needed.

### Clients

_Coming soon — CLI and Telegram setup instructions will be added here._

## Background

Mirror Mind started as a [PoC](https://github.com/alissonvale/mirror-poc) built on Python and Claude Code. It validated the core idea — a Jungian AI architecture with personas, memory, and identity. But it was single-user, single-device, and coupled to a terminal session.

This repository is the reconstruction: same soul, new foundation. Client-server from day one. Built on [pi](https://github.com/badlogic/pi-mono) for agent portability. Designed for ubiquity — CLI, Telegram, WhatsApp, web. Multi-user with privacy by design.

The Python PoC continues running in parallel ([strangler fig](https://martinfowler.com/bliki/StranglerFigApplication.html)) until the new foundation covers enough ground.

## License

MIT
