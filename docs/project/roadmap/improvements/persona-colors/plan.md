[< Improvement](index.md)

# Plan: Persona colors

**Improvement:** [Persona colors](index.md)
**Framing:** Colors were a cosmetic derivative of the persona key — a hash, no persistence, applied sparsely. Reinforcing persona identity visually across the system requires persistence, editability, and consistent application. Not big enough to need a dedicated epic, but deliberate enough to deserve a plan and test guide.

---

## Goal

Give each persona a persistent color stored in the database, let the user edit it from the persona workshop page, and apply it uniformly wherever a persona is surfaced.

**Validation criterion:** open any conversation that uses the `mentora` persona. Go to `/map/persona/mentora` and pick a distinctive color from the palette (say the teal `#8aa08b`). Return to `/conversation` — Cast avatar, bubble color bar, `◇ mentora` badge, and (for admin) the rail Composed row all carry the teal. `/conversations` listing tag on rows tagged with mentora is teal. `/map` persona badge avatar is teal. `/personas` listing avatar is teal. Edit the color again in the workshop; every surface picks up the change on next render.

## Non-goals (this improvement)

- **Color theme for journeys / organizations.** Only personas. Scopes (orgs, journeys) use a single icon + neutral pill treatment; changing that is a separate decision.
- **Contrast / accessibility tooling.** No picker-side contrast check or warning for illegible foreground/background pairs. The palette is curated for generally-usable on cream; custom hex is user-accepted-risk. Revisit if bad pairs actually show up.
- **Dark mode.** Colors applied as-is. A future theme pass can remap.
- **Per-user admin override of family-member persona colors.** This is about a user coloring their own personas. The narrative's 4 fictional users each carry their own personas with their own colors; no cross-user edit surface.
- **Gradient or multi-color personas.** One solid hex per persona.
- **Color history / revert.** One Reset button (to hash); no undo beyond that.

## Decisions

### D1 — `identity.color TEXT` nullable

Nullable because "stored color" and "hash fallback" are two distinct states worth distinguishing. NULL means "follow the hash" — consumers always read through `resolvePersonaColor(stored, key)` which falls back. This preserves the pre-improvement behavior for any persona that ends up with NULL (shouldn't happen after backfill, but the code path stays defensive).

Non-persona layers (self.soul, ego.*) keep it NULL unconditionally — colors are a persona-only concept today.

### D2 — Palette is curated; custom hex is permitted

Two affordances in the picker:
- **8-color palette** (swatches) — the `PERSONA_COLORS` constant, lifted from the frontend into `server/personas/colors.ts` so both render paths share it.
- **Custom hex input** — accepts `#rgb`, `#rrggbb`, `#rrggbbaa`. Validated server-side via `normalizeHexColor`. Invalid input silently no-ops.

Custom takes precedence when both are posted (user typed a hex AND clicked Apply — intent is clear). Clearing (empty string) resets to NULL → hash.

### D3 — Migration backfills existing rows with the hash

The `migrate()` function runs `UPDATE identity SET color = ?` for every persona whose color is NULL, using the same hash function that was implicit before. This means upgrading to the improvement doesn't change any visual — personas keep the color they already had, now stored. The user sees the difference only when they edit.

Backfill is done in JS (not SQL) because the Horner-style *31 hash is cleaner imperatively than as a CTE.

### D4 — New personas get a hash seed on insert

`setIdentityLayer(db, ..., 'persona', key, content)` now writes `color = hashPersonaColor(key)` on the initial insert. ON CONFLICT UPDATE does NOT touch color, so re-saving content never clobbers a user's chosen color.

Consequence: the "no color at all" state is unreachable in practice for fresh personas. NULL only appears when the user explicitly resets.

### D5 — Server is the single source of truth for streaming

The `routing` SSE event includes `personaColor` (a resolved hex string) so the client's `attachPersonaSignature` and `ensureCastAvatar` don't re-run the hash — they trust the server. This keeps client and server in sync when the stored color diverges from the hash.

The client-side `personaColor(key)` hash helper stays as a fallback for cases where the server doesn't send the color (legacy/edge paths).

### D6 — RailState carries a pre-built map

Server-render surfaces (header Cast, bubble color bar, etc.) all consume `rail.personaColors: Record<key, color>`. Built once per request in `buildRailState`, iterating the persona layers and resolving each through `resolvePersonaColor`. No N queries, no repeated hash calls in the render.

### D7 — `/map/persona/:key` is the canonical edit surface

Personas share the same workshop route (`/map/:layer/:key`) as self.soul and ego.*, so adding the color picker to that page covers the case cleanly. The section only renders when `layer === "persona"`. No new route needed; the dangling link from the Cast popover ("View persona →") now leads to a useful destination.

### D8 — Click-to-commit, no explicit Save

The palette swatches are `<button type="submit" name="color" value="#...">` — clicking any of them submits the form with that color. No separate Save button. Custom hex has its own Apply button because typing requires a commit gesture.

Matches the behavior of the mode pill in the conversation header: click-to-commit is honest about the action being taken.

## Phases

1. **Schema + helpers + backfill.** DB column, hash/normalize/resolve helpers, setPersonaColor, seed on insert, backfill UPDATE in migrate(). Tests for each helper + DB-level probes.
2. **Picker UI + endpoint.** Workshop page gains the Color section. New POST endpoint normalizes + writes. Route tests.
3. **Consumers read from DB.** RailState.personaColors; Cast/CastAvatar/bubble/personas listing/routing SSE event all read from the map. Existing tests continue to pass.
4. **New colored surfaces.** Bubble ◇ badge + /conversations tag + /map persona card + streaming chat.js badge all carry inline color. Tests verify the inline styles.
5. **Docs close-out.** This plan, the improvement index, and the test guide.

## Files likely touched

- `server/db.ts` — schema + migrate + backfill
- `server/db/identity.ts` — IdentityLayer.color, setPersonaColor, seed on insert
- `server/personas/colors.ts` (new) — PERSONA_COLORS, hashPersonaColor, normalizeHexColor, resolvePersonaColor
- `adapters/web/pages/context-rail.tsx` — RailState.personaColors
- `adapters/web/pages/conversation-header.tsx` — CastAvatar reads color prop
- `adapters/web/pages/mirror.tsx` — bubble signature + badge color from the map
- `adapters/web/pages/conversations.tsx` — persona tag inline color
- `adapters/web/pages/map.tsx` — persona badge avatar color
- `adapters/web/pages/personas.tsx` — avatar reads p.color
- `adapters/web/pages/layer-workshop.tsx` — color picker section when layer=persona
- `adapters/web/index.tsx` — buildRailState populates personaColors; routing event emits personaColor; new /map/persona/:key/color endpoint
- `adapters/web/public/chat.js` — accept explicit color from routing event
- `adapters/web/public/style.css` — `.workshop-color` + `.sr-only`
- `tests/persona-colors.test.ts` (new), `tests/db.test.ts`, `tests/web.test.ts`

## Open questions (registered, not blockers)

- **Contrast on text badges.** A user choosing a very light custom hex (e.g. `#fafafa`) for `◇ mentora` text would be illegible on the cream background. Today: accepted. Future: optional contrast warning in the picker, or fall back to a darker swatch text color automatically.
- **Ripple to pre-existing meta.** The `◇ mentora` that appeared in past turns (before this improvement) is now colored live — the color is applied at render time, not stored in the entry. If the user re-colors, old bubbles re-paint. That's what we want, but worth naming.
- **Lookup when the persona no longer exists.** If a session has meta referencing a persona the user deleted, the listing/conversation still shows `◇ deleted-key`. `personaColors` doesn't include it → inline style omitted → falls back to the `.msg-badge-persona` default color (the old `#8b7d6b`). Acceptable.

## Risks

- **Visual drift across releases.** The palette `PERSONA_COLORS` is shared server + frontend. If someone edits only one side, personas with hash fallback will render different colors in different render paths. Mitigation: the palette + hash function now live in a single file (`server/personas/colors.ts`), and the frontend `avatarColor` is unchanged for non-persona uses but the persona render paths route through the server's map instead of the frontend hash. Drift is impossible unless the two hash implementations diverge — a single-file change guard is in the test suite (`hashPersonaColor` membership test).

## Done criteria

- [ ] 628+ tests passing after phase 4; +36 new total.
- [ ] Picker renders on `/map/persona/<key>`; non-persona workshops unaffected.
- [ ] Color change via picker → visible across Cast, bubble, `/conversations`, `/map`, `/personas` on next render.
- [ ] Backfill migration runs idempotently; no visual change on upgrade.
- [ ] Improvement docs present: index, plan (this file), test guide.
