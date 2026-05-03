[< CV1.E12](../)

# CV1.E12.S2 — Living synthesis (glance + pulse + depth)

**Status:** ✅ Done (2026-05-03)

## Problem

S1 ships an empty `/espelho` shell. The page exists, the chrome points to it, but it doesn't yet *do* anything. S2 fills the body with the actual mirror — the synthesized self-portrait that answers *"who am I, where am I operating, what have I lived?"* in a single page that reads top-to-bottom.

The page must support two reading regimes simultaneously:

- **Glance** — a 2-second read for the user passing through (most visits).
- **Linger** — a slower read with the three depth panes for when they actually stop.

If we get the glance right but the depth feels like a dashboard, we lost the metaphor. If we get the depth right but the glance forces a long read, the page won't sustain the corridor-mirror regime.

## Fix

A single page in three vertical strata:

```
[GLANCE] — 2-second read above the fold
  one synthesized sentence describing present state
  3-4 compact pulse signals (frequency, focused journey,
  active voice, scene count — to be calibrated)

[PULSE: what shifted] — small textual markers since last visit
  • new memory extracted yesterday
  • cena X reopened
  • soul layer touched 2 days ago
  (no numeric badges, no "X new" counters)

[DEPTH] — three panes, each one paragraph + drill-down link
  Sou       synthesis from cognitive layers          → /map
  Estou     synthesis from territory state           → /territorio
  Vivo      thematic synthesis of recent record      → /memorias
```

### Update model (decision (c))

- **Sou** — recomputes only when underlying psyche layers (self/ego/persona) change. Cheap to skip; layers change rarely.
- **Estou** — recomputes every visit. Territory shifts in days/weeks; freshness matters.
- **Vivo** — recomputes every visit. Recent record changes daily.

Implementation likely uses a `mirror_synthesis` cache keyed by `(user_id, layer_signature)` for Sou, and direct queries for Estou + Vivo.

### Synthesis style — template-based, NOT LLM (in S2)

Start with deterministic templates that pull from current state:

- **Sou** — soul orientation + dominant frequency + active voice tendency, joined into one sentence. *"Estás voltado para X, em frequência Y, falando hoje pela voz Z."* Source: `setIdentityLayer` content + recent voice usage.
- **Estou** — current active travessias + dominant org of the week + cenas opened recently. *"Atravessas X e Y; operas em Z; W cenas vivas."*
- **Vivo** — recurring threads from extracted memórias + recent session scenes. *"Esta semana voltaste ao tema X, abriste a cena Y, encerraste Z."*

LLM-driven prose is a follow-on (post-S3 or a separate epic) once we know what the templated baseline is missing.

### "What shifted since last visit"

Track `users.last_mirror_visit` (timestamp). On each `/espelho` GET, compute the diff between that timestamp and now across:

- New memórias extracted (count + title of most recent)
- Cenas opened/edited
- Layers touched
- New travessias or orgs

Render as 1-3 short text bullets above the depth section. Update `last_mirror_visit` *after* rendering, so the user sees the diff exactly once per "session of glances" (debounce by N minutes to avoid the diff vanishing on a quick page reload).

### Voice, tense, format

- Active voice, present tense throughout. *"Sou"*, *"Estou"*, *"Vivo"*.
- No timestamps visible to the user. No "atualizado há 2h".
- No numeric badges (no "12 memórias", no "3 cenas vivas as a count").
- Pane drill-down links are minimal text: *"→ território"*, no chevrons, no buttons.

## What ships

### Routes

- `GET /espelho` — replaces the placeholder body from S1 with the full synthesis.

### Pages

- `adapters/web/pages/espelho.tsx` — modified:
  - `EspelhoGlance` component (sentence + 3-4 pulse signals)
  - `EspelhoPulse` component ("what shifted since last visit" markers)
  - `EspelhoDepth` with three panes (`SouPane`, `EstouPane`, `VivoPane`)

### Synthesis

- `server/mirror/synthesis.ts` — new module:
  - `composeSouSynthesis(db, userId)` — pulls layer state, returns text + pulse signals
  - `composeEstouSynthesis(db, userId)` — pulls territory state
  - `composeVivoSynthesis(db, userId, since?)` — pulls recent record
  - `computeShifts(db, userId, since)` — diffs since `last_mirror_visit`

### DB

- Migration: add `users.last_mirror_visit` (TEXT, ISO8601, nullable)
- Optional: `mirror_synthesis_cache` table for Sou-only caching (skip if cost-of-compute is negligible at this scale)

### i18n

- `espelho.glance.template.*` — phrasings for the glance line
- `espelho.depth.sou.heading`, `espelho.depth.estou.heading`, `espelho.depth.vivo.heading`
- `espelho.depth.linkTo.*` — drill-down link text
- `espelho.shifts.heading` (or no heading at all — TBD during build)
- Empty-state strings for each pane when state is too thin to synthesize

## Test plan

`tests/espelho-synthesis.test.ts`:

- Each synthesis function returns coherent text given known inputs.
- Empty state for each pane (no scenes / no layers / no record) renders sensible fallback, not a broken sentence.
- `computeShifts` returns correct diff for known timestamps.

`tests/espelho-routes.test.ts`:

- `GET /espelho` includes glance, pulse, and depth sections.
- Depth panes link to `/map`, `/territorio`, `/memorias`.
- `last_mirror_visit` is updated on visit (with debounce verified).
- Active voice in the rendered text (no "Quem sou hoje" or timestamp strings).

## Done criteria

- The user opens `/espelho`, reads the glance line in under 3 seconds, recognizes themselves.
- Scrolling reveals three coherent paragraphs corresponding to Sou / Estou / Vivo.
- "What shifted" surfaces meaningful textual markers when something has changed since last visit; nothing renders when nothing shifted.
- All tests passing.

## Out of scope (deferred)

- LLM-generated prose for the panes.
- Visualization of the territory pane as a constellation/cluster.
- Personalized templates per user — everyone gets the same template structure for now.
