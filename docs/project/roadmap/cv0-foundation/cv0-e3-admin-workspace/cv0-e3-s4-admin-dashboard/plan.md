[< Story](index.md)

# Plan: CV0.E3.S4 — Admin landing dashboard

**Roadmap:** [CV0.E3.S4](../index.md)
**Framing:** this mirror shows itself to the admin. A landing surface at `/admin` with glance cards for users, cost, activity, release, memory, and system — the operational counterpart to the Cognitive Map.

---

## Goal

A new route `GET /admin` renders a dashboard with a grid of cards. Each card answers one question succinctly and, when relevant, links to a deeper surface. Admin-only (uses the existing `adminOnlyMiddleware`). Server-rendered; no auto-refresh.

## Cards in v1

- **Users** — `N users · M active in last 7 days`. Links to `/admin/users`.
- **Cost this month** — approximate BRL total across all users, broken down per model role (main + reception + title). Based on the Rail's message-length estimation method applied across all sessions. Labeled as estimated. Drill-down link goes to a future cost-detail surface (not in v1; card shows a "detailed breakdown coming with usage tracking" placeholder that resolves when S6 lands).
- **Activity** — `N sessions today · M sessions this week`. Session count, not message count — sessions are the unit that matters to memory. Links to the users page as the closest proxy (no dedicated activity feed yet).
- **Latest release** — headline of the most recent release notes file + its date + link to `/docs/releases/<version>`.
- **Mirror memory** — total identity layers written across all users (self, ego, persona counts). A snapshot of how much the mirror has been shaped. No drill-down — it's a number.
- **System** — server uptime, DB size on disk, Node version. Observational only.

## Non-goals (v1)

- **Real usage tracking.** Cost numbers are approximate. Exact per-request tracking is S6 (radar).
- **Auto-refresh.** Manual reload is fine.
- **Charts / graphs.** Cards are text + numbers + links in v1.
- **Configurable card layout.** The card set is fixed for v1.
- **Cross-mirror comparison.** Single mirror only.

## Decisions

### D1 — Cost is approximate

Today we don't store per-request token counts. Computing exact cost would mean backfilling or deferring the card until S6 lands. Instead, v1 aggregates the Context Rail's existing estimation method (`computeSessionStats`) across all sessions, summed per model role, converted to BRL via `config/models.json` prices. The card label says "estimated" explicitly so the admin knows not to reconcile this against a bank statement.

### D2 — Server-rendered, not live

Each visit re-renders the dashboard from fresh queries. No polling, no WebSocket, no SSE. For an admin-only surface that's checked every few hours at most, live is overkill. Manual refresh carries real information: "I just loaded this, so it's current."

### D3 — Cards are self-contained, drill-downs are optional

A card reads as a complete thought on its own. Drill-down links are present where a deeper surface exists (Users, Release notes) and absent where it doesn't (Mirror memory, System). Cost's drill-down is a placeholder — a link to a future breakdown that S6 will supply, but the card header itself labels it as "coming soon" so the admin isn't confused by a dead link.

### D4 — Sidebar

The existing Admin section in the sidebar gains **Dashboard** as the first sub-item, above **Users** and **Docs**. The main "Admin" section header stays; the dashboard is one entry among several inside admin.

### D5 — Route at `/admin` itself

Today `/admin` has no GET handler — only `/admin/users` and friends. S4 adds `GET /admin` rendering the dashboard. This makes the path hierarchy meaningful: `/admin` is the workspace, `/admin/users`, `/admin/docs` (wait, no, that's `/docs`), `/admin/models`, `/admin/adapters` are the sub-surfaces. Note: `/docs` lives at its own root because it's a read-only surface, not an admin operation per se. That inconsistency is tolerable.

## Steps

1. **Helpers** (`server/admin-stats.ts`):
   - `getUserStats(db)` — total users, active in last 7d (any session with created_at > now - 7d).
   - `getActivityStats(db)` — sessions today + this week.
   - `getMemoryStats(db)` — total identity layers broken by layer (self, ego, persona).
   - `getCostEstimate(db)` — iterate over sessions, call `computeSessionStats` per session, sum `costBrl` per model role, convert to monthly window.
   - `getSystemStats()` — uptime (process.uptime()), DB size (fs.stat on DB path), Node version.
   - `getLatestRelease()` — scan `docs/releases/` for the most recent file, read its first `# heading` and `*date*` line.
2. **Page component** (`adapters/web/pages/admin-dashboard.tsx`): DashboardPage with a grid of cards. Each card receives its data as props.
3. **Route** in `adapters/web/index.tsx`: `admin.get("/", handler)` — the sub-app already has `adminOnlyMiddleware`. Mounts at `/admin`. Reads stats helpers, composes props, renders.
4. **Sidebar link**: "Dashboard" added as the first sub-item under Admin in `adapters/web/pages/layout.tsx`.
5. **CSS**: `.admin-dashboard` grid layout with cards; consistent with the Cognitive Map's card family but neutral (no psyche-depth gradient — it's this mirror's face, not a psyche).
6. **Tests**: non-admin gets 403; admin GET /admin returns 200 with each card title present; the stats helpers return sensible values on a fresh DB (0 counts, no crash).
7. **Docs**: test-guide, worklog, mark ✅.

## Files likely touched

- `server/admin-stats.ts` — new
- `server/db.ts` — re-exports if the helpers depend on existing ones
- `adapters/web/pages/admin-dashboard.tsx` — new
- `adapters/web/index.tsx` — `/admin` route
- `adapters/web/pages/layout.tsx` — sidebar link
- `adapters/web/public/style.css` — dashboard + card styles
- `tests/web.test.ts` — coverage
