[< Roadmap](index.md)

# Identity Lab — follow-up queue

Queue ativa de itens técnicos que emergem do trabalho da POC do Identity Lab e precisam virar epics/stories quando o trabalho de design fechar. Este arquivo é vivo: alimentado à medida que novos itens aparecem durante a POC.

Não é spike (spike é histórico, congelado). Não é epic ainda. É candidato a epic — o pacote de mudanças no mirror que a POC do Identity Lab está produzindo como subproduto da exploração da voz.

---

## Itens em queue

### Separar `ego` em três keys: `identity`, `expression`, `behavior`

Hoje o `ego/behavior` mistura **conduta** (como ajo, como penso, como me posiciono) e **expressão** (como falo, vocabulário, formato, pontuação). Mistas no mesmo arquivo, uma contamina o diagnóstico da outra: durante a POC, sintomas de forma e sintomas de método ficavam difíceis de isolar.

Por enquanto a separação está como duas seções (`## Conduta` e `## Expressão`) dentro do mesmo `ego/behavior`. A separação real em três keys distintas pertence a story própria.

Tasks:
- Migration: split do `ego/behavior` atual em dois novos registros (`ego/behavior` reduzido só com conduta + novo `ego/expression` com forma).
- Code: ordem custom em `getIdentityLayers` para garantir composição em ordem semântica (`identity → expression → behavior`) ao invés de alfabética.
- Cognitive Map: novo card para `ego/expression`. Atualizar layout para acomodar três cards de ego ao invés de dois.
- Templates/seeds: criar template padrão para `ego/expression`.
- Tests: ajustar testes que assumem a estrutura `ego: behavior + identity`.

### Staging layer no DB (`current` vs `draft`)

Desenhada no spike do Identity Lab. Necessária para iteração frequente da identidade sem afetar a vida real do mirror, e foundation para o Lab agent.

Tasks:
- Schema: nova coluna `state` em `identity` (`current`/`draft`), ou tabela paralela `identity_drafts`.
- Composer: `composeSystemPrompt` aceita modo (`current` ou `draft`).
- UI: editor de draft + simulador de output integrado, em `/lab/:layer` (ou `/map/:layer/draft`).
- Lab mode bypass continua funcionando ortogonalmente — drafts também devem ser testáveis em modo isolado (sem persona).

### Identity Lab agent (versão completa)

A continuação não-trivial: agente conversacional que faz o ciclo da POC automaticamente, sem depender de Claude na conversa.

Tasks:
- Agent: persona/agent dedicado para entrevista, com prompt próprio.
- Detection phase: descobrir o método cognitivo do sujeito (orbital, decompositional, narrativo, analítico, sistêmico) antes de escolher como sondar.
- Tools: `propose_layer_edit`, `run_simulation`, `accept_draft`, `revert_draft`.
- Conversational loop: interview → propose → simulate → iterate, até o usuário sinalizar satisfação.
- UI: tela `/lab` com chat do agente + visualização de drafts ao vivo.

---

## Como esta queue evolui

À medida que a POC avança, novos itens entram aqui. Quando a POC fecha, os itens são convertidos em epic/stories formais (provavelmente um epic Identity Lab dentro de um CV apropriado, com docs próprios). Até lá, é queue de descoberta.
