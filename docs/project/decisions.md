[< Docs](../index.md)

# Decisions

Incremental decisions made during construction. For foundational architectural decisions (D1–D8), see the [Briefing](briefing.md).

---

### 2026-04-13 — Identity as layers, not a single column

The `users` table doesn't store identity. A separate `identity` table stores layers (`user_id`, `layer`, `key`, `content`). System prompt composed at runtime by joining layers.

**Why:** preserves the structured model from the POC (self/soul, ego/identity, ego/behavior). Each layer editable independently. Migration is layer-by-layer. Future layers (personas, knowledge, journeys) follow the same pattern.

**Supersedes:** briefing D5 originally described identity as a single TEXT column in `users`.

---

### 2026-04-13 — Docs organized by roadmap hierarchy

Docs for epics and stories follow the roadmap structure: `docs/cv0-e1/` for the epic, `docs/cv0-e1/s1-db-identity/` for stories within it. Each level contains its own docs (design, plan, test guide). Transversal docs (principles, admin CLI reference) stay in `docs/design/`.

**Why:** the folder structure mirrors the roadmap codes. Finding docs for a given story is navigating a path, not searching filenames.

---

### 2026-04-13 — POC Mirror as migration source, not just reference

The admin CLI includes `identity import --from-poc` to read layers directly from `~/.espelho/memoria.db`. New users get starter templates via `user add`.

**Why:** two onboarding paths from day one — migration for existing users, templates for new ones. Reduces friction for both.

---

### 2026-04-13 — Self-construction layer isolated from core

The mirror will be able to program itself (create tools, tables, logic) to serve each user's specific needs. This generated layer is strictly sandboxed — it cannot touch the core (identity, auth, sessions, agent runtime).

**Why:** the mirror needs to be genuinely useful for diverse needs (inventory, finances, social media) without becoming a monolith. Isolation protects stability while enabling unlimited per-user growth.

---

### 2026-04-13 — Roadmap hierarchy: CV → Epic → Story

Renamed the roadmap levels: Milestone (M) → Epic (E), Epic (E) → Story (S). CV remains. An epic is a cohesive block of work with done criteria. A story is an atomic delivery from the user's perspective. Folder structure follows: `docs/cv0-e1/s1-db-identity/`.

**Why:** the old Milestone/Epic naming was inconsistent — sometimes milestones existed, sometimes not. Epic/Story aligns better with what each level actually represents.

---

### 2026-04-13 — Nginx (Docker) instead of standalone Caddy for reverse proxy

The VPS already runs a Docker container (Zenith) with nginx on ports 80/443, with a Cloudflare Origin wildcard cert for *.softwarezen.com.br. Instead of installing a standalone Caddy, we added a server block to the existing nginx for `mirror.softwarezen.com.br`, proxying to `172.17.0.1:3000` (host from container). SSL handled by Cloudflare (Full/Strict) + Origin cert.

**Why:** ports 80/443 were already occupied by Docker. Fighting for ports or reconfiguring the existing infra would be more complex than adding a server block. The Caddy files remain in `deploy/` as reference but aren't used in production.

---

### 2026-04-13 — Web UI before Telegram in the tracer bullet

Web UI (chat + admin) moved from CV2 to CV0.E1.S5, before Telegram (now S6). Served from the existing hono server using JSX — no separate frontend build.

**Why:** the web is 100% under our control (no third-party dependency like BotFather), serves as admin interface immediately, and is easier to iterate on. Telegram can come after.

---

### 2026-04-14 — Reception as a dedicated layer before response

Personas (and later journeys, intents, topic shifts) require analyzing the user's message before composing the system prompt. This analysis happens in a dedicated **reception** step — a lightweight LLM call that classifies multiple signals at once and returns structured JSON.

**Decisions:**

- **Personas per user, in the DB.** Each user has their own personas (layer `persona`, key = persona id). Not global.
- **LLM-first routing.** No keyword matching. The reception model decides which persona(s) fit the message.
- **Structured output.** Reception returns JSON with multiple signals (`personas`, later `journey`, `intent`, etc.). One call, many signals.
- **Separate model for reception.** Configurable via `LLM_RECEPTION_MODEL` env var. Default: a fast/cheap model (Gemini Flash Lite or similar). Main response uses the quality model.
- **5s timeout.** Experience over latency. If reception fails, fall back to base identity (no persona layer).
- **Sum, not replace.** Personas add as a lens on top of `self/soul + ego/identity + ego/behavior`. They enrich, don't substitute.
- **Signature in code.** The `◇ persona-name` prefix is added by the server after reception decides the persona — not by the LLM.

**Why reception is strategic:** it's the critical step that makes the mirror *feel* alive. Over time, reception will evolve:

1. Stateless — classify current message (S1)
2. With recent history — detect topic shifts, reclassify
3. Metacognitive — detect patterns, suggest journeys, notice when the mirror isn't helping

Each stage adds context to the reception call. The architecture starts prepared: `receive(message, context)` where `context` is empty today and grows over time.

**Radar:** topic shift detection, caching of similar classifications, reception log in entries for post-hoc review.

---

### 2026-04-14 — Model config centralized in config/models.json

Models are an **application resource**, not an installation setting. Each model has a defined purpose (reception, main response, future: summary, embeddings, meta-review). Env vars don't scale — they can't express relationships, purposes, or typed defaults.

**Structure:** `config/models.json` versioned in the repo, one entry per purpose:

```json
{
  "main": {
    "provider": "openrouter",
    "model": "deepseek/deepseek-chat-v3-0324",
    "purpose": "Primary response model — quality and identity fidelity matter most."
  },
  "reception": {
    "provider": "openrouter",
    "model": "google/gemini-2.0-flash-lite-001",
    "timeout_ms": 5000,
    "purpose": "Fast classification — persona, intent. Speed over nuance."
  }
}
```

Loaded through `server/config/models.ts` as typed objects. Code does `models.main`, `models.reception` — no `process.env` reads for model choices.

**`.env` stays for secrets only:** API keys, tokens, ports.

**Why a `purpose` field:** future contributors and AI agents reading the config need to understand *why* each model was chosen. The purpose field is the instruction that guides model swaps (e.g., "we need faster reception" signals that `reception.model` should change, not `main.model`).

**Future evolution:** user-level overrides via a `user_config` table become possible without touching the code — `models.main` becomes the global default, DB provides overrides when present.

---

### 2026-04-15 — Telegram webhook processes updates asynchronously

grammy's `webhookCallback` waits for the handler to finish before returning HTTP 200 to Telegram. With reception (5s) + LLM (variable), total processing regularly exceeds grammy's internal 10s timeout. When that happens, grammy throws, Telegram never receives 200, and redelivers the same update — creating an infinite loop of duplicate replies.

**Fix:** the webhook route now returns 200 immediately and calls `bot.handleUpdate(update)` in a fire-and-forget pattern. Secret validation is done manually before processing. Errors are caught and logged.

**Why this matters for the architecture:** any future webhook handler (WhatsApp, etc.) must follow the same pattern: ACK fast, process async. Never hold the HTTP response open while waiting for an LLM.

---

### 2026-04-13 — Clients moved to adapters/ directory

CLI moved from `cli/` to `adapters/cli/`. Telegram will be at `adapters/telegram/`. All client adapters live under `adapters/`, each in its own subdirectory.

**Why:** clients are thin adapters that translate between a channel's protocol and the server. Grouping them under `adapters/` makes the architecture visible in the folder structure — server is the core, adapters are the edges.
