[< Story](index.md)

# Test Guide — CV0.E4.S2

## Automated

```bash
cd ~/Code/mirror-mind
npm test
```

Expected: **331 tests passing**. Suites touched:
- `tests/web.test.ts` — sidebar assertions updated (Admin Workspace link; no sub-links; no `This Mirror` heading); dashboard assertions updated (five shortcut cards + their `href`s).

## Manual acceptance

### Setup

```bash
cd ~/Code/mirror-mind
npm run dev
```

Make sure you have one admin and one regular user in the DB.

### Admin flow

1. Log in as admin, land at `/`.
2. **Sidebar check:**
   - `Conversation`, `Organizations`, `Journeys` at the top (unchanged).
   - No `This Mirror` section header.
   - `Admin Workspace` link sits above Logout in the footer.
   - Total visible nav entries for admin = 5 (brand, avatar, 3 top links, Admin Workspace, Logout).
3. Click `Admin Workspace` → navigates to `/admin`.
4. **Dashboard check — shortcut cards in the first rows:**
   - **Users** — total + active 7d + `Manage users →`
   - **Budget** — credit remaining USD + days left + `Manage budget →`
   - **Models** — role/model list + `tune →`
   - **OAuth** — `N of 5 configured` + `Configure OAuth →`
   - **Docs** — paragraph + `Open documentation →`
5. **Dashboard check — glance cards below:**
   - Activity, Mirror memory, Latest release (still a shortcut to the release note), System.
6. Click each shortcut link and verify it lands on the correct surface.

### Regular user flow

1. Log in as a non-admin, land at `/`.
2. Sidebar: no `Admin Workspace` link, no admin sub-links.
3. Direct-hit `/admin` in the URL bar → 403.
4. Home bands render normally (greeting, Latest release, Continue) — no regression from S1.

### Regressions to rule out

- `/admin/users`, `/admin/models`, `/admin/oauth`, `/admin/budget`, `/docs` — all render without error when reached from the new shortcut cards.
- `/admin/budget` burn-rate computation still matches the dashboard's Budget card (same `computeBurnRate` function, same window).
- `/` home's admin State band still renders the same three items as before (Users · Budget · Release).
