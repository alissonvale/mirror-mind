[< Story](index.md)

# Plan: CV0.E3.S5 — User management with delete and role toggle

**Roadmap:** [CV0.E3.S5](../index.md)
**Framing:** two operations the admin feels missing today — destructive user delete (no way to remove a created user) and inline role toggle (promoting/demoting requires SQL). Both live on the existing `/admin/users` page.

---

## Goal

`/admin/users` gains per-row actions:

- **Role toggle.** A button on each user row that flips their role between `admin` and `user`. Current admins see `admin · click to demote`; users see `user · click to promote`.
- **Delete.** A small destructive action per row that removes the user and everything attached to them (sessions, entries, identity layers, telegram links) in a single transaction. Native `confirm()` before execution.

Both actions are **self-proof**: the admin can't delete themselves or change their own role. Safety guards on the server (return 403) and in the UI (buttons replaced by a `"(you)"` label on the admin's own row).

## Non-goals (v1)

- **Soft delete / undo.** Delete is irreversible by design.
- **Rename another user from the admin page.** Rename is self-service only on the map.
- **Bulk operations.** One user at a time.
- **Transfer ownership.** If you delete a user, their sessions and identity go with them. No "move conversations to another user" flow.

## Decisions

### D1 — Cascade deletes, atomic transaction

`deleteUser` wraps entries → sessions → identity → telegram_users → users DELETEs in a single better-sqlite3 transaction. If any step fails, nothing commits.

The cascade order matters: entries depend on sessions, telegram_users depends on users. Deleting entries first (by session_id via subquery) then sessions, identity, telegram, then users is the safe order.

### D2 — Self-proof on both the UI and the server

UI: the admin's own row shows the role as a plain label ("admin (you)") and omits the delete button entirely. The server does the same check independently — `target.id === currentUser.id` returns 403 regardless of what the form posted. Two layers of protection so a tampered form can't bypass the guard.

### D3 — Confirmation for delete only

Delete gets a native `confirm()` with a sentence naming what will happen. Role toggle is inline and effectively reversible (click again to flip back), so no confirm ceremony.

### D4 — Surface stays on `/admin/users`

No new route pattern, no dedicated delete/role page. The users table gains columns/buttons; actions POST and redirect back. Simplest possible surface.

## Steps

1. **DB helpers** (`server/db/users.ts`):
   - `deleteUser(db, userId)` — cascade in a transaction.
   - `updateUserRole(db, userId, role)` — single UPDATE with the `UserRole` type.
   - Export both from `server/db.ts`.
2. **Routes** (`adapters/web/index.tsx` inside the admin sub-app):
   - `POST /admin/users/:name/delete` — resolve by name, 404 if unknown, 403 if self, else call `deleteUser` and redirect to `/admin/users`.
   - `POST /admin/users/:name/role` — same guards; read `body.role` (validate it's one of `admin`/`user`), call `updateUserRole`, redirect.
3. **UsersPage** (`adapters/web/pages/admin/users.tsx`):
   - Role cell becomes: label for self; form-button toggle for others (hidden input with the flipped role).
   - Actions cell adds delete form-button with `onclick="return confirm(...)"`.
4. **CSS**: small-button styling for the inline actions; red tone for delete to signal destructive.
5. **Tests**: cascade happy path, self-delete 403, self-role 403, non-admin 403 on both routes, valid role flip.
6. **Close-out**: test-guide, worklog, mark ✅.

## Files likely touched

- `server/db/users.ts` — new helpers
- `server/db.ts` — re-exports
- `adapters/web/index.tsx` — two routes
- `adapters/web/pages/admin/users.tsx` — row actions
- `adapters/web/public/style.css` — action styling
- `tests/web.test.ts` — coverage
