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
   - A native color picker (the OS/browser color input) pre-filled with the current color.
   - The current hex beside it.
   - A Save button.
3. Click the color swatch, pick any color in the native picker, click Save → redirect back to `/map/persona/<key>` with the new color persisted.
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

## 3. Full-spectrum picker

The native color input exposes the full 24-bit spectrum — any color the OS picker allows is valid. The server validates shape (`#rgb` / `#rrggbb` / `#rrggbbaa`) and silently no-ops on garbage (cannot happen through the native picker; only relevant if someone POSTs manually).

## 4. New persona starts colored

1. On `/map`, click **+ add persona**, create a new one (e.g. `chronicler`).
2. Confirm the new persona has a color from the palette immediately — no visit to the color picker needed. The seed ran on insert.
3. The color matches `hashPersonaColor("chronicler")`.

## 5. Streamed turns

1. Start a new conversation, tag a persona that has a custom color (e.g. the one you set in step 2).
2. Send a message. Reception picks the persona.
3. During the streaming response:
   - **Cast avatar** is painted live with the custom color (via `ensureCastAvatar` + the `routing` event's `personaColor` field).
   - **Bubble color bar** is the custom color on the streamed bubble.
   - **`◇ persona` badge**, if this is a persona transition, is the custom color.

## 6. Color survives re-save of content

1. Set a persona color via picker (e.g. `#112233`).
2. Go to `/map/persona/<key>` and click Edit → change the content → Save.
3. Confirm the color is still `#112233`. (The save path uses `setIdentityLayer` which the ON CONFLICT UPDATE doesn't touch color.)

## 7. Multi-user isolation

If the demo family is loaded (`narrative load`):

1. As Dan Reilly, pick a color for his `engineer` persona.
2. Switch session to Elena Marchetti (another admin via token).
3. Confirm Elena's `engineer` persona (if it exists — each user has their own keys) is unchanged. Colors live on `(user_id, layer, key)`; cross-user leakage is impossible by schema.

## 8. Regression quick-check

These shouldn't change:

- `/me`, `/admin/*`, `/journeys`, `/organizations`, `/docs` — unaffected.
- Non-persona layers (self.soul, ego.identity, ego.expression, ego.behavior) — no color section in the workshop; no color applied anywhere.
- Sidebar navigation — untouched.
- Rail (admin only, Look inside) — unchanged.

---

Report anything that drifts from expectation.
