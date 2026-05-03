[< CV1.E12](../)

# CV1.E12.S3 — Inscriptions

**Status:** ⏳ Drafted

## Problem

People stick things to mirrors. Mantras, citations from favorite authors, song lyrics, lines that landed and they don't want to forget. The synthesized state on `/espelho` (S2) is *generated* — it reflects the user back to themselves, but it's not *chosen* by them. Without a place for the user's intentional, hand-pinned voice, the page is missing the gesture that makes a real mirror feel like a mirror.

S3 adds that layer: a small inscription — a phrase the user authored or curated — sits at the top of `/espelho` above the glance, the way a post-it sits taped to glass.

## Fix

A simple data model and a quiet rendering rule.

### Data model

```sql
CREATE TABLE inscriptions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  text        TEXT NOT NULL,
  author      TEXT,                       -- nullable; mantras have no author
  pinned_at   TEXT,                       -- ISO8601; non-null = manual pin
  created_at  TEXT NOT NULL,
  archived_at TEXT,                       -- soft-delete
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_inscriptions_user_active
  ON inscriptions(user_id) WHERE archived_at IS NULL;
```

### Selection logic (decision (c) — daily rotation + manual pin)

On each `/espelho` GET, pick the inscription to render:

```
1. If any active inscription has pinned_at IS NOT NULL → use the most recent pinned.
2. Otherwise, deterministic daily rotation:
     - Compute today's date (user's locale TZ — or UTC if unset).
     - Hash the date + user_id to a stable seed.
     - Pick inscription[ seed % count ] from active inscriptions ordered by created_at.
   Same inscription all day; rotates at user's day boundary.
3. If the user has zero active inscriptions, render nothing (silent space).
```

The "no inscriptions = silence" rule is intentional. No empty-state placeholder, no "you can pin one!" CTA, no nudge. The mirror is fine without an inscription; the gesture is offered, not enforced.

### Rendering on `/espelho`

```
❖ O Espelho

  ┃ "<text>"
  ┃                            — <author?>

  [GLANCE — S2]
  ...
```

- Inscription block sits above the glance, with generous breathing room.
- Typography: serif italic, lighter weight than the rest of the page. Visually parses as *pinned over the surface*, not part of the structural content.
- No header, no caption, no count. The inscription IS — no metadata.
- No edit affordance directly on the inscription itself (would clutter). A small, low-contrast link `inscrições` somewhere in the page footer (or inside the avatar menu under a sub-item) opens the management page.

### Management page (`/espelho/inscricoes`)

A minimal CRUD surface:

- List of active inscriptions (text + author + indicator if pinned + created date).
- Inline "+ adicionar" form: `text` (textarea) + `author` (input, optional) + `Salvar` button.
- Per-row actions: `editar`, `fixar` / `despinar`, `arquivar`.
- Archived band at bottom (collapsed) — restorable.

No tags, no categories, no search. If a user accumulates dozens, that's the price of having dozens — the management page lists them all.

### Internationalization

The inscription `text` and `author` are user-authored content — not translated. The chrome around them (page title, form labels, "fixar" / "arquivar" actions) follows i18n.

## What ships

### Routes

```
GET   /espelho/inscricoes                          — management list
POST  /espelho/inscricoes                          — create
POST  /espelho/inscricoes/:id/edit                 — edit text/author
POST  /espelho/inscricoes/:id/pin                  — pin (sets pinned_at)
POST  /espelho/inscricoes/:id/unpin                — unpin (nulls pinned_at)
POST  /espelho/inscricoes/:id/archive              — soft-delete
POST  /espelho/inscricoes/:id/unarchive            — restore
```

### DB

- Migration: create `inscriptions` table + index.

### Server

- `server/db/inscriptions.ts` — CRUD helpers.
- `server/mirror/inscription-picker.ts` — daily-rotation + pin resolution.

### Pages

- `adapters/web/pages/espelho.tsx` — modified: render inscription block at top.
- `adapters/web/pages/espelho-inscricoes.tsx` — new: management page.

### i18n

- `espelho.inscricoes.title`, `espelho.inscricoes.heading`
- `espelho.inscricoes.add.text.label`, `.author.label`, `.submit`
- `espelho.inscricoes.action.pin`, `.unpin`, `.archive`, `.unarchive`, `.edit`
- `espelho.inscricoes.empty` — list-empty state for the management page (NOT for `/espelho` itself, which renders silently)
- `espelho.inscricoes.archived.heading`

## Test plan

`tests/inscriptions.test.ts`:

- CRUD: create, edit, archive, unarchive, pin, unpin.
- Picker:
  - With one pinned, returns the pinned regardless of date.
  - With no pinned and N active, returns the same inscription on the same date for the same user.
  - With no pinned and N active, can return different inscriptions on different dates (deterministic rotation).
  - With zero active, returns null.

`tests/espelho-routes.test.ts` (extends S2 tests):

- `/espelho` renders the inscription block when one exists.
- `/espelho` renders no inscription block when user has none (no empty placeholder).
- `/espelho/inscricoes` returns 200 with form + list.

## Done criteria

- Alisson adds 3 inscriptions, sees them rotate daily on `/espelho`.
- Alisson pins one ("a frase que está reverberando agora"), sees it appear on every visit until despinada.
- Alisson archives one — disappears from rotation, still recoverable from management page.
- Veronica visits `/espelho` without any inscriptions configured — page renders cleanly with the inscription space silent (not "+ add your first inscription" boilerplate).
- All tests passing.

## Out of scope

- Tags, categories, or context-aware selection (re-introducing algorithm dilutes the *"I chose this"* gesture).
- Multiple inscriptions visible simultaneously on `/espelho`.
- Notifications when a new rotation kicks in.
- Importing inscriptions from external sources (notes apps, files).
- Per-inscription scheduling ("show this one every Tuesday").
