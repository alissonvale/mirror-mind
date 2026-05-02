[< Story](index.md)

# Test guide — CV1.E11.S6 + S5 final arc

## Pre-conditions

- Latest build deployed; `npm run dev` running.
- Logged in as Alisson.

## Test 1 — Cutover: `/` redirects to `/inicio`

1. Navigate to `http://localhost:3000/` directly (or click the brand logo in any page that links to `/`).
2. **Expected:** browser ends up at `/inicio` (TopBarLayout chrome). Network tab shows a 302 from `/` to `/inicio`.
3. The old sidebar-chrome home page no longer renders anywhere.

**Validates:** S5 redirect.

## Test 2 — Old surfaces still work via direct URL

1. Navigate to `/map`, `/personas`, `/organizations`, `/journeys`, `/conversation`, `/me`.
2. **Expected:** all render with the existing sidebar chrome.

**Validates:** S5 didn't break other routes.

## Test 3 — New user provisioning creates Voz da Alma cena + doctrine

Run in a sandbox (don't pollute prod):

```bash
cd ~/Code/mirror-mind
MIRROR_DB_PATH=/tmp/onboard-test.db npm run admin -- user add testuser
```

Expected console output mentions:
- User created (existing behavior)
- "Voz da Alma cena pre-seeded"
- "self/doctrine seeded from docs/seed/alisson/doctrine.md"

SQL check:
```bash
sqlite3 /tmp/onboard-test.db "SELECT key, voice FROM scenes WHERE user_id = (SELECT id FROM users WHERE name='testuser')"
# Expected: voz-da-alma|alma

sqlite3 /tmp/onboard-test.db "SELECT layer, key, length(content) AS chars FROM identity WHERE user_id = (SELECT id FROM users WHERE name='testuser') AND layer='self'"
# Expected: self|doctrine|<some big number>
```

Cleanup: `rm /tmp/onboard-test.db`

**Validates:** S6 seed.

## Test 4 — Provisioning gracefully handles missing seed file

```bash
mv docs/seed/alisson/doctrine.md /tmp/doctrine.md.backup
MIRROR_DB_PATH=/tmp/onboard-test2.db npm run admin -- user add testuser2
mv /tmp/doctrine.md.backup docs/seed/alisson/doctrine.md
```

Expected: user created without error. Console mentions "doctrine seed file not found, skipping" or similar.

SQL: identity table for testuser2 has no self/doctrine row.

**Validates:** defensive seed read.

## Sign-off

If all 4 pass, the cena pivot epic is closed.
