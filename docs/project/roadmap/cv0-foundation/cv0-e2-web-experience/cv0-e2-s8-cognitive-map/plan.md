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

### D2 — Confirmed: `/map` replaces `/admin/users/:name`, modality via path parameter

Option (a). The map is canonical for every user. Admin viewing or editing another user uses `/map/<name>`. Legacy `/admin/users/:name` redirects to `/map/:name`; `/admin/identity/:name` and `/admin/personas/:name` redirect straight to `/map/:name`. UserProfilePage deleted as dead code.

### D3 — Confirmed: full self-service

Option (i). A user can edit their own self, ego, personas, and display name. Admin only creates and deletes users. "My map is mine" — the user who breaks their own mirror is the same user who can fix it, and the workshop's composed-prompt preview makes consequences visible in real time, which mitigates most of the concern behind the more conservative options. A revert-to-default affordance per layer is a follow-up (not shipped in v1).

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

## Files touched (as shipped)

- `adapters/web/index.tsx` — handler helpers (handleDashboard, handleWorkshopGet/Save/Compose, handlePersonaAdd/Update/Delete), self-modality + admin-modality route registration, name edit route, legacy `/admin/users/:name` and friends replaced with redirects to `/map/:name`
- `adapters/web/pages/map.tsx` — new; MapPage + StructuralCard + PersonaBadges + PersonaForm + identity strip with page title + edit affordance
- `adapters/web/pages/layer-workshop.tsx` — new; focused per-layer editor + composed prompt preview panel
- `adapters/web/pages/layout.tsx` — sidebar link "Cognitive Map" (renamed from "Map" for cross-surface consistency); CSS version bump
- `adapters/web/pages/context-rail.tsx` — `personaInitials`/`personaColor` renamed to `avatarInitials`/`avatarColor` (now reused by the map); footer link changed from `/admin/users/:name` to `/map`
- `adapters/web/pages/admin/users.tsx` — row link text and column header retargeted from `/admin/users/:name` ("Edit"/"Identity") to `/map/:name` ("View map"/"Map")
- `adapters/web/pages/admin/user-profile.tsx` — **deleted** (replaced by the Cognitive Map)
- `adapters/web/public/style.css` — map grid + pastel-per-layer palette + identity strip + persona form + workshop layout + memory column
- `adapters/web/public/workshop.js` — new; debounced compose endpoint call that updates the prompt preview live as the textarea changes
- `server/db.ts` — re-export `updateUserName`, `getUserSessionStats`, `UserRole`
- `server/db/users.ts` — new `updateUserName` helper
- `server/db/sessions.ts` — new `getUserSessionStats` helper for the memory card counts
- `server/db/identity.ts` — `getIdentityLayers` now orders by psychic depth (`self` → `ego` → `persona` → other) rather than alphabetically
- `server/identity.ts` — unchanged; inherits the new order via the SQL in `getIdentityLayers`
- `tests/web.test.ts` — 24 new tests across dashboard, workshop, persona CRUD, name edit, admin modality
- `tests/db.test.ts` — one ordering test rewritten + three role tests extended (pre-existing, touched only to match the new order)
- `tests/identity.test.ts` — one assertion flipped (self-before-ego)

## Out of scope / follow-ups

- Avatar upload.
- Shadow, meta-self, journey cards (wait for each to have DB substance).
- Cross-user map copying or templating.
- Full role management UI (create/delete admins in UI beyond the checkbox that already exists).
- Per-layer version history.

## Post-plan additions

Emerged during implementation and design reviews, not in the initial sketch:

- **Pastel per-layer palette** replaced the originally planned warm single-hue gradient (cream → amber → clay). The plan had treated color as encoding depth; the review surfaced that vertical position already carries depth, and color can do more work by encoding layer *identity* instead. Final palette: lavender (self), peach-cream (ego), dusty-rose (personas), pale-sage (skills), neutral-gray (memory, outside the structural family). See [2026-04-18 decision](../../../../decisions.md#2026-04-18--cognitive-map-and-memory-are-distinct-concepts-s8-renamed).
- **Memory as lateral column, not bottom card.** The plan's original memory portal was a card at the bottom of the stack. A design-review observation reframed it: memory is *perpendicular* to structure, not sequential — it traverses every psychic layer rather than following them. Memory now sits in a right-side column alongside the whole structural stack, which also rhymes spatially with the `/mirror` rail. Documented as an amendment in the Cognitive Map decision.
- **Identity layers ordered by psychic depth.** Surfacing the composed prompt in the workshop preview exposed that `getIdentityLayers` was returning rows alphabetically, so `ego/behavior` preceded `self/soul` in the system prompt. Fixed the SQL to order by depth (`self` → `ego` → `persona`). Own decision entry because the rule applies beyond S8.
- **Page title "Cognitive Map of {name}" + sidebar label "Cognitive Map".** The identity strip at the top reads as a proper page title (`<h1>`) rather than just the user's name. The sidebar menu and browser tab were also renamed from "Map" to "Cognitive Map" for cross-surface consistency, breaking the single-word menu convention on purpose.
- **Pivot from inline card edit to dedicated Workshop pages** for self/ego layers. Own decision entry. Personas kept the inline card form because their cardinality (13+) differs from the structural layers (1-2).
- **Single-card Personas with badges**, rejecting the "one card per persona" alternative. Own decision entry.
- **Arbitrary no-whitespace rule on user name dropped** during phase 5. The rule was defensive without cause; only slashes (which break URL routing) are rejected now, so "Alisson Vale" is a valid display name. Caught by the user questioning the rule directly.
- **Silent duplicate-persona failure** caught during testing — `.flash-error` CSS was missing, so the server-side rejection rendered with no visual distinction. Now styled with a soft red background.
- **Two routing-conflict fixes:** Hono matches routes linearly and literal segments don't automatically beat all-dynamic routes. (i) POST `/map/:name/persona` was shadowed by self's `/map/:layer/:key`; admin persona routes now register before the self generic. (ii) POST `/map/:layer/:key/compose` was shadowed by admin's `/map/:name/:layer/:key`; the self compose route now registers before the admin catch-all. Inline comments at both ordering boundaries capture the intent.
- **Scroll-to-card on persona navigation.** Clicking a badge or "add persona" triggered a full page reload that landed at the top, below the fold where the personas card lives. Fixed with URL fragment (`#personas-card`) + `scroll-margin-top` CSS + autofocus as a fallback for validation-error re-renders.
- **Skills card invitation given a two-tier voice** — primary paragraph describing what skills are conceptually, secondary italic meta noting the layer doesn't exist yet. Prototype of the invitation vocabulary S10 will extend across every empty card.
