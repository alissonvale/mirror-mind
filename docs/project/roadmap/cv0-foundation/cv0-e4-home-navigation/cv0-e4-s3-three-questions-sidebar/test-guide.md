[< Story](index.md)

# Test Guide — CV0.E4.S3

## Automated

```bash
cd ~/Code/mirror-mind
npm test
```

Expected: **332 tests passing**. New assertion in `tests/web.test.ts`: sidebar contains the three section headers (`Who Am I`, `What I'm Doing`, `Where I Work`) and a Psyche Map link to `/map`.

## Manual acceptance

```bash
cd ~/Code/mirror-mind
npm run dev
```

1. Log in as any user. Navigate to `/` or `/mirror`.
2. **Sidebar check — regular user:**
   - Brand "Mirror Mind" at the top links to `/` (home).
   - Avatar shows user name, still clicks through to `/map`.
   - First nav link: **Conversation** → `/mirror`.
   - Section header: **Who Am I** — with **Psyche Map** under it → `/map`.
   - Section header: **What I'm Doing** — with **Journeys** under it.
   - Section header: **Where I Work** — with **Organizations** under it.
   - Footer has Logout only.
3. **Sidebar check — admin user:**
   - Same structure as above.
   - Footer has `Admin Workspace` above Logout.
4. Clicking Psyche Map from its new nav link lands at `/map` (page title and heading both read "Psyche Map"); clicking the avatar also lands at `/map`. Both paths work (acceptable duplication).

## Regressions to rule out

- Existing routes still reachable: `/mirror`, `/map`, `/journeys`, `/organizations`, `/admin`.
- Home's State of the mirror band (admin) still renders.
- Home's Continue band still renders across empty / 1-session / many-session states.
