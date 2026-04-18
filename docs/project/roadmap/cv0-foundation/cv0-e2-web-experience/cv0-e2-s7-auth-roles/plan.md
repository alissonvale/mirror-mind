[< Story](index.md)

# Plan: CV0.E2.S7 — I know who's logged in

**Roadmap:** [CV0.E2.S7](../index.md)

---

## Goal

Two complementary visibilities on the web client:

1. **Identity visible** — the sidebar shows the logged-in user with avatar (initials + color) and name, near the logout action.
2. **Authority visible** — the menu adapts to role. Admins see "Users"; regular users don't. Admin-only routes return 403 to non-admins.

## Non-goals

- Dedicated user profile page (that's S8 Memory Workspace territory).
- Custom avatar uploads — initials + deterministic color token, same family used by the rail.
- Per-permission granularity — only two roles: `admin` and `user`. No scopes, no groups.
- Self-service role changes — an admin promoting/demoting happens in code for now; no UI beyond creation.

---

## Decisions

### D1 — Role storage
`users.role` column, `TEXT NOT NULL DEFAULT 'user'`. Added via idempotent `ALTER TABLE` in schema bootstrap. A `CHECK(role IN ('admin','user'))` constraint was considered but dropped: SQLite's `ALTER TABLE ADD COLUMN` can't add CHECK, so fresh installs would have stricter validation than upgraded ones. Uniform enforcement at the TypeScript layer (`UserRole`) is more valuable than fresh-install strictness — see [refactoring.md](refactoring.md).

### D2 — First-admin seeding
Two mechanisms, complementary:
- **At creation**: if `COUNT(*) FROM users = 0`, the new user is created as admin automatically. Bootstraps a fresh install.
- **In UI**: the "Create user" form gains an `is_admin` checkbox, so an admin can mint new admins without touching SQL.
- **Retroactive (migration)**: when the schema runs and there are existing users but no admin, the oldest user (by `created_at`) is promoted to admin. Keeps existing installations (mine, Henrique's, anyone's) functional after `git pull` — the original owner regains access to admin features.

### D3 — Name in sidebar
Avatar with initials + color token, next to the full name. Same visual family as the persona avatar in the rail, so users read it as "this is me" without explanation. **Final placement:** top of the sidebar, below the "Mirror Mind" brand, with a `border-bottom` separating identity from navigation. Identity at the top (who I am), actions at the bottom (logout).

### D4 — Guard behavior
Non-admin hitting `/admin/*` gets `403 Forbidden` with a plain response. Honest over friendly: redirecting would hide the permission boundary.

---

## Steps

1. **Schema + helpers.** Add `role` column to `users` (idempotent), update `User` interface, update `createUser` to default to admin when table is empty, and add a migration step that promotes the oldest user to admin when no admin exists yet. DB tests cover all three paths.
2. **Admin guard.** New `adminOnlyMiddleware` in `adapters/web/auth.ts` — checks `c.get("user").role`, returns 403 otherwise. Applied to `/admin/*` routes in `adapters/web/index.tsx`.
3. **Sidebar role-aware with user visible.** `Layout` takes `user` as a required prop. Renders avatar + name; "Users" link renders only when `user.role === 'admin'`. All call sites updated.
4. **Create-user form.** Checkbox `is_admin` added to `UsersPage`. Handler reads `body.is_admin` and passes role to `createUser`.
5. **Avatar helper (opportunistic refactor).** If the sidebar avatar and the rail avatar end up sharing shape, extract a small `avatar.tsx` component. Otherwise leave inline and log the decision in [refactoring.md](refactoring.md) (created at the end if anything lands there).
6. **Tests.** Extend `tests/db.test.ts` with role-seeding cases; extend `tests/web.test.ts` with sidebar visibility + 403 guard cases.
7. **Docs + release hygiene.** Link the story from [`cv0-e2-web-experience/index.md`](../index.md) and [`roadmap/index.md`](../../../index.md). Update [`worklog.md`](../../../../../process/worklog.md). Record new decisions in [`decisions.md`](../../../../decisions.md): retroactive-admin migration, 403-over-redirect for `/admin/*`, and the `/chat` → `/mirror` rename that emerged during the visual pass.

## Files touched

- `server/db.ts` — schema + migration logic
- `server/db/users.ts` — `User` type, `createUser` signature
- `adapters/web/auth.ts` — `adminOnlyMiddleware`
- `adapters/web/index.tsx` — apply guard, pass `user` to all `Layout` renders, read `is_admin` in POST handler
- `adapters/web/pages/layout.tsx` — receive `user`, render avatar/name, conditional "Users" link
- `adapters/web/pages/admin/users.tsx` — checkbox in form
- `adapters/web/public/style.css` — styles for sidebar avatar (minimal)
- `tests/db.test.ts`, `tests/web.test.ts` — coverage
- Possibly `adapters/web/pages/avatar.tsx` — only if extraction earns its keep

## Post-plan additions

Emerged during implementation and review, not in the initial sketch:

- **Dead code removed.** `adapters/web/pages/admin/personas.tsx` and `identity.tsx` were orphans since the unified profile landed in S2. Deleted in this cycle — the `Layout` signature change forced them to be updated, which exposed that no route imported them. Cleanup in place of maintenance.
- **`UserProfilePage` takes `user`.** Threading the admin's `user` through the admin routes covered this page too, even though its call sites weren't part of the original "Layout call sites" list.
- **Primary route renamed `/chat` → `/mirror`.** Emerged from the visual review pass as a semantic clarification — the page is a mirror that contains a chat, not a chat window. Affected `adapters/web/pages/{chat → mirror}.tsx` (file rename via `git mv`, component rename `ChatPage` → `MirrorPage`), the route definitions in `adapters/web/index.tsx`, the SSE URL in `adapters/web/public/chat.js`, the root redirect in `server/index.tsx`, and all web test references. A thin redirect from `/chat` to `/mirror` preserves bookmarks. See [decisions.md](../../../../decisions.md#2026-04-18--primary-route-renamed-from-chat-to-mirror).

## Out of scope / follow-ups

- Audit log of admin actions.
- UI to change another user's role after creation.
- Multi-role / permission scopes.
