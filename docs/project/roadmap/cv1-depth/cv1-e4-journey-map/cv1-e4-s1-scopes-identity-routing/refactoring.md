[< Story](index.md)

# Refactoring: CV1.E4.S1

Review pass notes — what landed as cleanup and what was evaluated but parked.

---

## Applied

### Shared composed-prompt drawer

**Commit `2bf5c77` (phase 6).** The drawer markup in `map.tsx` and `layer-workshop.tsx` was duplicated (~35 lines each). Phase 6 added scope dropdowns to both; maintaining parallel copies for the new axes would have guaranteed drift. Extracted to `adapters/web/pages/composed-drawer.tsx` as a single `ComposedDrawer` FC, parameterized by `endpoint`, `personas`, `organizations`, `journeys`.

Net: one new file, two files slimmed, one canonical source for future axis additions (attachments in CV1.E4.S2 will slot in here).

### Scope surfaces visually coherent with the map

The `/organizations` and `/journeys` list and workshop pages inherit layout conventions from the Cognitive Map (`.workshop-breadcrumb`, `.workshop-form`, `.workshop-summary`) plus scope-specific CSS (`.scope-list`, `.scope-grid`, `.scope-card`, `.journey-group`). Same palette, same density, same edit affordances.

### Reception module separation

`server/scopes.ts` created as the shared helper for `extractScopeDescriptor`, mirroring `server/personas.ts`. Both the reception classifier and future consumers (rail, composer previews, drawer) read through the same function — no drift risk on descriptor extraction rules.

---

## Evaluated but not done

### List-page scaffolding duplication (orgs vs journeys)

Both `organizations.tsx` and `journeys.tsx` implement list pages with the same structural elements: header + intro, create form, empty state, grid of cards, archived toggle, archived section. The components differ in details (journeys groups by organization, orgs don't), but the scaffolding is parallel.

**Parked.** Rule of three: two occurrences tolerate the duplication. When CV1.E4.S2 (attachments library) or CV1.E6 (memory map sections) ships a third similar list page, extract a shared `ScopeList` component.

**Revisit criterion:** a third list page with the same scaffolding.

### `scope-card` appears indistinguishable from `map-card--link`

The card shape on `/organizations` and `/journeys` lists is visually similar to the structural cards on the Cognitive Map, but they use different class trees (`.scope-card` vs `.map-card`). Some properties duplicate (padding, hover border transition, inner layout).

**Parked.** The visual similarity is intentional (consistency across surfaces), but coupling the CSS would mean changes to the Cognitive Map's cards affect scope cards too, and vice versa — probably not desired. Keep distinct for now.

**Revisit criterion:** if a third card surface appears (attachments, memory items), consider a shared base class with per-surface modifiers.

### `renderScope` helper could move to `server/scopes.ts`

`composeSystemPrompt` contains an internal `renderScope` function that formats a scope into its prompt block. It could migrate to `server/scopes.ts` next to `extractScopeDescriptor`, which would concentrate scope-shape logic in one module.

**Parked.** The function is 12 lines and used only by the composer. Moving it feels like motion for motion's sake until a second caller (preview rendering? drawer?) needs the same shape.

**Revisit criterion:** a second consumer of briefing-situation block formatting.

### Delete organization cascade could be enforced at the DB level

`deleteOrganization` explicitly `UPDATE journeys SET organization_id = NULL` before the DELETE. Enabling `PRAGMA foreign_keys = ON` plus declaring `ON DELETE SET NULL` on the FK would move the guarantee to SQLite.

**Parked.** Enabling `foreign_keys` affects the whole connection — existing tables that don't declare FK actions would suddenly start enforcing them, potentially breaking existing flows in ways that aren't covered by tests today. The defensive transaction in the helper gives the same guarantee without that risk. Worth revisiting once we do a survey of all FK relationships.

**Revisit criterion:** a sweep to enable `PRAGMA foreign_keys = ON` across the DB.

### Eval fixture data is hardcoded to the primary user

`evals/scope-routing.ts` hardcodes `"Alisson Vale"` as the user for probes. Same pattern as `evals/routing.ts`. When the product grows past a single user, both evals will need per-user fixture files.

**Parked.** Not blocking. Consistent with existing convention.

**Revisit criterion:** a second user with non-trivial identity content that needs eval coverage.

### Rail label is plain key, not display name

The rail shows `organization: software-zen` and `journey: o-espelho` — raw keys, not the human `name` field. Names would be friendlier.

**Parked.** Shipping names requires either passing them through the rail payload (extra fields) or making the rail look them up. First-iteration value in the raw key is low (keys are short and readable); worth revisiting if users report friction.

**Revisit criterion:** a user notes confusion between key and display name.

---

## Not touched

Everything outside the story's scope. Notably:
- The telegram and CLI adapters were left with base composition (no scope injection).
- `/mirror/begin-again` and `/mirror/forget` already work; scope rows naturally reset to hidden on the fresh session.
- Existing persona / identity workshop flows were untouched.
