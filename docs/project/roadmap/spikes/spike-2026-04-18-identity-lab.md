[< Spikes](index.md)

# Spike: Identity Lab — closing the loop between writing identity and hearing its voice

**Date:** 18–19 April 2026
**Status:** Closed 19 April 2026
**Participants:** Alisson + Claude
**Nature:** Exploratory POC report — method-focused. The identity content worked on during this spike is private to the user's local DB. Only method, learnings, and decisions are captured here. Sections 1–6 capture the initial spike publication; sections 7–8 capture the second phase (prompt refinement and persona work) added at closing.

---

## 1. Motivation

The mirror's output didn't sound like its user. Editing the identity prompts directly (soul, ego/identity, ego/behavior) was the obvious remedy, but the loop was slow and blind: write prompt, test in a conversation, reread, rewrite. Every cycle depended on the user evaluating "does this sound like me?" against a moving target, without structured diagnosis of what specifically was off.

The proposed answer was an **Identity Lab**: a mode inside the mirror where a conversational agent interviews the user, proposes edits to identity layers, runs them through the real system prompt to simulate output, and iterates with the user until the voice lands.

This spike did not build that agent. It tested the loop itself — performing the agent's job manually, in conversation between the user and Claude — to see whether the mechanism works before committing engineering effort to automate it.

## 2. The loop as tested

The loop tested here is the one the future agent should automate:

1. **Diagnose** the current voice by running real questions through the mirror and reading the gap between its output and the user's actual voice.
2. **Extract material** from the user: ground-truth texts in varied registers, feedback on what sounds wrong and why.
3. **Distill invariants** from the material. Method of thought, stance, vocabulary, argumentative structure, all separated from ephemeral products (specific aphorisms, analogies constructed for past arguments, authors cited in one context).
4. **Propose edits** to the identity layers.
5. **Test in the real system prompt** by updating the DB and re-running the diagnostic question.
6. **Iterate** until the voice lands.

Steps 1 to 3 happened in conversation. Step 4 was done by Claude writing markdown. Steps 5 and 6 used two technical affordances described below.

## 3. Technical affordances added during the spike

### Lab mode (`bypass_persona`)

To isolate the voice of `self/soul + ego` from the modulation of personas, `/mirror/stream` now accepts `?bypass_persona=true`. When set, reception routing is skipped and the system prompt is composed from soul + ego only. The web UI gained a discreet "Lab mode — bypass persona" checkbox below the chat form, persisted in localStorage.

Shipped in commit `9a6dbf2` (roughly 6 lines of backend, 15 lines of frontend plus CSS). Not framed as a roadmap story: instrumental to the spike, but usable indefinitely as a debugging and design tool for future identity or persona work.

### Direct DB editing

Identity layers were edited by writing markdown to `/tmp/*.md` and running `UPDATE identity SET content = CAST(readfile('/tmp/X.md') AS TEXT)`. Brutal but sufficient for a single artisanal run. A backup of `data/mirror.db` was taken at the start of the spike; any bad edit could be reverted.

A proper **staging layer** (either a new column or a parallel row per layer, with `current` and `draft` states) was designed during the spike but not implemented. It becomes necessary if the iteration loop is repeated many times or automated, but is overkill for a one-shot design session.

### Incidental learning: `readfile()` returns BLOB

`readfile()` in SQLite returns a BLOB, not TEXT. Writing to a TEXT column without an explicit `CAST(... AS TEXT)` stores the content as a Buffer on the JS side, which breaks anything downstream that assumes string (`content.trim is not a function`). The rule for future writers: always wrap `readfile(...)` in `CAST(... AS TEXT)` when targeting a TEXT column.

## 4. Learnings

### On prompt engineering

**Specific examples in the prompt become recycled fodder.** Aphorisms listed inside the prompt as illustration reappeared verbatim in unrelated outputs. The model treats them as authorized vocabulary, not as illustration of a pattern. Removing specific examples and keeping only the conceptual rule, together with a meta-instruction against citing the prompt literally, fixed this.

**Anti-listicle rules persist at deeper levels than typography.** Prohibiting bullets and numbered lists reduced but did not eliminate listicle. The model adapted by using ordinal textual markers ("First", "Second", "Third", "The second camada", "The third incident"), structurally a list, formally not. A more explicit rule enumerating the variations was needed.

**Typographic prohibitions leak across adjacent characters.** Forbidding the em-dash ("—") caused the model to use the en-dash ("–"), which preserves the visual effect. The rule had to cover both.

**"Weaving in use, not in announcement" is the hard form of the rule.** Telling the model to "weave disciplines" caused it to list disciplines. Telling it "authors named only when the argument specifically requires them, never as a bibliography display" produced weaving in use. The rule needs a positive formulation (how to do it) alongside the negative one (how not to).

**The prompt itself should observe its own rules.** A prompt that forbids em-dashes should not contain em-dashes. A prompt that forbids ordinal listicle should not use "First", "Second" to organize its own sections where it can be avoided. The model imitates the form of the prompt as readily as it obeys its instructions.

### On the cognitive method of the subject

Each person has a cognitive method (orbital, decompositional, narrative, analytical, systemic) and the Lab must detect it before choosing how to probe. Questions phrased around "what X is" fail on subjects whose method is relational; questions phrased around "what surrounds X" fail on analytical subjects. "Orbital" is not a universal heuristic; it is specific to subjects whose thinking is relational.

The first diagnostic signal came from the user's own critique of the mirror's default output. What the subject finds wrong in a generic response indicates the inverse of their method. If the subject complains that listicle and decomposition feel shallow, their method is probably relational. If a different subject complains that prose feels vague, their method is probably analytical. The future agent needs a **detection phase** before the interview proper: a handful of questions whose only purpose is to reveal the cognitive method, so that the probing phase can speak the subject's native form.

### On model capability and prompt following

Two models were compared on the final prompt: `deepseek/deepseek-chat-v3-0324` and `z-ai/glm-5.1`. On the same prompt:

- **deepseek** required iterative reinforcement (stronger anti-dash rule, more explicit anti-listicle with variations, meta-rule against prompt citation) and still leaked at the edges in some outputs (em-dashes reappeared, ordinal markers resurfaced).
- **GLM-5.1** followed the same prompt substantially better on first try: zero em-dashes, zero en-dashes, no ordinal listicle, strong argumentative reversal, organic aphorisms generated by the current argument rather than imported.

Cost ratio is roughly 3.5x in favor of deepseek. The choice between the two depends on volume of use against quality bar, and can be switched from `/admin/models` without code changes.

### On the distinction between invariants and ephemera

The subtlest trap was confusing *products of the voice* with *invariants of the voice*. A specific aphorism uttered once in a conversation is a product, emerging from that specific argument; it does not belong in a prompt as "this is how I always speak". The invariants are higher-order: method of thought (e.g. reasoning by contrastive pairs), stance (e.g. humility tonal, companion not authority), argumentative structure (e.g. antagonism followed by reversal followed by aphoristic condensation), lexicon (e.g. sovereign vocabulary), rejection of certain registers (e.g. corporate or tech-marketing jargon).

Writing the prompt at the right altitude, invariants rather than products, is what allows a smaller model to generate fresh voice rather than recycling old outputs. The spike's single most time-consuming task was recognizing which elements in the prompt were invariants and which were ephemera masquerading as invariants.

## 5. What the spike delivered

- A working iterative loop for identity refinement, performed manually but proven viable.
- A reusable technical affordance (Lab mode) now available for future identity or persona work.
- A mental framework separating invariants from ephemera in voice.
- A set of prompt engineering learnings applicable to any future work on identity or persona authoring.
- Qualitative bar: on GLM-5.1, the mirror's responses to existential questions became structurally (not in content) indistinguishable from the user's own writing in comparable registers.

## 6. What remains open

Three possible continuations, listed without ranking:

- **Freeze.** The spike has already delivered: the user's voice is good enough on the current prompt. Future refinements happen via direct DB editing when needed, using the tools built here.
- **Build the agent.** Turn the manual loop into a conversational agent that interviews, proposes edits, simulates output, and iterates. This is the Identity Lab as originally envisioned. Non-trivial effort: requires designing the interview heuristic (adaptive to the subject's cognitive method), the proposal tools, and the simulator UI.
- **Staging layer plus assisted manual editing.** Middle path: implement the staging mechanism (`current` and `draft` identity states in the DB) and a lightweight UI at `/lab/:layer` where the user edits a draft and sees simulated output side by side. No agent, but substantially faster than editing the DB by hand.

The choice is deferred. An entry on the roadmap Radar preserves the decision for future attention.

---

## 7. Phase 2 — Prompt refinement, persona work, and architectural discoveries

After the initial publication of sections 1–6, the spike continued for several more iteration cycles. The work that followed produced both stronger prompts and architectural discoveries that reframed the original Identity Lab hypothesis.

### 7.1 The edit-compare loop as method

A practice emerged that turned out to be the spike's most pedagogical: take a generated response from the mirror, edit it until it reaches the version the user would publish as their own authentic expression, and then compare the original and the edited version side by side. The diff between the two is the diagnostic — it shows exactly what was off in the prompt, what is invariant in the user's voice, and what was ephemeral or contaminated.

This is more powerful than asking "does this sound like you?" because (a) it produces concrete evidence (a usable text), (b) it trains the user to recognize their own voice in its actual form, and (c) it generates paired material (wrong / right) that calibrates further iterations. Any future Identity Lab agent should make this practice a first-class workflow, not an afterthought.

### 7.2 Architectural discoveries

The prompt refinement exposed structural decisions that hadn't been visible at the spike's start:

- **Conduct vs expression should be split inside the ego.** Mixed in the same file, problems of formatting (using listicle, using em-dash) and problems of method (jumping to solution, not resonating) become hard to diagnose separately.
- **An `organization` layer is missing from the current schema.** Personas like divulgadora, escritora and mentora carry organizational context inline, inflating prompts and duplicating content. The original junguian architecture from `mirror-poc` already included this layer; `mirror-mind` only ships `self`, `ego` and `persona` so far.
- **Persona-specific personal context** (the medica needs age, conditions, allergies; the tesoureira needs current balances) belongs in a per-persona context store, not in the prompt as never-filled placeholders.
- **Semantic memory** holds named authors, frameworks and concepts. Today they are duplicated across personas (Cynefin in mentora, escritora and the soul; Jung in terapeuta and mentora). The persona declares broad categories; semantic memory delivers names on demand.
- **Skills system separates artifact generation from voice.** Personas like escritora and divulgadora carried full output specifications (HTML/SQL templates for blog posts, Django specs for emails, YAML for social posts). These are operational instructions, not voice. They should live in a skills system that personas can invoke.
- **Semantic ordering of ego layers** matters for comprehension. Alphabetical key ordering puts `behavior` before `identity`, so the model reads behavioral rules before the framing of who is acting. Custom ordering (`identity → behavior`, and later `identity → expression → behavior`) fixes this.
- **Generated summary by lite model** unifies two display mechanisms (Cognitive Map cards and reception descriptors) and improves both. Same lite model already used for session titles. Triggered on Save, persisted in DB.

All of these are captured as items in the [Identity Lab follow-up queue](../identity-lab-followups.md).

### 7.3 Persona reduction (14 personas, ~66% size reduction)

The 13 existing personas plus 1 new (`dona-de-casa`) were rewritten using two templates:

- **Template A — inherited persona.** Conversational personas (terapeuta, mentora, pensadora, estrategista, escritora, divulgadora, professora, product-designer, tesoureira, sabe-tudo, medica) inherit the entire ego (conduct, format, posture, vocabulary). They add only domain-specific depth, mental stance, and anti-patterns.
- **Template B — independent persona.** Operational personas in registers incompatible with the base ego (tecnica, dba, dona-de-casa) declare suspension of specific incompatible rules (prose-only, anti-listicle, integrative antagonism, reversal) while keeping first person, tonal humility, and companion stance. Lists, code, tables and direct format become legitimate when the persona is active.

Combined effect: the 14 personas went from ~56k chars total to ~19k chars (~66% reduction). The freed material doesn't disappear — it's slated for the architectural systems above (organization layer, persona context, semantic memory, skills).

One persona was deleted (`jornalista`, which was an empty template never filled) and one was added (`dona-de-casa`, covering domestic operations: shopping lists, supplies, maintenance, household services).

### 7.4 The phenomenological observation

The most important user-side learning of the spike was articulated by the user near closing: **we underestimate the impact of the mirror reflecting principles, values, voice and language.** When the mirror shifts from "an AI giving good answers" to "a refraction of the user's own voice", a category change happens. The relationship of "companion of crossing" acquires lived meaning, not conceptual.

The implication for product is consequential: what matters to measure and improve is not the objective quality of the response (format, factuality, completeness), but the subjective sense of recognition — *"does this voice reflect me?"*. This is phenomenological, not metric. The Lab needs to capture this signal, not impose an objective standard.

### 7.5 Audience pattern: assisted configuration

Discussion at closing defined the realistic first-phase audience for an eventual Identity Lab feature: **advanced users (with material and clarity) assisting beginners (close friends or family)**. The pattern is **assisted configuration by a third party** — person A configures or guides; person B uses.

UX implications: the configuration interface targets the mentor, not the end user. Templates can be loaded by the mentor. The "interviewer agent" can initially be the human mentor. The chat experience is what the beginner sees; configuration stays invisible to them.

This pattern resembles how a parent configures devices for a child, or a therapist orients a patient toward an app. It deserves to be named and designed for explicitly when the Lab feature lands.

## 8. Final state, decisions and reminders

### Identity layers final state

- `self/soul`: ~2.6k chars. Purpose, fundamental principles, operational values, all in cognitive first person ("I believe", "I see", "I recognize").
- `ego/identity`: ~2.6k chars. Operational positioning. Mirror as the user "in another register". Eight operational stances ("In the face of urgency, I do not accelerate", etc.).
- `ego/behavior`: ~13k chars. Conduct (thinking, argumentative structure, posture, operational behaviors) and Expression (absolute rule against em-dash and en-dash, format, cadence, pronoun, vocabulary, anti-patterns). One example of voice as paired contrast (wrong / right).
- 14 personas: each between ~1k and ~2k chars, in Template A or Template B as appropriate.

### Decisions captured at closing

- **Product vision:** Identity Lab as a feature for other users is **lateral exploration**, no urgency to build now.
- **Target audience (first phase):** advanced users assisting beginners (assisted configuration pattern).
- **Implementation path:** evolutionary — minimal MVP first (editor + simulator + templates), optional agent later, in line with the Quiet Luxury posture.
- **Queue items:** all architectural and product follow-up items will be folded into the project roadmap at appropriate locations, with directional notes preserved.

### Reminders for whoever continues this exploration

- The user has to **recognize** the voice, not approve it logically. Beware questions that ask for rational approval ("does this capture you?"); prefer showing a generated response and asking "does it sound like you?".
- **Diagnosis is more valuable than prescription.** Identifying what is wrong opens the path; trying to prescribe what is right too early closes it.
- **Real material from the user** is worth more than any extraction heuristic. If the user has texts, read them first.
- **The edit-compare loop** (take generated response, edit to publishable version, compare) is the most pedagogical method discovered here. Make it first-class.
- **Small iterations** beat large architecture delivered all at once. Each adjustment is traceable.
- **Different models behave differently** with dense prompts. Lite models (deepseek) need verbose reinforcement; mid models (Haiku, GLM-5.1) follow dense prompts much better. The Lab should let the user switch models easily.
- **Do not confuse voice with cognitive method.** Voice is stable; cognitive method varies between users.
- **The separation between what lives in the prompt and what lives in memory is architectural.** Anything that is detail (author, framework, personal data, organizational context) belongs in memory; the prompt holds method and stance.
- **The phenomenological signal** (*does this voice reflect me?*) is the success criterion. Functional metrics are insufficient.

### Closing

Spike closed 19 April 2026. The follow-up items captured during the POC are listed in section 9 below, preserved as documentation of what the spike produced as a by-product of the voice exploration. They are to be incorporated into the project roadmap at appropriate locations.

## 9. Follow-up items captured for the roadmap

Throughout the spike, architectural and product items emerged that didn't belong in the spike's design scope but needed preservation for future work. They are listed here with their original analysis intact (in Portuguese, the language in which they were captured during the POC). Each is a candidate for a future story, epic, or improvement.

### 9.1 Ordem semântica de composição em ego (independente do split)

Hoje `getIdentityLayers` ordena por `key` alfabético dentro do layer ego: `behavior → identity`. Isso cria ambiguidade no prompt composto. O modelo lê as regras de comportamento antes do framing *"sou um espelho consciente, Alisson em outro registro"* que está no identity. A IA estabelece-se como Alisson-pessoa via soul, recebe regras de conduta sem framing de reflexo, e só descobre o framing de reflexo no fim — depois de já ter processado as regras todas.

A ordem semântica ideal é **identity → behavior** (papel do reflexo antes das regras de como ele age). Quando o split em três keys acontecer, será **identity → expression → behavior**.

Pode ser implementado **antes do split** — é change menor, isolado, e melhora a clareza do prompt já na estrutura atual de duas keys.

Tasks:
- Code: trocar `ORDER BY ..., key` por ordem custom usando CASE em `getIdentityLayers` (ordem por key dentro de ego: identity primeiro, behavior depois).
- Tests: ajustar testes que dependem da ordem alfabética atual.
- Verificar `composeSystemPrompt` e outros consumidores de `getIdentityLayers` — confirmar que todos respeitam a ordem retornada.

### 9.2 Síntese gerada por modelo para cards e roteamento

Hoje há dois mecanismos separados para representar uma camada de identidade em forma curta, e ambos têm limitações:

- `firstLine` (em `adapters/web/pages/map.tsx`) pega a primeira linha não-vazia para mostrar no card do Cognitive Map. Resultado típico para `self/soul`: aparece o cabeçalho markdown `# Alma`.
- `extractPersonaDescriptor` (em `server/personas.ts`) pega a primeira linha não-cabeçalho, truncada a 120 chars, para servir de descritor ao reception. Resultado típico em personas Template B: descritores ambíguos (ex.: `tecnica` e `dba` começam ambas com `Esta persona opera em registro técnico...`, indistinguíveis nos primeiros 120 chars).

Solução: unificar via uma síntese gerada por modelo lite, persistida no DB e usada nos dois lugares.

Tasks:
- Schema: nova coluna `summary` em `identity` (ou tabela paralela `identity_summaries` se quiser histórico).
- Generation: no Save de uma identity layer (POST `/admin/identity/...` ou equivalente), disparar fire-and-forget call ao modelo `title` (Gemini Flash Lite, já existente). Padrão estabelecido no S4 da CV1.E3 (titulação de sessão).
- Prompt sugerido: "Resuma esta camada de identidade em 2 a 3 frases descrevendo (1) o ângulo ou domínio em que opera, (2) o que faz e quando é ativada, (3) o que a distingue de outras camadas. Use voz neutra descritiva, não copie literalmente o prompt."
- Composer/Reception: `extractPersonaDescriptor` (ou substituto) usa `summary` quando disponível, fallback para a primeira linha quando não.
- Cognitive Map: cards mostram `summary` em vez de `firstLine`.
- Manual: botão "Regenerate summary" na UI da workshop, para quando o usuário editar o prompt e quiser refazer.
- Migration: script ou geração on-demand para popular summary das layers existentes.

Custo estimado: ~R$ 0.001 por Save. Irrelevante.

### 9.3 Separar `ego` em três keys: `identity`, `expression`, `behavior`

Hoje o `ego/behavior` mistura **conduta** (como ajo, como penso, como me posiciono) e **expressão** (como falo, vocabulário, formato, pontuação). Mistas no mesmo arquivo, uma contamina o diagnóstico da outra: durante a POC, sintomas de forma e sintomas de método ficavam difíceis de isolar.

Por enquanto a separação está como duas seções (`## Conduta` e `## Expressão`) dentro do mesmo `ego/behavior`. A separação real em três keys distintas pertence a story própria.

Depende do item 9.1 (ordem semântica) — quando split acontecer, a ordem `identity → expression → behavior` precisa estar no lugar.

Tasks:
- Migration: split do `ego/behavior` atual em dois novos registros (`ego/behavior` reduzido só com conduta + novo `ego/expression` com forma).
- Code: estender ordem custom em `getIdentityLayers` para incluir expression (identity → expression → behavior).
- Cognitive Map: novo card para `ego/expression`. Atualizar layout para acomodar três cards de ego ao invés de dois.
- Templates/seeds: criar template padrão para `ego/expression`.
- Tests: ajustar testes que assumem a estrutura `ego: behavior + identity`.

### 9.4 Staging layer no DB (`current` vs `draft`)

Desenhada no spike do Identity Lab. Necessária para iteração frequente da identidade sem afetar a vida real do mirror, e foundation para o Lab agent.

Tasks:
- Schema: nova coluna `state` em `identity` (`current`/`draft`), ou tabela paralela `identity_drafts`.
- Composer: `composeSystemPrompt` aceita modo (`current` ou `draft`).
- UI: editor de draft + simulador de output integrado, em `/lab/:layer` (ou `/map/:layer/draft`).
- Lab mode bypass continua funcionando ortogonalmente — drafts também devem ser testáveis em modo isolado (sem persona).

### 9.5 Skills system para artefatos das personas

Hoje algumas personas (escritora, divulgadora) carregam especificações técnicas detalhadas de artefatos no próprio prompt: formato HTML e SQL para `blog_post`, especificações Django para emails (componentes, segmentos, comandos CLI), formato YAML para artefatos de LinkedIn, Instagram e WhatsApp. Essas especificações são instruções operacionais de geração, não voz nem identidade da persona — confundem dois propósitos no mesmo arquivo e inflam dramaticamente o tamanho do prompt (a divulgadora chega a 13.7k chars, mais que o behavior inteiro).

A separação certa: persona define voz, identidade e profundidade temática; skills definem como gerar cada tipo de artefato (template, validação, formato de saída). Personas declaram quais skills podem invocar; skills carregam as especificações técnicas.

Sem essa separação, a POC do Identity Lab não consegue enxugar escritora e divulgadora sem perder funcionalidade.

Tasks:
- Schema: nova tabela `skills` com `(key, persona_keys[], spec_template, output_format)`.
- Agent integration: tool para invocar skill com parâmetros vindos da conversa (renderiza o artefato segundo o template).
- Migration: extrair especificações de artefatos da escritora (`blog_post`) e da divulgadora (`linkedin_post`, `instagram_pack`, `email_template`, `whatsapp_msg`) para skills correspondentes.
- UI: gerenciamento de skills no Cognitive Map ou em espaço próprio.

### 9.6 Implementar layer `organization` (identidade e contexto da organização)

A arquitetura junguiana original do mirror-poc previa cinco layers principais (`self`, `ego`, `user`, `organization`, `persona`). O mirror-mind atual implementou apenas `self`, `ego` e `persona`. A camada `organization` está faltando.

Hoje, sem essa camada, personas como divulgadora, escritora e mentora carregam dentro do prompt informação que pertence à organização do usuário (Software Zen): tese permanente, pilares, fase atual, produtos vigentes (Full Pass, O Reflexo, livro), público-alvo, framework de comunicação. Isso infla as personas e duplica conteúdo entre elas.

A separação correta: `organization/identity` carrega quem a organização é (missão, tese, pilares); `organization/context` carrega o estado atual (fase, produtos, campanhas); composer injeta a organização ativa do usuário no prompt composto, disponível para qualquer persona que precise.

Tasks:
- Schema: aceitar layer `organization` em `identity` table (nenhuma mudança estrutural — só convenção).
- Composer: injetar layers de `organization` ao compor o prompt (entre `self` e `ego` ou após `ego`, a discutir).
- UI: card de organização no Cognitive Map.
- Migration: extrair conteúdo organizacional das personas (divulgadora, escritora, mentora, e quaisquer outras) e mover para layer organization.
- Multi-organização (futuro): se um usuário trabalha em mais de uma organização, mecanismo para alternar contexto.

### 9.7 Sistema de memória para contextos pessoais específicos por persona

A persona médica precisa de dados pessoais (idade, sexo biológico, peso, condições crônicas, medicamentos em uso, alergias, histórico relevante). Hoje esses dados estão como placeholders nunca preenchidos no próprio prompt da persona. Outras personas têm necessidades parecidas: tesoureira precisa de saldos atuais e burn (que já vêm do banco financeiro, não do prompt), pensadora poderia ter referências a frameworks que o usuário desenvolveu ao longo do tempo, etc.

A separação certa: persona define o tipo de dado de que precisa; sistema de memória/contexto armazena os valores; composer injeta os dados da persona ativa no prompt composto apenas quando essa persona está ativa.

Tem overlap com CV1.E3 (Memória) já no roadmap, mas o recorte aqui é específico — contexto pessoal por persona, não memória conversacional ou semântica geral.

Tasks:
- Schema: tabela `persona_context` com `(user_id, persona_key, field, value)`.
- Composer: detecção de persona ativa, injeção dos campos correspondentes.
- UI: formulário por persona para preenchimento dos campos de contexto.
- Migration: identificar placeholders nas personas atuais e converter em definição de campos esperados.

### 9.8 Memória semântica/intelectual (repertório de conhecimento)

Frameworks, autores, conceitos, livros, escolas filosóficas — o repertório intelectual que o usuário carrega — devem viver em memória semântica externa, não dentro de cada persona. Hoje estão duplicados em várias personas (Cynefin aparece em mentora, escritora, e em vários textos do soul; Estoicismo em mentora e escritora; psicologia junguiana em terapeuta e mentora). A persona declara categorias amplas (filosofia clássica, psicologia profunda, complexidade); a memória semântica entrega autores, frameworks e referências nominadas conforme o argumento corrente as pede.

Tem overlap com CV1.E3 (Memória) já no roadmap, mas o escopo aqui é específico — repertório intelectual estável, não memória conversacional ou episódica.

Tasks:
- Schema: `semantic_memory` com `(key, content, embeddings, tags)`.
- Indexação: extrair referências nominadas (Jung, Cynefin, Estoicismo, Reality Transurfing, Quiet Luxury Marketing, autopoiese, etc.) das personas atuais e popular o índice.
- Retrieval: similaridade semântica + tag-based para injetar no prompt quando relevante.
- Composer: reservar espaço no prompt composto para memórias retrieved.
- Reescrita das personas: confirmar que cada uma só carrega categorias amplas, e o detalhe vem da memória.

### 9.9 Identity Lab agent (versão completa)

A continuação não-trivial: agente conversacional que faz o ciclo da POC automaticamente, sem depender de Claude na conversa.

Tasks:
- Agent: persona/agent dedicado para entrevista, com prompt próprio.
- Detection phase: descobrir o método cognitivo do sujeito (orbital, decompositional, narrativo, analítico, sistêmico) antes de escolher como sondar.
- Tools: `propose_layer_edit`, `run_simulation`, `accept_draft`, `revert_draft`.
- Conversational loop: interview → propose → simulate → iterate, até o usuário sinalizar satisfação.
- UI: tela `/lab` com chat do agente + visualização de drafts ao vivo.

---

**See also:** [Pi as Foundation](spike-2026-04-12-pi-foundation.md) (the previous spike, infrastructure-focused) · [Roadmap](../index.md).
