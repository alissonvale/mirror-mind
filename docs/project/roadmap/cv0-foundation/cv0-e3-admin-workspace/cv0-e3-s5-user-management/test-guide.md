[< Story](index.md)

# Test Guide: CV0.E3.S5 — User management (delete + role toggle)

## Automated

```bash
npx vitest run
```

New coverage in `tests/web.test.ts`:

- **Delete**
  - Admin deletes another user → cascade removes sessions, entries, identity, telegram links, and the user row. All within one transaction.
  - Admin trying to delete themselves → 403.
  - Non-admin → 403.
  - Unknown target name → 404.
- **Role toggle**
  - Admin flips another user's role → DB reflects new role, redirect to `/admin/users`.
  - Admin trying to change own role → 403.
  - Non-admin → 403.
- **UI render**
  - Self row shows `admin (you)` label (no toggle, no delete).
  - Other rows show a role-toggle button and a delete button with the target name in the confirm message.

Total: **143 passing**.

## Manual (browser)

### Create, demote, re-promote

1. Log in as admin. Sidebar → This Mirror → Users.
2. Create a new user (form at the bottom, leave the Admin checkbox unchecked).
3. The new row appears with role `user · click to promote`. Click it → the button becomes `admin · click to demote`. DB confirms role flipped.
4. Click again → back to `user`.

### Delete

1. On a row that isn't yours, click the red **Delete** button.
2. A native confirm appears: *"Delete &lt;name&gt; and all their data? This cannot be undone."* Cancel and nothing happens; OK to proceed.
3. Row disappears from the table. SQLite confirms sessions, entries, identity, telegram links, and the users row are all gone.

### Self-safety

1. Your own row shows `admin (you)` (grey italic) in place of a toggle button.
2. The delete button is absent from your row.
3. Even if you POST `/admin/users/<yourname>/delete` directly (e.g., via curl), you get **403 Forbidden** — the server check is independent of the UI.

### Auth

1. Log in as a non-admin. The sidebar has no This Mirror section.
2. Hit either POST route directly → **403**.

### What's not here

- **Soft delete / undo.** Delete is irreversible.
- **Rename another user from the admin page.** Rename is self-service on the map.
- **Bulk actions.** One user at a time.
- **Transfer ownership.** Deleting a user takes their sessions and identity with them.
