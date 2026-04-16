[< Docs](../../index.md)

# Plan: CV0.E1.S5 — Web UI (retroactive)

**Roadmap:** [CV0.E1.S5](../../project/roadmap.md)
**Date:** 13 April 2026 (documented retroactively)

## Goal

Chat with the mirror from a browser with real-time streaming, plus an admin interface for managing users and identity layers. Served from the same hono server — no separate frontend build.

## Deliverables

- **Login** — token input, sets HTTP-only cookie, redirects to /chat
- **Chat** — server-rendered page with message history, client-side JS for SSE streaming
- **Admin** — user list + create, identity view + edit per user
- **Layout** — shared HTML shell with nav
- **Static files** — CSS + chat.js served via @hono/node-server/serve-static

## Architecture decisions

- **Hono JSX** for server-side rendering — no React, no build step
- **Cookie auth** for web routes, bearer token for API — coexist on the same server
- **SSE** for real-time streaming via `GET /chat/stream`
- **index.ts renamed to index.tsx** for JSX support
- **tsconfig** updated with `jsx: "react-jsx"`, `jsxImportSource: "hono/jsx"`

## Note

This story was later continued by CV0.E2 (Web Experience), which refined the admin UI, moved web code to `adapters/web/`, added sidebar navigation, and will add tests.

---

**See also:** [Test Guide](test-guide.md) · [CV0.E2 — Web Experience](../../cv0-e2/tracer-bullet.md)
