[< Improvement](index.md)

# Test guide — Persona colors

Manual validation walkthrough. Runs against a dev server (`npm run dev`) with Alisson's account (admin).

## 1. Upgrade preserves the visual

Before running the improvement: note the color of at least one persona avatar in the Cast on `/conversation`. After upgrading (git pull + restart):

1. Open `/conversation`.
2. Confirm every persona in the Cast shows the **same color it had before**. The backfill migration used the hash function — no visual shift on upgrade.

## 2. Edit a color, see it everywhere

1. Go to `/map/persona/<your-persona>` (e.g. `/map/persona/mentora`).
2. A new **Color** section is above the Summary. It shows:
   - The current swatch on the left + its hex label (or `#xxxxxx · hash fallback` if unset).
   - An 8-swatch palette.
   - Custom hex input + Apply.
   - Reset to hash button.
3. Click any palette swatch → redirect back to `/map/persona/<key>` with the current swatch now showing the new color.
4. Navigate to `/conversation`:
   - **Cast avatar** for that persona: new color.
   - If that persona speaks in the conversation, the **bubble color bar** (border-left) and the **`◇ persona` text badge** carry the new color on the next assistant turn.
5. Navigate to `/conversations`:
   - The **persona tag** (`◇ persona`) on rows tagged with this persona carries the new color.
6. Navigate to `/map`:
   - The **persona badge avatar** on the Cognitive Map uses the new color as background.
7. Navigate to `/personas`:
   - The **avatar badge** on the listing uses the new color.

All five surfaces should be in sync.

## 3. Custom hex

1. Back in `/map/persona/<key>`, type a hex (e.g. `#ff7777`) in the Custom hex input.
2. Click Apply.
3. Confirm the color picker's current swatch now reflects the custom hex, and all five surfaces above picked it up.

## 4. Invalid custom hex is silently rejected

1. Type `rainbow` in the Custom hex input.
2. Click Apply.
3. The redirect still happens, but the stored color is unchanged. Current swatch keeps its previous value.

The client-side `pattern=` attribute on the input already blocks obvious non-hex; the server also validates and no-ops on bad input.

## 5. Reset to hash

1. With a custom color in place, click **Reset to hash**.
2. The Color section label now reads `#xxxxxx · hash fallback`.
3. The resolved color matches what `hashPersonaColor(key)` would return — same as before any edit.

## 6. New persona starts colored

1. On `/map`, click **+ add persona**, create a new one (e.g. `chronicler`).
2. Confirm the new persona has a color from the palette immediately — no visit to the color picker needed. The seed ran on insert.
3. The color matches `hashPersonaColor("chronicler")`.

## 7. Streamed turns

1. Start a new conversation, tag a persona that has a custom color (e.g. the one you set in step 2).
2. Send a message. Reception picks the persona.
3. During the streaming response:
   - **Cast avatar** is painted live with the custom color (via `ensureCastAvatar` + the `routing` event's `personaColor` field).
   - **Bubble color bar** is the custom color on the streamed bubble.
   - **`◇ persona` badge**, if this is a persona transition, is the custom color.

## 8. Color survives re-save of content

1. Set a persona color via picker (e.g. `#112233`).
2. Go to `/map/persona/<key>` and click Edit → change the content → Save.
3. Confirm the color is still `#112233`. (The save path uses `setIdentityLayer` which the ON CONFLICT UPDATE doesn't touch color.)

## 9. Multi-user isolation

If the demo family is loaded (`narrative load`):

1. As Dan Reilly, pick a color for his `engineer` persona.
2. Switch session to Elena Marchetti (another admin via token).
3. Confirm Elena's `engineer` persona (if it exists — each user has their own keys) is unchanged. Colors live on `(user_id, layer, key)`; cross-user leakage is impossible by schema.

## 10. Regression quick-check

These shouldn't change:

- `/me`, `/admin/*`, `/journeys`, `/organizations`, `/docs` — unaffected.
- Non-persona layers (self.soul, ego.identity, ego.expression, ego.behavior) — no color section in the workshop; no color applied anywhere.
- Sidebar navigation — untouched.
- Rail (admin only, Look inside) — unchanged.

---

Report anything that drifts from expectation.
