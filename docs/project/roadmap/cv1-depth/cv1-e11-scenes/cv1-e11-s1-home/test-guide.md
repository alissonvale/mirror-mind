[< Story](index.md)

# Test guide — CV1.E11.S1+S2 home + briefing + cold-start smoke

End-to-end manual smoke for the new home, the avatar top bar, the briefing-in-compose, and the cold-start suggestion card.

## Pre-conditions

- Latest build deployed; `npm run dev` running.
- Hard reload to pick up new asset versions.
- Logged in as Alisson (admin) — sees Admin and Docs items in the avatar menu.
- At least one cena exists (create via `/cenas/nova` if needed: a Voz da Alma cena and a persona cena make the smoke richer).

## Test 1 — Home renders Variant C

1. Navigate to `http://localhost:3000/inicio`.
2. **Expected:** avatar top bar at top (no sidebar). Brand `⌘ espelho` left, avatar `[A]` right.
3. Cards row: existing cenas as cards plus a `✚ Nova cena` card on the end.
4. `─── ou ───` separator.
5. Free input field with placeholder.
6. **Recentes** section listing recent sessions, each labeled with its scene (or `(sem cena)`).

**Validates:** S2 chrome + S1 layout.

## Test 2 — Avatar menu items by role

1. On `/inicio`, click the avatar `[A]`.
2. **Expected dropdown:**
   - Header: name + email (clickable → `/me`)
   - Mapa Cognitivo
   - Minha Memória
   - Skills (em breve, no link or disabled)
   - separator
   - Admin (only as admin)
   - Docs (only as admin)
   - separator
   - Sair
3. Click outside → dropdown closes.

**Validates:** S2 dropdown behavior + admin gating.

## Test 3 — Free input creates session

1. On `/inicio`, type "estou pensando em pricing do book release" and submit.
2. **Expected:** redirect to `/conversation/<uuid>` with the message already in the thread; assistant streams a response.
3. SQL: `sqlite3 data/mirror.db "SELECT id, scene_id FROM sessions ORDER BY created_at DESC LIMIT 1"` → newest session has `scene_id=NULL`.

**Validates:** free input flow + auto-send via seed param.

## Test 4 — Cena card click starts new session

1. Back to `/inicio`. Click a cena card (e.g., "Aula Nova Acrópole").
2. **Expected:** redirect to `/conversation/<uuid>` of a NEW session linked to the cena.
3. SQL: newest session has `scene_id` matching the cena's id.
4. Send any message; the assistant response should reflect the cena's briefing in tone (especially noticeable on a richly-briefed cena).

**Validates:** card click → session creation flow + briefing in compose (P4).

## Test 5 — Briefing visible in composed snapshot

1. After Test 4, in the conversation, open `Look inside ›` (admin only — the rail composed snapshot).
2. **Expected:** a new entry showing the cena's briefing — labeled `Cena: <title>` with the briefing content.
3. SQL: confirm `_scene_key` (or similar meta) on the assistant entry if we stamp it.

**Validates:** briefing reaches the prompt + snapshot reflects it.

## Test 6 — Cold-start suggestion appears

1. From `/inicio`, send a free-input message that should match an existing cena (e.g., if you have an "Aula Nova Acrópole" cena with org=nova-acropole, send "ressonância com o conceito de eídos" or similar).
2. After the assistant response renders, **expected:** a suggestion card appears below the bubble: `◇ Parece "Aula Nova Acrópole" — continuar nessa cena?` with `[Continuar nessa cena]` and `[Manter sem cena]` buttons.
3. Click `[Continuar nessa cena]`.
4. **Expected:** card disappears; the conversation header now shows the cena name; SQL confirms `sessions.scene_id` is set.
5. Send another turn; the assistant's response now composes through the cena's briefing.

**Validates:** cold-start match + apply-scene endpoint + briefing-from-turn-2.

## Test 7 — Cold-start dismiss

1. From `/inicio`, send a message that matches a cena.
2. Click `[Manter sem cena]`.
3. **Expected:** card disappears; session.scene_id stays NULL.
4. Send another turn; **no new suggestion appears** (cold-start only fires on turn 1).

**Validates:** dismiss path + turn-1-only gate.

## Test 8 — No suggestion when no match

1. From `/inicio`, send a fragment that no cena could plausibly match (`oi`, `ok`, or something genuinely orthogonal).
2. **Expected:** no suggestion card. Trivial turns return null up front; non-trivial without match also return null.

**Validates:** strict-match matrix from S4 + no false positives.

## Test 9 — Existing UI not regressed

1. Navigate to `/` (old home), `/conversation/<existing>`, `/me`, `/map`, `/personas`, `/organizations`, `/journeys`.
2. **Expected:** all render with the existing sidebar chrome unchanged. No broken links.

**Validates:** strangler — old surfaces untouched.

## Sign-off

If all 9 pass, S1 + S2 are ready for the wrap-up phase. Next stories: S6 (onboarding seed), S3 (Memória dashboard), S5 (cutover).
