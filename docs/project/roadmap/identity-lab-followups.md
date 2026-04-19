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

### Síntese gerada por modelo para cards e roteamento

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

### Skills system para artefatos das personas

Hoje algumas personas (escritora, divulgadora) carregam especificações técnicas detalhadas de artefatos no próprio prompt: formato HTML e SQL para `blog_post`, especificações Django para emails (componentes, segmentos, comandos CLI), formato YAML para artefatos de LinkedIn, Instagram e WhatsApp. Essas especificações são instruções operacionais de geração, não voz nem identidade da persona — confundem dois propósitos no mesmo arquivo e inflam dramaticamente o tamanho do prompt (a divulgadora chega a 13.7k chars, mais que o behavior inteiro).

A separação certa: persona define voz, identidade e profundidade temática; skills definem como gerar cada tipo de artefato (template, validação, formato de saída). Personas declaram quais skills podem invocar; skills carregam as especificações técnicas.

Sem essa separação, a POC do Identity Lab não consegue enxugar escritora e divulgadora sem perder funcionalidade.

Tasks:
- Schema: nova tabela `skills` com `(key, persona_keys[], spec_template, output_format)`.
- Agent integration: tool para invocar skill com parâmetros vindos da conversa (renderiza o artefato segundo o template).
- Migration: extrair especificações de artefatos da escritora (`blog_post`) e da divulgadora (`linkedin_post`, `instagram_pack`, `email_template`, `whatsapp_msg`) para skills correspondentes.
- UI: gerenciamento de skills no Cognitive Map ou em espaço próprio.

### Implementar layer `organization` (identidade e contexto da organização)

A arquitetura junguiana original do mirror-poc previa cinco layers principais (`self`, `ego`, `user`, `organization`, `persona`). O mirror-mind atual implementou apenas `self`, `ego` e `persona`. A camada `organization` está faltando.

Hoje, sem essa camada, personas como divulgadora, escritora e mentora carregam dentro do prompt informação que pertence à organização do usuário (Software Zen): tese permanente, pilares, fase atual, produtos vigentes (Full Pass, O Reflexo, livro), público-alvo, framework de comunicação. Isso infla as personas e duplica conteúdo entre elas.

A separação correta: `organization/identity` carrega quem a organização é (missão, tese, pilares); `organization/context` carrega o estado atual (fase, produtos, campanhas); composer injeta a organização ativa do usuário no prompt composto, disponível para qualquer persona que precise.

Tasks:
- Schema: aceitar layer `organization` em `identity` table (nenhuma mudança estrutural — só convenção).
- Composer: injetar layers de `organization` ao compor o prompt (entre `self` e `ego` ou após `ego`, a discutir).
- UI: card de organização no Cognitive Map.
- Migration: extrair conteúdo organizacional das personas (divulgadora, escritora, mentora, e quaisquer outras) e mover para layer organization.
- Multi-organização (futuro): se um usuário trabalha em mais de uma organização, mecanismo para alternar contexto.

### Sistema de memória para contextos pessoais específicos por persona

A persona médica precisa de dados pessoais (idade, sexo biológico, peso, condições crônicas, medicamentos em uso, alergias, histórico relevante). Hoje esses dados estão como placeholders nunca preenchidos no próprio prompt da persona. Outras personas têm necessidades parecidas: tesoureira precisa de saldos atuais e burn (que já vêm do banco financeiro, não do prompt), pensadora poderia ter referências a frameworks que o usuário desenvolveu ao longo do tempo, etc.

A separação certa: persona define o tipo de dado de que precisa; sistema de memória/contexto armazena os valores; composer injeta os dados da persona ativa no prompt composto apenas quando essa persona está ativa.

Tem overlap com CV1.E3 (Memória) já no roadmap, mas o recorte aqui é específico — contexto pessoal por persona, não memória conversacional ou semântica geral.

Tasks:
- Schema: tabela `persona_context` com `(user_id, persona_key, field, value)`.
- Composer: detecção de persona ativa, injeção dos campos correspondentes.
- UI: formulário por persona para preenchimento dos campos de contexto.
- Migration: identificar placeholders nas personas atuais e converter em definição de campos esperados.

### Memória semântica/intelectual (repertório de conhecimento)

Frameworks, autores, conceitos, livros, escolas filosóficas — o repertório intelectual que o usuário carrega — devem viver em memória semântica externa, não dentro de cada persona. Hoje estão duplicados em várias personas (Cynefin aparece em mentora, escritora, e em vários textos do soul; Estoicismo em mentora e escritora; psicologia junguiana em terapeuta e mentora). A persona declara categorias amplas (filosofia clássica, psicologia profunda, complexidade); a memória semântica entrega autores, frameworks e referências nominadas conforme o argumento corrente as pede.

Tem overlap com CV1.E3 (Memória) já no roadmap, mas o escopo aqui é específico — repertório intelectual estável, não memória conversacional ou episódica.

Tasks:
- Schema: `semantic_memory` com `(key, content, embeddings, tags)`.
- Indexação: extrair referências nominadas (Jung, Cynefin, Estoicismo, Reality Transurfing, Quiet Luxury Marketing, autopoiese, etc.) das personas atuais e popular o índice.
- Retrieval: similaridade semântica + tag-based para injetar no prompt quando relevante.
- Composer: reservar espaço no prompt composto para memórias retrieved.
- Reescrita das personas: confirmar que cada uma só carrega categorias amplas, e o detalhe vem da memória.

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
