[< CV1 Depth](../)

# CV1.E11 — Scenes

**Status:** 🟡 In progress · S1 + S2 + S3 + S4 + S7 ✅ 2026-05-02 · Design locked 2026-05-01b

## Premise

The cena pivot at the model layer demands a chrome inversion at the surface layer. Sidebar with seven peer entries (Map, Personas, Organizations, Journeys, Conversations, …) gives equal visual weight to entities that — under the pivot — are consequences in service of scenes, not parallel entry points. The new home places **scenes first** and demotes the rest into a single avatar menu.

A **scene** is not a feature on top of the existing model. **The scene IS the model.** Personas, organizations, journeys are consequences that emerge in service of specific scenes — they are not pre-requisites the user assembles upfront.

## What ships

A new home at `/inicio` (Variant C) renders saved cena cards above a free input and a list of recent conversations. The avatar menu (top-right) splits navigation into **Mapa Cognitivo** (psyche layers) and **Minha Memória** (orgs, travessias, library, history, scenes list). New tenants are seeded with a default **Voz da Alma** scene so the empty home is never seen. The cena form (`/cenas/nova` and `/cenas/<id>/editar`) is an inline expander with stub-first sub-creation of personas/orgs/travessias. The receptor learns to suggest a matching scene when the user starts unscoped from the free input.

## Stories

| # | Story | Status | Notes |
|---|---|---|---|
| S1 | [Home nova em `/inicio` (Variant C)](cv1-e11-s1-home/) | ✅ 2026-05-02 | Cards + free input + recents + briefing-in-compose + cold-start. |
| S2 | [Top bar com avatar menu](cv1-e11-s2-top-bar/) | ✅ 2026-05-02 | Lives only on `/inicio` and sub-pages during transition. |
| S3 | [Memória dashboard em `/memoria`](cv1-e11-s3-memoria/) | ✅ 2026-05-02 | Grid 2×2 (Cenas/Travessias/Orgs/Library) + Histórico full-width. |
| S4 | [Backend: scenes table + CRUD + receptor cold-start](cv1-e11-s4-backend/) | ✅ 2026-05-02 | Foundational data layer; no UI. |
| S5 | Cutover: redirect `/` → `/inicio` | ⏳ drafted | Last; small PR. |
| S6 | Onboarding seed (Voz da Alma) | ⏳ drafted | Default doctrine + default self prompt for new tenants. |
| S7 | [Form de criação/edição de cena](cv1-e11-s7-cena-form/) | ✅ 2026-05-02 | Inline expander; stub-first sub-creation; mutex Voz da Alma; depends on S4. |

**Implied order:** S4 → (S1, S2, S7 parallel) → S3 → S6 → S5.

## Strangler strategy

Inspired by the pi-mirror reconstruction (briefing-pi, D4 greenfield + parallel migration). Same pattern applied here.

- **New home at parallel route `/inicio`.** Old `/` stays untouched.
- **Avatar top bar lives only on the new surfaces** (`/inicio`, `/memoria`, future `/mapa-cognitivo`). Rest of the app keeps the sidebar until cutover.
- **Backend changes are additive** — `scenes` table, `sessions.scene_id`, receptor cold-start, default Alma seed. None mutate existing tables in destructive ways. Old home doesn't see the new tables.
- **No per-user feature flag** in v1. Few tenants, manual access via URL is enough.
- **Cutover (S5)** is a single small PR: redirect `/` → `/inicio`, delete sidebar templates and orphaned routes.

| Surface | Chrome during transition |
|---|---|
| `/` (old home), `/conversation/*`, `/map`, `/personas`, `/organizations`, `/journeys` | Sidebar (untouched) |
| `/inicio` (new home) | Avatar top bar + Variant C |
| `/memoria` | Avatar top bar + dashboard |
| `/mapa-cognitivo` | Avatar top bar + reuses `/map` content |

## Why this epic exists

Through CV1.E1–E10 the data model accreted: personas, organizations, journeys, sessions, scopes, voice. Each became a peer in the sidebar — equal visual weight, parallel entry points. The first-run UX for a new tenant became "populate seven CRUDs before you can do anything useful."

The cena pivot inverts that: a scene is the unit a user actually thinks in (*"my Wednesday philosophy class"*, *"my evening journal moment"*, *"my pricing strategy session"*). Personas, orgs, travessias emerge in service of scenes, not the other way around. Onboarding becomes "tell me about a recurring conversation" → everything else is generated in service of it.

## Architectural decisions installed

- **Variant C home** (cards above, "ou" separator, free input below). Cenas come first visually (the model is the model), but free input remains visible as the always-available escape.
- **Avatar-only top bar** with the split `Cognitivo × Memória` (identity vs. context). Cleaner than a single "Mapa" catch-all.
- **Memória is dashboard-style**, not tabs. Grid 2×2 + Histórico full-width.
- **Receptor cold-start = suggest post-hoc** (option B). Reuses the suggestion-card pattern from CV1.E7.S8. Silent auto-apply (A) is risky given current calibration; threshold-gated (C) requires confidence-score work out of scope.
- **Default seed = Alisson's doctrine** (v1). When adoption widens beyond the household, provisioning script accepts a `--seed` flag.
- **Stub-first sub-creation** of personas/orgs/travessias from inside the cena form. Persona character is discovered through use of the cena, not specified upfront.
- **Strangler over rewrite.** Old `/` keeps working until S5 cuts over.

## Validation milestone

Alisson opens `/inicio`, the Voz da Alma card sits there with sample recents below it, click flows into a conversation that composes through the scene's voice. Veronica logs in for the first time and her home is the same shape — Voz da Alma seeded automatically, ready to use without traversing seven CRUDs first.

## Out of scope

- **Archive flow for existing personas/orgs/travessias** — parked. The user wanted to "clean house" but the strangler approach makes it unnecessary; existing entities stay reachable via Memória, new ones emerge through cena creation.
- **Conversational onboarding** ("mirror interviews user to build first scene") — parked. The default-seed approach satisfies the empty-home concern without the heavyweight flow.
- **Pre-populated example scenes for new tenants** — only Voz da Alma is seeded.
- **Pinning/favorites on cena cards** — cards order by activity, frequently-used cenas rise naturally.

## Docs

- [Design — scenes-home-design.md](../../../../design/scenes-home-design.md) (locked decisions)
- [Design — scenes-pivot.md](../../../../design/scenes-pivot.md) (predecessor pivot insight)

## Docs to update at close

- `docs/process/worklog.md`
- `docs/project/decisions.md`
- `docs/project/roadmap/cv1-depth/index.md` (epic status)
- Each story folder's `index.md` and `plan.md`
