[< CV0.E4 — Home & Navigation](../index.md)

# S5 — URL alignment: `/mirror/*` → `/conversation/*`

The route for the chat surface renames from `/mirror` to `/conversation`, matching the sidebar label renamed during S3. The URL is the most persistent "label" in a web app — it appears in bookmarks, history, and the browser address bar — so a mismatch between path and visible label is a quiet, persistent friction.

**Paths that moved:**

| Before | After |
|--------|-------|
| `/mirror` | `/conversation` |
| `/mirror/begin-again` | `/conversation/begin-again` |
| `/mirror/forget` | `/conversation/forget` |
| `/mirror/stream` | `/conversation/stream` |

**Legacy:** `/mirror` (GET) redirects to `/conversation` to preserve bookmarks. `/chat` — which used to redirect to `/mirror` — now short-circuits directly to `/conversation`.

**Derived from:** 2026-04-21 URL audit conversation with the `product-designer` persona. Three semantic tensions were surfaced; only the `/mirror` vs *Conversation* label mismatch warranted action. `/map` vs *Psyche Map* and `/docs` scope were left intentionally untouched.

- [Plan](plan.md) — rename list, references updated, legacy redirect strategy
- [Test guide](test-guide.md) — automated + manual acceptance

## Done criteria

1. `GET /conversation` renders the chat page (was `GET /mirror`).
2. `POST /conversation/begin-again` and `POST /conversation/forget` work identically to their old `/mirror/*` counterparts.
3. `GET /conversation/stream` serves the SSE response.
4. `GET /mirror` and `GET /chat` both redirect to `/conversation` with 302.
5. All client-side references updated: sidebar link, home page (Continue band, empty-state CTA), map page ("open the rail" link), context-rail forms (begin-again, forget), `public/chat.js` SSE fetch.
6. Tests migrated: all `app.request("/mirror")` calls become `/conversation`; a new test asserts the `/mirror → /conversation` legacy redirect.
7. `npm test` green.
