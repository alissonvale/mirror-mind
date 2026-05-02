[< Story](index.md)

# Test guide — CV1.E11.S3 Memória dashboard smoke

End-to-end manual smoke for the new `/memoria` surface.

## Pre-conditions

- Latest build deployed; `npm run dev` running.
- Hard reload to pick up new asset versions.
- Logged in as Alisson.
- At least one cena, one organization, one journey existing (otherwise empty states will dominate — also test those separately, see Test 5).

## Test 1 — Dashboard renders the 2×2 grid + Histórico

1. Click the avatar `[A]` in the top bar from `/inicio`.
2. Click **Minha Memória**.
3. **Expected:** lands on `/memoria` (TopBarLayout chrome). Page title "Minha Memória" or similar.
4. Grid shows 4 cards (2×2 on desktop, stacked on mobile):
   - **Cenas** — count + 3 most-recent cenas listed with glyph
   - **Travessias** — count + 3 most-recent journeys
   - **Organizações** — count + 3 most-recent orgs
   - **Library** — em-breve badge + placeholder text
5. Below the grid, **Histórico** heading + count + list of up to 20 recent sessions in `/conversations` style markup.
6. Each list shows "ver →" or equivalent link.

**Validates:** dashboard structure + chrome.

## Test 2 — Cards link to listing pages

1. Click "ver →" on the Cenas card → lands on `/cenas` showing the list of cenas.
2. Click "ver →" on the Travessias card → lands on `/journeys`.
3. Click "ver →" on the Organizações card → lands on `/organizations`.
4. Library "ver →" is absent or disabled.

**Validates:** card-level navigation.

## Test 3 — Card item links go directly to the entity

1. On `/memoria`, click a cena name in the Cenas card.
2. **Expected:** lands on `/cenas/<key>/editar` (or whatever the cena's primary surface is — currently editar).
3. Click a journey name → `/journeys/<key>`.
4. Click an org name → `/organizations/<key>`.

**Validates:** item-level navigation.

## Test 4 — Histórico links work

1. On `/memoria`, click a row in the Histórico → lands on `/conversation/<sessId>` showing the thread.
2. Click "ver tudo →" → lands on `/conversations` (existing surface).

**Validates:** Histórico navigation.

## Test 5 — Empty states render correctly

To exercise empty states without polluting the prod DB, run with a fresh user (or use a test fixture). Alternatively, archive everything in a sandbox.

For each card with no items:
- **Expected:** card stays in grid, count says "0 ativas", body shows "Nenhuma X ainda" + "+ Criar X" link to the create surface.
- Library card always shows the em-breve placeholder regardless of state.

**Validates:** empty state per card.

## Test 6 — `/cenas` list page

1. Navigate directly to `/cenas`.
2. **Expected:** TopBarLayout chrome; grid of CenaCard for all active cenas (same component as on `/inicio`).
3. Empty state when no cenas: "Nenhuma cena ainda — crie a primeira" + link.

**Validates:** /cenas list works as the destination of the Memória > Cenas card.

## Test 7 — Old surfaces unchanged

1. Navigate to `/`, `/conversation/<existing>`, `/me`, `/map`, `/personas`, `/organizations`, `/journeys`.
2. **Expected:** all render with the existing sidebar chrome unchanged.

**Validates:** strangler — old surfaces untouched.

## Sign-off

If all 7 pass, S3 is ready for the wrap-up. Remaining stories in CV1.E11: S6 (onboarding seed), S5 (cutover).
