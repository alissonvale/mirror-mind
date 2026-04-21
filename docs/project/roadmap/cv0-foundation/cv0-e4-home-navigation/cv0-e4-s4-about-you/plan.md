[< Story](index.md)

# CV0.E4.S4 — About You

## Context

CV0.E4.S3 promoted the Psyche Map to a first-class sidebar link under "Who Am I." That left the avatar at the top of the sidebar without a clear destination — it had pointed to `/map`, but now the nav carries that link explicitly.

The product-designer conversation that followed framed the distinction cleanly:

- **Psyche Map (`/map`)** is the *structural* you — soul, ego layers, personas. Editable, philosophical.
- **About You (`/me`)** is the *operational* you — name, preferences, stats, data. Clerical, direct.

Clicking the avatar now opens the clerical surface. Clicking the explicit nav link under "Who Am I" opens the structural surface. Each surface has one reason to exist.

## Bands

1. **Header** — avatar circle, name (inline-editable), `Member since <date>`, role badge for admins. Migrates the name-edit UI that used to live inline on `/map`.

2. **Preferences** — admin only today. The BRL-cost toggle (which used to live on `/admin/budget`) moves here; it is a personal preference, not an admin operation. Non-admins see an empty-state paragraph acknowledging more settings will land over time (language, timezone, theme).

3. **How the mirror sees you** — four stats from the user's own data, computed in `server/me-stats.ts`:
   - `sessionsTotal` — COUNT of sessions
   - `messagesTotal` — COUNT of entries joined on the user's sessions where type='message'
   - `favoritePersona` — most frequent `_persona` across assistant messages (JSON meta parse)
   - `lastActivityAt` — MAX entry timestamp, rendered via `formatRelativeTime`

   Contemplative, not surveillance. Four lines of self-portrait.

4. **Data** — a single row for now: `Export my data — coming with the Memory Map (CV1.E6.S6)`. Reserves the surface for future data-sovereignty affordances.

## Files

**New**
- `adapters/web/pages/me.tsx` — `MePage` component
- `server/me-stats.ts` — `getMeStats(db, userId)` returning `MeStats`

**Modified**
- `adapters/web/index.tsx` — new routes `GET /me`, `POST /me/name`, `POST /me/show-brl`. Removes `POST /map/name` and `POST /admin/budget/show-brl`. Removes `editingName`/`nameError` plumbing from `renderMap` and `handleDashboard`.
- `adapters/web/pages/layout.tsx` — avatar `href` from `/map` to `/me`, tooltip from "Open your Psyche Map" to "About you"
- `adapters/web/pages/map.tsx` — strip the `editingName` form branch from the identity header; remove `editingName` / `nameError` from props
- `adapters/web/pages/admin/budget.tsx` — replace the BRL toggle form with a one-line pointer to `/me`
- `adapters/web/public/style.css` — new `.me-*` classes for the four bands
- `tests/web.test.ts` — new describe block for `/me` (9 assertions); update existing name-edit tests to point at `/me`; remove the old `/admin/budget/show-brl` toggle test (migrated)

## Behaviour notes

- **Admin cannot rename other users from `/me`** — `POST /me/name` always updates the logged-in user. Same scope as the old `POST /map/name`.
- **`/admin/budget/show-brl` endpoint is removed** — only the budget page's form referenced it; that form is gone.
- **`/me/show-brl` returns 403 for non-admins** — non-admin users never see the toggle either way, but the guard is belt-and-suspenders.

## Verification

- `npm test` passes (target: 336+).
- Manual: log in → avatar click lands on `/me`. Edit name inline → redirect with `?saved=Name+updated` flash. Admin toggles BRL preference → Rail and `/admin/budget` reflect the change. Stats band shows sensible numbers after a couple of messages.
