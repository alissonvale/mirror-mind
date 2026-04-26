[< Improvements](../)

# Bubble metadata legibility — mode icon + org icon refresh

**Type:** Refinement (with one S9 phase 1 slice)
**Date:** 2026-04-26

## Problem

Two unrelated frictions surfaced during S3 manual smoke and the conversation that followed:

1. **Org icon collision with `◇` (mirror/persona).** The conversation header used `◈` (filled diamond) for organizations. The user reads the open diamond `◇` as "mirror/persona" in their mental model, and `◈` was visually too close — every time an org pill appeared, there was a flash of "is this a persona?". The friction was small per glance but consistent, and it made cast vs scope harder to read at a distance.

2. **Mode is invisible per turn.** Mode is decided fresh by reception every turn (or pinned via the rail's session override), but the decision is invisible after generation. The header's Mode pill shows the override or "auto", not what reception actually picked. Users testing the pipeline have no way to verify retroactively whether a turn was conversational, compositional, or essayistic without reading the response shape and inferring.

## Fix

### Org icon swap: `◈` → `⌂`

The house symbol is line-art, monochromic, and conceptually clean for "place / context". Same family of glyphs as `◇` (persona) and `↝` (journey) — no emoji-rendering inconsistency. Five touch points updated:

- [`adapters/web/pages/conversation-header.tsx`](../../../../adapters/web/pages/conversation-header.tsx) — `ScopePillGroup` icon prop
- [`adapters/web/pages/conversations.tsx`](../../../../adapters/web/pages/conversations.tsx) — listing tag
- [`adapters/web/pages/mirror.tsx`](../../../../adapters/web/pages/mirror.tsx) — bubble badge
- [`adapters/web/public/chat.js`](../../../../adapters/web/public/chat.js) — `ensureScopePill` icon + streaming bubble badge
- prompt-composition docs — references throughout

Search for `◈` returns zero hits after this commit.

### Mode bubble indicator (CV1.E7.S9 phase 1)

The full S9 had two parts: stamp `_mode` on the entry meta + surface in the `Look inside` composed snapshot. This commit ships **phase 1 only** — the bubble indicator. Snapshot field stays parked as phase 2.

**Server side.** Three persistence paths now stamp `_mode` and `_mode_source` (`"reception"` or `"session"`) on assistant entry meta:

- [`adapters/web/index.tsx`](../../../../adapters/web/index.tsx) — stream handler. Source can be `"session"` when the rail's mode override is set, otherwise `"reception"`.
- [`adapters/telegram/index.ts`](../../../../adapters/telegram/index.ts) — Telegram has no rail override (non-goal), so source is always `"reception"`.
- [`server/index.tsx`](../../../../server/index.tsx) — base API endpoint, same as Telegram.

**Client side.** A small text glyph renders inline at the start of the bubble's text via a CSS pseudo-element driven by `data-mode-icon`:

| Mode | Glyph | Why |
|---|---|---|
| `conversational` | `“` | Left double quotation mark — *"this is dialogue"*. Initially shipped as `🗨` (speech bubble), but that glyph renders filled in most fonts and broke the line-art consistency with ◇ ⌂ ↝. Swapped to `“` in v2 of the asset. |
| `compositional` | `☰` | Three lines — structured, list-shaped reply |
| `essayistic` | `¶` | Pilcrow — classical mark for prose |

The four metadata glyphs (`◇` persona, `⌂` org, `↝` journey, plus the three modes) are all monochromatic line-art so they read as a coherent family at the bubble's edge.

The pseudo-element approach (instead of an inline `<span>` inside the bubble) survives `chat.js`'s markdown re-render path (`b.innerHTML = md(b.textContent)`) which would otherwise clobber any inline metadata.

`mirror.tsx` exports a `modeIcon(mode)` helper that the server-rendered path uses; `chat.js` carries a `modeIconFromKey(mode)` mirror for the streaming path. Same mapping, two files (server and client can't share runtime code).

CSS rule:

```css
.bubble[data-mode-icon]::before {
  content: attr(data-mode-icon) " ";
  color: #a0958a;
  opacity: 0.7;
  font-size: 0.92em;
  margin-right: 0.15em;
  user-select: none;
}
```

Faint color, slightly smaller font — subtle metadata, not competing with the persona color bar or the bubble text.

### Asset version bump

- `chat.js?v=scope-pill-hot-update-1` → `?v=bubble-mode-org-icon-2` (initial bump was `-1`; bumped to `-2` when the conversational glyph swapped from `🗨` to `“` for line-art consistency)
- `style.css?v=persona-colors-native-picker-1` → `?v=bubble-mode-org-icon-1`

Both bumped so cached assets in the browser pick up the new behavior + CSS rule on next page load.

## Tests

647 passing, unchanged. The `_mode` stamping lives inside the streaming/persistence paths whose unit tests would need full Agent mocking. The CSS pseudo-element rendering is browser-only.

Validation is manual:

1. Open a fresh session, send any message, observe the bubble carries the correct mode glyph at its left edge.
2. Verify the glyph survives F5 (server-rendered) and survives streaming (client-side path in `chat.js`).
3. Verify the org pill in the header reads `⌂ <key>` everywhere.
4. Sanity check: SQL query against the latest entry — `json_extract(data, '$._mode')` should return `"conversational"`, `"compositional"`, or `"essayistic"`; `json_extract(data, '$._mode_source')` should return `"reception"` or `"session"`.

## Relationship to CV1.E7.S9

CV1.E7.S9 (per-turn mode visibility) stays Draft. The story's framing was: "stamp `_mode` on assistant entry meta + surface in the bubble + surface in the Look inside snapshot + optional bubble indicator." Phase 1 (stamp + bubble) shipped here; phase 2 (Look inside snapshot field) is unshipped and waits for the next time the user looks at the rail's snapshot and asks "what mode was applied?".

The S9 description in the epic index updates to reflect this split.

## Non-goals (parked)

- **Look inside snapshot field for mode.** Phase 2 of S9. Not done in this refinement.
- **Tooltip on the mode glyph.** Initially considered, but `title` on the bubble would trigger anywhere on the bubble's hover area (intrusive). A scoped span with title would re-introduce the markdown re-render problem. If the glyph itself isn't legible enough, the right response is a different glyph, not a tooltip.
- **Color-coded modes.** The single soft-gray color keeps the indicator quiet. If users start reading the glyph as primary signal (rather than the bubble's substance), color would help — but that hasn't surfaced.
- **Org icon for non-web adapters.** Telegram and CLI don't render the badge; their text signature only carries persona. Org icon scope is web-only.

## See also

- [CV1.E7.S9 — Per-turn mode visibility](../../cv1-depth/cv1-e7-response-intelligence/) — story this is phase 1 of
- [Prompt composition § 5 Meta stamping](../../../../product/prompt-composition/index.md) — updated to reflect `_mode` is now stamped (was "not currently stamped — reserved for future analytics")
