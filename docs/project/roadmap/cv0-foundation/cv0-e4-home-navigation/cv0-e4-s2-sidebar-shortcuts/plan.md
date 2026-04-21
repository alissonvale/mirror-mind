[< Story](index.md)

# CV0.E4.S2 — Sidebar pruning + admin shortcuts

## Context

S1 landed the home at `/` with a new top-level entry that telegraphs *where the mirror is*. Once the home existed, the sidebar's duplication — "This Mirror" section with six sub-links — became dead weight: six links navigating to surfaces the admin rarely needs more than once per session. S2 consolidates those six links into a single `Admin Workspace` entry that drops the admin onto `/admin`, and reshapes the dashboard so each admin surface has a **shortcut card** with a direct link.

## Card inventory

| Card | Before | After | Role |
|------|--------|-------|------|
| Users | shortcut | **shortcut** (unchanged) | links to `/admin/users` |
| Cost · 30 days | glance (stale estimate) | **replaced by Budget** | links to `/admin/budget` |
| Models | shortcut | **shortcut** (unchanged) | links to `/admin/models` |
| Activity | glance | glance (unchanged) | — |
| Latest release | shortcut | shortcut (unchanged) | links to `/docs/releases/vX.Y.Z` |
| Mirror memory | glance | glance (unchanged) | — |
| System | glance | glance (unchanged) | — |
| **OAuth** | did not exist | **new shortcut** | links to `/admin/oauth` — `X of 5 configured` |
| **Docs** | did not exist | **new shortcut** | links to `/docs` |

Grid order: shortcuts first (Users, Budget, Models, OAuth, Docs, Latest release), glances after (Activity, Mirror memory, System). The existing `auto-fit minmax(260px, 1fr)` grid naturally wraps; DOM order controls the flow.

## Sidebar change

Before (admin):

```
Mirror Mind
[avatar] alisson
My Mirror
Organizations
Journeys
── This Mirror ──
  Dashboard
  Users
  Models
  OAuth
  Budget
  Docs
Logout
```

After (admin):

```
Mirror Mind
[avatar] alisson
My Mirror
Organizations
Journeys
Admin Workspace
Logout
```

Non-admin sidebar unchanged (was already 5 items).

## Implementation — single phase

1. **Sidebar** — `adapters/web/pages/layout.tsx`: remove the "This Mirror" section and all six sub-links. Add a single `<a href="/admin" class="sidebar-link sidebar-admin-workspace">Admin Workspace</a>` inside `.sidebar-footer` above the existing logout form (admin-only, same role guard as before).
2. **Dashboard route** — `adapters/web/index.tsx :: admin.get("/")`: fetch `keyInfo` + `computeBurnRate` (same as `/admin/budget`) and `listOAuthCredentials(db)` + `getOAuthProviders()`. Pass a `budget: { creditRemainingUsd, daysOfCreditLeft }` and `oauth: { configured, total }` prop to `<AdminDashboardPage>`.
3. **Dashboard page** — `adapters/web/pages/admin-dashboard.tsx`:
   - Replace the `Cost · last 30 days` card with a `Budget` card: metric = `formatUsd(creditRemainingUsd)`, sub = `formatDaysLeft(daysOfCreditLeft) at current burn`, link to `/admin/budget`.
   - Add `OAuth` card: metric = `N of M configured`, sub = "Subscription-backed provider credentials", link to `/admin/oauth`.
   - Add `Docs` card: plain sub paragraph + link to `/docs`.
   - Reorder DOM so shortcuts precede glances.
4. **CSS** — `adapters/web/public/style.css`: add `.sidebar-admin-workspace` rule matching the muted link style used elsewhere in the sidebar.
5. **Cleanup** — remove now-unused `getCostEstimate` and `CostEstimate` from `server/admin-stats.ts` (and the unused `DAY_MS` constant). Drop the `computeSessionStats` import that served it.
6. **Tests** — `tests/web.test.ts`:
   - Update the existing `admin sees the Users link in the sidebar` test to assert on `Admin Workspace` instead (the Users link no longer lives in the sidebar).
   - New test: the admin sidebar no longer carries the old `This Mirror` / `sidebar-link-sub` markup.
   - Update the dashboard assertion block to cover all five shortcut headers (Users / Budget / Models / OAuth / Docs) and each of the five shortcut `href` targets.
   - Replace the `R$ 0,00` assertion in the fresh-DB test with a check for the em-dash fallback (the Budget card renders `—` when no OpenRouter key is configured).

## Files touched

**Modified**
- `adapters/web/pages/layout.tsx`
- `adapters/web/pages/admin-dashboard.tsx`
- `adapters/web/index.tsx`
- `adapters/web/public/style.css`
- `server/admin-stats.ts`
- `tests/web.test.ts`

**New docs**
- `docs/project/roadmap/cv0-foundation/cv0-e4-home-navigation/cv0-e4-s2-sidebar-shortcuts/{index.md, plan.md, test-guide.md}`

## Verification

- `npm test` passes (target: 331+; net add relative to S1).
- Manual: log in as admin → sidebar shows `Admin Workspace` above Logout, no `This Mirror` section. `/admin` shows the five shortcut cards in the first grid rows. Each card's link navigates to the right surface. Log in as non-admin → no admin link in sidebar, `/admin` still 403.
