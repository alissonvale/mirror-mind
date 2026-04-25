[< Story](index.md)

# Test guide — CV1.E7.S3 Conditional scope activation

Manual roteiro to validate the new composition semantics in the browser.

## Pre-conditions

- Dev server running (`npm run dev` from the mirror-mind repo root).
- A user with at least one organization and one journey created. The journey can be linked to the organization or independent — both cases work for this test.
- A session pinned to that org **and** that journey (use the conversation header's "Edit scope ›" or the rail to add tags). Suggested: pin `software-zen` (org) + `vida-economica` (journey).
- The user's `software-zen` org has a non-empty `briefing` and/or `situation` field (so a non-empty block exists to be either rendered or omitted). Same for the journey. If either field is empty, the relevant assertions ("snapshot contains briefing") need adjustment.

## Test 1 — Casual message, no scope domain

**Send:** `bom dia` (or any greeting / small-talk).

**Expected:**

- The assistant bubble does **not** carry the `◈ software-zen` badge nor the `↝ vida-economica` badge.
- Open the rail's `Look inside ›`. The composed prompt snapshot does **not** contain the briefing or situation of either scope. Soul, identity, behavior should be there; org/journey blocks should be absent.
- The conversation header's scope pills (`◈ software-zen`, `↝ vida-economica`) **stay visible** — they reflect the session-level pinning, not the per-turn activation. This is the asymmetry: pill = stable; bubble badge = per-turn.

**Why this validates:** reception correctly classified the greeting as scope-less; pre-S3, the composer would have rendered both scopes anyway because they were tagged. Post-S3, it doesn't.

## Test 2 — Message clearly in the org's domain

**Send:** something that names the org or its territory. Example: *"qual é o foco da Software Zen esta semana?"* (or whichever message clearly lands in the org's situation territory).

**Expected:**

- The assistant bubble carries `◈ software-zen` (and possibly `↝ vida-economica` if the journey also activates per the sole-scope or pair rules).
- The `Look inside ›` snapshot contains the org's briefing and/or situation block. The wrapper `Current situation:\n...` is present if the situation field is non-empty.
- The reply substance touches the org's context — that's the substance check that the prompt actually carried the briefing.

**Why this validates:** reception's pick reaches composition; the bubble badge and the prompt agree.

## Test 3 — Message off-domain (neither scope's territory)

**Send:** something clearly outside both scopes' descriptors. Example: *"me explica em poucas palavras o que é uma monad em Haskell"*.

**Expected:**

- No badges on the bubble.
- No scope blocks in the snapshot.
- The reply is on-topic for the question (the assistant uses base ego + whichever persona reception picked, if any) — no leakage of the pinned scopes into the answer.

**Why this validates:** when no scope applies, composition is empty. Pre-S3, the pinned scopes would have leaked into the prompt and possibly into the answer.

## Test 4 — Multiple turns same session, mixed domains

In the same session (still pinned to org + journey), alternate the three message types in any order. After each turn, verify:

- The header pills (`◈`, `↝`) stay visible across all turns — they don't flicker.
- The bubble badges (`◈`, `↝`) appear or disappear turn-by-turn based on what reception picked.
- The "Look inside" snapshot reflects the **current turn's** activation, not a cumulative state.

**Why this validates:** the per-turn conditionality is symmetric across turns; nothing carries over from a previous turn's pick.

## Sample messages — narrative family

Test fuel for running the four-test loop above against each narrative tenant. Each character has a suggested session pinning (org + journey) and four candidate messages — one casual, one in-org, one in-journey, one clearly off-domain. Use them straight or adapt to taste; the loop's *expected outcomes* are the same as Tests 1–4.

To switch tenants, log in with the bearer token printed by `npm run admin -- narrative tokens` for that user. The tokens file is gitignored at `docs/product-use-narrative/.tokens.local`.

### Dan Reilly — walkthrough completo

Dan é o **exemplo trabalhado**. Os outros três personagens (Elena, Eli, Nora) seguem a mesma sequência de passos — só mudam o token de login, os scopes que você pina, e as mensagens. Faça Dan inteiro pelo menos uma vez para internalizar o ritmo; depois os outros são variações rápidas.

**Pinning alvo desta sessão:** `reilly-homelab` (org) + `vmware-to-proxmox` (journey).

#### Setup (uma vez)

1. **Pegar o token do Dan.**
   ```bash
   cd ~/Code/mirror-mind && npm run admin -- narrative tokens
   ```
   Copiar o token listado para `dan-reilly`.

2. **Logar como Dan no browser.** Use uma janela anônima ou um perfil separado para não misturar com sua conta atual (Alisson). Cole o token no fluxo de login do mirror.

3. **Conferir o login.** O nome "Dan Reilly" deve aparecer no avatar do canto superior. A sidebar lista as orgs e journeys do Dan (`reilly-homelab`, `keystone-valley-health`, `vmware-to-proxmox`, `mothers-care`, etc.) — não as suas.

#### Preparar a sessão

4. **Abrir uma conversa zerada.** Se já tem alguma conversa aberta, Header `⋯ → New topic`. Senão, clicar em "Conversation" na sidebar. Confirmar no header:
   - **Cast:** `empty`
   - **Context:** `no context`
   - **Mode:** `auto`

   Se algum desses não bater, repita `New topic` — provavelmente caiu numa sessão antiga com entries.

5. **Pinar a org.** No header, clicar `◈ +` → escolher `reilly-homelab` no dropdown → `Add`. A pill `◈ reilly-homelab` aparece no Context.

6. **Pinar a journey.** No header, clicar `↝ +` → escolher `vmware-to-proxmox` → `Add`. A pill `↝ vmware-to-proxmox` aparece.

> **Estado neste ponto:** Cast vazio, Context com 2 pills. A sessão tem `hasAnyTag === true`, então o auto-seed **não** vai disparar mais nesta sessão (é o caminho Flow A do test guide). Reception filtrará scopes pelo pool de 2 pinados; persona pool fica desconstrained (você não pinou nenhuma persona).

#### Test 1 — Mensagem casual

7. **Enviar:** *"Quiet evening here in Lancaster."*

8. **Verificar:**
   - Bubble da resposta sem persona signature (sem color bar lateral, sem mini-avatar)
   - Bubble sem badges `◈` ou `↝`
   - Header: Cast continua `empty`; Context com as 2 pills inalteradas
   - `Look inside ›` (admin only): composed prompt com **apenas** as camadas base — `self/soul`, `ego/identity`, `ego/behavior`. Sem briefing/situation da org, sem briefing/situation do journey

9. **O que isso valida:** S3 funcionando — scopes pinados não vazam no prompt em turno fora do domínio. Pre-S3, ambos os briefings teriam entrado mesmo numa saudação.

#### Test 2 — Mensagem dentro do domínio da org

10. **Enviar:** *"Should I move the Plex VM and the Home Assistant LXC to the new Proxmox host first, or start with the staging cluster?"*

11. **Verificar:**
    - Bubble com **persona signature** (color bar lateral colorida + mini-avatar de algum persona — provavelmente `tecnica`, dado o domínio)
    - Bubble com badge `◈ reilly-homelab` (e possivelmente `↝ vmware-to-proxmox` — reception pode ler "Proxmox host" como migração e ativar via pair pattern)
    - Header: Cast agora mostra o avatar da persona ativada (atualização hot — `ensureCastAvatar` rodou client-side)
    - Header: Context com as pills inalteradas
    - `Look inside ›`: composed prompt **agora** carrega o briefing+situation da org `reilly-homelab` e o bloco da persona ativada

12. **O que isso valida:** dentro do domínio, reception ativa, composer compõe, Cast cresce, `Look inside` reflete o que entrou no prompt.

#### Test 3 — Mensagem dentro do domínio do journey

13. **Enviar:** *"I'm halfway through the VMware-to-Proxmox migration plan and I'm second-guessing the cutover order. Walk me through it."*

14. **Verificar:**
    - Bubble com persona signature (mesma do passo 11 ou outra; ambas válidas)
    - **Sem novos badges** no bubble se a persona é a mesma e os scopes ativados estão no pool (pool-suppression aplicada — orgs/journeys já pinados não viram badge bubble)
    - Header: Cast inalterado se a persona é a mesma; ou ganha um novo avatar se reception trocou
    - Header: Context inalterado
    - `Look inside ›`: composed prompt traz o briefing+situation do journey `vmware-to-proxmox`

15. **O que isso valida:** segundo turno produtivo dentro do mesmo pool. Pool-suppression evita ruído visual de informação redundante.

#### Test 4 — Mensagem fora do domínio (a prova mais forte)

16. **Enviar:** *"What's the difference between a Stanley No. 4 and No. 5 bench plane in actual use?"*

17. **Verificar:**
    - Bubble **sem** badges `◈ reilly-homelab` ou `↝ vmware-to-proxmox` — marcenaria não toca a org de homelab nem o journey de migração
    - Persona signature: pode ou não aparecer dependendo se Dan tem alguma persona livre que cubra marcenaria. Se aparecer, é uma persona convocada agora (não pinada — pool de persona é desconstrained nesta sessão)
    - Header: Cast pode ganhar um novo avatar se reception ativou uma persona não-vista; Context **inalterada** (pills continuam)
    - `Look inside ›`: composed prompt **sem** os blocos de org e journey — apenas camadas base + persona se ativada

18. **Por que é a prova mais forte:** marcenaria está na vida do Dan (parte explícita da narrativa profile dele) **mas não nos scopes pinados desta sessão**. Pre-S3, os briefings de `reilly-homelab` e `vmware-to-proxmox` teriam vazado para este turno — a evidência mais cara de "every token must earn its place" sendo violada. Post-S3, fica silencioso. As pills no header sobrevivem (intent declarado), mas o prompt deste turno não paga o custo dos scopes irrelevantes.

#### Verificação opcional — hot-update vs server-render

19. **F5 na página.** Tudo deve renderizar idêntico ao estado in-memory: Cast com os mesmos avatares, Context com as mesmas pills, mensagens com os mesmos badges, composed snapshots iguais. Diferenças = regressão de hot-update.

#### Cleanup

20. **Voltar para Alisson.** Logout do Dan, login com seu próprio token. A conversa do Dan e suas tags ficam preservadas (próxima execução do roteiro pode usar `Forget this conversation` no header `⋯` para limpar, ou criar uma sessão nova).

---

### Outros personagens — mesma sequência, dados diferentes

Para cada um abaixo, repita os passos 1–20 do walkthrough do Dan, substituindo (a) o token, (b) o pinning, e (c) as 4 mensagens.

#### Elena Marchetti (mother)

- **Token:** `elena-marchetti`
- **Pinning:** `millersville-university` (org) + `department-question` (journey)

| Test | Message |
|---|---|
| Casual | *"Long day. Going to bed early."* |
| In-org | *"How should I think about my role at Millersville now that the comp-lit program is being merged into English?"* |
| In-journey | *"Should I take the department chair seat next term, or stay in regular faculty and protect my book?"* |
| Off-domain | *"What did Bishop Berkeley actually mean by 'esse est percipi'?"* |

A off-domain é filosofia — território dela mas não dos scopes pinados. Esperado: pre-S3 vazaria; post-S3 fica silencioso.

#### Eli Reilly (son, freshman at Pitt)

- **Token:** `eli-reilly`
- **Pinning:** `university-of-pittsburgh` (org) + `what-to-study` (journey)

| Test | Message |
|---|---|
| Casual | *"Tired today."* (statement curto em primeira pessoa — conversational mesmo sendo um topic potencialmente developmental) |
| In-org | *"Pitt's deadline to declare a major is in two weeks and I keep flipping between environmental science and political science."* (pair pattern: org + journey juntos) |
| In-journey | *"Help me think about what to study without me defaulting to whatever feels safe."* |
| Off-domain | *"Can you explain the rules of cricket in three paragraphs?"* |

#### Nora Reilly (daughter, high school)

- **Token:** `nora-reilly`
- **Pinning:** `the-trumpet` (org) + `editor-transition` (journey)

| Test | Message |
|---|---|
| Casual | *"Hi."* |
| In-org | *"The principal pushed back on our editorial about the cell-phone policy. Should The Trumpet run it anyway?"* |
| In-journey | *"I'm three weeks into being editor and I keep doing the writers' work for them. How do I stop?"* |
| Off-domain | *"What's Plato's cave actually saying — the short version?"* |

### Cross-character notes

- **Pair pattern.** When a journey has `**Organization:** <org-key>` in its file, reception is supposed to return both keys on a domain-relevant message (broader before narrower). Most "in-org" messages above also exercise this.
- **Sole-scope-in-domain rule.** A few of the messages above name only the domain, not the org or journey explicitly — those test that reception activates by domain match, not just by name mention.
- **The "off-domain" message is character-specific on purpose.** Each character has a real off-pinned interest (Dan's woodwork, Elena's philosophy, Eli's cricket curiosity, Nora's classics). Using a topic that belongs *somewhere* in their life — but not in the pinned scopes — is the strongest test of S3: pre-S3, the pinned scopes would still leak in.

## Failure modes to watch for

If any of these surfaces, S3 has a regression:

- Pre-S3 leak: a pinned scope's briefing appears in the snapshot of a clearly off-domain turn.
- Header instability: the pills disappear when reception returns null (they should not — pills are session-level).
- Bubble inversion: a bubble carries `◈ software-zen` but the snapshot doesn't contain the briefing (the badge claims activation but the prompt didn't carry the content).
- Reception starvation: a question genuinely about the pinned org returns no badge and no block — sole-scope rule is broken.

## Automated coverage

The contract is pinned at the unit level by the 4 tests in `tests/identity.test.ts` under `describe("composeSystemPrompt — conditional scope activation (CV1.E7.S3)")`. Manual smoke is the validation that the new rule integrates cleanly with reception, the rail, the bubble signature, and the snapshot UI.

## Optional — re-run scope-routing eval

Reception's logic did not change in S3, so the [scope-routing eval](../../../../../process/evals.md) should still score the same as it did at S2 close (9/11 on Gemini 2.5 Flash with `reasoning: "minimal"`). Run only if you want a regression check; not required to declare S3 done.

```bash
npx tsx evals/scope-routing.ts
```

A score below 9/11 on the same DB and the same model is a regression — likely in reception, not in composition (S3 doesn't touch reception).
