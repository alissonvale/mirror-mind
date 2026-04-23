[< Roadmap](../../index.md)

# Personas listing polish: no sidebar, no controls, initials badge

**Status:** ✅ Shipped 2026-04-23
**Follows:** [Psyche Map sidebar + read/edit mode](../psyche-map-sidebar-and-read-mode/)

## Problem

The previous round shipped personas with the same row-controls
apparatus as journeys and organizations (↑/↓ reorder, ●/◎ sidebar
visibility) and listed individual personas as nested sub-items in the
sidebar. First use revealed the mismatch: personas are lenses the
reception routes to on its own — they aren't places the user
navigates to from the sidebar on a daily basis, and the ordering
doesn't affect the sidebar because personas aren't there. The result
was noise (controls that changed state no one observed) and clutter
(a potentially long list of personas always competing for sidebar
space).

## Fix

Three small changes, no schema change:

- **Personas out of the sidebar.** `loadSidebarScopes` no longer
  returns personas; layout stops rendering individual persona
  sub-items. The "Personas" sub-link under Psyche Map stays and
  points to `/personas`, which remains the surface for reaching
  any persona.
- **Row controls removed from `/personas`.** No more ↑/↓ reorder or
  ●/◎ visibility buttons. The DB columns `sort_order` and
  `show_in_sidebar` on the identity table remain (structure intact);
  the routes `POST /personas/:key/reorder` and `/sidebar` also stay.
  Bringing the controls back later is a UI-only change.
- **Initials badge per card.** Each persona card carries a colored
  circle with 1–2 letter initials computed from the key (mentora →
  "ME", product-designer → "PD", dba → "DB"). Reuses
  `avatarInitials` and `avatarColor` from context-rail so the color
  hashing matches the user avatar treatment. Placeholder for a
  proper per-persona avatar later — same shape will carry image.

## Commit

`7f8a7c5` — Personas listing polish: no sidebar, no controls, initials badge

## Tests added / changed

- Replaced `sidebar includes visible personas as sub-links` with
  `sidebar does not list individual personas — only the /personas
  sub-link`.
- Added `/personas renders each persona with an initials badge` —
  covers both single-word (`mentora` → `ME`) and hyphenated
  (`product-designer` → `PD`) keys.
- Added `/personas does not render reorder or visibility controls`
  — confirms the UI is clean while the underlying routes still
  exist.
- 513 tests passing (was 511).

## Decision

**Why keep the routes and DB columns.** The user asked to keep the
structure and only remove the UI. If daily use reveals an ordering
need later (e.g., the reception candidate list surfacing order
matters, or a future admin view benefits from explicit priority),
the fix is a few lines of JSX — the server already supports it.
