[< Docs](../../../../../index.md)

# Plan: CV0.E2.S4 — Sidebar navigation

**Roadmap:** [CV0.E2.S4](../../../index.md)

## Goal

Replace the top nav bar with a fixed sidebar. Clear hierarchy: Chat as main action, Admin as section, Logout at the bottom. Mobile-friendly with hamburger toggle.

## Structure

```
┌─────────────┬──────────────────────────┐
│ Mirror Mind │                          │
│             │                          │
│ Chat        │    [page content]        │
│             │                          │
│ ── Admin ── │                          │
│ Users       │                          │
│             │                          │
│ ── ── ── ──│                          │
│ Logout      │                          │
└─────────────┴──────────────────────────┘
```

## Deliverables

- `adapters/web/pages/layout.tsx` — sidebar markup replacing top nav
- `adapters/web/public/style.css` — sidebar styles, flex layout, mobile responsive
- `adapters/web/pages/login.tsx` — `login-body` class to opt out of sidebar layout

## Design decisions

- Sidebar is 200px fixed on desktop, slides off-screen on mobile
- Login page has its own body class (`login-body`) to override the flex layout
- Hamburger toggle uses inline onclick (no separate JS needed)
- Sidebar sections use small uppercase labels ("Admin")

---

**See also:** [Test Guide](test-guide.md)
