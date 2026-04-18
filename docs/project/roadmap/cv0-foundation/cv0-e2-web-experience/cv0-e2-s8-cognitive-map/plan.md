[< Story](index.md)

# Plan: CV0.E2.S8 — Cognitive Map

**Roadmap:** [CV0.E2.S8](../index.md)
**Framing:** the mirror's **structure** — not its memory — made legible and editable in the web client. See [2026-04-18 decision](../../../../decisions.md#2026-04-18--cognitive-map-and-memory-are-distinct-concepts-s8-renamed) for the structure/memory distinction that shaped this story.

---

## Goal

A `/map` route that renders the psyche's architecture as a workspace, with memory's presence alongside — structure on the left, memory perpendicular on the right.

**Structural cards (left column, editable, part of the warm color gradient):**

- **Self (soul)** — deep identity, frequency, nature. One card, centered full-width at the top.
- **Ego** — two cards side-by-side: `ego/identity` and `ego/behavior`. Twins of the same layer.
- **Personas** — specialized voices. *Single* card with badges (initials + color + name), inline editor opens when a badge is clicked. Scales with persona count; not one card per persona.
- **Skills** — what the mirror can do (renamed from "extensions"). One card, empty in v1, showing an invitation (feeds S10).
- Future psyche layers (shadow, meta-self) slot in at the bottom as they arrive in the DB.

**Memory card (right column, read-only, outside the gradient):**

- Lateral column alongside the structural stack — spatially encoding that memory is *perpendicular* to structure, not sequential. Three shortcut rows: Attention (→ rail), Conversations (→ future episodic browse), Insights (→ future long-term memory). High-level stats + navigation, not editable. Visually in a neutral-cool tone, distinct from the cream/amber/clay gradient, signaling a different category.

**Identity strip (header, above everything):** avatar + name + edit affordance. The map's label, not a layer. Self-service name edit lives here — absorbed into this story because it's the natural home for identity edits and the admin-only Users page doesn't cover it.

Every structural card is editable by the card's owner (see D2 below). Empty cards show textual invitations rather than blank placeholders. Memory card content is read-only in v1 (stats + links only).

## Non-goals

- **Episodic memory browsing.** Past conversations are memory, not structure. A separate surface (likely `/history` or inside the CV1.E3 Memory epic) handles them. The map never lists conversations.
- **Shadow and Meta-Self cards.** Those psyche layers don't exist in the DB yet. Following the same rule as journeys: don't render empty cards for concepts that have no substance — render only what the DB can back.
- **Journey cards.** Journeys exist conceptually (CV1.E4) but not in the DB today. Skip until CV1.E4 lands.
- **User role changes.** Promoting/demoting via UI is a follow-up; out of scope here.
- **Avatar upload.** Initials + color token stay; upload is a radar item.
- **Search across layers.** If useful later, a separate story; not bundled here.

---

## Decisions

### D1 — Confirmed (from the Cognitive Map reframing)

- **Route:** `/map`. Replaces the old `/memory` draft.
- **Concept name:** Cognitive Map (English, matching the rest of the app).
- **"Extensions" renamed to "Skills"** across the map layers and reception envelope (`skillsActivated`).
- **Skills card appears empty now**, showing an invitation. Shadow and Meta-Self do not appear until they exist in the DB.

### D2 — Open: relationship between `/map` and `/admin/users/:name`

Three options, need alignment:

- **(a) `/map` replaces `/admin/users/:name`.** The map is canonical for every user; admin variant uses a query param or sub-route (`/map?user=<name>` or `/map/<name>`) to view another user's map. Unifies the surface, reduces routes.
- **(b) Coexist.** `/map` is self-service (the user edits their own map); `/admin/users/:name` stays admin-only for editing others. Two routes, two purposes.
- **(c) `/map` with admin-only user selector.** Single route, but a dropdown at the top lets admins pick whose map to view/edit.

Leaning toward **(a)** — one concept, one route, modality (self vs admin) handled by the route parameter.

### D3 — Open: what can a regular user edit themselves?

The old admin-only model treated identity as tutelada. In the map framing, "my map" should be mine. But the deeper self/ego layers shape responses, and a user who doesn't understand them can degrade their own mirror.

- **(i) Full self-service.** User edits self, ego, personas, own name. Admin only creates/deletes users.
- **(ii) Partial.** Name + personas self-service; self/ego layers are admin-only or require admin review.
- **(iii) Conservative.** Only name is self-service; everything else admin-only (unchanged from today).

Leaning toward **(i)** — aligns with the "my map is mine" premise, and the user who breaks their own mirror is the same user who can fix it. A revert-to-default affordance per layer mitigates the damage case.

### D4 — Confirmed: card UX

- **Edit style:** inline. Clicking a card expands it into its editor; save/cancel collapses it back. Matches the existing rail's collapse/expand idiom.
- **Default state:** all cards collapsed. Click to expand. No accordion restriction — multiple cards can be open at once if the user wants to compare.
- **Personas are one card, not many.** With 13+ personas today and more likely, one card per persona would bloat the map and misrepresent the hierarchy (personas are specialized expressions of the ego, not peers of self). The Personas card renders a grid of badges (initials + color avatar + name, same visual vocabulary as the rail); clicking a badge opens an inline editor below the grid. Only one persona editing at a time inside the card; other cards elsewhere on the map can be open independently. A `+ add persona` action sits after the badges.
- **Scale posture.** Badges + filter is the v1 bet. If persona count grows past ~20-25, a light filter input at the top of the Personas card kicks in. Not needed before that.
- **Descriptors.** Badges show initials + color + name only. No inline one-liner yet — starts minimal, revisits if scan without hover proves insufficient (tooltip is not viable for mobile).
- **Textarea height.** When a persona or layer editor opens, the card grows vertically (a prompt of ~500-1000 tokens creates a ~400-500px editor). Acceptable: the user's focus is on that layer at that moment, the rest of the map recedes into scroll.

---

## Steps

1. **Route + page shell + sidebar link.** `/map` in the web adapter, `<MapPage>` scaffold with 5 structural cards + memory column. ✅ Phase 1 shipped (commit 7e79bb2).
2. **Dashboard + Self/Ego workshop pages.** `/map` cards become clickable navigation, each card shows overview (word count, first-line preview, edited-at). New route `/map/:layer/:key` renders `<LayerWorkshopPage>`: breadcrumb, large editor, composed prompt preview panel that reflects draft content live (debounced JS compose endpoint), save (persists + redirects to /map) / cancel (back to /map). Layers in scope for this phase: self/soul, ego/identity, ego/behavior. Test: dashboard navigates correctly; workshop renders current content; save persists; preview updates on edit.
3. **Personas card (badges + inline editor).** Grid of persona badges (avatar + name), `+ add persona` action, clicking a badge opens inline editor with textarea + save/delete/cancel. Reuses `avatarInitials`/`avatarColor`. Personas is the one exception to the workshop-page pattern because of the many-to-one cardinality — the card already is a workspace with its own internal structure. Test: badges render, edit flow round-trips, add creates a new layer, delete removes it.
4. **Skills card (empty).** Invitation text. No edit yet (skills don't exist in DB). Test: renders with invitation.
5. **Memory card (lateral column).** ✅ Phase 1 shipped. Stats query (`sessionCount`, `lastSessionAgo`) wired in this phase once the query helper is written. Test: renders three rows + correct anchor for attention link.
6. **Self-service name edit.** Lives on the identity strip (top of `/map`). Clicking the edit placeholder turns the name into an input; Enter or Save persists. New route handler `POST /map/name` validates uniqueness (reuses UNIQUE constraint) and updates `users.name`. Test: happy path + collision returns form error.
7. **Admin modality.** Per D2 = (a): `/map/<name>` variant admin-only, guarded by middleware. Admin sees target user's map and workshops (`/map/<name>/:layer/:key`). Test: admin can view + edit other users' maps; non-admin hitting those routes gets 403.
8. **Redirect from old admin route.** `/admin/users/:name` → `/map/<name>`. Legacy link preserved.
9. **Tests.** Unit: name validation, composed prompt preview helper. Web route: dashboard visibility, workshop render + save, preview endpoint, admin modality, 404 for unknown target user. ≥15 new tests.
10. **Docs.** `test-guide.md`, update epic index (mark S8 done), worklog entry, decisions.md for any sub-decisions surfaced during implementation.
11. **Review pass.** Per the story lifecycle step 5. Then push.

---

## Files likely touched

- `adapters/web/index.tsx` — new `/map` routes, possible redirect from `/admin/users/:name`
- `adapters/web/pages/map.tsx` — new page component (`MapPage`)
- `adapters/web/pages/layout.tsx` — sidebar link "Map"
- `adapters/web/public/style.css` — card styles (accordion, editors)
- `adapters/web/public/map.js` — client-side card interactions (optional; could be server-only for v1)
- `server/db.ts` — probably nothing new; existing identity table already supports this
- `server/db/users.ts` — name update helper (rename or new function)
- `tests/web.test.ts` — new coverage

## Out of scope / follow-ups

- Avatar upload.
- Shadow, meta-self, journey cards (wait for each to have DB substance).
- Cross-user map copying or templating.
- Full role management UI (create/delete admins in UI beyond the checkbox that already exists).
- Per-layer version history.

## Post-plan additions

*(Populated during implementation for anything that emerges mid-cycle; see [S7's plan.md](../cv0-e2-s7-auth-roles/plan.md) for precedent.)*
