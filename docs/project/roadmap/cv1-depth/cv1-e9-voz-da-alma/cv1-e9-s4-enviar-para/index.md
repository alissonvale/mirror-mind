[< CV1.E9](../)

# CV1.E9.S4 — "Enviar Para…" UI + manual override

**Status:** ✅ Done (2026-04-27) · Released in `v0.18.0`

## Problem

S3's auto-detector classifies most turns correctly, but two failure modes are inevitable:

1. **False negative.** The user wrote a registry-style fragment but reception classified it as a question or analytical reflection. The Alma stays silent when the user wanted it.
2. **False positive.** The user asked a casual or operational question and reception classified it as a self-moment. The Alma fires patronizing wisdom on small talk.

Without a manual escape, the user has no way to correct either mistake — and (3) the user often *knows* in advance which voice they want for a given message. Forcing them through the auto-detector is friction.

The **"Enviar Para…"** mechanism solves all three:
- A second send button next to the canonical send. Clicking it opens a small destination menu.
- Destinations: **Voz da Alma** + each persona currently in the cast.
- When the user picks, the turn bypasses reception's classification for the chosen axis and routes through the picked destination.
- The choice is logged on the assistant entry as a `_forced_destination` ground-truth label.

## Why this matters beyond UX

Manual choices are **labeled training data** for the auto-detector. Every "Enviar Para… → Voz da Alma" click is an unambiguous "this message should have been Alma" label; every "Enviar Para… → mentora" is "this message should have been mentora". CV1.E8 (logging) plus future eval work uses these labels to calibrate the auto-detector against real user intent. The S4 UI is not just an escape hatch — it's the loop that closes the auto-detection feedback.

## Fix

### Backend

Extend `/conversation/stream` (and `/conversation` sync) to accept a `forced_destination` query param:

- `forced_destination=alma` → bypass reception's persona/alma routing. Force Alma path: `is_self_moment` treated as true, persona pipeline replaced. Reception still runs (we still want mode/scope axes, and `is_self_moment` itself is logged for label vs auto comparison).
- `forced_destination=persona:<key>` → bypass reception's persona routing. Force persona path with `personas: [<key>]`. Reception still runs for scope/mode/alma axes (alma is suppressed when manual persona is chosen).
- omitted → canonical pipeline (reception decides).

The override applies to a single turn. The next turn returns to auto.

The chosen destination is stamped on the assistant entry meta as `_forced_destination: "alma"` or `_forced_destination: "persona:<key>"`. Telemetry pairs this with reception's auto-classification (`is_self_moment` and `personas`) so the divergence is queryable.

### Frontend

`mirror.tsx` chat form gains a second button next to send:

```html
<button id="send-to-btn" type="button">Enviar Para…</button>
```

Clicking it opens a popover anchored to the button:

```
┌─────────────────────────────┐
│ ◈ Voz da Alma               │
│ ─────────────────────────── │
│ ◇ mentora                   │
│ ◇ estrategista              │
└─────────────────────────────┘
```

The persona list is built from the cast (session_personas) plus the leading personas of the user's identity. When the user clicks an item:
- The popover closes
- The form submits via JS with the chosen destination encoded as `forced_destination` in the SSE URL
- The bubble that streams in carries the destination label visually (◈ for Alma, ◇ key for persona)
- The "Enviar" button is disabled mid-stream (existing behavior)

Default destination remembered in `localStorage` is **NOT** stored. Each "Enviar Para…" click opens fresh — the menu is a deliberate detour, not a recurring choice.

## What ships

- **`adapters/web/index.tsx`** — `/conversation/stream` parses `forced_destination` from query. When set, overrides reception's routing for the turn. Stamps `_forced_destination` on the assistant entry meta. The stream emits an extra `routing` field (`forcedDestination`) so the bubble label reflects the manual choice.
- **`server/index.tsx`** — sync `/api/message` accepts `forced_destination` in the JSON body with the same semantics.
- **`adapters/web/pages/mirror.tsx`** — second button + dropdown menu structure.
- **`adapters/web/public/chat.js`** — popover open/close, submit-with-destination wiring, ESC to close, click-outside to close.
- **`adapters/web/public/style.css`** — minimal styling for the second button + popover.
- **`adapters/web/locales/{en,pt-BR}.json`** — strings for the button and menu items.

## Tests

- `tests/voz-da-alma.test.ts` — additional tests for the override path (forced alma → composer used, forced persona:key → that persona only, no override → reception decides).
- Manual smoke (S5 calibration test guide covers the user-facing flow).

## Non-goals (parked)

- **Per-user default destination preference.** Each click is fresh.
- **Drag-to-route.** UI elaboration that doesn't match the adoption goal.
- **Multi-destination send** (send the same message to multiple destinations at once). Future feature; not the first iteration.
- **Edit-then-resend** alongside the destination picker. Decouple — first land the picker, then layer edit-resend on top if real use justifies.

## Docs

- [Plan](plan.md)
