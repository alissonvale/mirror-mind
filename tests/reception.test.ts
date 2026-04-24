import { describe, it, expect, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import {
  openDb,
  createUser,
  setIdentityLayer,
  createOrganization,
  createJourney,
  archiveOrganization,
  archiveJourney,
} from "../server/db.js";
import { receive } from "../server/reception.js";

type CompleteFn = Parameters<typeof receive>[4];

function fakeComplete(text: string, delayMs = 0): CompleteFn {
  return (async () => {
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    return { content: [{ type: "text", text }] };
  }) as unknown as CompleteFn;
}

function capturingComplete(): {
  fn: CompleteFn;
  getSystemPrompt: () => string | undefined;
} {
  let captured: string | undefined;
  const fn = (async (_model: unknown, req: { systemPrompt: string }) => {
    captured = req.systemPrompt;
    return { content: [{ type: "text", text: '{"persona": null, "organization": null, "journey": null}' }] };
  }) as unknown as CompleteFn;
  return { fn, getSystemPrompt: () => captured };
}

function failingComplete(): CompleteFn {
  return (async () => {
    throw new Error("boom");
  }) as unknown as CompleteFn;
}

describe("receive — persona axis", () => {
  let db: Database.Database;
  let userId: string;

  beforeEach(() => {
    db = openDb(":memory:");
    userId = createUser(db, "alice", "hash123").id;
  });

  it("returns all-null and skips LLM when nothing is configured", async () => {
    let called = false;
    const completeFn = (async () => {
      called = true;
      return { content: [] };
    }) as unknown as CompleteFn;

    const result = await receive(db, userId, "hello", {}, completeFn);

    expect(result).toEqual({
      persona: null,
      organization: null,
      journey: null,
      mode: "conversational",
    });
    expect(called).toBe(false);
  });

  it("returns the persona key when LLM picks one", async () => {
    setIdentityLayer(db, userId, "persona", "mentora", "# Mentora\n\nA mentora responde perguntas.");
    setIdentityLayer(db, userId, "persona", "tecnica", "# Tecnica\n\nA tecnica resolve problemas técnicos.");

    const result = await receive(
      db,
      userId,
      "me ajuda a refletir sobre uma decisão",
      {},
      fakeComplete('{"persona": "mentora", "organization": null, "journey": null}'),
    );

    expect(result.persona).toBe("mentora");
    expect(result.organization).toBeNull();
    expect(result.journey).toBeNull();
  });

  it("accepts legacy output missing organization and journey keys", async () => {
    setIdentityLayer(db, userId, "persona", "mentora", "# Mentora");

    const result = await receive(
      db,
      userId,
      "hello",
      {},
      fakeComplete('{"persona": "mentora"}'),
    );

    expect(result.persona).toBe("mentora");
    expect(result.organization).toBeNull();
    expect(result.journey).toBeNull();
  });

  it("returns all-null on invalid JSON", async () => {
    setIdentityLayer(db, userId, "persona", "mentora", "# Mentora");

    const result = await receive(
      db,
      userId,
      "hello",
      {},
      fakeComplete("not json at all"),
    );

    expect(result).toEqual({
      persona: null,
      organization: null,
      journey: null,
      mode: "conversational",
    });
  });

  it("returns persona null when key is unknown", async () => {
    setIdentityLayer(db, userId, "persona", "mentora", "# Mentora");

    const result = await receive(
      db,
      userId,
      "hello",
      {},
      fakeComplete('{"persona": "ghost", "organization": null, "journey": null}'),
    );

    expect(result.persona).toBeNull();
  });

  it("returns all-null when LLM call fails", async () => {
    setIdentityLayer(db, userId, "persona", "mentora", "# Mentora");

    const result = await receive(db, userId, "hello", {}, failingComplete());

    expect(result).toEqual({
      persona: null,
      organization: null,
      journey: null,
      mode: "conversational",
    });
  });
});

describe("receive — organization axis", () => {
  let db: Database.Database;
  let userId: string;

  beforeEach(() => {
    db = openDb(":memory:");
    userId = createUser(db, "alice", "hash123").id;
  });

  it("calls LLM when only organizations exist", async () => {
    createOrganization(db, userId, "sz", "Software Zen", "posture: curadoria", "phase: sem receita");
    const { fn, getSystemPrompt } = capturingComplete();

    const result = await receive(db, userId, "quais prioridades da Software Zen?", {}, fn);

    expect(result).toEqual({
      persona: null,
      organization: null,
      journey: null,
      mode: "conversational",
    });
    expect(getSystemPrompt()).toContain("Available organizations");
    expect(getSystemPrompt()).toContain('- sz ("Software Zen")');
  });

  it("returns org key when LLM picks one", async () => {
    createOrganization(db, userId, "sz", "Software Zen");

    const result = await receive(
      db,
      userId,
      "quais prioridades da Software Zen?",
      {},
      fakeComplete('{"persona": null, "organization": "sz", "journey": null}'),
    );

    expect(result.organization).toBe("sz");
  });

  it("returns null when LLM names an unknown organization", async () => {
    createOrganization(db, userId, "sz", "Software Zen");

    const result = await receive(
      db,
      userId,
      "something",
      {},
      fakeComplete('{"persona": null, "organization": "mystery", "journey": null}'),
    );

    expect(result.organization).toBeNull();
  });

  it("excludes archived organizations from candidates", async () => {
    createOrganization(db, userId, "sz", "Software Zen");
    createOrganization(db, userId, "old-co", "Old Co");
    archiveOrganization(db, userId, "old-co");

    const { fn, getSystemPrompt } = capturingComplete();
    await receive(db, userId, "hello", {}, fn);

    expect(getSystemPrompt()).toContain('- sz ("Software Zen")');
    expect(getSystemPrompt()).not.toContain('- old-co ("Old Co")');
  });
});

describe("receive — journey axis", () => {
  let db: Database.Database;
  let userId: string;

  beforeEach(() => {
    db = openDb(":memory:");
    userId = createUser(db, "alice", "hash123").id;
  });

  it("calls LLM when only journeys exist", async () => {
    createJourney(db, userId, "vida-economica", "Vida econômica", "tracking finances");
    const { fn, getSystemPrompt } = capturingComplete();

    await receive(db, userId, "quanto sobrou no caixa?", {}, fn);

    expect(getSystemPrompt()).toContain("Available journeys");
    expect(getSystemPrompt()).toContain('- vida-economica ("Vida econômica")');
  });

  it("returns journey key when LLM picks one", async () => {
    createJourney(db, userId, "vida-economica", "Vida econômica");

    const result = await receive(
      db,
      userId,
      "quanto sobrou no caixa?",
      {},
      fakeComplete('{"persona": null, "organization": null, "journey": "vida-economica"}'),
    );

    expect(result.journey).toBe("vida-economica");
  });

  it("annotates journeys with their parent organization in the prompt", async () => {
    const org = createOrganization(db, userId, "sz", "Software Zen");
    createJourney(db, userId, "o-espelho", "O Espelho", "", "", org.id);

    const { fn, getSystemPrompt } = capturingComplete();
    await receive(db, userId, "hello", {}, fn);

    expect(getSystemPrompt()).toContain('- o-espelho ("O Espelho") [in sz]');
  });

  it("returns null for unknown journey key", async () => {
    createJourney(db, userId, "vida", "Vida");

    const result = await receive(
      db,
      userId,
      "hello",
      {},
      fakeComplete('{"persona": null, "organization": null, "journey": "ghost"}'),
    );

    expect(result.journey).toBeNull();
  });

  it("excludes archived journeys from candidates", async () => {
    createJourney(db, userId, "active-j", "Active");
    createJourney(db, userId, "old-j", "Old");
    archiveJourney(db, userId, "old-j");

    const { fn, getSystemPrompt } = capturingComplete();
    await receive(db, userId, "hello", {}, fn);

    expect(getSystemPrompt()).toContain('- active-j ("Active")');
    expect(getSystemPrompt()).not.toContain('- old-j ("Old")');
  });
});

describe("receive — combined axes", () => {
  let db: Database.Database;
  let userId: string;

  beforeEach(() => {
    db = openDb(":memory:");
    userId = createUser(db, "alice", "hash123").id;
  });

  it("returns all three when LLM picks all three", async () => {
    setIdentityLayer(db, userId, "persona", "escritora", "# Escritora\n\nA escritora produz textos.");
    const org = createOrganization(db, userId, "sz", "Software Zen");
    createJourney(db, userId, "o-espelho", "O Espelho", "", "", org.id);

    const result = await receive(
      db,
      userId,
      "escreve um texto sobre o Espelho da Software Zen",
      {},
      fakeComplete('{"persona": "escritora", "organization": "sz", "journey": "o-espelho"}'),
    );

    expect(result).toEqual({
      persona: "escritora",
      organization: "sz",
      journey: "o-espelho",
      mode: "conversational",
    });
  });

  it("validates each axis independently — valid persona but invalid journey key", async () => {
    setIdentityLayer(db, userId, "persona", "mentora", "# Mentora");
    createJourney(db, userId, "real-j", "Real");

    const result = await receive(
      db,
      userId,
      "hello",
      {},
      fakeComplete('{"persona": "mentora", "organization": null, "journey": "ghost"}'),
    );

    expect(result.persona).toBe("mentora");
    expect(result.journey).toBeNull();
  });
});

describe("receive — session tag pool (CV1.E4.S4)", () => {
  let db: Database.Database;
  let userId: string;

  beforeEach(() => {
    db = openDb(":memory:");
    userId = createUser(db, "alice", "hash123").id;
    setIdentityLayer(db, userId, "persona", "mentora", "# Mentora");
    setIdentityLayer(db, userId, "persona", "tecnica", "# Tecnica");
    setIdentityLayer(db, userId, "persona", "terapeuta", "# Terapeuta");
    createOrganization(db, userId, "sz", "Software Zen");
    createOrganization(db, userId, "nova", "Nova");
    createJourney(db, userId, "vida", "Vida");
    createJourney(db, userId, "deserto", "Deserto");
  });

  it("empty tags pass all candidates to the prompt", async () => {
    const { fn, getSystemPrompt } = capturingComplete();
    await receive(
      db,
      userId,
      "hi",
      {
        sessionTags: {
          personaKeys: [],
          organizationKeys: [],
          journeyKeys: [],
        },
      },
      fn,
    );
    const prompt = getSystemPrompt()!;
    expect(prompt).toContain("mentora");
    expect(prompt).toContain("tecnica");
    expect(prompt).toContain("terapeuta");
    expect(prompt).toContain("sz");
    expect(prompt).toContain("nova");
    expect(prompt).toContain("vida");
    expect(prompt).toContain("deserto");
  });

  it("persona tag list restricts the prompt to only those personas", async () => {
    const { fn, getSystemPrompt } = capturingComplete();
    await receive(
      db,
      userId,
      "hi",
      {
        sessionTags: {
          personaKeys: ["terapeuta"],
          organizationKeys: [],
          journeyKeys: [],
        },
      },
      fn,
    );
    const prompt = getSystemPrompt()!;
    expect(prompt).toContain("terapeuta");
    expect(prompt).not.toContain("mentora");
    expect(prompt).not.toContain("tecnica");
  });

  it("tagged but LLM proposes something outside the pool → null (validation layer rejects it)", async () => {
    const result = await receive(
      db,
      userId,
      "hi",
      {
        sessionTags: {
          personaKeys: ["terapeuta"],
          organizationKeys: [],
          journeyKeys: [],
        },
      },
      fakeComplete('{"persona": "mentora", "organization": null, "journey": null}'),
    );
    // mentora was filtered out of the candidate pool; reception's
    // own validation rejects the pick because it's not in the list.
    expect(result.persona).toBeNull();
  });

  it("scope tags narrow both orgs and journeys independently", async () => {
    const { fn, getSystemPrompt } = capturingComplete();
    await receive(
      db,
      userId,
      "hi",
      {
        sessionTags: {
          personaKeys: [],
          organizationKeys: ["sz"],
          journeyKeys: ["vida"],
        },
      },
      fn,
    );
    const prompt = getSystemPrompt()!;
    expect(prompt).toContain("sz");
    expect(prompt).not.toContain("nova");
    expect(prompt).toContain("vida");
    expect(prompt).not.toContain("deserto");
  });
});

describe("receive — mode axis (CV1.E7.S1)", () => {
  let db: Database.Database;
  let userId: string;

  beforeEach(() => {
    db = openDb(":memory:");
    userId = createUser(db, "alice", "hash").id;
    // Mode classification runs inside the full LLM call, so there must be
    // at least one candidate present — otherwise reception short-circuits.
    setIdentityLayer(db, userId, "persona", "mentora", "# Mentora");
  });

  it("describes all three modes in the prompt", async () => {
    const { fn, getSystemPrompt } = capturingComplete();
    await receive(db, userId, "hi", {}, fn);
    const prompt = getSystemPrompt()!;
    expect(prompt).toContain("conversational");
    expect(prompt).toContain("compositional");
    expect(prompt).toContain("essayistic");
  });

  it("returns the parsed mode when the LLM picks 'conversational'", async () => {
    const result = await receive(
      db,
      userId,
      "hi",
      {},
      fakeComplete(
        '{"persona": null, "organization": null, "journey": null, "mode": "conversational"}',
      ),
    );
    expect(result.mode).toBe("conversational");
  });

  it("returns the parsed mode when the LLM picks 'compositional'", async () => {
    const result = await receive(
      db,
      userId,
      "compare VMware vs Proxmox",
      {},
      fakeComplete(
        '{"persona": null, "organization": null, "journey": null, "mode": "compositional"}',
      ),
    );
    expect(result.mode).toBe("compositional");
  });

  it("returns the parsed mode when the LLM picks 'essayistic'", async () => {
    const result = await receive(
      db,
      userId,
      "how should I think about the empty nest?",
      {},
      fakeComplete(
        '{"persona": null, "organization": null, "journey": null, "mode": "essayistic"}',
      ),
    );
    expect(result.mode).toBe("essayistic");
  });

  it("defaults to conversational when mode is missing from the response", async () => {
    const result = await receive(
      db,
      userId,
      "hi",
      {},
      fakeComplete('{"persona": null, "organization": null, "journey": null}'),
    );
    expect(result.mode).toBe("conversational");
  });

  it("defaults to conversational when mode is not one of the three literals", async () => {
    const result = await receive(
      db,
      userId,
      "hi",
      {},
      fakeComplete(
        '{"persona": null, "organization": null, "journey": null, "mode": "chatty"}',
      ),
    );
    expect(result.mode).toBe("conversational");
  });

  it("defaults to conversational when mode is explicitly null", async () => {
    const result = await receive(
      db,
      userId,
      "hi",
      {},
      fakeComplete(
        '{"persona": null, "organization": null, "journey": null, "mode": null}',
      ),
    );
    expect(result.mode).toBe("conversational");
  });

  it("defaults to conversational on LLM failure", async () => {
    const result = await receive(db, userId, "hi", {}, failingComplete());
    expect(result.mode).toBe("conversational");
  });
});
