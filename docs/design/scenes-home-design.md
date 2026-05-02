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
| **S7** | Form de criação/edição de cena em `/cenas/nova` e `/cenas/<id>/editar` | Inline expander with stub-first sub-creation; mutex Voz da Alma; depends on S4 |

**Implied order:** S4 → (S1, S2, S7 parallel) → S3 → S6 → S5. S1 needs S7 to make `✚` clickable end-to-end; S7 needs S4 for the data layer.

## Cena form — anatomy and behavior (S7)

**Shape locked: inline expander on its own route.** Modal squeezes the briefing (the heart of the cena). Wizard fights the onboarding seed (user's first form interaction is creating their *second* cena, not their first). Conversational creation is the right answer for a future "help me build this" mode but heavyweight as the default.

**Routes:**
- `/cenas/nova` — create
- `/cenas/<id>/editar` — edit (same form, pre-filled)

**Form structure (top to bottom):**

```
Título           [text input]
Padrão temporal  [text input, optional]   placeholder hints free format
Briefing         [large textarea]         the dominant field, visual weight
Voz              ◉ Persona  ◯ Voz da Alma
Elenco           [persona chips + add]    hidden when voz=Alma
Organização      [single org chip]
Travessia        [single journey chip]
Avançado ▾       [collapsed]              Modo + Tamanho selects, default auto/auto
```

The briefing field gets visual prominence — the source of truth for what the LLM uses every turn — proportional to its importance.

**Stub-first inline sub-creation:** when the user types a name that doesn't match any existing entity in Elenco/Organização/Travessia, the autocomplete shows "Criar X 'name'". Click expands a mini-form with three fields: name, key (auto), and a one-line description. Saving creates the entity as a draft (`is_draft: true` or equivalent). Full refinement happens later in the dedicated entity editor (`/personas/<key>`, `/organizations/<key>`, `/travessias/<key>`). This applies the pivot doc's stub-first hypothesis to all three secondary entities, not just personas.

**Mutex Voz da Alma:** when voice = Alma, the Elenco field is *hidden* (not just disabled). Toggling back to Persona makes Elenco reappear empty — it's not preserved across the toggle to prevent stale state. CV1.E9.S6 already enforces the data-layer mutex.

**Action buttons:** `[Salvar]` (returns to home) and `[Salvar e iniciar conversa]` (saves and opens `/conversation` with the cena applied). The second is the dominant case — most cena creations are followed by immediately using it.

**Locked decisions for S7:**

1. **Stub creations are committed**, not transactional with the cena. Cancelling the cena form does not undo a persona/org/travessia stub created during the session. Justification: creation has cognitive cost, undoing surprises. The "Criar como rascunho" label makes the commit explicit.
2. **No drafts of incomplete cenas in v1.** Closing the form discards in-progress work. Auto-save is a follow-up if it becomes a real pain.
3. **Validation: only title is required.** Empty briefing is a legitimate degenerate case ("I have a name, will populate later").
4. **Two save buttons:** `[Salvar]` and `[Salvar e iniciar conversa]`. The second matches the dominant intent.
5. **Personas in Elenco are not reorderable in v1.** Insertion order is enough. Multi-persona behavior already exists (CV1.E7.S5).
6. **Padrão temporal is a single free-text field** (confirmed earlier). Placeholder suggests format: `ex: qua 20h, ou "noites antes de dormir"`.
7. **Card color is derived from the dominant glyph,** not editable in the form. Alma → ♔ amber; cast persona → that persona's color (CV1.E7.S2 colors); empty/unscoped → neutral. Reduces friction.

**Other behaviors:**

- `beforeunload` prompt when there are unsaved changes.
- i18n via `t(key)` from day one (en + pt-BR).
- Briefing trim at ~10k chars (server-side defense, not user-visible limit).

## Open for next session

1. **Card anatomy detail.** Fixed dimensions, color treatment (does the dominant glyph drive a tint? a border? a corner mark?), max title length truncation, hover state precise behavior (always-visible `⋯` vs. on-hover reveal vs. long-press on mobile).
2. **Card click behavior.** Click anywhere = enter scene. Where does "edit scene" sit without being buried? Hover `⋯`, right-click, or long-press on mobile? Tradeoffs for accessibility.
3. **Receptor cold-start UX.** When user types in the free input without choosing a scene, receptor classifies. Does it: (a) silently apply the inferred scene, (b) suggest post-hoc ("Parece Aula N.A. — entrar nessa cena?"), (c) always start unscoped and only suggest if confidence is high? Calibration risk argues for (b) with a confidence threshold.
4. **Scene "default Voz da Alma" seed content.** What does the seeded doctrine look like for a new tenant who hasn't authored their own? A minimal generic doctrine, or empty? `cv1-e9-s1-doctrine-layer` was designed with optional doctrine; S6 needs to either ship a starter `doctrine.md` template or seed empty and let the user fill it.
5. **Discoverability of the avatar menu.** Brief avatar pulse + tooltip on first login? Or trust the convention?
