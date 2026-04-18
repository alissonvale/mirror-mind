[< Story](index.md)

# Plan: CV0.E2.S9 — Context Rail

**Roadmap:** [CV0.E2.S9](../index.md)
**Framing:** The rail is [Attention Memory](../../../../../product/memory-taxonomy.md#axis-a--cognitive-roles) made visible — a window into what the mirror is holding in mind for this turn.

---

## Goal

A collapsible right-side panel on the chat page that shows, at all times:

- **Persona** — which voice answered (avatar with initials + color token, name, one-line descriptor)
- **Session** — messages, tokens, cost so far, model in use
- **Composed context** — layers loaded, journey in play, attachments pulled

Plus a footer link to open the Memory Workspace (S8) when it exists.

The rail is not a dashboard and not a log. It reflects **composition**, not reception decisions. If a signal from reception doesn't affect what entered the prompt, it doesn't appear.

---

## Non-goals

Consciously out of scope for this story:

- **Soul/ego summary always visible** — rejected; depth cannot live as wallpaper. See [Decisions 2026-04-17](../../../../decisions.md#2026-04-17--no-soul-ego-summary-always-visible-in-the-rail).
- **Activity trail per-message** — discarded; the rail absorbs this surface. See [Decisions 2026-04-17](../../../../decisions.md#2026-04-17--activity-trail-per-message-discarded-the-rail-absorbs-it).
- **Avatar customization** — first-letter + color token for now. Upload lands when demand appears.
- **Cost history/chart** — rail is not a dashboard. Cost is shown for the current session only.
- **Editing from the rail** — edits happen in the Memory Workspace (S8), not here.

---

## Wireframe

### Expanded (desktop)

```
┌────────────────────────────────────────────────┬────────────────────────────┐
│  Chat                                           │ ATTENTION MEMORY     ◀ ✕   │
│  ─────                                          │ ──────────────────────     │
│                                                 │                            │
│  ┌───────────────────────────────────┐          │ ┌────────────────────┐    │
│  │ ◇ product-designer                 │          │ │  ╭──╮               │    │
│  │                                    │          │ │  │PD│               │    │
│  │  Concordo — mudei de ideia.        │          │ │  ╰──╯               │    │
│  │  O objetivo original era...        │          │ │                     │    │
│  └───────────────────────────────────┘          │ │  product-designer   │    │
│                                                 │ │  Product & strategy │    │
│                    ┌─────────────────────┐      │ │  architect          │    │
│                    │ queria ver um       │      │ └────────────────────┘    │
│                    │ wireframe           │      │                            │
│                    └─────────────────────┘      │ SESSION                    │
│                                                 │ ──────────                 │
│  ┌───────────────────────────────────┐          │ 12 messages                │
│  │ ask the mirror                  ↵ │          │ 8.4k tokens  ·  R$ 0,09    │
│  └───────────────────────────────────┘          │ deepseek-chat-v3           │
│                                                 │                            │
│                                                 │ COMPOSED                   │
│                                                 │ ──────────                 │
│                                                 │ soul · ego · behavior      │
│                                                 │ ◇ product-designer         │
│                                                 │ ▸ mirror-mind              │
│                                                 │ 2 attachments              │
│                                                 │                            │
│                                                 │ ──────────────────         │
│                                                 │ Grounded in your identity  │
│                                                 │ open →                     │
└────────────────────────────────────────────────┴────────────────────────────┘
        ~720px                                             ~280px
```

### Collapsed

```
┌──────────────────────────────────────────────┬────────┐
│  Chat                                         │  ◁  ╭──╮│
│                                               │     │PD││
│  ...                                          │     ╰──╯│
│                                               │        │
│                                               │   R$   │
│                                               │  0,09  │
└──────────────────────────────────────────────┴────────┘
        ~960px                                     ~56px
```

Collapsed strip keeps two signals: persona avatar + session cost. Clicking reopens.

*Rows `▸ <journey>` and `N attachments` are aspirational — they render only when those mechanisms exist (CV1.E4+). For v1, Composed shows only identity layers plus `◇ persona` when reception picks one.*

### Mobile

Rail becomes a drawer triggered by a top-right icon. Opens full-screen on tap, closes on outside tap. Same three blocks, same content.

### Empty states

- **No persona active (ego solo):** persona card shows a dashed circle + `ego` label + `voz base` descriptor.
- **Reception failed/timeout:** Composed section omits the persona line, shows `reception —` muted.
- **No attachments:** attachment line omitted entirely (zero is absence, not a card).

---

## Visual conventions

Reuse what v0.4.0 already chose:

- Background: same cream as the chat (no new palette).
- Rail border: same subtle warm border used on assistant bubbles.
- Block dividers: 1px line at `opacity: 0.15`.
- Block titles: sans, small-caps, tracking `0.08em`, `--ink-muted`.
- Data lines: sans regular, `--ink`.
- Numerical values (tokens, cost): mono light.
- No gold, no heavy borders, no decorative icons. Only the chevron for collapse and the `→` on the footer link.

---

## Files touched

**Reality note (2026-04-17):** the original plan predicted paths that didn't match the actual repo structure (no `partials/`, single `style.css` and `chat.js`, endpoint lives in `server/index.tsx` with web-specific SSE in `adapters/web/index.tsx`). Actual layout below.

### New

- `server/session-stats.ts` — aggregate message/token/cost helper for a session.
- `server/composed-snapshot.ts` — what entered the prompt: layers + persona.
- `adapters/web/pages/context-rail.tsx` — the rail component (JSX) plus `personaInitials` and `personaColor` helpers exported for the server side.
- `tests/session-stats.test.ts` — unit tests for the stats aggregator.

### Modified

- `server/config/models.ts` — `ModelConfig` gains optional `price_brl_per_1m_input` and `price_brl_per_1m_output`.
- `config/models.json` — BRL rates added to `main` and `reception`. Approximate, documented in each entry's `purpose`.
- `adapters/web/index.tsx` — imports helpers, adds `personaDescriptor` and `buildRailState` functions, passes `rail` to `ChatPage`, emits `rail` inside the SSE `done` event.
- `adapters/web/pages/chat.tsx` — mounts `<ContextRail>` as sibling of `.chat-container` inside a new `.chat-shell` flex wrapper; accepts `rail` prop.
- `adapters/web/pages/layout.tsx` — new optional `wide` flag toggles a `.content-wide` class that removes the `max-width: 800px` constraint on the chat page.
- `adapters/web/public/chat.js` — `updateRail(state)` refreshes DOM nodes on every SSE `done` event; collapse toggle persists to `localStorage["mirror.rail.collapsed"]`.
- `adapters/web/public/style.css` — rail styles (three blocks, avatar circular, collapsed strip, mobile drawer). `.content-wide` override.
- `tests/web.test.ts` — four new tests under "web routes — context rail".

### Scope clarification

The JSON `POST /api/message` endpoint was **not** changed. The rail lives in the web adapter, which uses the SSE `/chat/stream` — that is where `rail: RailState` now ships, on the `done` event. CLI and Telegram continue using `/message` untouched. Extending the JSON endpoint to return `sessionStats` + `composed` is a follow-up if the CLI ever wants to surface equivalent info.

---

## Endpoint change

The web adapter's SSE route `GET /chat/stream` evolves. The `done` event gains a `rail` field carrying the full state the rail needs to refresh:

```jsonc
data: {
  "type": "done",
  "reply": "...",
  "rail": {
    "sessionStats": {
      "messages": 12,
      "tokensIn": 5200,
      "tokensOut": 3200,
      "costBRL": 0.0391,
      "model": "deepseek/deepseek-chat-v3-0324"
    },
    "composed": {
      "layers": ["self.soul", "ego.identity", "ego.behavior"],
      "persona": "product-designer"
    },
    "personaDescriptor": "Arquiteta de produto e estratégia sênior...",
    "personaInitials": "PD",
    "personaColor": "#7c9aa0"
  }
}
```

- `sessionStats` is recomputed from entries on every turn — simple and honest; optimize with a cache only if it becomes hot.
- `tokensIn`/`tokensOut` are approximations (character count / 4) — pi-ai does not surface usage at the Agent level, and a rough estimate is adequate for the rail.
- `composed.layers` mirrors what `composeSystemPrompt` put into the prompt — pulled from identity layers that the user has under `self` and `ego`.
- `costBRL` is derived from `config/models.json` `price_brl_per_1m_input` / `price_brl_per_1m_output` of the `main` model. If the rates are missing, `costBRL` is `null` and the rail omits the cost line.
- `personaDescriptor`, `personaInitials`, `personaColor` are computed server-side so the client doesn't duplicate the hash logic.

---

## State and persistence

- Collapse state: `localStorage["mirror.rail.collapsed"] = "true" | "false"`, per browser/user.
- Session stats: recomputed every turn; not cached on the client beyond the current page load.
- Composed context: recomputed every turn; always reflects the most recent response.

---

## Tests

- **Unit** — `tests/session-stats.test.ts`: six tests covering the stats aggregator (empty session, counting, token approximation, cost derivation from BRL rates, `_meta` stripping, non-message entry filtering).
- **Route** — `tests/web.test.ts` gains a "web routes — context rail" `describe` block: four tests verifying the rail container renders, the `ego · voz base` empty state shows when no persona is active, the last persona is reflected from the most recent assistant entry, and the composed layers list includes `self.soul`, `ego.identity`, `ego.behavior`.
- **Manual** — see [Test Guide](test-guide.md) for the eight-step in-browser checklist.

---

## Estimate

Small-to-medium. Endpoint change + one new partial + one new script + styles. No new dependencies. Target: one session.

---

**See also:**
- [Memory Taxonomy](../../../../../product/memory-taxonomy.md) — what Attention Memory is and why this rail is its window
- [Decisions 2026-04-17](../../../../decisions.md) — the decisions that shape this story
- [Epic index](../index.md) — CV0.E2 and the stories around this one
