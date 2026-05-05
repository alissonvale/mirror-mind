[< CV1.E13](../)

# CV1.E13.S1 — Journey portrait

**Status:** ✅ Done (2026-05-04). Five-round build in one session. Visual smoke against a provisioned tenant pending; structural reproduction of the three reference drafts validated by `tests/journey-portrait-reference-drafts.test.ts`.

> Editorial design source: [`docs/design/entity-profiles.md`](../../../../../design/entity-profiles.md) — three reference drafts (Bia Saturada, Voltar a BH, Pós-Lançamento) are the acceptance criteria.

## Problem

Today `/journeys/<key>` opens a CRUD form. The user has no surface to *re-read* a travessia. Conversations tagged to a journey, scenes anchored to it, the central question it carries, the personas it summons — none of this surfaces in the form. The journey's accumulated story has nowhere to live.

S1 inverts that: `/journeys/<key>` becomes a read view (the *journey portrait*), and the form moves to `/journeys/<key>/editar` (locale-aware: `/edit` for `en`).

## Fix

A new read view assembled from the journey's existing fields plus its accumulated activity, in the user's own first-person voice and locale. Three blocks — **lede** (italic serif, one to four sentences) → **body** (conditional sections that render only when the data is there) → **close** (italic indented line). A discreet "editar esta travessia" link in the footer.

The page is **deterministic marshalling** of the source data plus **two narrow LLM extraction points** (citable line per tagged conversation; lede synthesis only when briefing+situation are too short to land an opening on their own). Both LLM points cached with `source_hash` invalidation.

URL migration handled in this story (no separate S0): the existing `/journeys/<key>` form route renames to `/journeys/<key>/editar` (and `/edit` for `en` tenants). All existing internal links to `/journeys/<key>` keep working — they now land on the portrait, which is the correct default.

## What ships

### Routes

```
GET  /journeys/<key>           — new portrait read view
GET  /journeys/<key>/editar    — existing form (was at /journeys/<key>)
GET  /journeys/<key>/edit      — same form, en locale
POST /journeys/<key>/editar    — existing form submit
```

Locale-aware route handler: middleware resolves `editar` vs `edit` based on `users.locale`. Both paths accepted to keep cross-locale link sharing working.

### Server

- `server/portraits/journey-synthesis.ts` — new module mirroring the shape of `server/mirror/synthesis.ts`. Builds a typed `JourneyPortrait` state object from DB queries:
  - Lede source (briefing-first, situation-fallback, LLM-synthesis as last resort)
  - Numeric tiles (concrete fact, structural anchor, recency or temporal proxy)
  - "Onde ela mora" (org / persona / scene adjacencies + parenthetical for absences)
  - Structural section (regex on situation: enumerated cenários vs continuous frentes; null when neither pattern matches)
  - "A pergunta viva" (extracted from briefing/situation when central question is declared; null otherwise)
  - "Conversas que a moldaram" (chronological list of sessions tagged with this journey, with citable line per session)
  - Close (briefing-first, last-conversation-fallback)
  - Footer (deterministic — start date, status, last-update relative time)
- `server/portraits/conversation-citable-line.ts` — LLM extraction helper. Asks the title-class model: "Pick the single sentence from the assistant turns that best encapsulates this conversation." Returns a string. Called once per (session_id, last_entry_timestamp).
- `server/portraits/lede-synthesis.ts` — LLM synthesis helper. Falls through to it only when both briefing and situation are too short. Returns a 1-3 sentence lede in the user's locale and voice.
- `server/portraits/cache.ts` — new `entity_profile_cache` table. Schema:
  ```sql
  CREATE TABLE entity_profile_cache (
    entity_type TEXT NOT NULL,    -- 'journey' | 'organization' | 'scene'
    entity_id TEXT NOT NULL,
    field_name TEXT NOT NULL,     -- 'citable_line:<session_id>' | 'lede'
    value TEXT NOT NULL,
    source_hash TEXT NOT NULL,    -- hash of source fields the value depends on
    generated_at INTEGER NOT NULL,
    PRIMARY KEY (entity_type, entity_id, field_name)
  );
  ```
  Render flow: compute current `source_hash`; if matches cached, use cached; else call LLM, overwrite, return.

### Pages

- `adapters/web/pages/journey-portrait.tsx` — new TSX component:
  - `JourneyPortraitPage({ portrait, locale })` — top-level
  - Section components: `<PortraitLede>`, `<NumericTiles>`, `<WhereItLives>`, `<StructuralSection>`, `<LiveQuestion>`, `<ConversationsThatShaped>`, `<PortraitClose>`, `<PortraitFooter>`
  - Each section short-circuits to null when its data is empty (per design principle 1)
- `adapters/web/pages/journey-form.tsx` — renamed from `journey-workshop.tsx` if a separate file exists, or extracted from the current `/journeys/<key>` handler. The form itself doesn't change; only its URL does.

### CSS

New stylesheet section under `adapters/web/public/style.css`:
- `.portrait-shell` — single column, max-width 640px, centered
- `.portrait-lede` — EB Garamond italic, ~16pt, generous leading, with a teal left strip (3-4px, color per entity type)
- `.portrait-tiles` — inline-flex row, ~140px per tile, separator dots between
- `.portrait-section` — muted small-caps heading + sans body
- `.portrait-quote` — italic serif with typographic quote characters, indented
- `.portrait-close` — italic serif, centered, indented, generous whitespace
- `.portrait-footer` — small muted text, right-aligned edit link

Reuses typography variables from CV1.E12 (espelho); no new CSS variables introduced.

### i18n keys

```
portrait.editLink              → "editar esta travessia" / "edit this journey"
portrait.whereItLives          → "ONDE ELA MORA" / "WHERE IT LIVES"
portrait.threeScenarios        → "OS TRÊS CENÁRIOS" / "THE THREE SCENARIOS"
portrait.threeLiveFronts       → "AS TRÊS FRENTES VIVAS" / "THREE LIVE FRONTS"
portrait.theLiveQuestion       → "A PERGUNTA VIVA" / "THE LIVE QUESTION"
portrait.conversationsThatShaped → "CONVERSAS QUE A MOLDARAM" / "CONVERSATIONS THAT SHAPED IT"
portrait.noConversationsYet    → empty-state for zero conversations (full italic line)
portrait.noScene               → "(sem cena recorrente — esta travessia não cristalizou em diálogo)" / "(no recurring scene — this journey hasn't crystallized in dialogue)"
portrait.noPersona             → "(sem persona declarada)" / "(no persona declared)"
portrait.noOrg                 → "(sem organização afiliada)" / "(no affiliated organization)"
portrait.startedIn             → "Iniciada em {date}" / "Started in {date}"
portrait.lastUpdate            → "última atualização há {n} {unit}" / "last update {n} {unit} ago"
portrait.silenceFor            → "travessia em silêncio há {n} meses" / "journey silent for {n} months"
```

### Asset cache bumps

- `style.css` query param bumped to `journey-portrait-1`

## Test plan

`tests/journey-portrait.test.ts` — unit tests for `journey-synthesis.ts`:

- Lede source priority: briefing wins over situation; situation wins over LLM-synth; LLM-synth only when both empty
- Numeric tiles: with conversations → tile 3 = recency; without conversations → tile 3 = temporal anchor from situation; without either → tile 3 omitted
- "Onde ela mora": each adjacency type renders/omits independently; parenthetical declares absences
- Structural section: detects `Cenário [A-Z]` pattern → "OS TRÊS CENÁRIOS" label; detects continuous-fronts pattern → "AS TRÊS FRENTES VIVAS" label; absent when neither matches
- "A pergunta viva": detects interrogative + adjacent confessional layer; null when neither present
- "Conversas que a moldaram": empty list → italic two-liner empty-state; non-empty → list with citable line per session
- Close source priority: briefing wins over last-conversation; last-conversation fallback when briefing empty

`tests/journey-portrait-routes.test.ts` — integration tests for the route handler:

- `GET /journeys/<key>` → 200 with portrait HTML (admin user, en locale)
- `GET /journeys/<key>` → 200 with portrait HTML (regular user, pt-BR locale)
- `GET /journeys/<key>/editar` → 200 with form HTML (pt-BR user)
- `GET /journeys/<key>/edit` → 200 with form HTML (en user)
- `GET /journeys/<missing>` → 404
- `POST /journeys/<key>/editar` → 302 redirect to portrait

`tests/entity-profile-cache.test.ts` — unit tests for cache invalidation:

- First render computes `source_hash`, caches value, returns
- Second render with same source: cache hit, no LLM call
- Source field edited → `source_hash` changes → cache miss, regenerates
- Multiple `field_name` entries per `(entity_type, entity_id)` coexist independently

`tests/conversation-citable-line.test.ts` — unit tests for the citable-line extractor:

- Returns a sentence from the assistant content (not the user content)
- Returns null gracefully when assistant content is empty
- Cached by `(session_id, last_entry_timestamp)` — re-extraction only when session has new turn

**Editorial validation (manual):** the three reference drafts in `docs/design/entity-profiles.md` should be reproducible by the system from Antonio Castro's underlying data. Manual smoke: provision Antonio Castro, navigate to `/journeys/bia-saturada`, `/journeys/voltar-a-bh`, `/journeys/pos-lancamento`. Compare rendered output to the reference drafts. **The drafts are the acceptance bar** — variations in tone, wording, or section selection that diverge from the drafts indicate the engine needs adjustment.

## Decisions parked for build round

The design doc enumerates open questions. Those that require concrete decisions during S1 implementation:

1. **Default fecho source** — briefing-first, conversation-fallback. Validate by comparing the reproduced drafts to the reference. If briefing-first feels uniform across the three drafts, ship as-is. If not, expose both fields in the portrait state and decide editorially per render.
2. **Cache schema** — `entity_profile_cache` table sketched above. Confirm column types, indexes, GC strategy on entity-forget before coding.
3. **The "9 meses · da DM pendente" tile fallback** — regex on temporal phrases in the situation field. Specify which phrase wins when multiple candidates exist (most recent? most prominent? first match?). Decision before coding `journey-synthesis.ts`.

## Out of scope (S1 only)

- Organization portrait → S2
- Scene portrait → S3
- Persona portrait → not in this epic
- Caching strategy beyond `source_hash` (e.g., proactive refresh, background regeneration) → future
- A/B testing infrastructure for fecho-source comparison → future
