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

## Implementation strategy — strangler (closed)

Inspired by the pi-mirror reconstruction (briefing-pi, D4 greenfield + parallel migration). Same pattern applied to the home redesign.

The strangler ran across S1–S7 with parallel chrome (avatar top bar on `/inicio` + `/memoria`, sidebar on the rest). The cutover (S5) formalized 2026-05-02 swept all surfaces onto the avatar top bar — `Layout` was rewritten to render the AvatarTopBar internally, so every legacy callsite migrated in one step. Sidebar templates and the old `/` HomePage were retired (`/_legacy-home` returns 410 Gone). The chrome table below is the post-cutover state — uniform across the app.

- **`/` redirects to `/inicio`.** No HomePage rendering anywhere.
- **Avatar top bar is the canonical chrome.** Every page (`/conversation/*`, `/map`, `/personas`, `/organizations`, `/journeys`, `/conversations`, `/me`, `/admin/*`, `/docs/*`, `/inicio`, `/memoria`, `/cenas/*`) renders inside it.
- **Backend additions** from this epic: `scenes` table, `sessions.scene_id`, receptor cold-start, default Alma seed in `provisionUser` and `loadNarrative`.

| Surface | Chrome (post-cutover) |
|---|---|
| Every authenticated page | Avatar top bar |
| `/` | Redirect → `/inicio` |
| `/_legacy-home` | 410 Gone (sentinel; will be removed in a follow-up sweep) |

## Story breakdown — CV1.E11

| ID | Title | Notes |
|---|---|---|
| **S1** | Home nova em `/inicio` com cards de cena + input + recentes (Variante C) | Chrome + Home view; depends on S4 for data |
| **S2** | Top bar com avatar menu (lives only em `/inicio` e sub-páginas) | Shared chrome component |
| **S3** | Memória dashboard em `/memoria` | Aggregations across orgs/journeys/library/history/scenes |
| **S4** | Backend: `scenes` table + CRUD + `sessions.scene_id` + receptor cold-start handling | Data layer; foundational |
| **S5** | Cutover: redirect `/` → `/inicio`, remove sidebar from every legacy surface (Layout rewritten to render AvatarTopBar internally), retire HomePage at `/_legacy-home` (410 Gone sentinel). Tests updated to assert avatar-bar chrome. | ✅ Done 2026-05-02 |
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

## Card anatomy and behavior (S1)

```
┌─────────────────────────┐
│║ ◇                  ⋯  │  color bar + glyph corner + always-visible menu
│║                       │
│║                       │
│║ Aula Nova             │
│║ Acrópole              │  title (max 2 lines, ellipsis)
│║                       │
│║ qua 20h               │  temporal pattern (smaller, lighter)
│║                       │
│║                       │
│║ Última 2d             │  last activity (smallest)
└─────────────────────────┘
   ~220 × 240 px desktop
   2 cards/row mobile (~160px)
```

**Visual vocabulary reuses CV1.E7.S2.** Left color bar mirrors the bubble signature for assistant persona turns — same language, no invented vocabulary. Glyph corner is small, doesn't compete with the title.

**Glyph and color by context:**

| Context | Glyph | Color (bar + glyph) |
|---|---|---|
| Voz da Alma | ♔ | warm amber (`#b8956a`, inherited from CV1.E9.S6) |
| Single persona | ◇ | persona color (CV1.E7.S2) |
| Multi persona | ◇ | first persona's color (no gradient, no "+N" badge in v1) |
| Org-only (no persona) | ⌂ | neutral |
| Travessia-only | • | neutral |
| Pure improvisation (no scope at all) | ✎ | neutral |
| `Nova cena` card | ✚ | dashed border, no fill |

Multi-persona stays simple — no count badge, no gradient. The cena editor is where cast detail belongs; the card is for fast recognition.

**States:**

- **Default:** as drawn.
- **Hover (desktop):** subtle elevation shadow; `⋯` gains ~10% contrast; `cursor: pointer` on the whole card.
- **Active (cena has open conversation today):** "Última hoje" carries the signal. No extra marker.
- **Empty (cena created, never used):** same chrome, last-activity slot shows "—" or "ainda não usada".
- **Mobile:** no hover. `⋯` always visible. Long-press on the card opens the same menu as `⋯` for accessibility.

**Click and menu behavior:**

| Action | Result |
|---|---|
| Click anywhere on card | Enter scene (start new conversation in the cena) |
| Click `⋯` | Open dropdown menu |
| Long-press on mobile | Same as `⋯` |
| Click `Nova cena` card (`✚`) | Navigate to `/cenas/nova` |

Dropdown menu items:

```
Entrar      ← redundant with card click but explicit; primary action
Editar      ← navigates to /cenas/<id>/editar
Duplicar    ← copies briefing/cast/scope, not history
─────
Arquivar    ← reversible; subtle red
```

`Excluir` (permanent delete) is **not** in the card menu — lives in `/cenas` (Memória > Cenas) as a power-user action where the consequences (orphaned conversations, loss of history) can be surfaced clearly.

**Truncate rules:**

| Field | Limit | Behavior on overflow |
|---|---|---|
| Title | 2 lines | ellipsis |
| Temporal pattern | 1 line | ellipsis |
| Last activity | always fits | n/a — fixed format ("Hoje" / "Ontem" / "Nd" / "—") |

**Locked decisions for the card:**

1. **`⋯` is always visible** (low contrast), not hover-only. Buys mobile parity, discovery without hover, costs little visually.
2. **"Entrar" stays in the menu** despite being redundant with the card click. Makes the action hierarchy explicit: enter is primary, edit is secondary; without it the menu reads as "edit/destroy only".
3. **Archive only in v1, no permanent delete on the card.** Reversible action lives close; destructive lives one level deeper in the list view.
4. **Duplicate is in the menu.** Common case: variation creation (e.g., a Sunday version of a Wednesday cena). Copies briefing/cast/scope, not history. Cheap to implement, real value.
5. **Aspect ratio ~11:12** (220×240). Square (1:1) feels cramped — title abuts metadata. Slightly tall gives the title breathing room.
6. **No pinning/favorites in v1.** Cards already order by activity. Frequently-used cenas (e.g., Voz da Alma) rise naturally. Pin can be added later if a real need surfaces.

## Receptor cold-start UX (S1 + S4)

**Locked: option B — suggest post-hoc.** Reuses the suggestion-card pattern established by CV1.E7.S8 (out-of-pool persona suggestion). Silent auto-apply (option A) cobra alto preço quando o receptor erra, e a calibração ainda é imatura — recent telemetry confirmed false positives on `is_self_moment` and on org/journey detection. Threshold-gated apply (option C) is theoretically better but the receptor doesn't emit a confidence score today; building one is out of scope.

**Flow:**

```
1. User types in free input on /inicio (no cena selected)
2. New session created with scene_id = NULL
3. Turn 1 runs through the normal pipeline (compose with identity/ego baseline)
4. Receptor classifies axes (persona, org, journey, is_self_moment, etc.)
5. Server checks: does any existing scene match this classification?
6. If yes → render suggestion card below the assistant bubble
7. User accepts → session.scene_id = match.id; future turns compose with cena
8. User dismisses or keeps typing → suggestion clears; session stays unscoped
```

Turn 1 is **not re-executed** when the suggestion is accepted. The cena applies from turn 2 onward. Re-running burns tokens, confuses the user ("did the answer change?"), and the baseline answer is fine for one turn.

**Suggestion card:**

```
[bubble assistant]

┌────────────────────────────────────────────────────────┐
│ ◇  Parece "Aula Nova Acrópole" — continuar nessa cena? │
│                                                        │
│             [Continuar nessa cena]   [Manter sem cena] │
└────────────────────────────────────────────────────────┘
```

Dominant glyph of the matching cena on the left. Two explicit actions. No third option (e.g., "later") — the alternatives are accept now, dismiss now, or just keep typing.

**Match logic (strict, axis-based):**

| Case | Criterion |
|---|---|
| Alma cena | `is_self_moment=true` AND `scene.voice='alma'` |
| Persona cena | `receptor.persona ∈ scene.cast` AND (`scene.org` matches `receptor.org` or both null) AND (`scene.journey` matches `receptor.journey` or both null) |
| Multiple matches | most-recent activity wins |
| No matches | no suggestion (stay unscoped) |

Strict by design. Looser matching (e.g., "org alone matches") tends to false positives — the user sees "Parece X" for a cena with nothing to do with the actual tone of their message.

**Locked decisions for cold-start:**

1. **Suggestion is dismissed on next action** — accept, "Manter sem cena", or sending the next turn. Doesn't accumulate across turns.
2. **"Manter sem cena" silences future suggestions for that session only.** A session is a moment — across sessions, suggestions reset. This avoids nagging without making the dismissal permanent.
3. **Receptor keeps running after a session becomes scoped.** From that point, suggestions are CV1.E7.S8 territory (out-of-pool). Cold-start is specifically the unscoped → scoped transition.
4. **Zero-cena tenants get no suggestion ever.** Post-S6 this case is impossible (Voz da Alma always seeded), but if it occurs, conversation just stays unscoped. No "create scene now" upsell — friction without clear return.
5. **No semantic-similarity matching in v1.** Briefing-vs-turn embedding match would be richer but requires the semantic retrieval infra from CV1.E7.S6. When that arrives, cold-start can ride along. Strict axis-based match works for v1.
6. **No confidence threshold / auto-apply in v1.** Anotated as a future possibility once the LLM logging telemetry from CV1.E8.S1 yields enough data to calibrate. Natural evolution post-telemetry, not part of this epic.

**Implementation impact on stories:**

- **S4 (backend):** add `findMatchingScene(receptorOutput, userId)` helper. SQL lookup against `scenes` + `scene_personas` (junction) using receptor axes.
- **S1 (Home + new conversation flow):** render the suggestion card below the assistant bubble; wire "Continuar" to a `POST /conversation/<id>/apply-scene` endpoint that sets `session.scene_id`.

UI vocabulary reuses the suggestion-card style from CV1.E7.S8 — no new visual language to invent.

## Default seed content for new tenants (S6)

**Locked: ship Alisson's doctrine as the v1 default.** Source: `docs/seed/alisson/doctrine.md` (already the canonical seed referenced in the worklog). Same approach for the default `self` prompt — Alisson's content is the seed.

Fits the current adoption phase (Alisson + Veronica, shared household, overlapping philosophy in practice). Veronica receives something concrete to appropriate/edit instead of a blank slate; the Voz da Alma compose path lands on real substance from turn 1.

**Honest tradeoff:** when adoption widens beyond the household, this default becomes wrong — a third party gets Alisson's personal philosophy as their starting point, and Alma cites principles that aren't theirs. Registered as a follow-up: when adoption leaves the household, the provisioning script will accept a `--seed` flag (file path to alternate doctrine + self) or default to empty, leaving Alma to compose without the doctrine slot.

**Implementation:** during tenant provisioning (admin script), after `createUser`:
1. Create Voz da Alma cena (voice='alma', no cast/scope, default title and briefing).
2. Apply `docs/seed/alisson/doctrine.md` as the new user's `self/doctrine` layer.
3. Apply Alisson's `self` content as the new user's `self/soul` layer.

## Avatar menu discoverability (S2)

**Locked: no pulse, no tooltip, no first-login coachmark.** Trust the convention — top-right avatar is where Google, Notion, GitHub, and most modern apps put account/settings menus. Users learn it within minutes of use. Adding a pulse adds noise to a chrome that's intentionally quiet.

If real-use shows discoverability pain (Veronica or a future user genuinely can't find a setting), revisit then with concrete signal. Not pre-emptively.

## Design phase — done

All locked decisions consolidated above. The epic is ready for implementation by story.

Implementation order (re-confirmed): S4 (backend) → (S1, S2, S7 in parallel) → S3 (Memória) → S6 (onboarding seed) → S5 (cutover).
