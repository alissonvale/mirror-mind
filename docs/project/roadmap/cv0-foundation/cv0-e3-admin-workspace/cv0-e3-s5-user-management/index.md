[< CV0.E3 — Admin Workspace](../index.md)

# S5 — User management with delete and role toggle ✅

The admin can remove users (cascade: sessions, entries, identity, telegram links) and toggle roles between admin and user. Both actions are guarded against self-modification — the logged-in admin can't delete or demote themselves.

- [Plan](plan.md) — scope, decisions, steps
- [Test Guide](test-guide.md) — automated + manual verification
