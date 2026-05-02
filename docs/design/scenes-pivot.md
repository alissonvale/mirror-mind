[< Docs](../index.md)

# Scenes pivot — design notes (parked 2026-05-01)

> Status: **resolved** in [`scenes-home-design.md`](scenes-home-design.md) (design session 2026-05-01b).
> Originally parked as: brainstorm to be reasoned about in a dedicated next session.
> Kept here as a record of the pivot insight and the open questions that drove the next session.

## The insight in one sentence

A **scene** is not a feature on top of the existing model. **The scene IS the model.** Personas, organizations, journeys are consequences that emerge in service of specific scenes — they are not pre-requisites the user assembles upfront.

## How we got here

The conversation started as a feature request for "context": a savable bundle of header configuration (cast + scope + mode + length + voice + briefing + title) so the user could pick from saved configurations when starting a new conversation instead of re-configuring every header every time.

We named the concept **Cena / Scene** to avoid clashing with the existing "Contexto" header zone label. We sketched the schema (one scene per row, junction table for personas, single org + single journey, briefing field, mode/length/voice/title columns), the picker UX (replaces "Nova" → goes to scene selector with "blank" option at top), and "save current as scene" via the `⋯` menu.

Then we walked through a real user case to stress the design:

> Aula Nova Acrópole — every week, a Nova Acrópole philosophy class. The user chats with the mirror during the lecture, bringing fragments of what the professor says, asking for parallels, implications, questions to ask the professor. Conversational tone, medium length (he's reading on his phone mid-class). Travessia: vida-filosofica. Org: nova-acropole. Persona: probably `pensadora` (the mirror's idea-thinking lens), maybe a future dedicated `filosofa`.

Drafting that scene's title, briefing, and persona surfaced the pivot.

## What the example revealed

1. **The persona didn't exist yet.** No `filosofa` in the user's inventory. He could use `pensadora` + the briefing field, but the briefing field had to do work the persona was supposed to — carry the philosophical lens, the Nova Acrópole tradition, the user's posture (not-a-beginner, mid-class), the desired tone.

2. **The briefing was richer than expected.** It became a small scenario primer: "this happens DURING a lecture, the user brings fragments not full questions, tradition is perennial/initiatic, expand without forcing the lens, no preambles." That's not metadata — it's substance the LLM uses every turn.

3. **Voz da Alma fits the same shape.** The user immediately recognized he'd want a scene tied to Voz da Alma — "a scene for when I'm at the end of the day and want to write a fragment back to the soul." Voice mode is just another scene attribute.

4. **Existing personas are the friction, not the feature.** The user said: *"my idea is to remove all my current personas and start creating personas from these scenes."* The scenes are the anchor; personas should be created in service of them, not the other way around. Onboarding is "tell me about a recurring conversation you want" → emerges everything.

## Why this is a pivot, not a refinement

The originally proposed feature (Story A: cenas CRUD + picker; Story B: save current as cena) treated the cena as a **shortcut over existing model**. Personas/orgs/travessias still came first; cena bundled them.

The pivot says: cena precedes everything. Form for creating a cena needs **inline creation** of personas/orgs/travessias that don't exist yet. The product's first-run UX changes — new users start by describing a recurring conversation, not by populating CRUD pages. The CRUD pages still exist for power-user editing, but the entry point inverts.

This affects:

- **Schema**: still includes `scenes` table + junctions, but also `archived` flags on personas/orgs/journeys (the user wants to clean house before recreating)
- **Form UX**: cena form has expanding sub-forms ("create new persona inline") or a wizard
- **Onboarding**: a new tenant's first screen is "tell me about a recurring conversation" — the mirror interviews them and builds the first scene live
- **The briefing field's weight**: it's a first-class composer input, like soul/identity layers, not a footnote. May want its own composer block in `composeSystemPrompt` and `composeAlmaPrompt`.
- **The relationship between cena and journey**: journeys carry their own briefing (long-running episode); orgs carry briefing+situation (workspace identity). Cena briefing is a third level — "this specific recurring conversation pattern within a journey." All three compose additively into the prompt under the cena-applied path.

## What was sketched but not finalized

A four-story arc was discussed:

| Story | Scope |
|---|---|
| **CV1.E11.S1** | Cena CRUD + picker + apply on new conversation, with **inline creation** of persona/org/travessia from inside the cena form |
| **CV1.E11.S2** | "Save current session as cena" — button in the `⋯` menu, snapshot of current configs |
| **CV1.E11.S3** | Onboarding cena-first — guided creation of the first scene for new tenants |
| **CV1.E11.S4** | Archive flow for existing personas (and possibly orgs/travessias) so the user can clean house before scene-driven recreation |

Order question parked: does S4 come first (clean house, then recreate) or last (S1+S2 first, use them to recreate, then archive what's no longer needed)?

The "stub-first" question parked: when a persona is created via the cena form, is it a complete persona (full prompt, behavior block, summary) or a stub (name + 1–2 sentence description) that gets refined later in the standalone `/personas` editor? The hypothesis was: **stub-first**, because the persona's character is discovered through the use of the cena, not specified upfront.

## Open questions for the next session

1. **Naming**: confirmed "Cena" / "Scene" but need to revisit if usage in flow surfaces a better word.
2. **Inline creation form shape**: expander? modal? wizard? Each has tradeoffs for the briefing-rich, multi-axis nature of cena creation.
3. **Briefing composition in the prompt**: where does it sit? Order? Weight relative to journey/org briefings?
4. **Archive vs delete for the user's existing personas**: archive gives reversibility; the user's tone leaned toward "remove" but archive seems safer.
5. **Cena → conversation linking**: when the user starts a conversation from a cena, do we stamp `sessions.scene_id` so the conversation remembers its origin? Probably yes — useful for later "show all conversations from this scene" view.
6. **Onboarding flow shape**: conversational (mirror interviews user) vs structured form vs hybrid.
7. **Pre-populated example scenes**: ship with template scenes that new users can adopt/duplicate? Or empty-by-default?

## Concrete user case captured

The user described an actual use pattern that's now the canonical test for any cena design:

```
Title: Aula Nova Acrópole
Travessia: vida-filosofica
Organização: nova-acropole
Cast: pensadora (or future dedicated filosofa)
Voice: persona (not Alma)
Mode: conversational
Length: standard
Briefing: |
  Conversa que acontece DURANTE uma aula de filosofia da Nova Acrópole.
  Eu trago fragmentos do que o professor está dizendo — um termo, uma
  frase, um nome, um conceito — e quero expandir, conectar, aprofundar.

  Não estou perguntando "o que é X" do zero. Estou em aula recebendo
  X e quero:
  - ressonâncias com outras tradições
  - paralelos / contrastes que iluminem
  - implicações que o professor não desenvolveu
  - perguntas que valha fazer ao professor

  Tom: conversacional, ágil. Respostas curtas-médias — leio no celular
  enquanto presto atenção na aula. Sem preâmbulo do tipo "que pergunta
  interessante"; entra direto no conteúdo.

  Tradição: Nova Acrópole opera dentro da filosofia perene / iniciática
  (linhagem hermética, platônica, esoterismo greco-romano, com leitura
  adaptada à "Filosofia Para Viver"). Quando o tema casar com essa
  linhagem, traça as conexões; quando ficar fora, expande sem forçar
  a lente.

  Não sou iniciante. Posso receber termos técnicos sem definição
  prévia (eídos, nous, hylé, paranoia, theosis, etc.); se precisar
  de definição, peço.
```

Whatever scene model emerges from the next session needs to make this case feel light to set up and effortless to launch into.

## Why this was parked

A feature design that re-grounds the product's data model deserves a brainstorm session of its own — not the tail end of a session that started as "add a CRUD". Locking scope mid-pivot means implementing on top of the wrong model. Better to register the insight, ship the work that's done, and resume next session with this as the entry point.

## Next session — entry checklist

1. Read this document end-to-end.
2. Read [`docs/process/worklog.md`](../process/worklog.md) "Next" section (points back here).
3. Walk a second user case through the cena-first model — different shape than Aula Nova Acrópole. Voice da Alma case is a strong candidate.
4. Decide order of S1–S4.
5. Lock the form shape (inline / modal / wizard) before any code.
