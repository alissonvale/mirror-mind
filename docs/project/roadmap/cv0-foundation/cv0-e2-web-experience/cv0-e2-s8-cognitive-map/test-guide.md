[< Story](index.md)

# Test Guide: CV0.E2.S8 — Cognitive Map

## Automated

```bash
npx vitest run
```

New coverage (24 tests across 5 describe blocks in `tests/web.test.ts`):

- **Dashboard** — `/map` returns 200 with the identity title and all five structural cards; the memory column renders with Attention/Conversations/Insights rows; the self-service name edit affordance is visible; `?editName=1` renders the name form; real session stats appear (`0 sessions` for a fresh user, `1 session · last just now` after `getOrCreateSession`).
- **Layer workshop** — GET `/map/self/soul` renders the editor with current content and a composed preview; GET `/map/unknown/key` returns 404; POST saves via `setIdentityLayer` and redirects to `/map`; POST `/compose` returns JSON with the draft applied and non-overridden layers still present.
- **Persona CRUD via `/map`** — POST `/map/persona` creates and redirects; invalid name pattern rejected; duplicate name rejected without corrupting the existing persona; POST `/map/persona/:key` updates content; POST `/map/persona/:key/delete` removes the layer.
- **Self-service name edit** — POST `/map/name` updates the current user's display name and redirects; names with spaces allowed (regression for the dropped no-whitespace rule); slashes rejected; empty names rejected.
- **Admin modality** — regular user gets 403 on `/map/:name` and on POST `/map/:name/persona`; admin GET `/map/:name` renders the target's map with "viewing as admin" and *without* the edit-name affordance; admin workshop renders target content with target-scoped form actions; admin POST saves on target and redirects to `/map/<target>`; admin persona POST creates on target.

Supporting adjustments to existing tests:
- `tests/db.test.ts` — `getIdentityLayers` ordering test rewritten to assert psychic-depth order (self → ego → persona).
- `tests/identity.test.ts` — `composeSystemPrompt` ordering assertion flipped (self before ego).
- Four admin legacy redirect tests updated to expect `/map/:name` as the target instead of `/admin/users/:name`.
- Context Rail footer-link test updated to expect `href="/map"`.

Total: **121 passing**.

## Manual (browser)

Start dev:

```bash
npm run dev
```

### As yourself (self-modality)

1. Log in with your own token.
2. **Sidebar** shows "Mirror" and "Cognitive Map" links; if admin, also the Admin section.
3. **`/map`** opens the Cognitive Map:
   - Identity strip: avatar (initials + color) + title "Cognitive Map of {your name}" + an edit pill.
   - Five structural cards arranged top-down: **Self** (lavender, full width), two **Ego** cards side-by-side (peach cream), **Personas** (dusty rose, full width) with badges and a `+ add persona` action, **Skills** (pale sage, full width) with a two-tier invitation.
   - **Memory** column on the right (neutral gray) with three rows: Attention → link to the rail, Conversations showing real session count and "last X ago", Insights as a pending label.
4. **Click "edit"** next to your name. The strip swaps for a form. Change your name (spaces allowed, slashes rejected, duplicates of other users rejected with a red flash). Save redirects to `/map` with the new name reflected in the strip and the sidebar.
5. **Click a structural card** (e.g. Self). You land on `/map/self/soul` — the Layer Workshop. Edit the text on the left; the Composed Prompt preview on the right updates live (debounced ~400ms). Save persists and redirects to `/map`; Cancel goes back without saving.
6. **Click a persona badge**. The Personas card switches to inline edit mode with a textarea and Save / Delete / Cancel. The page scrolls to the card via the `#personas-card` anchor, so you don't lose the target below the fold.
7. **Click `+ add persona`**. Same card, now with a name input and textarea. Try creating a duplicate name — a red flash appears; the draft is preserved so you don't lose your writing.

### As admin viewing another user

1. Visit `/map/<someone-else>`. You see their map with:
   - "· viewing as admin · back to mine" next to the title.
   - **No edit affordance on the name** — admins don't rename other users from the map.
   - Same structural cards, but operating on the target's layers.
2. Clicking into any layer → `/map/<name>/:layer/:key` → admin workshop. Save persists to the target and redirects back to `/map/<name>` (not `/map`).
3. Persona CRUD works against the target user; the URLs are `/map/<name>/persona` and `/map/<name>/persona/:key`.
4. Legacy redirects: `/admin/users/:name`, `/admin/identity/:name`, and `/admin/personas/:name` all land on `/map/:name`.

### As a regular (non-admin) user

1. Log in with a non-admin token.
2. **`/map`** works normally — you can edit your own layers, personas, name.
3. **`/map/<any-other-name>`** returns 403 Forbidden.
4. **POST `/map/<any-other-name>/persona`** and equivalent admin-modality writes return 403.

### Composed prompt order (ordering fix)

1. Open `/map/self/soul`.
2. The composed preview on the right should **open with the `self/soul` content**, followed by `ego/identity` and `ego/behavior`. If personas exist, they come last. If the order is inverted (ego first), the psychic-depth SQL order is broken — regression in `server/db/identity.ts`.
