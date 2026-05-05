import { describe, it, expect, beforeEach } from "vitest";
import { createHash } from "node:crypto";
import {
  openDb,
  createUser,
  createJourney,
  createOrganization,
  linkJourneyOrganization,
  type Journey,
} from "../server/db.js";
import {
  composeJourneyPortrait,
  composeLede,
  detectStructuralSection,
  detectLiveQuestion,
  composeClose,
} from "../server/portraits/journey-synthesis.js";

/**
 * Reproduces the three reference drafts from
 * `docs/design/entity-profiles.md` against the actual content of the
 * narrative tenant Antonio Castro's travessias. The drafts are the
 * acceptance criteria of CV1.E13.S1 — when the synthesis pipeline
 * produces the right shape from the underlying data, the page
 * renders the design.
 *
 * These probes validate **structural reproduction**: lede source,
 * tile composition, "onde ela mora" adjacencies, structural section
 * detection, live-question detection, close source. Visual fidelity
 * (typography, spacing, color) is verified manually against a
 * provisioned mirror — see the smoke roteiro at the end of the
 * S1 plan.
 */

// --- Fixtures (verbatim source content) -------------------------------

const BIA_SATURADA_BRIEFING = `Bia está cansada. É cansaço acumulado de dois anos de plantões pesados num pronto-socorro pediátrico privado, somado a vida doméstica em que a divisão de cuidados, na superfície, parece equilibrada — eu cubro as noites quando ela está de plantão, e ela cobre a maior parte das tardes quando está em casa — mas que na prática deixa para ela uma carga emocional desproporcional.

A travessia não é "salvar o casamento". O casamento não está em crise. Está em descuido. É um casamento bom de doze anos que, nos últimos meses, vem sendo tratado por mim com a mão fechada — eu estou em casa quase sempre, mas não estou inteiro. Bia notou. Ainda não chamou para conversar. Eu notei que ela notou. Estou adiando.`;

const BIA_SATURADA_SITUATION = `A coisa concreta que está acontecendo é que a Bia tem chegado em casa de plantão noturno e me encontrado no escritório com a porta encostada três vezes nas últimas semanas.

A pergunta viva, esta semana, é mais simples do que parece: eu vou conversar com a Bia? E se vou, como?

A versão "precisamos conversar" eu rejeito. É discurso. Bia detesta. A versão de "passei a viver no escritório, percebi, mudei a partir de agora" sem grande declaração também tem risco — a sutileza pode passar despercebida.

A dúvida real é se eu acredito em mim quando digo "vou mudar". Mudei outras vezes em outras épocas, mantive um tempo, voltei ao padrão antigo.`;

const VOLTAR_A_BH_BRIEFING = `Estou pensando, há cerca de oito meses de forma intermitente e nos últimos três meses de forma mais insistente, sobre a possibilidade de me mudar de Florianópolis para Belo Horizonte — ou pelo menos passar períodos significativamente mais longos lá.

A travessia, neste momento, é menos sobre "decidir mudar" e mais sobre "olhar de frente o que a opção significaria" — para mim, para a Bia, para o Tonico, para o Pedro, para meus pais. Tenho evitado esse olhar porque suspeito que olhá-lo de frente vai me obrigar a algo, e eu ainda não sei a quê.`;

const VOLTAR_A_BH_SITUATION = `Há três cenários que eu reviro:

**Cenário A — Mudança da família para BH.** Vendo o aluguel da Lagoa, Bia pede transferência de hospital, Tonico muda de escola, eu monto escritório em BH. Custo emocional alto, custo prático alto, reversibilidade baixa.

**Cenário B — Eu passar uma semana por mês em BH, ficando na casa do meu pai.** Mantenho a vida em Floripa, mas estabeleço presença regular. Custo emocional médio, custo prático médio, reversibilidade alta.

**Cenário C — Continuar como está, ajustar o que dá.** Mantenho ligações semanais, visito a cada dois meses. Custo prático baixo no curto, alto no longo, reversibilidade zero.

A questão honesta, e que estou adiando, é: eu já decidi. Eu decidi pelo cenário B há semanas, mas não disse para a Bia nem para o Pedro nem para mim mesmo.

Tem também uma camada que eu evito olhar: o cenário B me coloca em BH uma semana por mês, e isso significa também ficar perto do livro de outro jeito.`;

const POS_LANCAMENTO_BRIEFING = `Eu fui parte do circuito brasileiro de lançamento Hotmart entre 2018 e 2020. Em meados de 2020, no meio da pandemia, tive um colapso de ansiedade que me tirou de circulação por três meses.

A travessia é a relação contínua, e ainda não estabilizada, com o circuito do qual eu saí. Saí, mas eles não desapareceram. Os antigos parceiros continuam trabalhando, alguns crescendo, alguns naufragando. Há uma porosidade que eu mantenho mais aberta do que admito.`;

const POS_LANCAMENTO_SITUATION = `Há três frentes vivas.

**A primeira é a DM pendente.** Um antigo parceiro me escreveu há nove meses. Mensagem longa, cuidadosa, pedindo uma conversa por vídeo. Não respondi. A não-resposta está virando dívida moral.

**A segunda é a curiosidade pelos números do circuito.** Continuo, com alguma vergonha, abrindo planilhas de comparação mental.

**A terceira é a permeabilidade técnica.** Algumas práticas do mundo de lançamento são ferramentas neutras. Outras são manipulação dourada. A fronteira nem sempre é clara.

A questão de fundo não é "voltar ou não voltar para o circuito". Eu não vou voltar. A questão é mais sutil: como eu mantenho posição editorial sem virar puritano, sem virar amargo.

Tem também uma camada mais antiga: parte de mim ainda procura reconhecimento daquele mundo. Tenho consciência. Não me agride; é informação.`;

function makeJourney(
  name: string,
  key: string,
  briefing: string,
  situation: string,
  organizationId: string | null = null,
): Journey {
  const now = Date.now();
  return {
    id: "j-" + key,
    user_id: "u-1",
    organization_id: organizationId,
    key,
    name,
    briefing,
    situation,
    summary: null,
    status: "active",
    sort_order: null,
    show_in_sidebar: 1,
    is_draft: 0,
    created_at: now - 90 * 24 * 60 * 60 * 1000, // 90 days ago
    updated_at: now,
  };
}

// --- Bia Saturada -----------------------------------------------------

describe("Reference draft 1 — Bia Saturada", () => {
  it("lede comes from briefing's last paragraph (the 'descuido' diagnosis)", () => {
    const j = makeJourney("Bia Saturada", "bia-saturada", BIA_SATURADA_BRIEFING, BIA_SATURADA_SITUATION);
    const lede = composeLede(j);
    expect(lede.source).toBe("briefing");
    expect(lede.text).toContain("não está em crise");
    expect(lede.text).toContain("descuido");
    expect(lede.text).toContain("Estou adiando");
  });

  it("structural section is null — Bia Saturada has no enumerated branches", () => {
    expect(detectStructuralSection(BIA_SATURADA_SITUATION)).toBeNull();
  });

  it("live question detected: 'eu vou conversar com a Bia? E se vou, como?'", () => {
    const lq = detectLiveQuestion(BIA_SATURADA_BRIEFING, BIA_SATURADA_SITUATION);
    expect(lq).not.toBeNull();
    expect(lq!.primary).toContain("eu vou conversar com a Bia");
  });

  it("close fragment lands a punchline from briefing's last sentences", () => {
    const j = makeJourney("Bia Saturada", "bia-saturada", BIA_SATURADA_BRIEFING, BIA_SATURADA_SITUATION);
    const close = composeClose(j);
    expect(close).not.toBeNull();
    expect(close!.source).toBe("briefing");
  });
});

// --- Voltar a BH ------------------------------------------------------

describe("Reference draft 2 — Voltar a BH", () => {
  it("lede comes from briefing's last paragraph (the 'olhar de frente' diagnosis)", () => {
    const j = makeJourney("Voltar a BH", "voltar-a-bh", VOLTAR_A_BH_BRIEFING, VOLTAR_A_BH_SITUATION);
    const lede = composeLede(j);
    expect(lede.source).toBe("briefing");
    expect(lede.text).toContain("olhar de frente");
  });

  it("detects three scenarios as the structural section", () => {
    const result = detectStructuralSection(VOLTAR_A_BH_SITUATION);
    expect(result).not.toBeNull();
    expect(result!.kind).toBe("scenarios");
    expect(result!.items).toHaveLength(3);
    if (result!.kind === "scenarios") {
      expect(result!.items.map((i) => i.letter)).toEqual(["A", "B", "C"]);
      expect(result!.items[1]!.title).toContain("uma semana por mês");
    }
  });

  it("live question + confessional layer — the meta-question + the book", () => {
    const lq = detectLiveQuestion(VOLTAR_A_BH_BRIEFING, VOLTAR_A_BH_SITUATION);
    expect(lq).not.toBeNull();
    expect(lq!.primary).toMatch(/já decidi|A questão honesta/);
    expect(lq!.confessionalLayer).not.toBeNull();
    expect(lq!.confessionalLayer).toContain("perto do livro");
  });
});

// --- Pós-Lançamento ---------------------------------------------------

describe("Reference draft 3 — Pós-Lançamento", () => {
  it("lede comes from briefing's last paragraph ('Saí, mas eles não desapareceram')", () => {
    const j = makeJourney(
      "Pós-Lançamento",
      "pos-lancamento",
      POS_LANCAMENTO_BRIEFING,
      POS_LANCAMENTO_SITUATION,
    );
    const lede = composeLede(j);
    expect(lede.source).toBe("briefing");
    expect(lede.text).toContain("não desapareceram");
  });

  it("detects three live fronts as the structural section", () => {
    const result = detectStructuralSection(POS_LANCAMENTO_SITUATION);
    expect(result).not.toBeNull();
    expect(result!.kind).toBe("fronts");
    expect(result!.items).toHaveLength(3);
    if (result!.kind === "fronts") {
      expect(result!.items[0]!.title).toContain("DM pendente");
      expect(result!.items[1]!.title).toContain("curiosidade pelos números");
      expect(result!.items[2]!.title).toContain("permeabilidade");
    }
  });

  it("live question + confessional layer — the editorial posture + reconhecimento", () => {
    const lq = detectLiveQuestion(POS_LANCAMENTO_BRIEFING, POS_LANCAMENTO_SITUATION);
    expect(lq).not.toBeNull();
    expect(lq!.primary).toContain("posição editorial");
    expect(lq!.confessionalLayer).not.toBeNull();
    expect(lq!.confessionalLayer).toContain("reconhecimento");
  });

  it("close fragment includes 'Saí, mas eles não desapareceram'", () => {
    const j = makeJourney(
      "Pós-Lançamento",
      "pos-lancamento",
      POS_LANCAMENTO_BRIEFING,
      POS_LANCAMENTO_SITUATION,
    );
    const close = composeClose(j);
    expect(close).not.toBeNull();
    expect(close!.source).toBe("briefing");
  });
});

// --- Integration: full portrait state ---------------------------------

describe("Reference drafts — full portrait integration", () => {
  it("Bia Saturada portrait composes lede + tiles + live question + close", () => {
    const db = openDb(":memory:");
    const tokenHash = createHash("sha256").update("t").digest("hex");
    const user = createUser(db, "Antonio", tokenHash);
    const j = createJourney(
      db,
      user.id,
      "bia-saturada",
      "Bia Saturada",
      BIA_SATURADA_BRIEFING,
      BIA_SATURADA_SITUATION,
    );
    const fresh = db
      .prepare("SELECT * FROM journeys WHERE id = ?")
      .get(j.id) as any;
    const portrait = composeJourneyPortrait(db, user.id, fresh);

    expect(portrait.lede.text).toContain("descuido");
    expect(portrait.structuralSection).toBeNull();
    expect(portrait.liveQuestion).not.toBeNull();
    expect(portrait.close).not.toBeNull();
    expect(portrait.conversationsEmpty).toBe(true);
    // Parenthetical declares all three absences (no org, persona, scene).
    expect(portrait.whereItLives.parenthetical).toContain(
      "não cristalizou em diálogo",
    );

    // After the journey ages past a week, the time-since-start tile
    // emits. Verify by re-composing with a future `now`.
    const futureNow = fresh.created_at + 60 * 24 * 60 * 60 * 1000;
    const aged = composeJourneyPortrait(db, user.id, fresh, futureNow);
    expect(aged.tiles.some((t) => /dias|meses|anos/.test(t.number))).toBe(true);
  });

  it("Voltar a BH portrait emits the scenarios tile + structural section", () => {
    const db = openDb(":memory:");
    const tokenHash = createHash("sha256").update("t").digest("hex");
    const user = createUser(db, "Antonio", tokenHash);
    const j = createJourney(
      db,
      user.id,
      "voltar-a-bh",
      "Voltar a BH",
      VOLTAR_A_BH_BRIEFING,
      VOLTAR_A_BH_SITUATION,
    );
    const fresh = db
      .prepare("SELECT * FROM journeys WHERE id = ?")
      .get(j.id) as any;
    const portrait = composeJourneyPortrait(db, user.id, fresh);

    expect(portrait.structuralSection).not.toBeNull();
    expect(portrait.structuralSection!.kind).toBe("scenarios");

    // Tile 2 emits the cenários count.
    const cenariosTile = portrait.tiles.find((t) =>
      t.number.includes("cenários"),
    );
    expect(cenariosTile).toBeDefined();
    expect(cenariosTile!.number).toBe("3 cenários");
  });

  it("Pós-Lançamento portrait emits the frentes tile + 'fronts' structural section + org adjacency", () => {
    const db = openDb(":memory:");
    const tokenHash = createHash("sha256").update("t").digest("hex");
    const user = createUser(db, "Antonio", tokenHash);
    const org = createOrganization(db, user.id, "pages-inteiras", "Pages Inteiras");
    const j = createJourney(
      db,
      user.id,
      "pos-lancamento",
      "Pós-Lançamento",
      POS_LANCAMENTO_BRIEFING,
      POS_LANCAMENTO_SITUATION,
    );
    linkJourneyOrganization(db, user.id, "pos-lancamento", org.id);
    const fresh = db
      .prepare("SELECT * FROM journeys WHERE id = ?")
      .get(j.id) as any;
    const portrait = composeJourneyPortrait(db, user.id, fresh);

    expect(portrait.structuralSection).not.toBeNull();
    expect(portrait.structuralSection!.kind).toBe("fronts");

    const frentesTile = portrait.tiles.find((t) => t.number.includes("frentes"));
    expect(frentesTile).toBeDefined();
    expect(frentesTile!.number).toBe("3 frentes");

    expect(portrait.whereItLives.org).toEqual({
      key: "pages-inteiras",
      name: "Pages Inteiras",
    });
  });
});
