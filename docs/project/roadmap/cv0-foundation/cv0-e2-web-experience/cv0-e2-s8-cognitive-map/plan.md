[< Story](index.md)

# Plan: CV0.E2.S8 — Cognitive Map

**Roadmap:** [CV0.E2.S8](../index.md)
**Framing:** the mirror's **structure** — not its memory — made legible and editable in the web client. See [2026-04-18 decision](../../../../decisions.md#2026-04-18--cognitive-map-and-memory-are-distinct-concepts-s8-renamed) for the structure/memory distinction that shaped this story.

---

## Goal

A `/map` route that renders the psyche's architecture as a workspace:

- **Self (soul)** — deep identity, frequency, nature. One card.
- **Ego** — operational identity + behavior. One card (or two: identity + behavior). Design decision noted below.
- **Personas** — specialized voices. One card per persona, with the existing list + add/edit/delete.
- **Skills** — what the mirror can do (renamed from "extensions"). One card, empty for now, showing an invitation (feeds S10).

Every card is editable by the card's owner (see D2 below). Empty cards show textual invitations rather than blank placeholders. The map grows as new psyche layers arrive (shadow, meta-self) without restructuring the page.

**Also in scope — self-service identity edits:** the logged-in user can change their own display name from the map. Absorbed into this story because the map is the natural home for identity edits and the admin-only Users page doesn't cover it.

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

### D4 — Open: card UX

- **Edit:** inline (click the card → card expands into editor) vs modal (click → modal dialog with editor) vs separate page (click → navigate to `/map/self/soul/edit`).
- **Layout:** accordion (one card open at a time, collapsed by default) vs all collapsed (click to expand) vs all expanded (click to collapse).

Leaning toward **inline edit + all collapsed by default** — matches the existing rail affordance (collapse/expand), keeps the page scannable, avoids the modal-over-modal risk as the map grows.

---

## Steps

1. **Route + page shell.** `/map` in the web adapter, `<MapPage user={currentUser}>`. Collapsible cards scaffold. Test: GET `/map` with cookie returns 200 + contains each expected card title.
2. **Self (soul) card.** Render + inline edit. Reuses `setIdentityLayer`. Test: edit updates DB, page shows new content.
3. **Ego cards.** Identity + behavior layers. Same shape as self. Test: edits persist; layers independent.
4. **Persona cards.** List + add + edit + delete, mirroring current admin behavior. Test: CRUD round-trips.
5. **Skills card (empty).** Invitation text. No edit yet (skills don't exist in DB). Test: renders with invitation.
6. **Self-service name edit.** New route handler `POST /map/name`. Validates uniqueness (reuse UNIQUE constraint), updates `users.name`. Test: happy path + collision returns form error.
7. **Admin modality.** If D2 = (a): `/map/<name>` variant admin-only, middleware check. If (b): keep `/admin/users/:name`. If (c): dropdown in `<MapPage>` admin branch.
8. **Redirect from old admin route.** `/admin/users/:name` → `/map/<name>` (or stays per D2). Legacy link preserved.
9. **Sidebar link.** Add "Map" above Admin section in the sidebar (visible to everyone; the link goes to one's own map).
10. **Tests.** Unit: name validation. Web route: visibility, edit flow, admin modality, 404 for unknown target user. ≥10 new tests.
11. **Docs.** `test-guide.md`, update epic index (mark S8 done), worklog entry, decisions.md for any sub-decisions surfaced during implementation.
12. **Review pass.** Per the story lifecycle step 5. Then push.

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
