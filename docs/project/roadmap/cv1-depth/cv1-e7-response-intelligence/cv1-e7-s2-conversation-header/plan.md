[< Story](index.md)

# Plan: CV1.E7.S2 — Conversation header + slim rail

**Roadmap:** [CV1.E7.S2](index.md)
**Framing:** Product-designer review of the v0.13.0+ conversation UI flagged the rail as a **junk drawer** — seven blocks with equal visual weight, most of them information rather than action, confining the chat to a central column while competing with it for attention. A parallel insight from the user surfaced that **personas and scope have different natures**: personas form a mutable ensemble across a conversation ("a cast that forms"); orgs and journeys are stable context ("a setting that stays"). The old UI treated all three axes as symmetric tags; this story breaks the symmetry.

---

## Goal

The `/conversation` page renders around a new **conversation header** above the chat and a slimmed rail reduced to two disclosures. Message bubbles gain a **persona signature** that communicates which persona spoke in each turn.

**Structure after this story:**

```
┌── conversation ──────────────────────────────────────┬── rail ──────┐
│ ┌── header ────────────────────────────────────────┐ │              │
│ │ Cast: (A)(B)(C) +   Scope: ≡journey ◈org   …     │ │ Edit scope › │
│ │ Mode: essayistic ▾                               │ │ Look inside ›│
│ └──────────────────────────────────────────────────┘ │              │
│                                                       │              │
│  ┃ (a) ┌─ assistant ──┐                               │              │
│  ┃     │ text…        │×                              │              │
│  ┃     └──────────────┘                               │              │
│        ┌─ user ───────┐                               │              │
│       ×│ text         │                               │              │
│        └──────────────┘                               │              │
│  ┃ (b) ┌─ assistant ──┐       ← mini-avatar only on   │              │
│  ┃     │ text…        │×       persona change         │              │
│  ┃     └──────────────┘                               │              │
│                                                       │              │
│  [ type a message… ] [ Send ]                         │              │
└───────────────────────────────────────────────────────┴──────────────┘
```

**Validation criterion:** The Dan Reilly session loads, the new header shows (empty cast, empty scope, auto mode, `⋯` menu). Dan adds `vmware-to-proxmox` journey from the header → pill appears in Scope. He sends *"walk me through the migration sequence"* → reception picks `engineer` persona → (E) avatar appears in Cast, the first assistant bubble gains a left color bar + an `(E)` mini-avatar. Next turn in the same persona → same color bar, **no** mini-avatar (persona hasn't changed). He types *"step back — what do I actually lose if I skip this?"*, reception routes to `strategist` → new bubble gains a different color bar + a fresh `(S)` mini-avatar. Both E and S avatars remain in the cast (ensemble accumulates). The rail is collapsed by default; `Look inside ›` opens the composed snapshot + session stats for inspection.

## Non-goals (this story)

- **Reception returning multiple personas per turn.** That is [CV1.E7.S5](../index.md). The header's Cast is already shaped to render multiple simultaneous personas, but reception's contract stays at "0 or 1 persona" for this story.
- **Integrated vs segmented voicing.** Same — parked for S5. Today's single persona per turn has no ambiguity.
- **Bubble visual overhaul beyond the persona signature.** Bubble shape, padding, colors, markdown rendering all stay. Only the lateral color bar and the conditional mini-avatar are additive.
- **Sidebar changes.** Stays as-is.
- **Chat input form / Send button / microtexts.** Stay as-is.
- **Admin-only views** (`/admin/*`), `/me`, listings, `/map`. Out of scope.
- **Mobile-specific optimizations.** The header and rail will work on narrow screens via existing responsive rules, but no dedicated mobile layout rework in this story.

## Decisions

### D1 — Header is a single fixed row above the scroll

A new `<ConversationHeader>` component renders as the first child of `.chat-container`, before `#messages`. It does not scroll with the messages — stays pinned so the conversation's identity is always at a glance.

**Why above the messages, not inside a scroll-sticky position:** the rail already does the "sticky context" role; a second sticky element inside the scroll adds interaction cost. Fixed above = simpler, honest.

### D2 — Cast = avatars only, clickable

Each persona in the session's pool (`session_personas`) renders as a circular avatar (initials + persona color), reusing the `avatarInitials()` / `avatarColor()` helpers from `context-rail.tsx`. Tooltip shows the persona key. Clicking an avatar opens a small popover with:
- Persona descriptor (from `extractPersonaDescriptor`).
- Turn count within the session (how many assistant messages this persona wrote — meta-stamped already).
- A `Remove from cast` button.

No text label next to the avatar — the cast stays visually compact even with 5-6 personas. Hover/tooltip carries the name.

### D3 — `+` convokes a persona manually (hybrid model)

A `+` affordance at the end of the cast opens a picker with all of the user's personas not currently in the pool. Clicking adds it to `session_personas`. Reception continues to pick within the pool per turn — user agency augments the pool without overriding the classifier.

This answers the open question from the design conversation: **both** user-directed and reception-directed convocation, with user taking precedence on presence in the pool.

### D4 — Scope = two pill groups, inline edit on click

Orgs (◈) and journeys (≡) render as pills alongside the Cast. Max 3 visible per group; overflow collapses to `+N more` that expands inline. Clicking a pill: opens an inline editor with add (select of user's orgs/journeys not yet tagged) and remove (`×` on each existing pill).

**Why two groups, not one:** the iconography already distinguishes (`◈` vs `≡`), and users think in those terms (*"onde?"* vs *"o quê?"*). Collapsing into one undifferentiated list loses the frame.

### D5 — Mode = pill pouch, click expands to segmented control

A single pill showing the active mode (e.g. `essayistic ▾`) next to the Cast/Scope row. Click expands a segmented control inline with `auto | conversational | compositional | essayistic`. Click-to-commit (no explicit Save — the click *is* the save). The pill collapses back to showing the chosen value.

This kills the 6-row vertical block that mode occupied in the rail. The hint text (`"reception picks"`, etc.) moves into tooltips.

### D6 — Menu `⋯` consolidates actions

A three-dot menu on the right of the header opens:
- **New topic** (same POST as today).
- **Forget this conversation** (same POST as today — still with confirm).
- **Look inside** (opens/anchors to the rail's `Look inside ›` section).

Keeps destructive actions (Forget) inside a menu, less prominent than a persistent button. Matches the principle from the design review: "ações destrutivas misturadas ... deviam ter peso visual diferente."

### D7 — Rail slims to two disclosures

Current rail sections all collapse under two entries:
- **`Edit scope ›`** — opens a panel with the existing three-group scope editor (Personas, Organizations, Journeys with add/remove). Essentially today's Scope block plus Personas pool management. Opens inline.
- **`Look inside ›`** — opens a panel with the composed snapshot (layers, persona, org, journey), session stats (messages, tokens, cost, model). The ficha técnica. Admin-only rows (cost) stay admin-only within this view.

The rail's other current sections (active persona block, note paragraph, session actions, "grounded in your identity" footer) are removed — their information moves to the header or to `Look inside`; the actions move to the menu.

**Why leave the rail at all:** it is the natural home for "edit" and "inspect" — heavier interactions that merit a side panel. But the rail default state is now *quiet*; the header carries the conversation's identity.

### D8 — Message bubble persona signature

Two signals on each assistant bubble:

- **Lateral color bar.** Thin 3px strip on the left edge of the bubble, colored with the persona's `avatarColor()`. Renders on every assistant bubble that has a persona. When the persona is null, no bar.
- **Mini-avatar.** Circular 1.4rem badge with persona initials, absolutely positioned at the top-left of the bubble (slight overlap). **Only renders when the persona changes from the previous assistant turn** (or when the previous assistant had no persona). When the persona stays the same across turns, the mini-avatar is suppressed — the color bar alone continues the continuity visually.

User bubbles remain unchanged (no persona; they are the speaker).

**Why change-only for the mini-avatar:** the color bar already communicates continuity. Repeating the mini-avatar on every turn of the same persona is redundant and noisy — what the user wants to see is **transitions**.

### D9 — Per-message `◇ persona` badge is removed

The old `msg-badge-persona` (the `◇ mentora` text label on top of bubbles) is **fully retired** for persona. Its signal is now carried by D8's color bar + mini-avatar, which are richer and more legible.

`msg-badge-organization` and `msg-badge-journey` **stay** with their existing pool-suppression rule (per the previous refinement) — orgs and journeys remain labeled by text badge when they diverge from the pool (rare today, useful for imported sessions).

**Consequence for the earlier refinement (badge-in-pool):** the server-side and client-side pool-comparison code for persona becomes dead weight and is removed. The rule for org/journey stays.

### D10 — Data shape accepts future multi-persona without UI rework

- **Cast** reads from `session_personas` (the pool). Already is, no change.
- **Per-turn persona pick** is read from each assistant entry's `_persona` meta (the current mechanism).
- The Cast renders the *pool*; each bubble signature renders the *pick*. These are already different concepts in the data model (since CV1.E4.S4); this UI finally honors that distinction visually.

When CV1.E7.S5 lets reception return multiple personas per turn, the model extends:
- Pool: same.
- Per-turn pick becomes `[persona]` instead of `persona`. The bubble's color bar can render as two segments; the mini-avatar can become a cluster of 2 small circles. **No header or rail changes are required** — the scaffolding already thinks in plurality.

## Phases

Each phase commits on its own, green tests, descriptive message.

### Phase 1 — Header shell + layout

**Files:**
- New `adapters/web/pages/conversation-header.tsx` — `<ConversationHeader>` component. Takes `rail: RailState` as the data source (already has everything needed).
- `adapters/web/pages/mirror.tsx` — render `<ConversationHeader rail={rail} />` as first child of `.chat-container`, before `#messages`.
- `adapters/web/public/style.css` — new `.conversation-header` styles (flex row, two zones, ⋯ menu on the right).

No behavior yet — just structure. Placeholder zones for Cast, Scope, Mode, Menu.

**Tests:** `tests/web.test.ts` — the header renders with the four zones on `/conversation`.

### Phase 2 — Cast block (avatars + `+` picker)

**Files:**
- Extend `<ConversationHeader>` with Cast rendering: map `rail.tags.personaKeys` through `avatarInitials`/`avatarColor` into circular avatars.
- Popover-on-click for each avatar: descriptor, turn count, Remove.
- `+` affordance → dropdown/picker of unpicked personas. On select, POST to `/conversation/tag` (existing endpoint).
- Turn count per persona: new tiny server helper `getPersonaTurnCountsInSession(db, sessionId)` reading `_persona` meta from assistant entries.

**Tests:**
- Header renders N avatars for N personas in the pool.
- `+` picker shows only personas not in the pool.
- Popover shows descriptor + turn count.
- Clicking Remove POSTs to `/conversation/untag` and the avatar disappears on reload.

### Phase 3 — Scope block (orgs + journeys pills)

**Files:**
- Extend `<ConversationHeader>` with two pill groups: `◈ org-key` and `≡ journey-key`, max 3 per group, overflow → `+N more` expandable.
- Click a pill → inline editor (select + add + × for each existing).
- Uses existing `/conversation/tag` and `/conversation/untag` endpoints.

**Tests:**
- Pills render for each tagged org/journey.
- Add via inline editor POSTs and renders after reload.
- Remove `×` works.
- Overflow collapses beyond 3.

### Phase 4 — Mode pill with segmented control

**Files:**
- Extend `<ConversationHeader>` with the mode pill showing `rail.responseMode.override ?? "auto"`.
- Click: expands segmented control inline. Each option: on click, POST to `/conversation/response-mode` (existing endpoint) with that mode. Page reload (existing pattern) brings the updated pill.

**Tests:**
- Pill shows the active mode.
- Segmented control shows all four options, with the active one highlighted.
- Click commits.

### Phase 5 — Menu `⋯`

**Files:**
- Extend `<ConversationHeader>` with the menu trigger. Simple dropdown (no JS dependency — existing `<details>` or a small click-to-toggle).
- Menu items: `New topic` (form POST to `/conversation/begin-again`), `Forget this conversation` (form POST with confirm), `Look inside` (anchor scroll to rail's `Look inside ›` section).

**Tests:**
- Menu trigger + items render.
- Items map to correct endpoints / anchors.

### Phase 6 — Rail slim

**Files:**
- Rewrite `adapters/web/pages/context-rail.tsx`:
  - Remove the persona block, the scope tags section (it becomes accessible via the header's Scope block + `Edit scope ›` disclosure), the response mode section, the session block, the composed block, the session actions (New topic / Forget), the footer link.
  - Add `<details>` disclosures for `Edit scope ›` (wraps the three groups with add/remove — same components, just nested in `<details>`) and `Look inside ›` (composed snapshot + session stats + model + cost).
- `buildRailState` stays the same. RailState's shape does not change — the rail consumes less of it, the header consumes more.

**Tests:**
- Rail collapsed by default shows only the two disclosure triggers.
- `Edit scope ›` expands and shows the tag editors.
- `Look inside ›` expands and shows composed + session stats.
- All the existing rail POST endpoints still work (the forms move but the routes stay).

### Phase 7 — Bubble persona signature

**Files:**
- `adapters/web/pages/mirror.tsx` — for each message, compute `persona` from meta and a `personaChanged` flag (true when the current assistant's persona differs from the previous assistant's persona).
- Render lateral color bar via `style` on the bubble (`border-left: 3px solid {color}` for assistant; none for user).
- Conditionally render a `.msg-avatar-chip` element (absolute-positioned top-left) when `personaChanged`.
- `style.css` — `.msg-avatar-chip` styling (small, circular, padded off the bubble edge).
- `adapters/web/public/chat.js` — on streaming `routing` event, compute `personaChanged` against the last assistant in the DOM and attach the signature (color bar + conditional chip) to the streaming bubble.

**Tests:**
- First assistant with persona → color bar + mini-avatar.
- Second assistant, same persona → color bar + NO mini-avatar.
- Third assistant, different persona → color bar (new color) + mini-avatar.
- Assistant with no persona → no color bar, no chip.

### Phase 8 — Retire the per-message persona badge

**Files:**
- `adapters/web/pages/mirror.tsx` — remove `showPersona` branch and the `msg-badge-persona` span. Keep org/journey per existing rule.
- `adapters/web/public/chat.js` — remove the persona branch in the `routing` handler (keep org/journey).
- Tests in `tests/web.test.ts` — the badge-in-pool describe block's persona assertions update to reflect total removal; org/journey assertions stay.

### Phase 9 — Close-out

- `docs/process/worklog.md` entry.
- Mark S2 ✅ in epic + roadmap indexes.
- Refactoring log in the story folder.
- `decisions.md` entry for the cast-as-ensemble design principle and the asymmetric treatment of persona vs scope.

## Files likely touched

- `adapters/web/pages/conversation-header.tsx` (new)
- `adapters/web/pages/context-rail.tsx` (slim)
- `adapters/web/pages/mirror.tsx` (wire header + bubble signature)
- `adapters/web/public/chat.js` (streaming signature)
- `adapters/web/public/style.css` (header, pill/pouch/segmented styles, bubble signature)
- `adapters/web/pages/layout.tsx` (CSS version bump)
- `server/me-stats.ts` or a new `server/session-stats.ts` helper (persona turn counts) — resolve during implementation
- `tests/web.test.ts` (new describe blocks: header, rail slim, bubble signature)

## Open questions (registered, not blockers)

- **Look inside on narrow screens.** When the rail is collapsed, do the disclosures stay in the right column, or move below the chat? Resolve during Phase 6 when the responsive rules come out.
- **Avatar click — popover or navigate?** Popover wins for compactness. Navigation to `/map/persona/<key>` is a natural reflex but overshoots "quick inspection." Keep popover; add `View persona →` inside the popover as link to the workshop page if useful.
- **Mode pill's tooltip vs hint text.** Hint text was readable inline in the old rail; tooltip hides on mobile. Decide: keep the hint in the segmented control, hide it in the collapsed pill. Resolve during Phase 4.
- **Turn count per persona in the popover.** Current meta-read approach relies on `_persona` stamped on assistant entries. Imported sessions (pre-import timestamp) may not carry the stamp — the count falls back to 0. Acceptable for v1.

## Risks

- **Header density.** Cast + Scope + Mode + Menu on one row can feel crowded on ≤1200px widths. Mitigation: Cast and Scope share a single row that wraps when needed; Mode + Menu pin to the right. If wrapping looks bad, move Mode into the Menu.
- **Avatar click ergonomics on mobile.** Popovers on touch are fragile. Mitigation: the popover has click-outside-to-dismiss; explicit `View persona →` link inside is the escape hatch.
- **User confusion on first encounter.** The rail no longer carries New topic and Forget — they move to the menu. Users familiar with the rail-heavy UI may look for them there. Mitigation: the sidebar's `New` entry (shipped earlier) still starts a new conversation; Forget is less frequent. Documented in release notes.
- **Persona signature might feel subtle.** A 3px color bar and an occasional mini-avatar are quiet. Intentional (Quiet Luxury), but if first-use shows users missing the signal, thicken the bar or add animation to the mini-avatar on appearance.

## Done criteria

- [ ] `./run_tests.sh` green; net new tests ≥ 12 (header: 4, cast: 3, scope: 2, mode: 1, menu: 1, rail slim: 2, bubble signature: 4, badge retirement: 2).
- [ ] Manual validation: the narrative criterion above reproduces for Dan Reilly + Alisson sessions.
- [ ] Rail collapsed by default; two disclosures visible; each expands to the expected content.
- [ ] Bubble signature appears only when persona changes between turns; color bar continues for same-persona runs.
- [ ] Per-message `◇ persona` text badge is gone; `◈ org` and `↝ journey` badges still suppressed when in pool, rendered when diverging.
- [ ] Story docs present: index, plan (this file), test guide (if manual steps warrant), refactoring log.
- [ ] Worklog entry.
- [ ] Decisions.md ADR for the cast-vs-scope asymmetry.
