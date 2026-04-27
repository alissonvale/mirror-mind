[< Story](index.md)

# Plan — CV1.E9.S4 "Enviar Para…" UI + manual override

## Premise

Manual override is the escape hatch for auto-detection mistakes AND the labeled-data feedback loop that lets the auto-detector improve over time. Both purposes argue for visible, low-friction UI — a second button next to send, not a hidden setting.

## Design

### Override semantics

Two override values:
- `forced_destination=alma` — engage Voz da Alma path. Even if reception classified `is_self_moment: false`, the pipeline routes to `composeAlmaPrompt`.
- `forced_destination=persona:<key>` — engage a specific persona. Even if reception activated other personas (or the alma), the pipeline forces `personas: [<key>]` and skips the alma.

When an override is present, reception STILL runs (we want the other axes — mode, scope, identity — and we want to log reception's classification for label vs auto comparison). Only the routing decision is overridden.

### Where the override applies in the pipeline

```
text + forced_destination
       │
       ▼
   reception (still runs — log its is_self_moment + personas)
       │
       ▼
   if forced=alma → isAlma=true, personas=[]
   if forced=persona:K → isAlma=false, personas=[K]
   else → use reception's verdict
       │
       ▼
   composer (canonical or Alma)
       │
       ▼
   ... rest of pipeline ...
       │
       ▼
   stamp _forced_destination on assistant entry meta
```

### UI — second button + popover

Existing form:
```html
<form id="chat-form">
  <input id="chat-input" />
  <button type="submit">Send</button>
</form>
```

S4 form:
```html
<form id="chat-form">
  <input id="chat-input" />
  <button id="send-to-btn" type="button">Enviar Para…</button>
  <button type="submit">Send</button>
</form>
<div id="send-to-popover" data-open="false">
  <button data-destination="alma">◈ Voz da Alma</button>
  <button data-destination="persona:mentora">◇ mentora</button>
  <!-- ... per persona in cast ... -->
</div>
```

The popover anchors to `#send-to-btn`. Click toggles open. ESC and click-outside close. Picking an item:
1. Reads `data-destination` from the chosen item
2. Reads input value (must be non-empty)
3. Closes popover
4. Calls the existing send flow with the destination appended to the SSE URL
5. Clears input
6. Disables both buttons until stream completes

### Persona list source

The popover lists personas from two sources, deduplicated:
1. Personas currently in `session_personas` (the cast)
2. All `persona/*` identity layers visible in the sidebar (the user's full persona inventory)

Reasoning: the cast is the most likely target ("send to a current cast member"), but the user may want to invoke a non-cast persona without seeding it permanently. Listing both gives flexibility without an "advanced" disclosure.

Order: cast personas first (in their display order), then non-cast personas alphabetical.

### Visual marker

When a turn is forced:
- `forced=alma` → bubble carries the same Alma label as auto (◈ Voz da Alma)
- `forced=persona:K` → bubble carries the persona signature (◇ K)

A small icon next to the label indicates manual choice (e.g., a pinpoint dot ●). Optional polish; defer to S5 if styling work is heavy.

## Phases

| # | Phase | Files | Validation |
|---|---|---|---|
| 1 | **Backend stream** — parse `forced_destination` from query, override pipeline, stamp meta. | `adapters/web/index.tsx` | Type check |
| 2 | **Backend sync** — same in `/api/message` body. | `server/index.tsx` | Type check |
| 3 | **UI structure** — second button + popover element in `mirror.tsx`. | `adapters/web/pages/mirror.tsx` | Visual smoke |
| 4 | **JS** — popover toggle, destination submission, ESC/click-outside close. | `adapters/web/public/chat.js` | Manual smoke |
| 5 | **Styles** — minimal CSS for the second button + popover positioning. | `adapters/web/public/style.css` | Visual smoke |
| 6 | **i18n** — strings for the button + popover header. | `adapters/web/locales/{en,pt-BR}.json` | Visual smoke |
| 7 | **Tests** — backend override path tests in `tests/voz-da-alma.test.ts`. | tests | runs |

## Risks

**Popover positioning.** Static absolute positioning may misalign on narrow viewports. Mitigation: anchor to button via CSS, test at common widths; defer fancy positioning logic to follow-up if needed.

**Destination key staleness.** The popover renders persona list at page load; if the user creates a new persona via /map without reloading, the new persona won't appear in the popover. Mitigation: refresh the popover list on chat-form focus; alternatively, accept staleness as a corner case (the user can reload).

**Telemetry confusion if forced and auto agree.** When the user picks alma and reception also said `is_self_moment: true`, the meta carries both `_forced_destination: "alma"` and `_is_alma: true`. The downstream consumer should distinguish: forced wins as the "what happened", auto stays as the "what reception thought". Both are logged.

## Rationale recap (from the strategy conversation)

The user named "Enviar Para…" as a critical complement to the auto-detector for two reasons:
1. Auto-detection alone fails some turns; the user needs an escape.
2. The auto-detector needs ground-truth labels to improve; the popover generates exactly those.

Without it, S3 alone produces an opaque feedback loop where bad classification stays bad. With it, every manual choice is a labeled training sample for future eval and prompt iteration.
