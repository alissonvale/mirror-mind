[< Docs](../index.md)

# Scenes — home redesign and chrome inversion (design session 2026-05-01b)

> Status: **design locked, implementation queued as CV1.E11**.
> Predecessor: [`scenes-pivot.md`](scenes-pivot.md) — registered the pivot insight.
> This doc crystallizes the locked decisions from the dedicated brainstorm session.

## What this session decided

The cena pivot at the model layer demands a chrome inversion at the surface layer. Sidebar with seven peer entries (Map, Personas, Organizations, Journeys, Conversations, …) gives equal visual weight to entities that — under the pivot — are consequences in service of scenes, not parallel entry points. The new home places **scenes first** and demotes the rest into a single avatar menu.

Two surfaces were designed: the new Home (`/inicio`) and the Memória dashboard (`/memoria`). Both ride a shared top bar with logo on the left and avatar menu on the right. Nothing in the center.

## Home — Variante C ("stage with proscenium")

```
┌─────────────────────────────────────────────────────────────────┐
│  ⌘ espelho                                                  [A] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│        ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐     │
│        │ ◇       │  │ ♔       │  │ ◇       │  │ ✚       │     │
│        │ Aula    │  │ Voz da  │  │ Diário  │  │ Nova    │     │
│        │ N.A.    │  │ Alma    │  │         │  │ cena    │     │
│        │ qua 20h │  │ noites  │  │ manhã   │  │         │     │
│        └─────────┘  └─────────┘  └─────────┘  └─────────┘     │
│                                                                 │
│                          ─── ou ───                             │
│                                                                 │
│        ┌───────────────────────────────────────────────┐       │
│        │  Diga o que está vivo agora…                   │       │
│        │                                          [↵]   │       │
│        └───────────────────────────────────────────────┘       │
│                                                                 │
│        Recentes                                                 │
│        ─────────                                                │
│        • Hoje    Voz da Alma   fragmento sobre paciência…      │
│        • Ontem   Aula N.A.     conexão eídos × signo…          │
│        • 2d      (sem cena)    pricing do book release…       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

Reads top-down: scenes first (model), free input second (improvisation), recents third (resume).

**Why Variante C and not the other two:**
- **A (input on top, cards below):** input as the star contradicts the pivot. The pivot says cena is the model; layout that promotes the input first says "the normal case is improvisation."
- **B (cards only, free input is a degenerate card):** purest expression of the pivot but punishes casual users who haven't built scenes yet. The "ou" separator in C buys us pivot-fidelity without that cost.
- **C (cards above, "ou", input below):** cenas come first visually (the model is the model), but free input remains visible as the always-available escape. Resolves the tension without compromise.

## Top bar — single avatar entry point

```
┌─────────────────────────────────────────────────────────────────┐
│  ⌘ espelho                                                  [A] │
└─────────────────────────────────────────────────────────────────┘
                                                              │
                              avatar click:                   ▼
                                                  ┌──────────────────────────┐
                                                  │ Alisson Vale              │
                                                  │ alissonvale@…             │
                                                  ├──────────────────────────┤
                                                  │ Meu Mapa Cognitivo        │
                                                  │ Minha Memória             │
                                                  │ Minhas Skills      em breve│
                                                  ├──────────────────────────┤
                                                  │ Admin                     │ (admin only)
                                                  │ Docs                      │ (admin only)
                                                  ├──────────────────────────┤
                                                  │ Sair                      │
                                                  └──────────────────────────┘
```

- Header (name + email) is clickable — opens `/me`.
- **Mapa Cognitivo** — psyche layers (self/soul/doctrine, ego, personas). Reuses content from current `/map` and `/personas`.
- **Memória** — world-as-experienced (orgs, travessias, library, history, scenes list). Dashboard surface (see below).
- **Skills** — future. Tools the espelho can invoke during a turn (semantic memory search, attachment reading, web fetch, etc.). Listed with "em breve" badge until live.
- **Admin / Docs** — admin-only.

The split `Cognitivo × Memória` is a meaningful axis: identity vs. context. Cleaner than a single "Mapa" catch-all.

## Memória — dashboard

```
┌─────────────────────────────────────────────────────────────────┐
│  ⌘ espelho                                                  [A] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Minha Memória                                                  │
│                                                                 │
│  ┌───────────────────────┐  ┌───────────────────────┐          │
│  │  Cenas                │  │  Travessias           │          │
│  │  4 ativas             │  │  5 ativas             │          │
│  │                       │  │                       │          │
│  │  ◇ Aula N.A.          │  │  • mirror-mind        │          │
│  │  ♔ Voz da Alma        │  │  • o-espelho          │          │
│  │  ◇ Diário             │  │  • recolhimento       │          │
│  │  + 1 mais             │  │  + 2 mais             │          │
│  │                ver →  │  │                ver →  │          │
│  └───────────────────────┘  └───────────────────────┘          │
│                                                                 │
│  ┌───────────────────────┐  ┌───────────────────────┐          │
│  │  Organizações         │  │  Library              │          │
│  │  2 ativas             │  │  12 anexos            │          │
│  │                       │  │                       │          │
│  │  ⌂ Software Zen       │  │  briefing-pi-mirror   │          │
│  │  ⌂ Nova Acrópole      │  │  design-entregavel-1  │          │
│  │                       │  │  runbook-import       │          │
│  │                       │  │  + 9 mais             │          │
│  │                ver →  │  │                ver →  │          │
│  └───────────────────────┘  └───────────────────────┘          │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Histórico                                               │   │
│  │  247 conversas — 42 esta semana                          │   │
│  │                                                          │   │
│  │  • Hoje    Voz da Alma   fragmento sobre paciência…     │   │
│  │  • Ontem   Aula N.A.     conexão eídos × signo…         │   │
│  │  • 2d      (sem cena)    pricing do book release…       │   │
│  │  • 3d      Diário        Veronica e o pivô…             │   │
│  │                                              ver tudo → │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

Grid 2×2 above (Cenas, Travessias, Orgs, Library), Histórico full-width below. Each card shows a count and three recent items; clicking an item jumps directly to it; clicking "ver →" opens the filtered list. Histórico gets a wider footprint because it's the most-consulted content.

**Empty state:** new tenant with 0 records still renders all five cards. Each card shows its empty state (e.g., "Nenhuma travessia ainda — crie a primeira") rather than hiding. Confirmed in this session.

## Locked decisions from this session

1. **Variant C** for the Home (cards above, "ou", input below).
2. **Cards ordered by most recent activity** in the session/scene. No time-aware/predictive ordering for v1.
3. **Card temporal pattern** ("qua 20h", "noites", "manhã") is a **free-text** field on the scene, not a structured cron.
4. **Mobile parity** confirmed (not a separate app; cards stack, "ou", input).
5. **Onboarding seed:** new tenants are born with a pre-populated **Voz da Alma** scene (default doctrine + default self prompt). Empty home is never seen.
6. **Avatar menu** as the only top-bar entry point. No center-nav.
7. **Skills** = (a) tools the espelho can invoke during turns. Listed with "em breve" until live.
8. **Dual editing path for scenes:** (a) casual edit on Home cards via hover `⋯`, (b) full list view in Memória > Cenas for power-user.
9. **`/me` access:** clicking the name+email header inside the avatar menu.
10. **Memória is dashboard-style**, not tabs. Grid 2×2 + Histórico full-width.
11. **Histórico empty state** is rendered, not hidden.

## Implementation strategy — strangler

Inspired by the pi-mirror reconstruction (briefing-pi, D4 greenfield + parallel migration). Same pattern applied to the home redesign.

- **New home at parallel route `/inicio`.** Old `/` stays untouched.
- **Avatar top bar lives only on the new surfaces** (`/inicio`, `/memoria`, future `/mapa-cognitivo`). Rest of the app keeps the sidebar until cutover.
- **Backend changes are additive** — `scenes` table, `sessions.scene_id`, receptor cold-start, default Alma seed. None mutate existing tables in destructive ways. Old home doesn't see the new tables.
- **No per-user feature flag** in v1. Few tenants, manual access via URL is enough. If we ever need an opt-in toggle, that's a tiny follow-up.
- **Cutover (S5)** is a single small PR: redirect `/` → `/inicio`, delete sidebar templates and orphaned routes.

| Surface | Chrome during transition |
|---|---|
| `/` (old home), `/conversation/*`, `/map`, `/personas`, `/organizations`, `/journeys` | Sidebar (untouched) |
| `/inicio` (new home) | Avatar top bar + Variant C |
| `/memoria` | Avatar top bar + dashboard |
| `/mapa-cognitivo` | Avatar top bar + reuses `/map` content |

## Story breakdown — CV1.E11

| ID | Title | Notes |
|---|---|---|
| **S1** | Home nova em `/inicio` com cards de cena + input + recentes (Variante C) | Chrome + Home view; depends on S4 for data |
| **S2** | Top bar com avatar menu (lives only em `/inicio` e sub-páginas) | Shared chrome component |
| **S3** | Memória dashboard em `/memoria` | Aggregations across orgs/journeys/library/history/scenes |
| **S4** | Backend: `scenes` table + CRUD + `sessions.scene_id` + receptor cold-start handling | Data layer; foundational |
| **S5** | Cutover: redirect `/` → `/inicio`, remove sidebar antiga e rotas substituídas | Last; small PR |
| **S6** | Onboarding seed: tenant novo nasce com cena Voz da Alma pré-criada | Default doctrine + default self prompt |

**Implied order:** S4 → (S1, S2 parallel) → S3 → S6 → S5. S2 and S1 can ship together since the avatar bar is only meaningful with a destination.

**Form for creating a scene** is **not** in this list — parked for the next design session (was the "S1" of the original four-story arc, but the form shape — inline expander vs. modal vs. wizard — wasn't locked here).

## Open for next session

1. **Form shape for creating a scene.** Inline expander, modal, or wizard? Briefing field is rich (multi-paragraph), inline persona/org/journey creation needed when they don't exist yet. Each shape has tradeoffs for the briefing-rich, multi-axis nature.
2. **Card anatomy detail.** Fixed dimensions, color treatment (does the dominant glyph drive a tint?), max title length, hover state precise behavior (always-visible `⋯` vs. on-hover reveal).
3. **Card click behavior.** Click anywhere = enter scene. But where do we surface "edit scene" without burying it? Hover `⋯`, right-click, or long-press on mobile?
4. **Receptor cold-start UX.** When user types in the free input without choosing a scene, receptor classifies. Does it: (a) silently apply the inferred scene, (b) suggest post-hoc ("Parece Aula N.A. — entrar nessa cena?"), (c) always start unscoped and only suggest if confidence is high? Calibration risk argues for (b) with a confidence threshold.
5. **Scene "default Voz da Alma" content.** What does the seeded doctrine look like for a new tenant who hasn't authored their own? A minimal generic doctrine, or empty? The `cv1-e9-s1-doctrine-layer` was designed with optional doctrine; the seed needs to either ship a starter doctrine.md or seed empty and let the user fill it.
6. **Discoverability of the avatar menu.** Brief avatar pulse + tooltip on first login? Or trust the convention?
