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
  type Organization,
} from "../server/db.js";
import {
  composeOrganizationPortrait,
  composeOrgLede,
  composeWhoComesByHere,
} from "../server/portraits/organization-synthesis.js";
import { detectStructuralSection } from "../server/portraits/journey-synthesis.js";

function fixture(briefing: string, situation: string, name = "Org", key = "org"): Organization {
  return {
    id: "o-id",
    user_id: "u-id",
    key,
    name,
    briefing,
    situation,
    summary: null,
    status: "active",
    is_draft: 0,
    show_in_sidebar: 1,
    sort_order: 0,
    created_at: 0,
    updated_at: 0,
  };
}

describe("composeOrgLede — situation-first heuristic (CV1.E13.S2)", () => {
  it("picks the first paragraph of situation when present (orgs invert the journey heuristic)", () => {
    const org = fixture(
      "Manifesto.\n\nQuem somos.",
      "A casa está estabilizada, mas não em descanso.",
    );
    const lede = composeOrgLede(org);
    expect(lede.source).toBe("situation");
    expect(lede.text).toContain("estabilizada");
  });

  it("appends a short briefing-end punchline when both fit comfortably", () => {
    const org = fixture(
      "Setup.\n\nA escala é desconfortável de propósito.",
      "A casa está estabilizada, mas não em descanso.",
    );
    const lede = composeOrgLede(org);
    expect(lede.source).toBe("situation");
    expect(lede.text).toContain("desconfortável de propósito");
  });

  it("falls through to briefing's last paragraph when situation is empty", () => {
    const org = fixture(
      "Long enough briefing paragraph that lives at the end and lands the lede on its own with at least sixty characters of weight to it.",
      "",
    );
    const lede = composeOrgLede(org);
    expect(lede.source).toBe("briefing");
  });

  it("returns null when both fields empty", () => {
    expect(composeOrgLede(fixture("", "")).source).toBeNull();
  });
});

describe("composeOrganizationPortrait — integration with DB", () => {
  function setup() {
    const db = openDb(":memory:");
    const tokenHash = createHash("sha256").update("t").digest("hex");
    const user = createUser(db, "Test User", tokenHash);
    return { db, user };
  }

  it("renders 'quem passa por aqui' with all three populated + no parenthetical", () => {
    const { db, user } = setup();
    const org = createOrganization(db, user.id, "sz", "Software Zen");
    const j = createJourney(db, user.id, "j1", "First journey");
    linkJourneyOrganization(db, user.id, "j1", org.id);
    setIdentityLayer(db, user.id, "persona", "estrategista", "voice");
    setIdentitySummary(db, user.id, "persona", "estrategista", "lente estratégica");
    createScene(db, user.id, "scene-x", {
      title: "Scene X",
      organization_key: "sz",
    });

    // Tag a session with the org's _organization meta to populate
    // primary persona via the entry-meta heuristic.
    const sessionId = getOrCreateSession(db, user.id);
    appendEntry(db, sessionId, null, "message", {
      role: "user",
      content: [{ type: "text", text: "hi" }],
    });
    appendEntry(db, sessionId, null, "message", {
      role: "assistant",
      content: [{ type: "text", text: "hello" }],
      _persona: "estrategista",
      _organization: "sz",
    });

    const fresh = db
      .prepare("SELECT * FROM organizations WHERE id = ?")
      .get(org.id) as any;
    const portrait = composeOrganizationPortrait(db, user.id, fresh);

    expect(portrait.whoComesByHere.nestedJourneys).toHaveLength(1);
    expect(portrait.whoComesByHere.nestedJourneys[0]!.name).toBe("First journey");
    expect(portrait.whoComesByHere.primaryPersona).toEqual({
      key: "estrategista",
      descriptor: "lente estratégica",
    });
    expect(portrait.whoComesByHere.anchoredScene).toEqual({
      key: "scene-x",
      title: "Scene X",
    });
    expect(portrait.whoComesByHere.parenthetical).toBeNull();
  });

  it("declares all three absences in the parenthetical when org is empty", () => {
    const { db, user } = setup();
    const org = createOrganization(db, user.id, "lonely", "Lonely Org");
    const fresh = db
      .prepare("SELECT * FROM organizations WHERE id = ?")
      .get(org.id) as any;
    const portrait = composeOrganizationPortrait(db, user.id, fresh);
    expect(portrait.whoComesByHere.parenthetical).toContain(
      "ainda não foi habitada",
    );
  });

  it("emits the nested-journeys count tile when at least one journey is linked", () => {
    const { db, user } = setup();
    const org = createOrganization(db, user.id, "sz", "Software Zen");
    const j = createJourney(db, user.id, "j1", "Journey One");
    linkJourneyOrganization(db, user.id, "j1", org.id);
    const fresh = db
      .prepare("SELECT * FROM organizations WHERE id = ?")
      .get(org.id) as any;
    const portrait = composeOrganizationPortrait(db, user.id, fresh);
    const journeysTile = portrait.tiles.find((t) =>
      t.number.includes("travessia"),
    );
    expect(journeysTile).toBeDefined();
    expect(journeysTile!.number).toBe("1 travessia");
  });
});

// --- Reference draft: Pages Inteiras ----------------------------------

const PAGES_INTEIRAS_BRIEFING = `Pages Inteiras é minha casa editorial. Não é empresa no sentido societário comum — sou MEI, faturo como pessoa física. É a marca sob a qual publico tudo o que faço de público.

Há também uma vida operacional que eu mantenho conscientemente pequena: respondo eu mesmo aos e-mails da newsletter. Não tenho ghostwriter, não tenho edição de copywriting. A escala é desconfortável de propósito.`;

const PAGES_INTEIRAS_SITUATION = `A casa está estabilizada, mas não em descanso.

Três coisas vivas hoje:

A primeira é uma queda lenta de abertura na newsletter. De 42% médio em 2023 para 31-34% médio em 2025. Em parte é estrutural — o algoritmo do Substack mudou. Em parte pode ser editorial — eu mesmo notei que os últimos seis ensaios talvez estejam dando voltas em torno dos mesmos temas.

A segunda é a abertura anual do *Como Escrever em Público sem se Perder*. Próxima turma em fevereiro. Movimento incipiente de antigos alunos pedindo "Notas Diárias 2", e eu não decidi se isso quer existir ou não.

A terceira é o convite de uma editora pequena de São Paulo (Editora Nona — boa, séria) para eu escrever um livro curto sobre escrita digital. Eu queria fazer e não consigo me decidir, porque o livro dessa proposta é diferente do romance que eu escrevo há quatro anos.`;

describe("Reference draft — Pages Inteiras", () => {
  it("lede comes from situation's first paragraph + briefing's punchline", () => {
    const lede = composeOrgLede(
      fixture(PAGES_INTEIRAS_BRIEFING, PAGES_INTEIRAS_SITUATION),
    );
    expect(lede.source).toBe("situation");
    expect(lede.text).toContain("estabilizada");
    expect(lede.text).toContain("desconfortável de propósito");
  });

  it("structural detector picks up the three frentes (relaxed regex accepts non-bold)", () => {
    const result = detectStructuralSection(PAGES_INTEIRAS_SITUATION);
    expect(result).not.toBeNull();
    expect(result!.kind).toBe("fronts");
    expect(result!.items).toHaveLength(3);
    if (result!.kind === "fronts") {
      expect(result!.items[0]!.title).toContain("queda lenta");
    }
  });
});
