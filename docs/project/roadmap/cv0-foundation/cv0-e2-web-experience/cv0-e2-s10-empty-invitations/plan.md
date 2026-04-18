[< Story](index.md)

# Plan: CV0.E2.S10 — Empty states as invitations

**Roadmap:** [CV0.E2.S10](../index.md)
**Framing:** an empty card is not a hole. It's the first chance to explain what the layer is and invite the user to shape it. The Skills card in S8 was the prototype of this voice; S10 extends it across every structural card that can be empty.

---

## Goal

When a structural card has no content, render a textual invitation that answers two questions — *what is this layer?* and *what do I do with it?* — in the same visual and tonal family. No grey placeholders, no "no content" stubs, no empty bodies.

## In scope

- **Self/Soul** — richer invitation replacing the terse "No soul written yet. Open the workshop to set your foundation."
- **Ego/Identity** — richer invitation.
- **Ego/Behavior** — richer invitation.
- **Personas** — a *new* empty-state invitation. Today the card renders an empty badge grid with just the `+ add persona` button when no personas exist — a layout hole.
- **Skills** — already done in S8 phase 4; kept as-is.

## Out of scope

- Changes to non-empty card rendering (preview, word count).
- Rewriting invitations for future layers (shadow, meta-self) — those don't render yet.
- Animated or interactive empty states.
- Image or icon assets.

## Copy (primary invitations)

- **Self/Soul:** *Your soul is the deepest voice — what you are before you are anything specific. Frequency, nature, origin. Open the workshop to write your foundation.*
- **Ego/Identity:** *Your operational identity — how you show up in the day-to-day. What you do, what you're known for, how you introduce yourself. Open the workshop to set it.*
- **Ego/Behavior:** *Your behavior — tone, stance, how you act and refuse to act. The rules you live by, written in your own words. Open the workshop to define them.*
- **Personas:** *Personas are the specialized voices the mirror speaks in — a mentor who listens with care, a strategist who cuts through noise, a writer who crafts with precision. Each persona is a lens the ego activates when a particular kind of depth is needed. Click + add persona to create your first.*
- **Skills:** (unchanged; kept from S8 phase 4 as the two-tier prototype — the layer itself doesn't exist yet, so the voice includes a status line.)

## Steps

1. Update `emptyInvitation` text on the four structural card call sites in `map.tsx`. No prop shape change — each invitation remains a single string.
2. Render a Personas empty-state invitation inside the Personas card body when `personas.length === 0`, keeping the `+ add persona` badge in place. The invitation appears above the badge grid (one-button grid).
3. Light CSS for the Personas empty-state block if the badge-grid alignment needs room.
4. Test: GET `/map` for a fresh user (no identity seeded + no personas) contains each invitation copy.
5. Docs: test-guide, worklog update, mark S10 ✅.

## Files likely touched

- `adapters/web/pages/map.tsx` — copy updates + Personas empty-state block.
- `adapters/web/public/style.css` — minor styling for the personas empty block if needed.
- `tests/web.test.ts` — one or two tests covering the empty-state invitations.
