[< CV1.E12](../)

# CV1.E12.S1 — Chrome inversion + `/espelho` skeleton

**Status:** ✅ Done (2026-05-03)

## Problem

Today the `◆ Mirror Mind` logo at the top-left of every page links to `/` — the operational home where you start a conversation. The brand is doing two jobs: it's the product mark *and* it's the verb "iniciar". This is why we can't simply add a new `/espelho` page that "feels like the mirror" — the brand mark is already pretending to be that, but it points to operations.

S1 inverts that arrangement. The logo becomes what it claims (the mirror), and operations get their own honest affordance.

## Fix

Two coordinated changes in the chrome (`AvatarTopBar`):

1. **Flip the logo's `href`** from `/` to `/espelho`.
2. **Add a `▶ Iniciar` pill** next to the logo that takes over the operational entry. Visually distinct from the brand mark — clearly an action affordance, not a wordmark.

Add a new route `GET /espelho` returning a minimal page (TopBarLayout + a placeholder body) so the link target exists. S2 fills the body; S1 only needs the page to render coherently.

Also add an explicit `Início` shortcut to the avatar dropdown menu so a user who lands on `/espelho` and wants to go back to operations has a textual path that doesn't depend on knowing what `▶ Iniciar` does.

## What ships

### Routes (additive)

```
GET  /espelho      — new contemplative entry; minimal shell in S1
```

### Pages

- `adapters/web/pages/avatar-top-bar.tsx` — modified:
  - Logo `href`: `/` → `/espelho`
  - New `<a class="avatar-top-bar-start" href="/">▶ Iniciar</a>` pill after the brand block
  - New dropdown item `Início` between `Mapa Cognitivo` and `Território` (or above all of them — TBD by visual fit)
- `adapters/web/pages/espelho.tsx` — new:
  - `EspelhoPage` component with `TopBarLayout`, single `<main>` with placeholder body
  - Empty state copy: `"O Espelho está em construção — a síntese chega em S2."`
  - Inscription slot reserved (rendered empty in S1) so S3 has a stable mounting point

### i18n keys

```
topbar.start             → "Iniciar" / "Start"
topbar.menu.start        → "Início" / "Home"
espelho.title            → "Espelho" / "The Mirror"
espelho.placeholder      → "Em construção." / "In progress."
```

### Asset cache bumps

- `style.css` query param bumped to mark chrome change (e.g. `chrome-mirror-flip-1`)

## Test plan

`tests/espelho-routes.test.ts`:

- `GET /espelho` returns 200 with `avatar-top-bar` chrome.
- `GET /espelho` includes the placeholder copy (so we know the route is wired, not 404).
- The avatar bar HTML on `/` shows `href="/espelho"` on the brand link AND `href="/"` on the Iniciar pill.
- The avatar bar dropdown includes an `Início` item pointing to `/`.
- The avatar bar HTML on `/espelho` is identical (chrome is shared, not page-specific).

`tests/avatar-top-bar.test.ts` (or update existing inicio-routes.test.ts assertions):

- The brand glyph's `href` is `/espelho`, not `/`.
- The Iniciar pill is present, points to `/`.

## Done criteria

- Click `◆ Mirror Mind` from anywhere with the chrome → land on `/espelho` (placeholder body).
- Click `▶ Iniciar` from `/espelho` → land on `/` (operational home, today's behavior).
- Avatar dropdown's `Início` link reaches `/` as well.
- All tests passing; no broken existing flows.

## Out of scope (handed to S2)

- The actual synthesis content of `/espelho` — Sou / Estou / Vivo, glance line, pulse signals.
- "What shifted since last visit" markers.
- Drill-down links from the panes.

## Out of scope (handed to S3)

- Inscription rendering and management.
