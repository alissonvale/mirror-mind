[< CV1.E13](../)

# CV1.E13.S4 — Persona portrait

**Status:** ✅ Done (2026-05-05). Single round, ~70% engine reuse.

## What this story added

`/personas/<key>` now lands on a read view. The workshop form remains at `/map/persona/<key>` (legacy URL preserved for backward compat); `/personas/<key>/{editar,edit}` (locale-aware) redirects there.

The persona portrait diverges from journey/org/scene portraits in two named ways:

1. **Per-row accent color.** Each persona has its own `identity.color` (warm clay, plum, teal, etc.) used across the system — avatar chip, bubble bar in conversations, /map card. The portrait completes the coherence by adopting that same color as its left strip + tile number color. Scoped via `[data-entity="persona"]` so other portraits keep their axis-fixed accents.

2. **Two new editorial sections.** Personas already carry `## Postura` and `## Anti-padrões` headings in their authored markdown. The portrait extracts them into:
   - **POSTURA** — flowing prose, paragraphs preserved. The most distinctive editorial layer a persona has.
   - **ANTI-PADRÕES** — a deliberately austere bullet list, marker `·` in the persona's accent color. The "what I deliberately don't do" texture is part of a persona's identity; bullet form makes it scannable and memorable.

## Other anatomical notes

- Lede is the first paragraph of authored content (no diagnosis-extraction heuristic — personas open with self-statements).
- Tiles cap at 2: conversations through this voice + recency. No "tempo desde início" — personas are voices, not events with biographies.
- "ONDE ELA APARECE" surfaces journeys (queried via `_persona` + `_journey` meta on assistant entries) and scenes (via `scene_personas` junction).
- Conversations queried via `_persona` meta on assistant entries — same signal `/me`'s persona-most-active stat reads.
- Close picks the last short sentence of `## Postura` (the most committed self-statements live there). Falls back to last sentence of lede when posture is absent.
- Empty-state (`portrait.noConversationsYetPersona`): "Esta voz ainda não falou. Vive como configuração, esperando ser ativada."

## URL migration

Conservative — the legacy `/map/persona/<key>` workshop URL is preserved. The new `/personas/<key>/{editar,edit}` aliases redirect there. This means:
- Internal links to `/map/persona/<key>` keep working.
- The footer "editar esta persona" link in the portrait points at the locale-aware `/personas/<key>/editar` (or `/edit`), which 302s to the legacy URL transparently.
- The persona form itself (`/map/persona/<key>` POST) is untouched; save still redirects back to `/map/persona/<key>` (workshop) rather than the portrait. Could be flipped to redirect to portrait in a follow-up if desired.

## Tests

`tests/persona-portrait.test.ts` (10 tests):

- `parsePersonaContent`: extracts lede + posture paragraphs + anti-pattern lines from full markdown; nulls when content empty; handles content without sections; matches English heading variants (Posture / Anti-patterns).
- `composePersonaPortrait` integration: builds full portrait with sections + color + where-it-appears + tiles + conversations.
- Renders cleanly when persona has no sections beyond a one-liner (lede only, no posture/antipatterns/tiles).
- Color falls back to hash-derived when `identity.color` is null.
- Route smoke: `/personas/marido` returns 200 with portrait HTML; unknown key returns 404; `/personas/marido/edit` redirects to `/map/persona/marido`.

Suite: 1182/1182 (was 1172; +10).
