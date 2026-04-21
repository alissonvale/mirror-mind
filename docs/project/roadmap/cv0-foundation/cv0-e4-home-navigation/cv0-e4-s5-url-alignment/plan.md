[< Story](index.md)

# CV0.E4.S5 — URL alignment: `/mirror/*` → `/conversation/*`

## Context

In S3 we renamed the sidebar link from "My Mirror" to **Conversation** to match what the surface actually does (it holds the chat, not the whole mirror). The underlying URL kept the historical name `/mirror`, which had been chosen in v0.5.0 when "My Mirror" was the chosen label for the page.

Auditing all URLs against the current semantic structure surfaced this as the only real tension worth fixing. The URL is the largest label a page has: it appears in bookmarks, browser history, shared links, and the address bar. Keeping `/mirror` while the visible label says *Conversation* forces every user (and every future contributor) to carry a silent glossary.

`/map` vs "Psyche Map" and `/docs` as top-level despite being admin-only were also flagged but judged not worth moving — `/map` has a minimalist economy that survives the mismatch, and `/docs` reserves a URL namespace for the future user-facing manual.

## Rename list

### Route moves

| Before (removed) | After (live) |
|------------------|--------------|
| `web.get("/mirror")` | `web.get("/conversation")` |
| `web.post("/mirror/begin-again")` | `web.post("/conversation/begin-again")` |
| `web.post("/mirror/forget")` | `web.post("/conversation/forget")` |
| `web.get("/mirror/stream")` | `web.get("/conversation/stream")` |

### Legacy redirects (kept for bookmarks)

| Route | Target |
|-------|--------|
| `web.get("/chat")` | `/conversation` (was `/mirror`) |
| `web.get("/mirror")` | `/conversation` (new) |

`/chat` used to redirect to `/mirror`. Both legacy entrypoints now point at the new canonical URL. POST targets are not redirected — form actions are embedded in server-rendered pages, so there are no stale POST bookmarks to preserve.

### Client references updated

| File | What |
|------|------|
| `adapters/web/pages/layout.tsx` | Sidebar `Conversation` `href` |
| `adapters/web/pages/home.tsx` | Continue band Resume link + empty-state CTA |
| `adapters/web/pages/map.tsx` | "open the rail →" link |
| `adapters/web/pages/context-rail.tsx` | Begin again + Forget form actions |
| `adapters/web/public/chat.js` | SSE `fetch` URL |

### Server cleanup

| File | Change |
|------|--------|
| `server/index.tsx` | Removed the now-dead `app.get("/", c.redirect("/mirror"))` fallback — the `/` home route lives inside the web adapter since CV0.E4.S1 and takes precedence. |
| `server/docs.ts` | Comment referencing in-app paths updated from `/mirror` to `/conversation`. |

## Tests

`sed -i '' 's|/mirror|/conversation|g' tests/web.test.ts` — 34 occurrences renamed in one pass. Each test that previously called `app.request("/mirror")` now calls `app.request("/conversation")`; form-action assertions (`action="/mirror/begin-again"`) updated accordingly; redirect-target assertions (`Location: /mirror`) updated.

One test label tidied by hand — `"GET /conversation with valid cookie returns mirror page"` became `"returns the chat page"`.

One new test added — asserts `/mirror` redirects to `/conversation` with 302, so the legacy entrypoint is covered.

No test names or assertions about *historical* paths (release notes, decision logs) touched — those preserve the name the URL had when each story shipped.

## Verification

- `npm test` passes (target: 337, was 336; +1 for the new legacy redirect test).
- Manual: `/conversation` renders chat; `/mirror` 302s to `/conversation`; `/chat` 302s to `/conversation`; Begin again / Forget / streaming all work; no console errors in chat.js.

## Non-goals (explicitly)

- `/map` stays `/map` despite the `Psyche Map` label. Rationale: minimalist URL, label + URL have different optimization targets.
- `/docs` stays top-level despite being admin-only today. Rationale: reserved namespace for the future user-facing manual (noted in CV0.E3.S3 docs).
- Historical docs and release notes keep `/mirror` references. Renaming history is revisionist.
