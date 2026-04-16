[< Docs](../../index.md)

# Test Guide: CV0.E2.S4 — Sidebar navigation

**Plan:** [Plan](plan.md)

## Manual verification

### 1. Login page

Open `/login`. Expect: centered form, no sidebar visible, no layout break.

### 2. Login → Chat

Enter token and submit. Expect: redirect to `/chat` with sidebar on the left.

### 3. Sidebar structure

On `/chat`, verify the sidebar has:
- "Mirror Mind" brand at the top
- "Chat" link
- "Admin" section label
- "Users" link (indented)
- "Logout" button at the bottom

### 4. Navigation

- Click "Users" → `/admin/users` loads, sidebar stays
- Click "Edit" on a user → profile page loads, sidebar stays
- Click "Chat" → back to chat, sidebar stays
- Click "Logout" → redirects to `/login`, no sidebar

### 5. Mobile (responsive)

Resize browser to < 768px width:
- Sidebar should be hidden
- Hamburger button (☰) appears top-left
- Click hamburger → sidebar slides in
- Click hamburger again → sidebar slides out

---

**See also:** [Plan](plan.md)
