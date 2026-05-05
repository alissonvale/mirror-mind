[< CV1.E15](.)

# CV1.E15 — Roteiro de teste consolidado

Sessão de teste para validar todas as 7 stories shipping em `2026-05-05`. Use **dois usuários** lado a lado:

- **admin** — você (`Alisson Vale` ou outro com `role='admin'`)
- **user** — um regular user qualquer (cria com `npm run admin -- user add testuser` se precisar)

## Setup

```bash
cd ~/Code/mirror-mind
npm run dev
# em outra aba, monitore os logs:
tail -f data/server.log 2>/dev/null  # se existir; senão, observe stdout do dev
```

Hard refresh em todas as páginas (cache buster mudou). Tenha duas janelas/abas: uma logada como admin, outra como user.

## Estado de partida

- **`/admin/models`** segue funcional (S1)
- **`/cenas/<key>/editar`** mostra picker pra admin (S2)
- **`/conversation`** tem row "Modelo" no Avançado pra admin (S3)
- Resolver consome session/scene model (S4)
- `⋯` no canto da bolha pra admin (S5)
- `POST /conversation/turn/rerun` admin-only (S6)
- Badge `⊕` quando turno divergente do default da sessão (S7)

---

## S1 — Catálogo + picker (`/admin/models`)

1. Abrir `/admin/models` como admin
2. Conferir largura: página centrada (~1080px), não flush-left
3. Clicar no campo **Model ID** de qualquer role → dropdown nativo lista modelos do OpenRouter
4. Digitar `claude` → datalist filtra por substring
5. Selecionar uma entrada → campo preenche com `model_id` apenas (sem `openrouter/` na frente)
6. Cada option mostra `[provider] Display Name (R$X/1M in, R$Y/1M out)`
7. Salvar → row mostra `openrouter · <model_id>` corretamente

**Negativos:**
- Como user normal: `GET /admin/models/catalog` → 403
- Sem `OPENROUTER_API_KEY` (apague do `.env` e reinicie): página renderiza, datalist vazio mas input aceita digitação livre

---

## S2 — Modelo por cena

1. Como admin em `/cenas/nova` (ou `/cenas/<key>/editar`):
   - Expandir **Avançado**
   - Ver "Provider do modelo" + "Modelo" + hint "vazio = usa global. Admin-only."
2. Selecionar `openrouter` + `google/gemini-2.5-flash` → Salvar
3. Reload → campos persistiram
4. Limpar os dois → Salvar → reload → vazios (cena volta a herdar)
5. Como **user**: abrir a mesma cena → **não** vê os campos
6. DevTools como user: forjar POST com `model_provider`/`model_id` → backend ignora; valor existente preservado

**Verificar no banco** (opcional):
```bash
sqlite3 data/mirror.db "SELECT key, model_provider, model_id FROM scenes WHERE key='<key>'"
```

---

## S3 — Modelo por sessão (header pouch)

1. Como admin em `/conversation`:
   - Clicar **Avançado ▾** no header → última row do panel é "Modelo"
   - Ver provider input + Model picker (datalist) + Salvar + hint "Aplica do próximo turno em diante. Vazio = herda da cena ou global. Admin-only."
2. Selecionar `openrouter` + um modelo → Salvar
3. Reload → campos persistiram; pouch summary agora mostra `auto/auto · <model_short>`
4. Limpar os dois → Salvar → summary volta para "Avançado"
5. Como **user**: abrir `/conversation` → row "Modelo" **ausente**
6. DevTools como user: `POST /conversation/model` → 403

---

## S4 — Resolver + per-turn stamping

**Esse é o que liga a chave** — daqui em diante, S2 e S3 efetivamente determinam qual modelo responde.

1. Sem nenhum override (cena sem modelo, sessão sem modelo): manda mensagem
2. Abrir `/admin/llm-logs` → última row de `role=main` mostra o modelo global
3. Setar **session override** (S3) para `anthropic/claude-sonnet-4-6`
4. Manda outra mensagem
5. `/admin/llm-logs` → nova row mostra `anthropic/claude-sonnet-4-6` (não o global)
6. Limpar session override; anchor session a uma cena que tem **scene override** (S2) configurado
7. Manda outra mensagem
8. `/admin/llm-logs` → row mostra o modelo da cena
9. Verificar stamping no entries (opcional):
   ```bash
   sqlite3 data/mirror.db "SELECT json_extract(data, '$._model_id') FROM entries WHERE session_id='<sid>' AND json_extract(data, '$.role')='assistant' ORDER BY timestamp DESC LIMIT 5"
   ```

**Precedência (deve confirmar nos logs):**
```
session override > scene override > global
```

Se setar **ambos** session e scene, **session vence**.

---

## S5 + S6 — Menu kebab + rerun destrutivo

1. Como admin em `/conversation`, com algumas mensagens trocadas:
   - Hover numa bolha de **assistant** → `⋯` aparece à direita (não mais `×`)
   - Clicar `⋯` → menu com **"Re-executar com modelo…"** + **"Excluir"**
2. Bolha **user**: o menu aparece, mas só com **"Excluir"** (assistente não tem rerun aqui — rerun de assistant é o caso primário)

   *Wait — confirmar que user bubble também não mostra rerun. Sim: o trigger `data-rerun-trigger` só renderiza com `role === "assistant"`.*
3. Em uma bolha assistant, clicar **"Re-executar com modelo…"**:
   - Popover central abre
   - Provider preenchido com "openrouter"; Modelo vazio
   - Selecionar um modelo diferente do que rodou esse turno → **Re-executar**
   - Status muda para "Re-executando…"
   - Sucesso → página recarrega
4. **A mesma bolha agora mostra o conteúdo da nova resposta** (não duplica — destrutivo).
5. **A bolha ganha badge `⊕ <model_short>`** (porque o stamped `_model_id` agora difere do default da sessão... espera, se rodei com modelo diferente, ele agora **é** o stamped — vou explicar abaixo)
6. Cancelar dentro do popover ou clicar fora → fecha sem fazer nada
7. Erro: digitar provider/modelo vazio → status mostra "Provider e modelo são obrigatórios"; submit fica disabled
8. Erro: digitar modelo inexistente (typo) → backend tenta, falha no LLM call → status "Falha ao re-executar: <error>"

**Negativos:**
- Como **user normal**: `⋯` não aparece, segue mostrando `×`
- DevTools como user: `POST /conversation/turn/rerun` → 403

**Verificar no `/admin/llm-logs`:** rerun aparece como nova row de `role=main` apontando pro mesmo `entry_id` da row anterior — você vê os dois turns no mesmo entry_id ordenados por `created_at`.

---

## S7 — Badge de divergência

A lógica do badge:
> "Mostra `⊕ <model_short>` quando `entries.data._model_id` ≠ modelo resolvido da sessão **agora**."

Ou seja: o badge mostra **bolhas que rodaram com modelo diferente do que a sessão usaria se uma nova mensagem fosse enviada agora**.

**Cenário 1 — rerun deixa a bolha "fora do default":**
1. Sessão sem override (default = global, ex: `gemini-2.5-flash`)
2. Manda mensagem → bolha rola sem badge (stamped = global = default → match)
3. Rerun da bolha pra `claude-sonnet-4-6`
4. Bolha agora tem stamped `claude-sonnet-4-6`; default da sessão segue `gemini-2.5-flash`
5. **Badge `⊕ claude-sonnet-4-6` aparece** na bolha

**Cenário 2 — admin muda o session override depois dos turnos:**
1. Sessão sem override; mande 3 mensagens → bolhas todas sem badge
2. Setar session override (S3) pra `claude-opus-4`
3. Reload `/conversation`
4. **Todas as 3 bolhas anteriores ganham badge** `⊕ <stamped>` (porque stamped = global anterior, default agora = claude-opus-4)
5. Manda nova mensagem → bolha sem badge (stamped = claude-opus-4 = default match)

**Cenário 3 — turnos antigos (pré-S4) ficam silenciosos:**
- Bolhas que foram persistidas antes do S4 não têm `_model_id` no meta. Badge não aparece (curto-circuita pra "sem divergência").

**Hover no badge:** tooltip mostra o `model_id` completo (ex: `anthropic/claude-sonnet-4-6` em vez do short `claude-sonnet-4-6`).

**Estilo:** badge cinza-neutro, fonte monospace, distinto do amber (Alma) e cool (persona/scope).

---

## Smoke geral final

```bash
cd ~/Code/mirror-mind
npm test
```

Esperado: **1232/1232** verde.

Os logs em `/admin/llm-logs` devem refletir corretamente os modelos que rodaram cada turno (incluindo reruns). Você consegue filtrar por modelo no select.

---

## O que **não** está coberto (follow-ups)

1. **Auth cross-provider**: se você fizer override pra um provider OAuth (Google Code Assist) sem que `models.main` seja desse provider, a auth vai falhar — `resolveApiKey(db, "main")` resolve pelo role, não pelo provider override. Documentado no doc da S4.
2. **`session-stats` cost na rail**: ainda usa o modelo global pra calcular custo estimado. Pode ficar levemente off quando há override. Não afeta geração; só o número exibido na rail.
3. **Live update do badge**: ao salvar session override no header, bolhas existentes não repaintam o badge até refresh. Refresh manual resolve.
4. **Rerun streaming**: a re-execução é síncrona (espera a resposta completa, depois full reload). Não tem text_delta pintando na tela. Aceitável para a primeira versão.

---

## Se algo der errado

- **Backup do DB**: `cp data/mirror.db data/mirror.db.bak-pre-e15-test`
- **Rollback de uma feature**: cada story é um commit separado. `git log --oneline | grep CV1.E15` lista todos.
- **Reset session model override**: na header, limpe os dois campos e Salvar
- **Reset scene model override**: em `/cenas/<key>/editar`, limpe os dois campos e Salvar
- **Reverter rerun**: como é destrutivo, a única forma é... rerun de novo com o modelo original. Backup do DB antes de testar reruns muito impactantes.

---

## Sequência sugerida de teste (60-90 min)

1. **15min** — S1 + S2 (estados estáticos, fácil de validar visualmente)
2. **15min** — S3 (popover do header, persistência)
3. **15min** — S4 (mande 3-4 turnos com diferentes overrides, confira `/admin/llm-logs`)
4. **20min** — S5 + S6 (menu kebab + rerun completo, verifique destrutividade no DB)
5. **15min** — S7 (cenários de badge — o mais sutil)

Total: 1h-1h30. Se algo travar, é melhor voltar ao último commit verde (`git log` mostra o histórico) e investigar.
