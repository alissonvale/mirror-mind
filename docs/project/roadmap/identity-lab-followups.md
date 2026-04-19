[< Roadmap](index.md)

# Identity Lab — follow-up queue

Queue ativa de itens técnicos que emergem do trabalho da POC do Identity Lab e precisam virar epics/stories quando o trabalho de design fechar. Este arquivo é vivo: alimentado à medida que novos itens aparecem durante a POC.

Não é spike (spike é histórico, congelado). Não é epic ainda. É candidato a epic — o pacote de mudanças no mirror que a POC do Identity Lab está produzindo como subproduto da exploração da voz.

---

## Itens em queue

### Ordem semântica de composição em ego (independente do split)

Hoje `getIdentityLayers` ordena por `key` alfabético dentro do layer ego: `behavior → identity`. Isso cria ambiguidade no prompt composto. O modelo lê as regras de comportamento antes do framing *"sou um espelho consciente, Alisson em outro registro"* que está no identity. A IA estabelece-se como Alisson-pessoa via soul, recebe regras de conduta sem framing de reflexo, e só descobre o framing de reflexo no fim — depois de já ter processado as regras todas.

A ordem semântica ideal é **identity → behavior** (papel do reflexo antes das regras de como ele age). Quando o split em três keys acontecer, será **identity → expression → behavior**.

Pode ser implementado **antes do split** — é change menor, isolado, e melhora a clareza do prompt já na estrutura atual de duas keys.

Tasks:
- Code: trocar `ORDER BY ..., key` por ordem custom usando CASE em `getIdentityLayers` (ordem por key dentro de ego: identity primeiro, behavior depois).
- Tests: ajustar testes que dependem da ordem alfabética atual.
- Verificar `composeSystemPrompt` e outros consumidores de `getIdentityLayers` — confirmar que todos respeitam a ordem retornada.

### Separar `ego` em três keys: `identity`, `expression`, `behavior`

Hoje o `ego/behavior` mistura **conduta** (como ajo, como penso, como me posiciono) e **expressão** (como falo, vocabulário, formato, pontuação). Mistas no mesmo arquivo, uma contamina o diagnóstico da outra: durante a POC, sintomas de forma e sintomas de método ficavam difíceis de isolar.

Por enquanto a separação está como duas seções (`## Conduta` e `## Expressão`) dentro do mesmo `ego/behavior`. A separação real em três keys distintas pertence a story própria.

Depende do item anterior (ordem semântica) — quando split acontecer, a ordem `identity → expression → behavior` precisa estar no lugar.

Tasks:
- Migration: split do `ego/behavior` atual em dois novos registros (`ego/behavior` reduzido só com conduta + novo `ego/expression` com forma).
- Code: estender ordem custom em `getIdentityLayers` para incluir expression (identity → expression → behavior).
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
