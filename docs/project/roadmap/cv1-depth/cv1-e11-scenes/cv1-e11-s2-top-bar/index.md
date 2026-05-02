[< CV1.E11](../)

# CV1.E11.S2 — Avatar top bar (chrome for new surfaces)

**Status:** 🟡 In progress · Opened 2026-05-02

## Problem

The cena pivot demoted the sidebar's seven equal entries (Map, Personas, Organizations, Journeys, Conversations, Admin, Docs) to a single avatar menu — *identity vs. context* split (`Mapa Cognitivo` for psyche layers, `Minha Memória` for orgs/travessias/library/history/scenes). The old sidebar still serves the old surfaces during the strangler period, but new surfaces (`/inicio`, `/memoria`, `/mapa-cognitivo`) need a chrome that matches the cena-first model.

## Fix

A shared `AvatarTopBar` component used by every new surface during the strangler period. Logo on the left, avatar button on the right, dropdown menu hidden by default. No center navigation.

## What ships

- `adapters/web/pages/avatar-top-bar.tsx` — `AvatarTopBar({user})` component
- `adapters/web/public/avatar-top-bar.js` — dropdown toggle (~30 lines vanilla)
- i18n keys `topbar.*` in en + pt-BR
- Used by `/inicio` in S1 (and future `/memoria` in S3, `/mapa-cognitivo` later)

Dropdown items (top to bottom):
- Name + email header — clickable, links to `/me`
- Mapa Cognitivo — links to `/map` (existing surface, will migrate later)
- Minha Memória — links to `/memoria` (placeholder/404 until S3)
- Skills — `em breve` badge, no link
- separator
- Admin — admin only, links to `/admin`
- Docs — admin only, links to `/docs`
- separator
- Sair — POST to `/logout`

## Non-goals

- Pulse / tooltip / coachmark — design explicitly says no (trust the convention).
- Migrating old surfaces to the avatar bar — that's S5 cutover.
- Mobile-specific menu pattern — desktop pattern works on mobile via existing responsive CSS.

## Tests

- `tests/avatar-top-bar.test.ts` — JSX rendering tests:
  - Renders name and email
  - Renders Admin + Docs only when user.role === "admin"
  - Renders Skills with em-breve badge
  - Logout form posts to /logout

## Phases

S2 is shipped together with S1 — see [S1 plan](../cv1-e11-s1-home/plan.md) Phase 2 for the implementation slice.

## Docs

- [Sibling — S1 home](../cv1-e11-s1-home/)
