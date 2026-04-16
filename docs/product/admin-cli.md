[< Docs](../index.md)

# Admin CLI Reference

Operations tool for server provisioning and maintenance. Not a user-facing interface — the end user talks to the mirror in natural language.

Run all commands from the project root:

```bash
npx tsx server/admin.ts <group> <action> <name> [flags]
```

---

## user add

Creates a new user with a bearer token and starter identity layers.

```bash
npx tsx server/admin.ts user add <name>
```

**What it does:**
- Generates a random 32-byte token and stores its SHA-256 hash
- Creates three starter identity layers (self/soul, ego/identity, ego/behavior)
- Creates the user's first session
- Prints the token once — store it, it won't be shown again

---

## user reset

Clears all conversation history for a user (entries + sessions). The user, identity layers, and token are preserved.

```bash
npx tsx server/admin.ts user reset <name>
```

**Use when:** you changed the identity significantly and want the next conversation to start from a clean slate, without old context bleeding in.

---

## identity list

Shows all identity layers for a user with a content preview.

```bash
npx tsx server/admin.ts identity list <name>
```

---

## identity set

Updates a specific identity layer.

```bash
npx tsx server/admin.ts identity set <name> --layer <layer> --key <key> --text <text>
```

**Example:**

```bash
npx tsx server/admin.ts identity set alisson --layer ego --key behavior --text "Direct and calm."
```

**Layers and keys follow the Jungian model:**

| Layer | Key | Content |
|-------|-----|---------|
| `self` | `soul` | Deep identity — purpose, who I am at the core |
| `ego` | `identity` | Operational identity — what I do, how I present myself |
| `ego` | `behavior` | Tone, style, constraints |

---

## identity import

Imports identity layers from the POC Mirror database.

```bash
npx tsx server/admin.ts identity import <name> --from-poc
```

**What it does:**
- Reads self/soul, ego/identity, and ego/behavior from `~/.espelho/memoria.db`
- Writes them into the mirror-mind database for the given user
- Overwrites any existing layers with the same layer/key

**Requires:** a POC Mirror database at `~/.espelho/memoria.db`.

---

## telegram link

Links a Telegram user ID to a mirror user, so messages from that Telegram account are routed to this user's identity and session.

```bash
npx tsx server/admin.ts telegram link <name> <telegram_id>
```

**How to find the telegram_id:** send any message to the bot on Telegram. The bot replies "Unknown user" and the server logs the telegram_id. Grab it from the logs:

```bash
journalctl -u mirror-server --no-pager -n 10
```

Look for: `Unknown Telegram user: <id>`

---

**See also:** [Getting Started](../getting-started.md) (setup walkthrough) · [CV0.E1 — Tracer Bullet](../project/roadmap/cv0-foundation/cv0-e1-tracer-bullet/) (schema and endpoints)
