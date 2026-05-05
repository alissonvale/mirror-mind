import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import {
  openDb,
  createUser,
  createOrganization,
  createJourney,
  linkJourneyOrganization,
  setIdentityLayer,
  setIdentitySummary,
  createScene,
  getOrCreateSession,
  appendEntry,
  addSessionPersona,
  addSessionJourney,
} from "../server/db.js";
import {
  composeJourneyPortrait,
  composeLede,
  detectStructuralSection,
  detectLiveQuestion,
  composeClose,
} from "../server/portraits/journey-synthesis.js";

function fixture(briefing: string, situation: string, name = "Test", key = "test") {
  return {
    id: "j-id",
    user_id: "u-id",
    key,
    name,
    organization_id: null,
    briefing,
    situation,
    summary: null,
    status: "active" as const,
    is_draft: 0,
    show_in_sidebar: 1,
    sort_order: 0,
    created_at: 0,
    updated_at: 0,
  };
}

describe("composeLede — pure (CV1.E13.S1)", () => {
  it("picks the last paragraph of the briefing when present", () => {
    const j = fixture(
      "Bia está cansada. Cansaço acumulado de plantões.\n\nA travessia não é salvar o casamento. O casamento não está em crise — está em descuido. Eu estou em casa quase sempre, mas não estou inteiro.",
      "",
    );
    const lede = composeLede(j);
    expect(lede.source).toBe("briefing");
    expect(lede.text).toContain("não está em crise");
    expect(lede.text).toContain("não estou inteiro");
  });

  it("falls through to situation when briefing is too short", () => {
    const j = fixture(
      "Curto.",
      "Esta é uma situação mais elaborada que descreve a travessia em pelo menos sessenta caracteres pra passar do mínimo do filtro.",
    );
    const lede = composeLede(j);
    expect(lede.source).toBe("situation");
  });

  it("returns null when both fields are empty", () => {
    const j = fixture("", "");
    const lede = composeLede(j);
    expect(lede.source).toBeNull();
    expect(lede.text).toBeNull();
  });
});

describe("detectStructuralSection — pure", () => {
  it("detects the 'Cenário X' enumeration as a scenarios section", () => {
    const situation = `
**Cenário A — Mudança da família para BH.** Vendo o aluguel, Bia pede transferência. Custo prático alto.

**Cenário B — Eu uma semana por mês, na casa do meu pai.** Mantenho a vida em Floripa. Custo médio.

**Cenário C — Continuar como está, ajustar o que dá.** Mantenho ligações semanais. Custo zero no curto.
`;
    const result = detectStructuralSection(situation);
    expect(result).not.toBeNull();
    expect(result!.kind).toBe("scenarios");
    expect(result!.items).toHaveLength(3);
    if (result!.kind === "scenarios") {
      expect(result!.items[0]!.letter).toBe("A");
      expect(result!.items[1]!.title).toContain("Eu uma semana por mês");
    }
  });

  it("detects the 'A primeira / A segunda / A terceira' enumeration as fronts", () => {
    const situation = `
Há três frentes vivas.

**A primeira é a DM pendente.** Um antigo parceiro escreveu há nove meses. Eu não respondi.

**A segunda é a curiosidade pelos números.** Continuo abrindo planilhas.

**A terceira é a permeabilidade técnica.** A fronteira nem sempre é clara.
`;
    const result = detectStructuralSection(situation);
    expect(result).not.toBeNull();
    expect(result!.kind).toBe("fronts");
    expect(result!.items).toHaveLength(3);
    if (result!.kind === "fronts") {
      expect(result!.items[0]!.title).toContain("DM pendente");
      expect(result!.items[1]!.body).toContain("planilhas");
    }
  });

  it("returns null when the situation has no enumerated structure", () => {
    const situation =
      "Apenas um parágrafo livre, sem cenários nem frentes enumerados. Continua falando.";
    expect(detectStructuralSection(situation)).toBeNull();
  });
});

describe("detectLiveQuestion — pure", () => {
  it("captures the primary question + a confessional layer when both present", () => {
    const briefing = "";
    const situation = `
A questão de fundo não é "voltar ou não voltar para o circuito". Eu não vou voltar. A questão é mais sutil: como eu mantenho posição editorial sem virar puritano.

Tem também uma camada mais antiga: parte de mim ainda procura reconhecimento daquele mundo. Não me agride; é informação.
`;
    const result = detectLiveQuestion(briefing, situation);
    expect(result).not.toBeNull();
    expect(result!.primary).toContain("A questão");
    expect(result!.confessionalLayer).toContain("uma camada mais antiga");
  });

  it("returns null when no question marker is present", () => {
    expect(detectLiveQuestion("", "Apenas prosa contínua sem pergunta declarada.")).toBeNull();
  });

  it("returns just the primary when there's no confessional layer", () => {
    const result = detectLiveQuestion(
      "",
      "A pergunta é como sustentar três meses em vez de três semanas.",
    );
    expect(result).not.toBeNull();
    expect(result!.confessionalLayer).toBeNull();
  });
});

describe("composeClose — pure", () => {
  it("picks a punchy closing fragment from the briefing's last paragraph", () => {
    const j = fixture(
      "Setup paragraph.\n\nA travessia é a relação contínua, e ainda não estabilizada, com o circuito do qual eu saí. Saí, mas eles não desapareceram.",
      "",
    );
    const close = composeClose(j);
    expect(close).not.toBeNull();
    expect(close!.source).toBe("briefing");
    expect(close!.text).toContain("não desapareceram");
  });

  it("returns null when both fields are empty", () => {
    expect(composeClose(fixture("", ""))).toBeNull();
  });
});

describe("composeJourneyPortrait — integration with DB", () => {
  function setup() {
    const db = openDb(":memory:");
    const tokenHash = createHash("sha256").update("t").digest("hex");
    const user = createUser(db, "Test User", tokenHash);
    return { db, user };
  }

  it("renders 'onde ela mora' with all three adjacencies + no parenthetical", () => {
    const { db, user } = setup();
    const org = createOrganization(db, user.id, "sz", "Software Zen");
    const journey = createJourney(db, user.id, "j", "Travessia X");
    linkJourneyOrganization(db, user.id, "j", org.id);
    setIdentityLayer(db, user.id, "persona", "p1", "voice for p1");
    setIdentitySummary(db, user.id, "persona", "p1", "lente especializada");
    createScene(db, user.id, "scene-x", { title: "Scene X", journey_key: "j" });

    // Tag a session with this journey + persona to set persona frequency.
    const sessionId = getOrCreateSession(db, user.id);
    addSessionJourney(db, sessionId, "j");
    addSessionPersona(db, sessionId, "p1");
    appendEntry(db, sessionId, null, "message", {
      role: "user",
      content: [{ type: "text", text: "hi" }],
    });

    const fresh = db
      .prepare("SELECT * FROM journeys WHERE id = ?")
      .get(journey.id) as any;
    const portrait = composeJourneyPortrait(db, user.id, fresh);

    expect(portrait.whereItLives.org).toEqual({ key: "sz", name: "Software Zen" });
    expect(portrait.whereItLives.persona).toEqual({
      key: "p1",
      descriptor: "lente especializada",
    });
    expect(portrait.whereItLives.scene).toEqual({
      key: "scene-x",
      title: "Scene X",
    });
    expect(portrait.whereItLives.parenthetical).toBeNull();
  });

  it("renders 'onde ela mora' with parenthetical declaring all three absences", () => {
    const { db, user } = setup();
    const journey = createJourney(db, user.id, "lonely", "Solo Travessia");
    const fresh = db
      .prepare("SELECT * FROM journeys WHERE id = ?")
      .get(journey.id) as any;
    const portrait = composeJourneyPortrait(db, user.id, fresh);

    expect(portrait.whereItLives.org).toBeNull();
    expect(portrait.whereItLives.persona).toBeNull();
    expect(portrait.whereItLives.scene).toBeNull();
    expect(portrait.whereItLives.parenthetical).toContain("não cristalizou em diálogo");
  });

  it("emits a tile for tempo desde início when journey is older than a week", () => {
    const { db, user } = setup();
    const journey = createJourney(db, user.id, "j", "X");
    const now = journey.created_at + 90 * 24 * 60 * 60 * 1000;
    const fresh = db
      .prepare("SELECT * FROM journeys WHERE id = ?")
      .get(journey.id) as any;
    const portrait = composeJourneyPortrait(db, user.id, fresh, now);
    expect(portrait.tiles.length).toBeGreaterThan(0);
    expect(portrait.tiles[0]!.number).toMatch(/meses|dias/);
  });

  it("conversationsEmpty stays true in round 2 (listing wires in round 3)", () => {
    const { db, user } = setup();
    const journey = createJourney(db, user.id, "j", "X");
    const fresh = db
      .prepare("SELECT * FROM journeys WHERE id = ?")
      .get(journey.id) as any;
    const portrait = composeJourneyPortrait(db, user.id, fresh);
    expect(portrait.conversationsEmpty).toBe(true);
    expect(portrait.conversations).toEqual([]);
  });

  it("silenceMonths is non-null when daysSinceUpdate > 30", () => {
    const { db, user } = setup();
    const journey = createJourney(db, user.id, "j", "X");
    // Force the row's updated_at into the past.
    const past = journey.created_at - 60 * 24 * 60 * 60 * 1000;
    db.prepare("UPDATE journeys SET updated_at = ? WHERE id = ?").run(
      past,
      journey.id,
    );
    const fresh = db
      .prepare("SELECT * FROM journeys WHERE id = ?")
      .get(journey.id) as any;
    const portrait = composeJourneyPortrait(db, user.id, fresh);
    expect(portrait.silenceMonths).not.toBeNull();
    expect(portrait.silenceMonths!).toBeGreaterThanOrEqual(2);
  });
});
