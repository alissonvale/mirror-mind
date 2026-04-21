[< CV0.E4 — Home & Navigation](../index.md)

# S3 — Sidebar organized by the three questions

The sidebar's context links (what used to be a flat list — Organizations, Journeys) reorganize into three explicit sections, each named after a foundational question the mirror reflects back to the user:

- **Who Am I** — Psyche Map
- **What I'm Doing** — Journeys
- **Where I Work** — Organizations

Conversation stays at the top as the primary action. Psyche Map is promoted from a click-hidden-behind-the-avatar to a first-class link — because if "Who Am I" is the first question, it cannot live inside a decorative bubble.

**Derived from:** 2026-04-21 modo Espelho conversation with the `product-designer` persona. The user surfaced the product thesis explicitly: *organizing information about myself gives the AI the right context to reflect my concrete situation.* Three wireframes were proposed (silent ordering, headers with Conversation on top, headers with Conversation at bottom). Option B was chosen — sections visible, Conversation primary. A follow-up exchange landed the final wording: **Cognitive Map → Psyche Map** (the surface holds soul, ego, personas — not cognition; "psyche" is accurate to the Jungian architecture) and **To Whom I'm Affiliate → Where I Work** (grammatically clean, warm register, bilingually legible).

- [Plan](plan.md) — scope, wording decisions, files touched
- [Test guide](test-guide.md) — automated + manual acceptance

## Done criteria

1. Sidebar nav shows four distinct regions in order: **Conversation**, then three section-headed groups — *Who Am I / What I'm Doing / Where I Work* — each with its matching link underneath.
2. Psyche Map is a direct sidebar link (not only reachable via the avatar).
3. Avatar remains clickable to `/map` for continuity; the duplication is deliberate — avatar is identity-as-badge, link is action-as-nav.
4. Admin footer (`Admin Workspace` + Logout) unchanged from S2.
5. Section-header styling reuses the existing `.sidebar-section` class from the old `This Mirror` header (same typography, same muted weight).
6. Sidebar tests updated to assert the three question headers and the new Cognitive Map link.
7. `npm test` green; existing flows unaffected.
