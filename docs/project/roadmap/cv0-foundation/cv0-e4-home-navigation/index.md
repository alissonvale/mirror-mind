[< Roadmap](../../index.md)

# CV0.E4 — Home & Navigation

> **Goal:** the logged-in user has a **home** — a surface that answers *where is the mirror right now?* before dropping into chat. Not another workspace, not another admin page: a quiet landing with greeting, latest release, and continuity with past conversations. Sidebar pruning is a second-order effect once the home is stable.

## Problem

The app today has no landing after login. The `/login` POST redirects straight to `/mirror` (chat), and the sidebar carries 11+ links for admins. Two symptoms of the same root: there is no single place that tells the user *where the mirror is* — no news when a release ships, no bridge between the continuous life of the system and the person who just showed up.

## Stories

| Code | Story | Description |
|------|-------|-------------|
| [`CV0.E4.S1`](cv0-e4-s1-landing-home/) | **Landing home** ✅ | New authenticated route `/` with greeting, *State of the mirror* band (admin-only), *Latest from the mirror* (release digest), and *Continue* (active session + up to 3 earlier threads). Login POST redirects here instead of `/mirror`. |
| [`CV0.E4.S2`](cv0-e4-s2-sidebar-shortcuts/) | **Sidebar pruning + admin shortcuts** ✅ | The sidebar's `This Mirror` section and its six sub-links collapse into a single `Admin Workspace` link above Logout. The `/admin` dashboard gains shortcut cards for each admin surface — Users, Budget, Models, OAuth, Docs — turning the dashboard into the navigation hub. Old stale "Cost" card replaced by a real-data Budget card. |

## Ordering rationale

**S1 first** — the home must exist before navigation can be reduced around it. Shipping the landing alone and living with it for a bit reveals which sidebar links still earn their place.
