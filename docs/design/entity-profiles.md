[< Docs](../index.md)

# Entity profiles — design notes (2026-05-04)

> Status: **design-locked**, implementation pending a construction window.
> Conversation source: design session 2026-05-04 with the product-designer persona.
> Three reference drafts authored end-to-end against Antonio Castro's travessias (Bia Saturada, Voltar a BH, Pós-Lançamento).

## The insight in one sentence

**Today every entity link drops into a CRUD form. The default landing should be a profile — a read view that tells the story this entity has accumulated — and editing should be the secondary affordance.**

## Why

The CRUD page is honest engineering but cold reading. It treats organizations, journeys, and scenes as records to maintain. The `/espelho` page proved a different relationship is possible — these are the materials of a life, not data to keep up to date. The same metabolism `/espelho` introduced for the user as a whole is now extended to each territory the user operates inside.

Three things this unlocks:

1. **A landing for lingering.** Today there is nowhere in the system to *re-read* an organization or a travessia. The CRUD form invites edits, not contemplation.
2. **A natural target for outsiders / future-you.** A travessia link from a conversation list shouldn't drop a reader into "am I supposed to edit this now?". It should land in a piece that can be read.
3. **A surface that absorbs accumulated activity.** The conversations tagged to an org, the cenas anchored to a journey, the personas a journey has summoned — none of this surfaces in the CRUD page. The profile gathers it into a portrait.

## What it is not

- **Not a dashboard.** No graphs, no analytics, no KPIs.
- **Not an "About" page.** Not generic copy explaining what the entity *means*.
- **Not third-person journalism.** The voice is the user's own first person ("Eu", "I"). The metaphor "post jornalístico" was structurally right (lede → body → close) but the register is closer to memoir-as-essay than to reportage.
- **Not a fixed template.** Sections render conditionally on what data the entity carries. A travessia with no anchored cena says so explicitly; a travessia with no conversations says so explicitly. Different entities produce structurally different pages from the same engine.

## Voice and register

First-person, reflective, in the user's voice and locale (`pt-BR` for Antonio/Bia, `en` for the Reilly–Marchetti tenants). Not "Antonio's organization Pages Inteiras is a small editorial house" — but "A casa editorial que reorganizei depois de 2020". The page is the user *re-reading themselves*, not the system describing the user to a third party.

## URL migration

| URL today | After this work |
|---|---|
| `/organizations/<key>` | profile (read view) |
| `/journeys/<key>` | profile (read view) |
| `/cenas/<key>` | profile (read view) |
| (form lives at the same URL) | `/organizations/<key>/editar`, `/journeys/<key>/editar`, `/cenas/<key>/editar` |

The slug `editar` matches `pt-BR`; for `en` tenants it is `edit`. Locale-aware route handler. Every existing internal link (rail, header, conversation list, `/me`, scope-sessions) keeps working — the link target just becomes the read view by default, which is the correct behavior. The "edit" affordance is a discreet link in the page footer, **not** a top-right pencil — the page is for reading, the door to edit is intentionally quieter.

## The shape of the profile

Three blocks, with names that vary per entity. The visual silhouette differs from `/espelho` by design — single column, ~640px reading width, no three-pane. Same typography vocabulary (EB Garamond italic for the lede, sans for body, italic serif for closing line and conversation excerpts), but a distinct silhouette so the brand mark of `/espelho` doesn't blur.

### Block 1 — Lede

EB Garamond italic, ~16pt, generous leading. One to four sentences. Variable length by content; not capped.

Source priority:
1. The most pointed line(s) of the **briefing** (preferred — briefings are written in contemplative register).
2. The most pointed line(s) of the **situation** (used when the briefing is short and the situation carries the diagnosis).
3. **LLM-synthesized** from briefing + situation when neither is sharp enough on its own. Cached until either source field is edited.

A teal accent strip (3-4px) runs down the left of the lede block only. Color varies by entity type:

- Organizations: warm-amber (`#b8956a`)
- Journeys: teal (`#7c9aa0`)
- Scenes: plum (`#9a8ba0`)

Mirrors the Sou/Estou/Vivo axis colors of `/espelho` thematically without duplicating them literally.

### Block 2 — Body

Variable structure, conditional on data. The page assembles itself from what's there; sections that don't apply are omitted. Three families of body sections were observed in the three drafts:

**a) "Onde ela mora"** — always present.

Compact section (3-5 lines max). Lists the entity's adjacencies using the rail glyph vocabulary:

- `⌂ <org-key>` — affiliated organization (when present)
- `◇ <persona-key>` — primary persona (when present)
- `❖ <scene-key>` — anchored scene (when present)

Followed by a parenthetical italic line declaring **what's missing as intentional information**, not as error. Examples from the drafts:

> Travessia da casa, não do trabalho. Sem organização afiliada — esta não passa pelo público. *(Bia Saturada)*

> sem persona declarada · sem cena recorrente — esta travessia ainda não cristalizou em diálogo. *(Pós-Lançamento)*

Distinguishes *quietas-por-frescura* from *quietas-por-abandono*.

**b) Structural section** — conditional, label varies by structure type.

Detected by patterns in the situation field:

- `^\*\*Cenário [A-Z] —` (or similar enumerated branches) → renders as `OS TRÊS CENÁRIOS` (decision grid: cost, reversibility)
- `A primeira é... A segunda é... A terceira é...` → renders as `AS TRÊS FRENTES VIVAS` (continuous coexistence, not branching choice)

Both render as numbered items with sub-text in regular weight. Limit ~3-4 items; above that, the pattern collapses into prose paragraphs.

**c) "A pergunta viva"** — conditional, only renders when the briefing or situation declares a central question.

Heuristics for detection:

- Explicit interrogative in the source ("eu vou X? como?", "como mantenho Y sem virar Z?")
- Phrases like "estou adiando", "evito olhar", "a questão é"
- A second paragraph in the section can carry the *confessional layer* — when the source has a "tem também uma camada que evito olhar" or similar meta-note. The drafts proved this is the texture that separates a profile from a report.

When neither pattern matches with confidence, the section is omitted. Conservative default — don't fabricate a question.

**d) "Conversas que a moldaram"** — always present, even when empty.

Chronological list of sessions tagged with this entity (most recent first). Per item:

- Title of the session
- Date in tenant locale
- One **citable line from the assistant turn** that best encapsulates the conversation, in serif italic between typographic quotes.

The citable line is the only field that requires a **per-conversation LLM extraction call**. Cached by `session_id`; invalidated when the session has a new turn. See *LLM extraction points* below.

When the entity has zero tagged sessions, the section renders an honest empty state (italic, two lines):

> Esta travessia ainda não veio à frente em diálogo. Vive no fundo, pensada por escrito mas não conversada. *(Pós-Lançamento)*

This is the form of empty-state we settled on: **declared, not silent**.

### Block 3 — Close

Italic serif, indented, no label, generous whitespace above and below.

Source priority (post-design discussion):

1. **The most pointed line of the briefing or situation.** The drafts confirmed that briefing-sourced fechos read with more weight than conversation-sourced fechos, because briefings are written in contemplative register and conversations are operational. Pós-Lançamento's "Saí, mas eles não desapareceram." landed harder than the conversation-sourced fechos of Bia Saturada or Voltar a BH.
2. The closing assistant line of the most recent conversation, when the briefing/situation lacks a quotable line.

**Open question still pending:** the user's first instinct (during the design conversation) was the last conversation; on review, briefing-sourced consistently sounded stronger. Decision parked. Implementation should default to briefing-source with a fallback to last-conversation; both should be exposed in the profile data so we can A/B during validation.

## Footer

Single line in muted small text:

> Iniciada em <month/year> · status: <ativa|pausada|encerrada> · última atualização há N dias

Followed by a discreet right-aligned link: `[editar esta travessia]` (or org / cena, locale-aware label).

## Numeric tiles

Three tiles maximum. Espelho uses 4 in some panes; here we keep 3 to maintain reading rhythm and avoid dashboard feel.

A pattern emerged across the three drafts:

| Tile slot | Purpose | Bia Saturada | Voltar a BH | Pós-Lançamento |
|---|---|---|---|---|
| **1** | Signature concrete fact of the moment | 3 plantões | 8 meses | 5 anos |
| **2** | Structural anchor (years, count of branches) | 12 anos casados | 3 cenários | 3 frentes |
| **3** | Recency (default) or proxy temporal anchor (when no recency) | 7 dias desde última conversa | 5 dias desde última conversa | 9 meses da DM pendente |

When recency is missing (zero conversations), tile 3 falls through to the next-most-relevant temporal anchor in the situation (regex on "há X meses/semanas/dias"). When that fails, the tile is **omitted entirely** rather than rendered empty. Honest substitution.

## Empty-states observed

| Field missing | Page behavior |
|---|---|
| Organization affiliation | "Onde ela mora" omits the `⌂` line; parenthetical declares "sem organização afiliada — <reason from text or generic>" |
| Anchored scene | "Onde ela mora" omits the `❖` line; parenthetical declares "sem cena recorrente — esta travessia não cristalizou em diálogo" |
| Persona | "Onde ela mora" omits the `◇` line; same parenthetical pattern |
| Conversations (zero) | "Conversas que a moldaram" renders italic two-liner empty-state, never silent |
| Briefing too short for lede | Lede falls through to situation, then to LLM synthesis |
| Recency tile (zero conversations) | Tile 3 falls through to proxy temporal anchor or omits |
| All structural sources empty | Page renders lede + "Onde ela mora" + footer only — minimum viable profile |

## LLM extraction points

The profile is **mostly marshalling** with two narrow synthesis points. This keeps cost predictable and renders deterministic when source data hasn't changed.

| Point | When called | Cache invalidation |
|---|---|---|
| Citable line per conversation | First profile render after a session has a new turn | `session_id` + last entry timestamp |
| Lede synthesis | When briefing + situation are both too short to extract a strong opening | `entity_id` + last `updated_at` of source fields |

What is **not** synthesized:

- "Onde ela mora" (deterministic — reads junction tables / schema)
- "A pergunta viva" (extracted via regex/heuristic from situation; section omitted when no question detected)
- Numeric tiles (deterministic — counts, dates, regex on temporal phrases)
- Footer (deterministic — timestamps)
- Close (extractive, not generative — picks the best existing line from briefing/situation/last-conversation)

Espelho's `/synthesis.ts` is the architectural reference. Same shape: typed state object built from DB queries, with one or two synthesized text fields, cached aggressively.

## Visual notes

- Single column, max 640px wide, centered.
- EB Garamond italic for: lede, fecho, conversation excerpts. Three places only.
- Sans-serif for everything else.
- Section headings in muted small caps sans (`color: var(--muted)`, `letter-spacing: 0.08em`, `text-transform: uppercase`).
- Numeric tiles inline-flex, ~140px each, separator dots between.
- The `/espelho` drop-cap is **not** used here — the lede stays clean. The drop-cap is reserved as the most "mirror-on-wall" gesture; reusing it would blur the brand mark of `/espelho`.
- Teal accent strip (3-4px) on the left of the lede block, color per entity type.

## Three reference drafts

The three drafts authored against Antonio Castro's journeys are kept verbatim below as editorial reference. Implementation should reproduce these outputs from the underlying data without authorial intervention. Variations between the drafts (variable lede length, conditional structural section, different fecho sources) are the proof points of the principles above.

### Draft 1 — `/journeys/bia-saturada`

```
┃                                                            editar
┃  BIA SATURADA
┃
┃    A travessia não é salvar o casamento. O casamento
┃    não está em crise — está em descuido. Eu estou em
┃    casa quase sempre, mas não estou inteiro. Bia notou.
┃    Eu notei que ela notou. Estou adiando.
┃
┃         3                  12 anos              7 dias
┃    plantões noturnos    de casamento     desde a última
┃    em que estive no                          conversa
┃    escritório com a
┃    porta encostada


  ONDE ELA MORA

  Casa. Travessia da casa, não do trabalho. Sem organização
  afiliada — esta não passa pelo público.

  ◇ marido     o ângulo do espelho que trabalha o casamento
  ❖ noite-com-bia     depois dos plantões da Bia, sem dramatizar


  A PERGUNTA VIVA

  Eu vou conversar com a Bia? E se vou, como?

  A versão "precisamos conversar" eu rejeito — é discurso, ela
  detesta. A versão "passei a viver no escritório, percebi,
  mudei" sem grande declaração também tem risco — a sutileza
  pode passar despercebida e virar mais uma ondulação no padrão.
  A versão do meio é uma frase concreta no café, sem preâmbulo.

  A dúvida real é se eu acredito em mim quando digo "vou mudar".


  CONVERSAS QUE A MOLDARAM

  A Bia chegou em casa chorando      03 maio, 23h
  ❝ Ela disse 'cansada de tudo' depois de perder uma criança.
    'De tudo' inclui o trabalho, a perda dessa criança — e
    também outras coisas. Coisas que envolvem você e a casa. ❞


       Eu não tenho estado inteiro.
       Eu sei. Eu vou estar.


  Iniciada em fev/2026 · ativa · última atualização há 12 dias
                                                  [editar esta travessia]
```

### Draft 2 — `/journeys/voltar-a-bh`

```
┃                                                            editar
┃  VOLTAR A BH
┃
┃    A questão honesta, e que estou adiando, é: eu já
┃    decidi. Decidi pelo cenário B há semanas, mas não
┃    disse para a Bia nem para o Pedro nem para mim
┃    mesmo.
┃
┃         8 meses              3 cenários           5 dias
┃    desde que comecei       que reviro       desde a última
┃    a pensar nisso                              conversa


  ONDE ELA MORA

  Travessia familiar — sobre a mãe, o pai, o irmão Pedro.
  Sem cena recorrente ainda; ela não cristalizou num padrão.

  ◇ filho     o ângulo que trabalha a relação com os pais e o irmão


  OS TRÊS CENÁRIOS

  A · Mudança da família para BH
        custo emocional alto · custo prático alto · reversibilidade baixa

  B · Eu uma semana por mês, na casa do meu pai
        custo emocional médio · custo prático médio · reversibilidade alta

  C · Continuar como está, ajustar o que dá
        custo prático baixo no curto, alto no longo · reversibilidade zero

  (já decidi pelo B há semanas.)


  A PERGUNTA VIVA

  Não é "qual cenário escolher". Já escolhi. A pergunta é por
  que ainda não disse — para a Bia, para o Pedro, para mim mesmo —
  e o que esse adiamento está deixando crescer enquanto ele dura.

  Tem também uma camada que evito olhar: o cenário B me coloca uma
  semana por mês na casa onde minha infância aconteceu. Não vou
  conseguir estar lá sem que isso entre no livro. Não sei se é
  coincidência ou se é exatamente parte do que estou tentando
  me autorizar.


  CONVERSAS QUE A MOLDARAM

  Minha mãe não falou bem ao telefone        02 maio, manhã
  ❝ Você está vendo um padrão se formar — mas é um padrão
    pequeno, em ponto específico, dentro de uma conversa que
    no resto foi inteira. ❞


       A informação que chegou hoje vai precisar
       de uma noite pra começar a chegar inteira.


  Iniciada em set/2025 · ativa · última atualização há 5 dias
                                                  [editar esta travessia]
```

### Draft 3 — `/journeys/pos-lancamento`

```
┃                                                            editar
┃  PÓS-LANÇAMENTO
┃
┃    A travessia é a relação contínua, e ainda não estabilizada,
┃    com o circuito do qual eu saí. Saí, mas eles não desapareceram.
┃
┃         5 anos                3 frentes              9 meses
┃    desde a saída         que pulsam        da DM pendente do R.


  ONDE ELA MORA

  ⌂ pages-inteiras     a casa editorial que reorganizei depois de 2020

  (sem persona declarada · sem cena recorrente — esta travessia
  ainda não cristalizou em diálogo.)


  AS TRÊS FRENTES VIVAS

  · A DM pendente
        Um antigo parceiro escreveu há nove meses. Mensagem de
        bom-faith, sem venda. Eu não respondi. A não-resposta
        está virando dívida moral.

  · A curiosidade pelos números
        Continuo, com alguma vergonha, abrindo planilhas de
        comparação mental. Faísca de inveja, raiva moralista
        pela própria inveja. Sei que é improdutivo. Continuo.

  · A permeabilidade técnica
        Algumas práticas do circuito são ferramentas neutras.
        Outras são manipulação dourada. A fronteira nem sempre
        é clara. Em meses lentos, eu cogito atalhos. Cogito,
        identifico, recuso. Mas a cogitação acontece.


  A PERGUNTA VIVA

  A questão de fundo não é "voltar ou não voltar para o circuito".
  Eu não vou voltar — isso decidi com clareza em 2021. A questão
  é mais sutil: como eu mantenho posição editorial sem virar
  puritano, sem virar amargo, sem usar o "eu saí" como bandeira
  identitária no lugar do trabalho que de fato faço.

  E mais embaixo: parte de mim ainda procura reconhecimento daquele
  mundo. Tenho consciência. Não me agride; é informação.


  CONVERSAS QUE A MOLDARAM

  Esta travessia ainda não veio à frente em diálogo. Vive no fundo,
  pensada por escrito mas não conversada.


       Saí, mas eles não desapareceram.


  Iniciada em set/2021 · ativa · última atualização há 7 dias
                                                  [editar esta travessia]
```

## Ten principles consolidated

1. **Sections are conditional, not fixed.** The page assembles from data; absent sections are omitted entirely. Different entities produce structurally different pages.

2. **Lede length is variable.** No fixed character cap. The lede is "however long the source needs to land" — three sentences for some, four for others. Cutting the punchline to fit a template kills the rhythm.

3. **Every section names what's there in the user's voice.** Section labels in pt-BR for pt-BR tenants ("ONDE ELA MORA", "A PERGUNTA VIVA"), in en for en tenants ("WHERE IT LIVES", "THE LIVE QUESTION"). Locale-aware throughout.

4. **The "live question" only renders when declared.** When the source doesn't carry a central question, the section is omitted — never fabricated.

5. **Absences are information.** Empty conversation list, missing scene, no organization affiliation — all rendered as italic explanatory lines, never silent. Distinguishes *quiet-by-freshness* from *quiet-by-abandonment*.

6. **When no conversation exists, the section stays and says it.** "Esta travessia ainda não veio à frente em diálogo" beats omitting the section.

7. **The third tile falls through gracefully.** When recency is irrelevant (no conversations), the slot reaches for the next-most-charged temporal anchor in the source. When that fails, the tile is omitted, not rendered empty.

8. **Structural patterns in the source produce structural sections in the page.** Enumerated branches → decision grid. Continuous fronts → frente list. Different labels for different shapes.

9. **The fecho lands harder when sourced from briefing than from conversation.** Briefings are written in contemplative register; conversations are operational. Implementation default: briefing-first, conversation-fallback.

10. **A single glyph in "Where it lives" doesn't read as incomplete.** The parenthetical immediately after declares what's missing as intentional context, not error.

## Comparative summary across the three drafts

| Section | Bia Saturada | Voltar a BH | Pós-Lançamento |
|---|---|---|---|
| Lede source | briefing | situation | briefing |
| Lede length | 3 lines | 4 lines | 2 lines |
| Tile 1 | concrete fact of the week | tempo desde início | tempo desde saída |
| Tile 2 | chão biográfico (12 anos) | estrutura (3 cenários) | estrutura (3 frentes) |
| Tile 3 | recency | recency | DM proxy (no recency) |
| "Onde ela mora" | persona + cena | persona | org |
| Structural section | (none) | 3 cenários | 3 frentes |
| "A pergunta viva" | yes | yes | yes |
| Conversations | 1 | 1 | 0 (with note) |
| Fecho source | last conversation | last conversation | briefing |

## Open questions

1. **Default fecho source.** Implementation should default to briefing-first, conversation-fallback. But validate during the first build round whether briefing-first feels too uniform across travessias. Some travessias may genuinely have stronger conversation closes (Bia Saturada's "Não me agradeça ainda. Me agradece daqui a três meses se você sustentar." is a strong example).

2. **Visibility — admin only or all users from day one?** The CRUD pages today are user-facing. Profile pages should follow the same default (everyone), but consider whether a phased rollout (admin first, then everyone) buys validation time.

3. **Edit affordance — discreet bottom link only, or also a top-right pencil?** Decision was bottom-only during design. Worth retesting once first surface lands.

4. **The page in the menu.** Should the *edit* page disappear from the avatar dropdown / sidebar entirely (only reachable via "editar" link on the read view)? Or keep both as parallel options? Lean toward edit-only-from-read; respects the "reading is the default" thesis.

5. **Cache strategy specifics.** The two LLM extraction points (citable conversation lines, lede synthesis) need a concrete invalidation scheme. Probably:

   - `entity_profile_cache` table: `entity_type`, `entity_id`, `field_name`, `value`, `source_hash`, `generated_at`
   - On render: compute current `source_hash` (hash of source fields); if matches cached, use cached; else regenerate and overwrite
   - Cleanup: stale rows GC'd after the entity is forgotten/archived

6. **The "9 meses da DM pendente" tile fallback.** The regex on "há X meses/semanas/dias" was sketched but not specified. Implementation needs a deterministic picker that handles multiple temporal phrases in a single situation field — pick the most recent? The most prominent? Worth specifying before code.

7. **What happens when the entity is forgotten / archived?** Currently `forget` exists for orgs/journeys. The profile page should presumably 404 or redirect. Decision pending.

## Implementation sequencing

The natural decomposition into stories:

- **S1 — Travessia profile.** The most narrative-shaped of the three entity types, where the design was authored. Highest-yield first surface.
- **S2 — Organization profile.** Structurally simpler — orgs are containers, fewer sub-sections. Many of S1's components reused.
- **S3 — Scene profile.** Different shape (cenas are more declarative, less narrative; "what kind of moment is this" is the primary question). Some component overlap, but the body sections diverge from S1/S2 enough to warrant separate authoring.
- **S0 (cross-cutting) — URL migration framework.** Move `/<entity>/<key>` to read view, introduce `/<entity>/<key>/editar`. Locale-aware route handlers. All existing internal links keep working without change.

Sequencing: S0 first (mechanical, no design risk), then S1 (the high-information surface), then S2 and S3 in either order based on usage signal.

## What this design lock buys

When the construction window opens, the first session does not need to redo this conversation. The lede selections, the section anatomy, the empty-state phrasings, the tile fallbacks — all are decided. Implementation becomes:

- Translate the structure into a typed `EntityProfile` state object (mirror of `MirrorState` from `server/mirror/synthesis.ts`)
- Build a parser per source-data pattern (enumerated cenários, continuous frentes, central question, citable conversation line, temporal anchor regex)
- Author one TSX component per section with shared typography helpers
- Wire URL migration with a back-compat redirect on the form URL
- Cache the two LLM-derived fields with `source_hash` invalidation

The reference drafts above are the acceptance criteria. The first round is "done" when the system reproduces them from the underlying data without authorial intervention.
