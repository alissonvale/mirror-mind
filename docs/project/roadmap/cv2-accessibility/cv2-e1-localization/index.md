[< CV2 — Accessibility](../)

# CV2.E1 — Localization

**Roadmap:** [CV2](../index.md)
**Last updated:** 26 April 2026

The web UI speaks the user's language. Each user picks their language in `/me`; the chrome (labels, buttons, navigation, system messages) renders in that language. A second-cut narrative character ships in pt-BR to exercise the new surface end to end.

---

## Stories

| Code | Story | Status |
|------|-------|--------|
| [S1](cv2-e1-s1-i18n-infra/plan.md) | **i18n infrastructure** — `t(key, locale)` function, locale resource files, Hono middleware, no copy changes yet | ✅ Done |
| `S2` | **Externalize all chrome strings** — every hardcoded UI string moves into `en.json`. | partial — sidebar, login, home, /me, /conversation surface, /conversations done; organizations, journeys, map, layer-workshop, personas, docs, admin/* pending |
| `S3` | **User locale preference** — `users.locale` column, `/me` selector, persists per user | ✅ Done |
| `S4` | **pt-BR translation** — `pt-BR.json` filled. Smoke test: full session in pt-BR. | ✅ Done (covers the surfaces externalized in S2) |
| `S5` | **Brazilian narrative character** — fifth tenant in `docs/product-use-narrative/`, full stack in pt-BR; loader sets `locale=pt-BR` | future |

**Ordering:** S1 builds the rail; S2 is mechanical and reversible; S3 unblocks user choice but pt-BR is still empty; S4 fills pt-BR — first user-visible win; S5 closes the loop with a tenant who lives in pt-BR.

Each story gets its own `plan.md` when its turn comes — drafting all five up front would commit to detail that the prior stories will reshape.

---

## Scope

**In:** UI chrome (labels, navigation, buttons, status messages, empty states, form copy, validation strings, system flashes), the user-visible parts of `/me`, `/conversation`, `/admin/*`, `/organizations`, `/journeys`, `/conversations`, `/docs`, login.

**Out** (see [decisions.md — 2026-04-26 user-facing locale ≠ D7](../../decisions.md)):

- Editorial content (`docs/product/*`, `docs/project/*` including this very document, ADRs) — D7 stands; internal substrate is English.
- LLM-generated content (assistant replies, summaries, titles) — already responds in the conversation's language; no plumbing needed.
- CLI and Telegram adapters — no chrome to localize. Their text is the user's text.
- Persona / organization / journey keys — identifiers, not strings.

---

## Key decisions

- **Custom `t(key)` over a library.** ~30 lines, no dependency, fits the codebase. Re-evaluate when key count exceeds ~500 or pluralization gets non-trivial.
- **Two locales: `en` (default) and `pt-BR`.** Adding more is additive — drop a `<locale>.json` file and add the option to `/me`'s selector. Right-to-left languages would need a CSS pass; deferred.
- **Locale resolution chain (per request):** `user.locale` if authenticated → `Accept-Language` header → `'en'`.
- **Pre-auth locale:** login uses `Accept-Language` only. No cookie until a real need surfaces.
- **Missing keys fall back to `en`.** Missing in both locales returns the key crude and warns. Never throws.
- **Persona/org/journey keys stay in English.** They are identifiers; their displayed `name` and content already lives per-user in the DB and naturally takes whatever language the user wrote it in.

---

## Done criteria for the epic

A user logs in as the Brazilian tenant created in S5, lands on `/conversation`, every label is in pt-BR, sends a message, the mirror replies (LLM does its own job), opens `/me`, sees "Idioma" (not "Language"), switches to English, reloads, everything is back in English.

---

**See also:** [Project briefing](../../briefing.md) (D7) · [Decisions](../../decisions.md) · [Product Use Narrative](../../../product-use-narrative/) (where S5 lands)
