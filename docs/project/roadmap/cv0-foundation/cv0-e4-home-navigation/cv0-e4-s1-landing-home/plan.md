[< Story](index.md)

# CV0.E4.S1 — Landing Home

## Context

Today there is no landing after login: the login POST redirects straight to `/mirror` (chat). Navigation is sidebar-only — 11+ links for an admin — and nothing tells the user *where the mirror is* right now: no news, no sense of rhythm, no bridge between a release shipping and a user noticing.

The user specifically likes the temporal feel of `docs/index.md` — latest release at the top, followed by "where we are" and browsable sections. That same rhythm belongs to the person who logs in.

This story adds a new authenticated route `/` as the landing, with four bands:

1. **Greeting** — "Good morning, Alisson"
2. **State of the mirror** — compact one-line band (admin only)
3. **Latest from the mirror** — headline + two-line digest of the most recent release
4. **Continue** — active session (with Resume CTA) + up to 3 earlier threads as history

Reducing menus is a declared second-order goal and stays out of scope for this story — it becomes CV0.E4.S2 once the home surface is stable.

## Goal

After login, the user lands at `/`. Non-admins see bands 1/3/4. Admins additionally see band 2. The sidebar remains unchanged in this story.

## Scope

**In scope**
- Route `/` (authenticated) rendering the home page
- Login POST redirects `/mirror` → `/`
- `digest` field added to YAML frontmatter of every release file (`docs/releases/v*.md`), retroactively populated for all 11 existing releases
- YAML frontmatter parsing — first use in the codebase, introduces `gray-matter` dependency
- New DB helper: `listRecentSessionsForUser(db, userId, limit)` returning sessions with `lastActivityAt`
- `getLatestRelease()` extended to return `digest`
- New greeting helper in a shared module
- Web tests for each band, conditional admin rendering, empty states

**Out of scope (parked)**
- Sidebar pruning / nav redesign → **CV0.E4.S2**
- Clickable "earlier threads" that reopen preserved sessions → depends on **CV1.E6.S3** (Memory Map — episodic browse)
- Journey cards band — user wants to rethink this after seeing the home live
- Auto-refresh, realtime, streaming on this page
- Documented convention for authoring future release digests (can come later as a contributor doc)

## Design details

### Greeting
Time-of-day based on server local time: `Good morning` < 12h, `Good afternoon` < 18h, `Good evening` otherwise. `Good morning, Alisson`. No exclamation marks — Quiet Luxury.

### State of the mirror (admin only)
Single row, three items, reusing `.admin-card` typography:

```
Users: 3 · 2 active 7d    Budget: $8.40 · ~42 days    Release: v0.9.0 · Apr 21
```

- **Users**: `getUserStats(db).total` / `activeLast7d`
- **Budget**: `getKeyInfo().limit_remaining` in USD + computed burn days; "—" if unavailable
- **Release**: `latestRelease.version` + `latestRelease.date` (already fetched for band 3)

No drilldown in v1 (existing `/admin` links remain the way to dig in). Band hidden entirely for non-admin users; helpers for admin-only data are not called in that branch.

### Latest from the mirror
```
v0.9.0 — Subscription, reconsidered
<digest line 1>
<digest line 2>

Read the full note →   (links to /docs/releases/v0.9.0)
```

Digest is a two-line narrative in the mirror's voice. Not a changelog bullet. Not a hype summary. A quiet note.

### Continue
Shows the user's most recent session as the **active** card, plus up to 3 **earlier** threads as a compact list.

```
┌── Continue ───────────────────────────────┐
│ <title or "Current conversation">          │
│ last exchange 2h ago                       │
│ [ Resume → ]                               │
├── Earlier threads ────────────────────────┤
│ • Sunday planning             3 days ago  │
│ • Budget reset                 5 days ago │
│ • Preparation for talk       last week    │
└───────────────────────────────────────────┘
```

Earlier threads show title + relative date, **non-clickable** in v1 (Memory Map future). If the title is null (title generation still pending), show "Untitled conversation."

**Empty states**:
- No sessions at all → single CTA card: `Your first conversation starts here →` linking to `/mirror`
- 1 session (only active, no earlier) → "Earlier threads" section omitted entirely
- 2–4 sessions → exactly `total - 1` earlier threads (capped at 3)

## Phases

Each phase ends with passing tests and is independently committable.

### Phase 1 — Release digest infrastructure + retroactive digests

1. Add `gray-matter` to `package.json`
2. Extend `getLatestRelease()` in `server/admin-stats.ts:158` to parse frontmatter via `gray-matter`; return shape gains `digest: string | null`. Fall back gracefully if frontmatter absent.
3. **Propose draft digests for all 11 releases** — I read each release narrative and draft a two-line digest in the mirror's voice. User reviews and approves/edits before any file is written.
4. Once approved, prepend frontmatter block to every release file:
   ```yaml
   ---
   digest: |
     Line one in the mirror's voice.
     Line two carrying the felt significance.
   ---
   ```
5. Unit tests in `tests/admin-stats.test.ts`:
   - `getLatestRelease()` returns digest when frontmatter present
   - `getLatestRelease()` returns `digest: null` when frontmatter absent
   - Picks the highest-semver file regardless of filename order

**Commit**: `feat(releases): add digest frontmatter and retroactive digests`

### Phase 2 — Greeting helper + home route skeleton

1. Create `server/formatters/greeting.ts` exporting `greetingFor(name: string, now?: Date): string`
2. Create `adapters/web/pages/home.tsx` with `HomePage: FC<{ user, latestRelease }>` rendering **greeting + latest release band only** (Continue and State stubs come in phases 3–4)
3. Register `web.get("/", handler)` in `adapters/web/index.tsx` inside the authenticated middleware chain; handler calls `getLatestRelease()` and renders via `c.html(<HomePage ... />)`
4. Change login POST redirect at `adapters/web/index.tsx:219` from `/mirror` to `/`
5. Web tests in `tests/web.test.ts`:
   - `GET /` as authed user → 200, HTML contains greeting and release title
   - `GET /` unauthed → 302 to `/login`
   - Login POST → 302 to `/`

**Commit**: `feat(home): landing route with greeting and latest release band`

### Phase 3 — Continue band

1. Add `listRecentSessionsForUser(db, userId, limit)` to `server/db/sessions.ts` — returns up to `limit` sessions ordered by `created_at DESC`, each enriched with `lastActivityAt` (max `entries.created_at` for that session, fallback to `session.created_at`)
2. Extend home handler to call `listRecentSessionsForUser(db, userId, 4)` (1 active + 3 earlier)
3. Extend `HomePage` to render the Continue band with empty-state logic described above
4. Reuse existing `formatRelativeTime` at `adapters/web/index.tsx:251` — extract to `server/formatters/relative-time.ts` so home and chat share it (small refactor, 1 call site to update)
5. Web tests:
   - User with 0 sessions → empty-state CTA rendered
   - User with 1 session → active card, no earlier threads section
   - User with 5 sessions → active + exactly 3 earlier threads
   - Null title → shown as "Untitled conversation"

**Commit**: `feat(home): continue band with active session and earlier threads`

### Phase 4 — State of the mirror band (admin only)

1. In home handler, branch on `user.role === "admin"`: fetch `getUserStats(db)`, `getKeyInfo()`, and reuse the already-loaded `latestRelease`. Compute burn-days inline using the same logic already at `adapters/web/index.tsx:1474-1488` (extract `computeBurnRate` to `server/billing/burn-rate.ts` so it is testable and reusable — 1 call site to update)
2. Render `.home-state-band` above band 3. Non-admin gets no band, no extra fetches.
3. Add CSS class `.home-state-band` to `adapters/web/public/style.css` — horizontal row, three items, same typography scale as `.admin-card-sub`
4. Web tests:
   - Admin user sees band with correct values
   - Non-admin user does not see band at all (and data helpers are not invoked — assertion via spy or via absence of DOM markers)

**Commit**: `feat(home): state of the mirror band for admin`

### Phase 5 — Docs + test guide + worklog

1. Create epic folder `docs/project/roadmap/cv0-foundation/cv0-e4-home-navigation/` with:
   - `index.md` — epic overview, lists S1 ✅ and S2 (sidebar pruning) queued
2. Create story folder `cv0-e4-s1-landing-home/` with:
   - `index.md` — story summary
   - `plan.md` — copy of this plan
   - `test-guide.md` — full manual acceptance walk-through
   - `refactoring.md` — what was extracted (`formatRelativeTime`, `computeBurnRate`), what was parked
3. Update `docs/project/roadmap/index.md` — add CV0.E4 section after CV0.E3
4. Update `docs/index.md` — add CV0.E4 link under "Project / Active right now"
5. Update `docs/process/worklog.md` with CV0.E4.S1 completion entry

**Commit**: `docs(cv0-e4): epic and s1 landing home documentation`

## Critical files

### Modified
| File | Change |
|------|--------|
| `server/admin-stats.ts:158` | `getLatestRelease()` parses frontmatter via `gray-matter`, adds `digest` |
| `server/db/sessions.ts:30` | Adds `listRecentSessionsForUser` |
| `adapters/web/index.tsx:219` | Login redirect → `/` |
| `adapters/web/index.tsx` (new block) | `web.get("/", handler)` |
| `adapters/web/public/style.css` | `.home-state-band` + home classes |
| `docs/releases/v*.md` (11 files) | Frontmatter with `digest` |
| `package.json` | Adds `gray-matter` |

### New
| File | Purpose |
|------|---------|
| `adapters/web/pages/home.tsx` | `HomePage` component |
| `server/formatters/greeting.ts` | `greetingFor(name, now?)` |
| `server/formatters/relative-time.ts` | Extracted from `index.tsx:251` |
| `server/billing/burn-rate.ts` | Extracted from `index.tsx:1474-1488` |
| Story + epic docs | See Phase 5 |

### Reused (no duplication)
- `server/admin-stats.ts` — `getUserStats`, `getLatestRelease`
- `server/openrouter-billing.ts` — `getKeyInfo`
- `server/db/usage-log.ts` — `getUsageByDay` for burn rate
- `adapters/web/auth.ts` — `webAuthMiddleware`
- `adapters/web/pages/layout.tsx` — `Layout` wrapper
- `adapters/web/public/style.css` — `.admin-card*` classes

## Verification

After each phase, `npm test` must pass (currently 311 tests; each phase adds ~3–6).

### Manual acceptance (after Phase 4, before Phase 5 docs wrap)
1. Clean DB, seed one admin and one regular user
2. Log in as **regular user** → lands at `/`
   - Greeting reads "Good [time], \<name\>"
   - No admin state band visible
   - Latest release band shows v0.9.0 title + digest + "Read the full note →"
   - Continue shows empty-state CTA (no sessions yet)
3. Click through to `/mirror`, send one message, return to `/`
   - Continue shows the current session with last-activity time and Resume button
   - No "Earlier threads" section yet (only 1 session)
4. In chat, click **Begin again**, send another message, return to `/`
   - Continue shows the new session as active
   - Earlier threads section shows the previous session with its generated title (or "Untitled conversation" if title generation still pending)
5. Log in as **admin** user → State of the mirror band visible above latest release; values match expectations
6. Click "Read the full note →" → renders `/docs/releases/v0.9.0` correctly
7. Existing flows unchanged: `/mirror` chat works, `/admin` dashboard works, sidebar links all work

### Smoke test
- Run `npm run dev` locally; `/`, `/mirror`, `/admin`, `/map`, `/journeys`, `/organizations`, `/docs/releases/v0.9.0` all render without errors
- Existing 311 tests still pass
