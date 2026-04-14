[< Docs](../../index.md)

# Plan: CV0.E1.S5 — Web UI (chat + admin)

**Roadmap:** [CV0.E1.S5](../../project/roadmap.md)
**Design:** [CV0.E1 — Tracer Bullet](../tracer-bullet.md)

## Goal

Chat with the mirror from a browser with real-time streaming, plus an admin interface for managing users and identity layers. Served from the same hono server — no separate frontend build.

---

## Architecture

### Streaming
`GET /chat/stream?text=...` returns an SSE stream. Tokens appear as they're generated. The existing `POST /message` (non-streaming) stays unchanged for CLI and other clients.

### Web auth
- `GET /login` — renders login form with token input
- `POST /login` — validates token, sets HTTP-only cookie, redirects to /chat
- `POST /logout` — clears cookie
- `webAuthMiddleware` — checks cookie, redirects to /login if invalid

API routes keep using bearer token header. Web routes use cookie.

### Rendering
Hono JSX server-rendered pages. Vanilla client-side JS for chat interactivity. Static files (CSS, chat.js) via `@hono/node-server/serve-static`.

---

## Deliverables

- `server/web/layout.tsx` — shared HTML layout with nav
- `server/web/login.tsx` — login page
- `server/web/chat.tsx` — chat page (server-rendered history + client-side SSE)
- `server/web/admin/users.tsx` — user list + create form
- `server/web/admin/identity.tsx` — view/edit identity layers
- `server/web/auth.ts` — cookie-based auth middleware
- `server/public/style.css` — minimal styling
- `server/public/chat.js` — SSE client + DOM manipulation
- `server/index.tsx` — updated with web routes and SSE endpoint
- `tsconfig.json` — updated for JSX (`jsxImportSource: "hono/jsx"`)

---

## Key files

- `server/web/` (new directory)
- `server/public/` (new directory)
- `server/index.tsx` (renamed from .ts for JSX)

---

**See also:** [Test Guide](test-guide.md) · [CV0.E1 — Tracer Bullet](../tracer-bullet.md)
