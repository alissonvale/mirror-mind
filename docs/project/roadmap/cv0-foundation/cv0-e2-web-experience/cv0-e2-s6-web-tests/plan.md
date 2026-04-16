[< Docs](../../../../../index.md)

# Plan: CV0.E2.S6 — Web route tests

**Roadmap:** [CV0.E2.S6](../../../index.md)

## Goal

Automated test coverage for web routes — login, auth, admin pages. Catch regressions without manual browser testing.

## Approach

Use Hono's `app.request()` to simulate HTTP requests in-process. No real server, no browser, no Playwright. Tests run against a :memory: SQLite database with a test user.

**Pattern:**
```typescript
const { app, db, token } = createTestApp();  // :memory: db + test user
const res = await app.request("/chat", {
  headers: { Cookie: `mirror_token=${token}` },
});
expect(res.status).toBe(200);
```

## Coverage

### Login (5 tests)
- GET /login renders form
- POST /login with valid token → 302 to /chat
- POST /login with invalid token → error message
- POST /login with empty token → error message
- POST /logout → 302 to /login

### Auth (3 tests)
- GET /chat without cookie → 302 to /login
- GET /chat with valid cookie → 200 with chat page
- GET /chat with invalid cookie → 302 to /login

### Admin (5 tests)
- GET /admin/users → 200 with user list
- GET /admin/users/:name → 200 with unified profile showing layers
- GET /admin/users/unknown → 404
- GET /admin/identity/:name → 302 redirect to /admin/users/:name
- GET /admin/personas/:name → 302 redirect to /admin/users/:name

## What's NOT tested

- SSE streaming (/chat/stream) — requires async event handling, out of scope for route tests
- Form submissions that create users — would need template loading, tested via smoke tests
- JavaScript behavior (chat.js) — needs a browser, not in scope

---

**See also:** [Test Guide](test-guide.md)
