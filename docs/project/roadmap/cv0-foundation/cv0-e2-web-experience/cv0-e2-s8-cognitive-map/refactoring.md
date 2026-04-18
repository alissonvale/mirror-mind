[< Story](index.md)

# Refactoring — CV0.E2.S8

What got cleaned up during the story and what was considered but deferred.

## Applied

### Extracted handler functions parametrized by (currentUser, targetUser)

Before the admin modality landed, each route in `adapters/web/index.tsx` inlined its DB loading and rendering. To serve `/map/:name/...` alongside `/map/...` without duplicating the handler bodies, the logic was extracted into named helpers — `handleDashboard`, `handleWorkshopGet`, `handleWorkshopSave`, `handleWorkshopCompose`, `handlePersonaAdd`, `handlePersonaUpdate`, `handlePersonaDelete` — each taking `(c, currentUser, targetUser, ...)`. Self routes pass `c.get("user")` twice; admin routes pass the logged-in admin plus the resolved target. One definition per operation; the modality becomes a thin wrapper. `mapRootFor(currentUser, targetUser)` centralizes the redirect-URL rule so no handler has to know about modality directly.

### Shared avatar helpers renamed from persona- to avatar-scoped

`personaInitials` and `personaColor` in `context-rail.tsx` were always generic string hashers — the "persona" in the name was a usage-context label, not a truth about the function. When the sidebar (S7) and the Cognitive Map (S8) started reusing them for user and persona avatars alike, the name started lying to the reader. Renamed to `avatarInitials` / `avatarColor`. The *field* names inside `RailState` (`personaInitials`, `personaColor`) stayed put because on the rail specifically those fields *are* persona attributes — the rule is the helper describes a computation, the field describes its meaning.

### Dead code removed: UserProfilePage

`adapters/web/pages/admin/user-profile.tsx` was the editing surface that `/admin/users/:name` rendered. Once phase 6b redirected that route to `/map/:name`, the component had no callers. Deleted, along with the POST handler that fed it. 198 lines gone, one file removed.

### Psychic-depth ordering centralized in SQL

Surfacing the composed prompt to the user (the workshop preview) exposed that `getIdentityLayers` returned layers alphabetically, so ego preceded self. Rather than sort in each caller, the ORDER BY clause was changed at the source — `CASE layer WHEN 'self' THEN 1 WHEN 'ego' THEN 2 WHEN 'persona' THEN 3 ELSE 4 END, key`. Every consumer (the composer, the map, future admin lists) inherits the correct narrative order for free. See the dedicated decision entry for the rationale.

### Generic invitation styling unified

`.map-card-invitation` and a new `.map-card-invitation-meta` class carry the copy-first tone that S10 will formalize. The Skills card today reads as a prototype of this: a primary conceptual paragraph + a secondary italic status line.

## Evaluated, parked

### Extract `<Avatar size="sm|md|lg">` component

Three callers now render "avatar circle with initials and deterministic color": the sidebar footer (S7), the Personas card badges (S8), and the identity strip at the top of `/map` (S8). The badge sizing and the strip sizing differ, plus the rail already carries a fourth variant on the persona card inside the rail.

Not extracted because the CSS differences are real — the strip wants a 2.4rem circle, the badge wants a 1.45rem pill-embedded circle, the sidebar wants a 1.9rem rounded square. A single `<Avatar size>` component would have to encode all three as style variants, which shifts complexity from "three 3-line JSX snippets" to "one component with three modes" — the same number of lines with more indirection.

**Revisit when:** a fifth caller appears *and* the sizing can be expressed as a single scale (XS / S / M / L), or when hover/tooltip behavior (radar: persona descriptor tooltip) needs to live in one place.

### `workshop.js` could support Escape to cancel and Cmd+S to save

The workshop editor today doesn't bind keyboard shortcuts. Esc+Cmd+S are the expected shortcuts for "dismiss edit" and "save". Small add, but a different surface concern — phase 2 scope was deliberately server-first with no client behavior beyond the debounced preview.

**Revisit when:** the test-chat story lands (radar: "Identity Workshop test chat") and we're already touching the workshop's JS. Bundle the shortcuts in that commit so the page has a consistent interaction model.

### Merge `server/identity.ts`'s `composeSystemPrompt` with `composeWithOverride`

`composeWithOverride` lives in `adapters/web/index.tsx` because it's specific to the workshop preview's draft-override need. `composeSystemPrompt` lives in `server/identity.ts` and does the real composition for requests. They share the join-on-separator shape but differ in whether an override is applied.

Not merged because the override path is UI-specific and adding an `override` param to the server-side composer would leak workshop-preview semantics into a core function that runs on every chat request. The duplication is small (~10 lines) and the boundary is honest.

**Revisit when:** a second consumer wants the override behavior (for example, a programmatic "test prompt" endpoint, or a shadow-layer preview). At that point the override moves to the server helper and the workshop handler becomes a caller.

### Split `adapters/web/index.tsx` into route modules

The file is now ~750 lines covering login, chat/mirror routes, mirror SSE streaming, map self-modality, map admin-modality, legacy redirects, and admin user management. Same concern parked in S9's refactoring log (its entry at the time was ~276 lines, the file has grown). The longer the file, the higher the cost of finding anything and the higher the risk of cross-route accidents like the routing-conflict bugs this story surfaced.

Not split during S8 because it's a multi-file restructuring that deserves its own scope (separate PR, careful about export shapes, tests stay stable throughout). Tracked as task `bba04585` ("Split adapters/web/index.tsx into route modules").

**Revisit when:** capacity allows a dedicated refactor window, or when the next route addition pushes the file past ~900 lines and the friction becomes hard to ignore.

### Autofocus on layer-workshop textarea

The workshop textarea doesn't autofocus on page load, so the user has to click into it before typing. Small quality-of-life gain. Deferred because the first interaction on the workshop is usually *reading* the composed preview alongside the editor, not immediately editing — autofocus would scroll the editor into view and might hide the preview.

**Revisit when:** user feedback actually complains about it, not before. Autofocus is a small cost but adds a surprise, and the current flow is legible.
