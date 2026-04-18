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
│  Chat                                           │ CONTEXT              ◀ ✕   │
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
│  └───────────────────────────────────┘          │ gemini-2.5-flash           │
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

### New

- `adapters/web/pages/partials/context-rail.tsx` — the rail component (JSX).
- `adapters/web/public/context-rail.css` — rail-specific styles.
- `adapters/web/public/context-rail.js` — collapse toggle + `localStorage` persistence.

### Modified

- `adapters/web/pages/chat.tsx` — mount the rail next to the chat column; adjust grid.
- `adapters/web/public/chat.js` — on response, receive `sessionStats` from `/message` and dispatch an event the rail listens to.
- `adapters/web/public/chat.css` — tweak the chat column width to accommodate the rail.
- `server/endpoints/message.ts` — response body gains `sessionStats` and `composed`.

### Unchanged

- Telegram, CLI, and API adapters do not get the rail. They ignore the new response fields.

---

## Endpoint change

`POST /message` response body evolves:

```jsonc
{
  "reply": "...",
  "persona": "product-designer",          // already returned
  "sessionStats": {                        // new
    "messages": 12,
    "tokensIn": 5200,
    "tokensOut": 3200,
    "costBRL": 0.0912,
    "model": "gemini-2.5-flash"
  },
  "composed": {                            // new
    "layers": ["self.soul", "ego.identity", "ego.behavior"],
    "persona": "product-designer",
    "journey": "mirror-mind",
    "attachmentsCount": 2
  }
}
```

- `sessionStats` is cumulative per session — server tracks totals in-memory per session or recomputes from entries on each turn (decide during implementation; recompute is simpler, cache if hot).
- `composed` mirrors exactly what the prompt composer put in — no inference, no reception output.
- Cost is computed from token counts × current model rate (configured in `config/models.json`). If unknown, returns `null` and the rail omits it.

---

## State and persistence

- Collapse state: `localStorage["mirror.rail.collapsed"] = "true" | "false"`, per browser/user.
- Session stats: recomputed every turn; not cached on the client beyond the current page load.
- Composed context: recomputed every turn; always reflects the most recent response.

---

## Implementation sketch

1. Extend `server/endpoints/message.ts` to build and attach `sessionStats` and `composed`.
2. Write unit tests for the stats builder (`:memory:` DB, insert entries, assert totals).
3. Build `context-rail.tsx` with the three blocks + footer link, pre-rendered on chat page load from the last message's metadata.
4. Add `context-rail.js` to listen for a `mirror:response` event and re-render blocks.
5. In `chat.js`, after receiving the JSON response, dispatch `mirror:response` with the new fields.
6. Style, verify collapse persistence, verify mobile drawer behavior, verify empty states.

---

## Tests

- **Unit** (`tests/server/message.test.ts`) — `sessionStats` totals match inserted entries; `composed.layers` includes all identity layers loaded; `composed.persona` matches reception output; `costBRL` is `null` when model rate is unknown.
- **Route** (`tests/web/chat-rail.test.ts`) — chat page includes rail container, rail re-renders after `mirror:response` dispatch (using `happy-dom`), collapsed state persists across page loads.
- **Manual** — first-person verification across a short conversation: persona shown matches signature in bubble, cost accumulates, collapse persists after refresh.

---

## Estimate

Small-to-medium. Endpoint change + one new partial + one new script + styles. No new dependencies. Target: one session.

---

**See also:**
- [Memory Taxonomy](../../../../../product/memory-taxonomy.md) — what Attention Memory is and why this rail is its window
- [Decisions 2026-04-17](../../../../decisions.md) — the decisions that shape this story
- [Epic index](../index.md) — CV0.E2 and the stories around this one
