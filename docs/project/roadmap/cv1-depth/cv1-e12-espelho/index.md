[< CV1 Depth](../)

# CV1.E12 — The Mirror page (`/espelho`)

**Status:** ✏️ Drafted (2026-05-03) · 3 stories scoped, design locked in conversation, ready for S1.

## Premise

After CV1.E11, the home (`◆ Mirror Mind` logo) does two incompatible jobs: it is the **brand mark** *and* it is the **operational entry** ("start a conversation"). The user named the conflict directly: *"o logo Mirror Mind é operacionalmente o equivalente a Iniciar"*. The brand collapses into a verb, and the system has no surface that *is* the mirror — only surfaces that let you *use* it.

This epic separates those jobs:

- The **logo** (`◆ Mirror Mind`) becomes what its name promises: the doorway to the mirror itself — a synthesized self-portrait at `/espelho`.
- A new **`Iniciar` button** in the chrome takes over the operational entry that the logo carried until now.
- `/territorio`, `/memorias`, and `/map` stay as drill-down tools, accessible from both the avatar menu and from the panes inside `/espelho`.

The `/espelho` page itself is **not a dashboard** of the three sub-pages. It is a single self-narrative that synthesizes the three questions a person asks themselves in front of a mirror: *who am I, where am I operating, what have I lived?* It must read top-to-bottom as one paragraph.

## Metaphor: the corridor mirror, not the oratory

The page's regime of use is *de passagem* — the same way people glance at a corridor mirror dozens of times a day. This shapes everything:

- **Above the fold = glance state.** A condensed self-portrait readable in 2 seconds.
- **Below the fold = depth.** Three panes (Sou / Estou / Vivo) for the slower visit.
- **"What shifted since last visit"** surfaces small markers (new memory, scene reopened, layer touched). The reflection responds to movement.
- **Active voice in the present tense.** *Sou* / *Estou* / *Vivo* — never "Quem sou hoje" or "Última atualização há 2h". Mirrors don't timestamp themselves.
- **Nothing numeric on badges.** Quantity is not the point — presence is.
- **People also pin things to mirrors.** A small inscription (mantra, citation, personal phrase) sits above the synthesis as the user's own intentional voice woven into the auto-generated state.

## What ships

A new contemplative entry-point in the system, peer to (but distinct from) the operational home.

### Chrome change

```
[◆ Mirror Mind]   [▶ Iniciar]   ........   [⚙▼]
   logo = mirror    operational              avatar menu
   → /espelho       → / (today's home)
```

- The logo's `href` flips from `/` to `/espelho`.
- A new pill button `▶ Iniciar` (i18n: `topbar.start`) sits next to the logo, taking over what the logo used to do (start the operational home).
- The avatar menu adds an explicit `Início` shortcut (in case the user ends up at `/espelho` and wants to jump back to operational without using the brand pill — also clarifies the relationship for new users).
- `Espelho` is **not** in the avatar menu — the logo *is* the entry. Adding it to the menu would re-introduce the duplication the redesign is meant to eliminate.

### Page structure (`/espelho`)

```
❖ O Espelho

  ┃ "<inscription text>"                              ← S3
  ┃                            — <author or empty>

  ─────────────────────────────────────────────────

  [GLANCE — above the fold, 2-second read]           ← S2
  one synthesized sentence + 3-4 compact pulse signals

  ─────────────────────────────────────────────────

  [DEPTH — below, for lingering]                     ← S2
  Sou       <synthesis from cognitive layers>     → mapa cognitivo
  Estou     <synthesis from territory state>      → território
  Vivo      <synthesis from recent record>        → memórias
```

## Stories

| # | Story | Status | Notes |
|---|---|---|---|
| S1 | [Chrome inversion + page skeleton](cv1-e12-s1-chrome/) | ✅ 2026-05-03 | Logo → `/espelho`. `Iniciar` pill. `/espelho` shell. Visually validated by the user. |
| S2 | [Living synthesis: glance + pulse + depth](cv1-e12-s2-synthesis/) | 🛠 In progress | The actual content — the three panes synthesized from cognitive/territory/memory state, plus glance + "what shifted" pulse. |
| S3 | [Inscriptions — pinned phrases on the mirror](cv1-e12-s3-inscriptions/) | ⏳ Drafted | User-curated mantras/quotes/citations. Daily rotation + manual pin. Quiet management page. |

**Implied order:** S1 → S2 → S3. S3 ships value standalone once the page exists (S1) — does not require S2 to land first.

## Design decisions installed

Recorded in [decisions.md](../../../decisions.md) as the entry dated 2026-05-03.

- **Logo means what it says.** `◆ Mirror Mind` points to the mirror page. The operational entry gets its own affordance (`▶ Iniciar` pill).
- **`/espelho` is narrative, not dashboard.** A single self-portrait in active voice — never a grid of cards aggregating the sub-pages.
- **Glance + Depth, not three sections.** Above-the-fold is a 2-second read; the three panes below reward lingering.
- **Update model is hybrid (option c).** Território + Memórias compute fresh on each visit; Cognitivo updates when its underlying layers change. Honest to each axis's actual rhythm.
- **"What shifted since last visit"** is a small textual diff, never a numeric badge. Mirrors don't notify.
- **Inscriptions: daily rotation + manual pin.** By default one per day; user can pin one as the active anchor. No tags, no context-aware selection. The choice IS the curation.
- **Inscriptions render unlabeled on the page.** No header, no count, no "your mantras" caption — the inscription just IS, the way a post-it on a real mirror has no caption.

## Validation milestone

Alisson clicks `◆ Mirror Mind` in the chrome and lands on `/espelho`, sees an inscription he chose at the top, reads the glance line in under 2 seconds, recognizes himself, and either leaves (using `▶ Iniciar` to go work) or scrolls into the three panes for a slower read. Veronica opens `/espelho` for the first time without inscriptions configured — the page still feels coherent (the inscription space is silent, not empty placeholder text), and she can either dismiss it or curate her own from a quiet edit affordance.

## Out of scope

- **A separate "weekly reflection" artifact.** The hybrid update model (c) is the single source. Materialized snapshots are a future epic if they prove necessary.
- **LLM-generated synthesis text.** S2 starts with template-based synthesis from current state. LLM-driven prose is a follow-on once the templated baseline proves useful.
- **Notifications or "you haven't visited in a while" prompts.** The mirror does not call you over.
- **Tags/categories on inscriptions.** Adding context-aware selection would re-introduce the algorithm and dilute the *"I chose this"* gesture.
- **Multi-mirror surfaces** (different mirrors for different times of day, different rooms, etc.). One mirror.

## Why this epic exists

Through CV1.E11 the system became fully operational — start a conversation, navigate cenas, browse memory. But every surface answered *what do I do*, never *what am I*. The user's exact ask: *"essa tela deveria contar a minha história pra mim mesmo. Mostrando informação sintetizada atual que responde essas 3 perguntas (quem sou, por onde opero e o que vivi). Assim soa como um espelho."*

The territory split (preceding this epic, shipped 2026-05-03) cleared the ground: with cenas/travessias/orgs lifted out of `/memorias` into `/territorio`, the three drill-down surfaces are now clean filing cabinets. The mirror page is the *index* that synthesizes them into a story.
