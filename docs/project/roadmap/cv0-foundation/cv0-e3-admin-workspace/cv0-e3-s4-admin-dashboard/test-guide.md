[< Story](index.md)

# Test Guide: CV0.E3.S4 — Admin landing dashboard

## Automated

```bash
npx vitest run
```

New coverage in `tests/web.test.ts`:

- Regular user gets **403 on `/admin`**.
- Admin GET `/admin` renders all six card headers (Users, Cost · last 30 days, Activity, Latest release, Mirror memory, System).
- Dashboard survives a fresh DB with no sessions — cost shows R$ 0,00, activity shows 0 sessions today without crashing.

Total: **135 passing**.

## Manual (browser)

### Dashboard render

1. Log in as admin. Sidebar → This Mirror → **Dashboard**.
2. Six cards render in a grid:
   - **Users** — total count, active in last 7 days, link to manage.
   - **Cost · last 30 days** — BRL total with "estimated" badge and a caveat note explaining the Rail-based approximation.
   - **Activity** — sessions today and this week.
   - **Latest release** — version headline + date + link to the release notes page (opens the release inside the docs reader).
   - **Mirror memory** — total identity layers across all users with breakdown by layer.
   - **System** — uptime, DB size, Node version.

### Drill-downs

- Users card → **Manage users** → `/admin/users`.
- Latest release → **Read the notes** → `/docs/releases/v0.5.0` (or whatever the latest is).

### Refreshing

- Dashboard is not live. Reload the page to re-read the numbers.
- After sending messages in `/mirror` and creating a new session via "Begin again", reload `/admin` — cost and activity update accordingly.

### Auth

1. Log in as non-admin. The sidebar has no "This Mirror" group.
2. Hit `/admin` directly — **403 Forbidden**.

### What's deferred (by design)

- **Real usage tracking.** Cost is approximate (Rail's char/4 heuristic). S6 on the radar promises real per-request tracking.
- **Charts / trends.** Cards are text + numbers only. If a trend view proves useful, register a follow-up story.
- **Auto-refresh.** Manual reload only.
