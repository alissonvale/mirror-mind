[< Docs](../../index.md)

# Test Guide: CV0.E1.S5 — Web UI (retroactive)

**Plan:** [Plan](plan.md)

## Manual verification

### 1. Login

Open `/login`. Enter token. Expect: redirect to `/chat`.

### 2. Chat with streaming

Type a message and send. Expect: response appears token by token in real time (SSE).

### 3. Context continuity

Send another message referencing the previous one. Expect: mirror remembers.

### 4. Admin — Users

Click "Users" in nav. Expect: list of all users. Create a new user — token displayed once.

### 5. Admin — Identity

Click "Edit" on a user. Expect: identity layers visible and editable.

### 6. Logout

Click "Logout". Expect: redirect to `/login`. Accessing `/chat` without logging in again redirects to `/login`.

### 7. Invalid token

On `/login`, submit an invalid token. Expect: error message, stays on login page.

---

**See also:** [Plan](plan.md)
