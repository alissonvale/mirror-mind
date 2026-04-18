[< Story](index.md)

# Refactoring — CV0.E2.S7

What was cleaned up during the story, and what was considered but deferred.

## Applied

### Dead admin pages removed
`adapters/web/pages/admin/personas.tsx` and `identity.tsx` were already orphans since S2 (Unified Profile) landed — the routes redirected to `/admin/users/:name` but the components stayed. Deleted. No callers, no tests lost. Confirms the honesty rule: when code stops being called, remove it rather than keep it "just in case".

### Admin sub-app instead of per-route middleware
Rather than applying `adminOnlyMiddleware()` to each admin route, the admin routes were mounted under a sub-app: `web.route("/admin", admin)` with `admin.use("*", adminOnlyMiddleware())`. One guard, one mount. Future admin routes inherit the guard automatically.

### Shared avatar helpers (already in place, reused)
The `personaInitials` / `personaColor` helpers already lived in `adapters/web/pages/context-rail.tsx` and were generic by design — any string in, initials + color token out. The sidebar avatar reuses them as-is. No extraction was needed; if a third surface asks for an avatar, *that* is when they move to a shared module.

## Evaluated, parked

### Extract avatar into `<Avatar>` component
Sidebar avatar is a 3-line inline JSX. Rail avatar is structurally similar but lives inside a larger persona card with descriptor + badges. Extracting a shared `<Avatar size="sm|md">` component would save ~6 lines but introduce a second file two callers have to understand. Revisit when a third caller appears (S8 Memory Workspace will likely add one) or when the callers start to drift.

### Admin UI to change existing users' roles
Today an admin can create admins via the checkbox, but promoting or demoting an *existing* user requires direct SQL. A small form on the user-profile page would close the loop. Intentionally deferred: out of scope for S7, and S8 (Memory Workspace) will likely absorb user role management into its broader surface.

### `CHECK(role IN ('admin','user'))` at the DB level
The CREATE TABLE path could enforce the role domain with a CHECK constraint, but `ALTER TABLE ADD COLUMN` in SQLite doesn't support CHECK, so legacy installs wouldn't get it. Keeping uniform validation at the application boundary (TypeScript `UserRole` type + `createUser` signature) avoids a split where fresh installs have stricter constraints than upgraded ones. If a future migration rewrites the table, add the CHECK then.

### Migration log / versioning table
The `migrate()` function is idempotent but there's no `schema_migrations` table tracking applied migrations. For the current single-step migration (role column + admin retrofit), a version table would be more bureaucracy than benefit. Revisit when a second migration lands — the *second* change is the moment to introduce a version mechanism, not the first.
