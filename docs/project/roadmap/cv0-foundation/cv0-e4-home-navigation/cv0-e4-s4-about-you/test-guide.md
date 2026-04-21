[< Story](index.md)

# Test Guide — CV0.E4.S4

## Automated

```bash
cd ~/Code/mirror-mind
npm test
```

Expected: **336 tests passing**. New describe block `web routes — About You (CV0.E4.S4)` with 9 assertions covers: rendering, admin role badge + toggle, non-admin empty preference state, name-update success, name-with-spaces, slash rejection, empty rejection, BRL toggle flip, BRL toggle 403 for non-admins, avatar link redirected to `/me`.

## Manual acceptance

```bash
cd ~/Code/mirror-mind
npm run dev
```

### Regular user flow

1. Log in as a non-admin user. Click the avatar at the top of the sidebar.
2. Land at `/me` — title bar reads "About You".
3. Bands visible:
   - Header with avatar, name, "Member since <date>". No role badge.
   - Preferences — empty-state paragraph ("No preferences to set yet…").
   - How the mirror sees you — four stats, probably zeroes for a fresh user.
   - Data — single row pointing at the future export.
4. Click "edit" next to the name → inline form appears.
5. Change the name and click Save → redirect with green "Name updated" flash. Sidebar reflects the new name.
6. Try a slash in the name → form re-renders with "cannot contain slashes" error.

### Admin flow

1. Log in as an admin. Click the avatar.
2. Header shows the `admin` badge.
3. Preferences band shows the `Show cost in BRL alongside USD` checkbox. Toggle it — page redirects with a "Preference updated" flash; the new value is reflected on `/admin/budget` and on the Context Rail.
4. Navigate to `/admin/budget` — no more BRL toggle form; instead a short line says "BRL display is a personal preference — set it on About You" (link to `/me`).

### Regressions to rule out

- `/map` no longer shows the name-edit affordance (neither the `edit` link nor the inline form). Name editing is only on `/me`.
- Psyche Map link under "Who Am I" still works.
- Avatar at the top of the sidebar links to `/me` (was `/map`).
- `/admin/budget/show-brl` endpoint no longer exists (404 if accessed directly — not a regression, the migration removed it).
