[< Product Use Narrative](../../)

# Antonio Castro

Brazilian tenant (second cut of the narrative). Mineiro de origem, mora em Florianópolis, sustenta uma pequena casa editorial de educação em escrita. Used to validate the localization layer end-to-end (CV2.E1) and to exercise registers the Reilly–Marchetti family doesn't reach.

> **Note:** Antonio's content is in **Brazilian Portuguese**. The loader sets `users.locale = 'pt-BR'` for this tenant via the `locale: pt-BR` frontmatter on his `profile.md`. The English translation of identity layers (for the project's reference / canonical English fallback) is intentionally NOT shipped — pt-BR is his canonical language.

## Files

- [profile.md](profile.md) — biographical narrative (author reference; not loaded into the DB)
- identity/
  - self/
    - [soul.md](identity/self/soul.md) — `layer=self, key=soul`
  - ego/
    - [identity.md](identity/ego/identity.md) — `layer=ego, key=identity`
    - [behavior.md](identity/ego/behavior.md) — `layer=ego, key=behavior`
    - [expression.md](identity/ego/expression.md) — `layer=ego, key=expression`
  - persona/
    - [criador.md](identity/persona/criador.md) — voz pública, estrategista de audiência
    - [escritor.md](identity/persona/escritor.md) — voz autoral, frase por frase
    - [pai.md](identity/persona/pai.md) — paternidade ativa
    - [marido.md](identity/persona/marido.md) — companheirismo com Bia
    - [filho.md](identity/persona/filho.md) — filho mineiro distante
- organizations/
  - [pages-inteiras.md](organizations/pages-inteiras.md) — sua casa editorial
  - [lagoa-letras.md](organizations/lagoa-letras.md) — coletivo de escritores em Floripa
- journeys/
  - [o-livro.md](journeys/o-livro.md) — romance autoral abandonado, retomada
  - [voltar-a-bh.md](journeys/voltar-a-bh.md) — proximidade da mãe doente
  - [pos-lancamento.md](journeys/pos-lancamento.md) — desidentificação do circuito guru-digital
  - [bia-saturada.md](journeys/bia-saturada.md) — divisão de cuidados em casa
  - [tonico-cresce.md](journeys/tonico-cresce.md) — filho começa a perceber o pai público
- scenes/ — cenas recorrentes da casa de Antonio (carregadas via `upsertScenes` + auto-seed Voz da Alma)
  - [escrita-do-livro.md](scenes/escrita-do-livro.md) — `escritor` + `criador`, `o-livro`, `pages-inteiras`
  - [depois-do-tonico-sair.md](scenes/depois-do-tonico-sair.md) — `pai`, `tonico-cresce`
  - [noite-com-bia.md](scenes/noite-com-bia.md) — `marido`, `bia-saturada`
- conversations/
  - [01-o-algoritmo-me-odeia.md](conversations/01-o-algoritmo-me-odeia.md) — `criador`
  - [02-voltei-a-abrir-o-livro.md](conversations/02-voltei-a-abrir-o-livro.md) — `escritor`
  - [03-a-bia-chegou-em-casa-chorando.md](conversations/03-a-bia-chegou-em-casa-chorando.md) — `marido`
  - [04-o-tonico-perguntou-se-sou-famoso.md](conversations/04-o-tonico-perguntou-se-sou-famoso.md) — `pai`
  - [05-minha-mae-no-telefone.md](conversations/05-minha-mae-no-telefone.md) — `filho`
