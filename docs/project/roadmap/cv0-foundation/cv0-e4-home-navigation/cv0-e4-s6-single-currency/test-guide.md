[< Story](index.md)

# Test Guide — CV0.E4.S6

## Automated

```bash
cd ~/Code/mirror-mind
npm test
```

Expected: **337 tests passing**. The existing "GET /me shows the admin role badge" test is updated to assert the radio shape (`type="radio"`, label text "USD — $" and "BRL — R$") instead of the old checkbox.

## Manual acceptance

```bash
cd ~/Code/mirror-mind
npm run dev
```

### Admin flow

1. Log in as admin; navigate to `/me`.
2. Preferences band shows:
   - Title "Preferred currency for cost display"
   - Two radios: **USD — $** and **BRL — R$**
   - The currently-selected radio matches `users.show_brl_conversion` (1 = BRL).
3. Click the unselected radio. Page submits and reloads with the new choice selected and a "Preference updated" flash.
4. Navigate to `/admin/budget`. Every cost cell (credit remaining, cap, lifetime, month total, burn rate, the three breakdown tables) now renders in the selected currency only. No `$X · R$Y` anywhere.
5. Toggle preference back and refresh — all numbers re-render in the other currency.
6. Navigate to `/` (home). The "State of the mirror" admin band renders credit in the selected currency.
7. Navigate to `/conversation`. Context Rail cost line (admin only) renders in the selected currency.

### Regressions to rule out

- Non-admins still see no cost anywhere (Rail hides it, home band hidden, `/admin/budget` is admin-guarded).
- `/me` for non-admins still shows the empty-state paragraph ("No preferences to set yet").
- Exchange-rate editing on `/admin/budget` still works.
- Existing session flows (Begin again, Forget, streaming) work at `/conversation`.
