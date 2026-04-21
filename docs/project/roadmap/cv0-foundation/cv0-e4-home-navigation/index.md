[< Roadmap](../../index.md)

# CV0.E4 — Home & Navigation

> **Goal:** the logged-in user has a **home** — a surface that answers *where is the mirror right now?* before dropping into chat. Not another workspace, not another admin page: a quiet landing with greeting, latest release, and continuity with past conversations. Sidebar pruning is a second-order effect once the home is stable.

## Problem

The app today has no landing after login. The `/login` POST redirects straight to `/mirror` (chat), and the sidebar carries 11+ links for admins. Two symptoms of the same root: there is no single place that tells the user *where the mirror is* — no news when a release ships, no bridge between the continuous life of the system and the person who just showed up.

## Stories

| Code | Story | Description |
|------|-------|-------------|
| [`CV0.E4.S1`](cv0-e4-s1-landing-home/) | **Landing home** ✅ | New authenticated route `/` with greeting, *State of the mirror* band (admin-only), *Latest from the mirror* (release digest), and *Continue* (active session + up to 3 earlier threads). Login POST redirects here instead of `/mirror`. |
| `CV0.E4.S2` | **Sidebar pruning** | Second-order cleanup once the home is in daily use: fewer top-level links, admin sub-nav consolidated, redundant entry points that the home absorbs (Journeys, Organizations as cards on home) removed from the sidebar. Scope and ordering decided after S1 runs for a week. |

## Ordering rationale

**S1 first** — the home must exist before navigation can be reduced around it. Shipping the landing alone and living with it for a bit reveals which sidebar links still earn their place.
