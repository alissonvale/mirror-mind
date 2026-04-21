[< Story](index.md)

# CV0.E4.S3 — Sidebar organized by the three questions

## Context

After S1 (home) and S2 (sidebar pruning + admin shortcuts), the sidebar is leaner but still presents context links as a flat list of nouns: *Conversation · Organizations · Journeys.* The user surfaced the product thesis out loud — *if I organize what the mirror knows about me, the AI can give responses that reflect my concrete situation* — and asked whether the menu structure could make that thesis visible.

Three questions emerged as the organizing frame:

- **Who Am I** — identity (soul, ego, personas)
- **What I'm Doing** — current activity (journeys)
- **Where I Work** — relational context (organizations)

Option B from the wireframes was chosen: **visible section headers, Conversation at the top**. The trade-off the user accepted: a bit more visual weight in the sidebar in exchange for the premise being *taught* every time it opens.

## Scope

**In scope**
- Sidebar nav restructure in `adapters/web/pages/layout.tsx`
- Psyche Map becomes a first-class sidebar link (was only reachable via avatar; `/map` page title, heading, workshop breadcrumbs, and tooltips rename together)
- Tests updated to assert the three headers + the new link

**Out of scope (parked)**
- Removing the avatar as a clickable element → kept for now; identity-as-badge plus nav-link-as-action is acceptable redundancy
- "What I Carry" (Memory Map) section → awaits CV1.E6
- Any per-persona or per-journey sub-navigation inside the groups → future S4+ if the sidebar needs to scale

## Wording

Final headers after a second round of product-designer review:

- `Who Am I`
- `What I'm Doing`
- `Where I Work`

"Who Am I" and "What I'm Doing" are the user's own cadence, preserved. "Where I Work" replaced the original "To Whom I'm Affiliate" after a short exchange: "Affiliate" was grammatically unusual (should be *affiliated*), carried corporate overtones, and didn't translate cleanly to Portuguese. "Where I Work" is warmer, grammatically clean, legible in both languages (*Onde eu trabalho*), and literal to what organizations are for this user — places of work.

The surface label "Cognitive Map" was renamed to **Psyche Map** in the same pass. "Cognitive" implied intellect, but the surface holds soul, ego expression, and behavior — not cognition. "Psyche" is accurate to the Jungian architecture and distinct from the `soul`/`self` layer names.

## Final sidebar shape

```
Mirror Mind                 (→ /)
◉ alisson                   (→ /map)
────────────────────────────
Conversation                (→ /mirror)

── Who Am I ──
Psyche Map                  (→ /map)

── What I'm Doing ──
Journeys                    (→ /journeys)

── Where I Work ──
Organizations               (→ /organizations)
────────────────────────────
Admin Workspace             (→ /admin, admin-only)
Logout
```

## Files

**Modified**
- `adapters/web/pages/layout.tsx` — reorder nav + add three `.sidebar-section` headers
- `tests/web.test.ts` — new assertion for the three questions + Cognitive Map link

**Reused (no changes)**
- `.sidebar-section` CSS class already exists from the old "This Mirror" header style — same typography (uppercase, small, muted)

## Verification

- `npm test` passes (target: 332+).
- Manual: log in as any user → sidebar shows Conversation at top; three headed sections each with their single link; admin footer unchanged.
