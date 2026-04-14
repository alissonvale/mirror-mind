[< Docs](../../index.md)

# Test Guide: CV0.E1.S5 — Web UI

**Plan:** [Plan](plan.md)

---

## Prerequisites

- Server running (local or production)
- A valid token (from `user add`)

## 1. Login

Open `https://mirror.yourdomain.com/login` (or `http://localhost:3000/login`).

Expect: login page with token input field.

Paste your token and submit.

Expect: redirect to `/chat`.

## 2. Chat with streaming

Type a message and send.

Expect: response appears token by token in real time (not all at once).

## 3. Continuity

Type another message that references the previous one.

Expect: mirror remembers the context.

## 4. Navigate to admin

Click "Users" in the nav.

Expect: list of all users with their creation date and link to edit identity.

## 5. Create a new user

Fill in a name and submit.

Expect: the token is displayed once on the page. Save it.

## 6. Edit identity

Click "Edit" next to a user. Modify any layer and save.

Expect: success message, layer content updated.

## 7. Logout

Click "Logout".

Expect: redirect to /login. Accessing /chat without logging in again redirects to /login.

## 8. Invalid token

Go to /login and submit an invalid token.

Expect: error message, stays on login page.

---

**See also:** [Plan](plan.md) · [Admin CLI Reference](../../design/admin-cli.md)
