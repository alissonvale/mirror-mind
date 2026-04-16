[< Docs](../../index.md)

# Plan: CV0.E2.S2 — Unified user profile (retroactive)

**Roadmap:** [CV0.E2.S2](../../project/roadmap.md)
**Date:** 16 April 2026 (documented retroactively)

## Goal

One page to manage a user's full identity — base layers (soul, ego/identity, ego/behavior) and personas — instead of navigating between separate screens.

## Deliverables

- `user-profile.tsx` — unified page with two visual groups: Base Identity and Personas
- Collapsible cards using `<details>` — closed shows name + content preview, open shows textarea editor
- Save and delete for personas, save for base layers
- "Add persona" form at the bottom
- Flash messages for save/delete confirmation
- Old routes (`/admin/identity/:name`, `/admin/personas/:name`) redirect to `/admin/users/:name`

## Design decisions

- **Product-designer (persona) analyzed the problem:** identity and personas were separate pages but the same underlying data (layers in the identity table). Separating them fragmented the mental model.
- **Cards use native `<details>` element** — no JS needed for collapse/expand
- **Preview** — first non-header line of content, truncated at 80 chars
- **Monospace textarea** — prompt content benefits from fixed-width font

---

**See also:** [Test Guide](test-guide.md)
