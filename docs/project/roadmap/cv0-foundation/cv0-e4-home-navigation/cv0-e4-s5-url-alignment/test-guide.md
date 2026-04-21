[< Story](index.md)

# Test Guide — CV0.E4.S5

## Automated

```bash
cd ~/Code/mirror-mind
npm test
```

Expected: **337 tests passing** (was 336, +1 new test for the `/mirror` → `/conversation` legacy redirect). 34 assertions that previously referenced `/mirror` now reference `/conversation`; zero regressions.

## Manual acceptance

```bash
cd ~/Code/mirror-mind
npm run dev
```

### Canonical URL

1. Log in → land at `/`.
2. Sidebar: click **Conversation** → URL bar shows `/conversation`, chat page renders.
3. In chat: send a message, the stream works. Click **Begin again** → page reloads at `/conversation` with a fresh session. Click **Forget this conversation** → same route, session cleared.

### Legacy redirects

1. Paste `https://<host>/mirror` in the address bar → 302 to `/conversation`.
2. Paste `https://<host>/chat` → 302 to `/conversation`.

### All chat entry points land correctly

Start from each of these and confirm the chat page renders:

- Sidebar `Conversation` link
- Home page `Continue → Resume` button
- Home page empty-state CTA ("Your first conversation starts here →")
- `/map` memory column "open the rail →" link
- Direct `/conversation` URL

### Regressions to rule out

- Context Rail's Begin again and Forget buttons still work (form actions moved to `/conversation/*`).
- SSE streaming works — check the browser network tab for `/conversation/stream?text=…`.
- No broken links anywhere that used to point at `/mirror`.
- `/admin/*` surfaces unaffected.
