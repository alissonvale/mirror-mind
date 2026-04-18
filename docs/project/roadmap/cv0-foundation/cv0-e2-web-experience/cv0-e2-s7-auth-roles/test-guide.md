[< Story](index.md)

# Test Guide: CV0.E2.S7 — I know who's logged in

## Automated

```bash
npx vitest run
```

New coverage:

- **`tests/db.test.ts`** — first user on an empty table defaults to admin; subsequent default to user; explicit role wins; `migrate()` adds the `role` column to pre-existing tables and retroactively promotes the oldest user to admin when none exists.
- **`tests/web.test.ts`** — sidebar renders user name + avatar; admin sees the Users link, regular user does not; 403 on all `/admin/*` routes for non-admins (including legacy redirects); create-user honors the `is_admin` checkbox.

## Manual (browser)

Start dev:

```bash
npm run dev
```

### As admin

1. Log in with an admin token.
2. Sidebar shows the colored avatar (initials) + name at the top, below the "Mirror Mind" brand, with a border separating it from the menu.
3. Sidebar includes the **Admin** section with **Users** link.
4. `/admin/users` lists all users with a **Role** column (admin/user).
5. Create-user form has an **Admin** checkbox. Create a user with it **off** → role is `user`. Create one with it **on** → role is `admin`.

### As regular user

1. Log in with a non-admin token.
2. Sidebar shows the user name + avatar but **no** Admin section, **no** Users link.
3. Visiting `/admin/users` directly returns **403 Forbidden** (plain body).
4. `/admin/users/<any>` and legacy `/admin/identity/<any>`, `/admin/personas/<any>` also return 403.

### Retroactive migration (pre-existing install)

If you are upgrading an existing install:

1. Pull and restart the server.
2. The oldest user by `created_at` is promoted to admin automatically — no SQL required.
3. Any user created after that keeps the default `user` role.
4. An admin can promote others via the Create-user form (for new users) or by direct SQL for legacy ones (no UI yet; see follow-ups in [plan.md](plan.md)).
