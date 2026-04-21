[< Story](index.md)

# Test Guide — CV0.E4.S1

Automated and manual acceptance for the landing home.

---

## Automated

```bash
cd ~/Code/mirror-mind
npm test
```

Expected: **329 tests passing** (baseline 311 + 18 new across the four phases).

Key new suites:

- `tests/admin-stats.test.ts` (6) — `getLatestRelease` frontmatter parsing, semver ordering, null-digest fallbacks
- `tests/greeting.test.ts` (4) — morning / afternoon / evening / name verbatim
- `tests/web.test.ts` home block (8) — routing, greeting rendering, latest-release band, Continue band across all session-count states, admin-only State band

## Manual acceptance

A clean run against a fresh DB.

### Setup

```bash
cd ~/Code/mirror-mind
rm -f data/mirror.db            # optional — start from scratch
npm run dev
```

Create one admin and one regular user via the admin CLI:

```bash
npx tsx server/admin.ts user add alisson
npx tsx server/admin.ts user add guest
```

Promote the admin if first-boot auto-promotion didn't pick them:

```bash
npx tsx server/admin.ts user role alisson admin
```

Grab each user's token from the CLI output for login.

### Regular user flow

1. Visit `http://localhost:3000/login`, log in as `guest`.
2. **Land at `/`** — browser shows:
   - Greeting line: `Good [morning|afternoon|evening], guest`
   - No *State of the mirror* band
   - *Latest from the mirror* band with current release version, two-line digest, "Read the full note →" link
   - *Continue* band with an empty-state card: `Your first conversation starts here →`
3. Click the CTA → navigate to `/mirror`. Send one message.
4. Click the Mirror Mind brand or `/` manually → back on home.
   - Continue now shows an **active card** with "Untitled conversation" (or title if generation has landed), `last exchange just now`, a **Resume →** link.
   - No "Earlier threads" section (only one session).
5. In `/mirror`, open the Context Rail and click **Begin again**. Send a new message in the new session.
6. Return to `/` → Continue shows:
   - Active card for the new session.
   - An *Earlier threads* list with one row — the previous session. Title appears once background title-generation lands (may be "Untitled conversation" for a few seconds).
7. Click "Read the full note →" on the release band → renders `/docs/releases/vX.Y.Z` correctly, no raw frontmatter leaking.

### Admin flow

1. Log out, log in as `alisson`.
2. Land at `/` — the admin-only **State of the mirror** band appears above the release card with:
   - **Users**: `N · M active 7d`
   - **Budget**: `$X.XX · ~D days` (both `—` if no usage_log rows or no OpenRouter key configured — that is expected on a fresh install)
   - **Release**: `vX.Y.Z · <date>`
3. Confirm regular sidebar still works: `/mirror`, `/map`, `/organizations`, `/journeys`, `/admin`, `/admin/budget`, `/docs`.

### Regressions to rule out

- `/mirror` still renders chat; the Context Rail still works; sending a message still streams a response.
- `/admin` dashboard cards still populate.
- `/admin/budget` page still renders; burn rate still computes (the shared `computeBurnRate` extraction).
- `/docs/releases/v0.9.0` (any release) renders clean — no `---` horizontal rule from raw frontmatter.
