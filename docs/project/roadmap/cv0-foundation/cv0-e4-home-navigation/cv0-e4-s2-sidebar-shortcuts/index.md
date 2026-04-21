[< CV0.E4 — Home & Navigation](../index.md)

# S2 — Sidebar pruning + admin shortcuts

The sidebar's "This Mirror" section (Dashboard / Users / Models / OAuth / Budget / Docs) collapses into a single **Admin Workspace** link above Logout. The admin dashboard takes on the role of navigation hub: each of the five admin surfaces now has a **shortcut card** on `/admin` with a direct link.

**Derived from:** 2026-04-21 conversation after CV0.E4.S1 shipped. With the home in place, the sidebar duplication became unnecessary and the navigation overhead was felt — 11+ links for an admin. Direction confirmed: consolidate the admin nav into a single entry-point; let the dashboard serve the sub-surfaces.

- [Plan](plan.md) — scope, card inventory, files touched
- [Test guide](test-guide.md) — automated + manual acceptance

## Done criteria

1. The sidebar's "This Mirror" section and its six sub-links are gone. In their place, admins see one **Admin Workspace** link above Logout.
2. Non-admin users see no admin link at all.
3. `/admin` dashboard has a shortcut card for each of the five admin surfaces — Users, Budget, Models, OAuth, Docs — each with a direct link.
4. The old "Cost · last 30 days" card is replaced by a **Budget** card driven by real usage-log data (from CV0.E3.S6), not the stale char/4 estimate.
5. Existing glance cards stay — Activity, Mirror memory, Latest release, System.
6. Grid order places shortcuts first, glances after, so the most actionable surfaces are visually nearest the page header.
7. `npm test` green; existing admin flows (`/admin/users`, `/admin/models`, etc.) unaffected.
