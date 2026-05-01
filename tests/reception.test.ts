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
      personas: [],
      organization: null,
      journey: null,
      mode: "conversational",
      touches_identity: false,
      is_self_moment: false,
      is_trivial: false,
      would_have_persona: null,
      would_have_organization: null,
      would_have_journey: null,
    });
    expect(called).toBe(false);
  });

  it("returns the persona key when LLM picks one (new array shape)", async () => {
    setIdentityLayer(db, userId, "persona", "mentora", "# Mentora\n\nA mentora responde perguntas.");
    setIdentityLayer(db, userId, "persona", "tecnica", "# Tecnica\n\nA tecnica resolve problemas técnicos.");

    const result = await receive(
      db,
      userId,
      "me ajuda a refletir sobre uma decisão",
      {},
      fakeComplete('{"personas": ["mentora"], "organization": null, "journey": null}'),
    );

    expect(result.personas).toEqual(["mentora"]);
    expect(result.organization).toBeNull();
    expect(result.journey).toBeNull();
  });

  it("wraps legacy singular persona output into a one-element array (CV1.E7.S5)", async () => {
    setIdentityLayer(db, userId, "persona", "mentora", "# Mentora");

    const result = await receive(
      db,
      userId,
      "hello",
      {},
      fakeComplete('{"persona": "mentora"}'),
    );

    expect(result.personas).toEqual(["mentora"]);
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
      personas: [],
      organization: null,
      journey: null,
      mode: "conversational",
      touches_identity: false,
      is_self_moment: false,
      is_trivial: false,
      would_have_persona: null,
      would_have_organization: null,
      would_have_journey: null,
    });
  });

  it("drops unknown persona keys from the array (CV1.E7.S5)", async () => {
    setIdentityLayer(db, userId, "persona", "mentora", "# Mentora");

    const result = await receive(
      db,
      userId,
      "hello",
      {},
      fakeComplete('{"personas": ["ghost"], "organization": null, "journey": null}'),
    );

    expect(result.personas).toEqual([]);
  });

  it("returns all-null when LLM call fails", async () => {
    setIdentityLayer(db, userId, "persona", "mentora", "# Mentora");

    const result = await receive(db, userId, "hello", {}, failingComplete());

    expect(result).toEqual({
      personas: [],
      organization: null,
      journey: null,
      mode: "conversational",
      touches_identity: false,
      is_self_moment: false,
      is_trivial: false,
      would_have_persona: null,
      would_have_organization: null,
      would_have_journey: null,
    });
  });

  it("returns multiple persona keys preserving order (CV1.E7.S5)", async () => {
    setIdentityLayer(db, userId, "persona", "estrategista", "# Estrategista");
    setIdentityLayer(db, userId, "persona", "divulgadora", "# Divulgadora");

    const result = await receive(
      db,
      userId,
      "qual seria a estratégia de divulgação?",
      {},
      fakeComplete(
        '{"personas": ["estrategista", "divulgadora"], "organization": null, "journey": null}',
      ),
    );

    expect(result.personas).toEqual(["estrategista", "divulgadora"]);
  });

  it("dedupes repeated persona keys in the output (CV1.E7.S5)", async () => {
    setIdentityLayer(db, userId, "persona", "mentora", "# Mentora");

    const result = await receive(
      db,
      userId,
      "hello",
      {},
      fakeComplete(
        '{"personas": ["mentora", "mentora"], "organization": null, "journey": null}',
      ),
    );

    expect(result.personas).toEqual(["mentora"]);
  });

  it("mixed valid + unknown keys: valid survive, unknown silently dropped (CV1.E7.S5)", async () => {
    setIdentityLayer(db, userId, "persona", "mentora", "# Mentora");

    const result = await receive(
      db,
      userId,
      "hello",
      {},
      fakeComplete(
        '{"personas": ["mentora", "ghost"], "organization": null, "journey": null}',
      ),
    );

    expect(result.personas).toEqual(["mentora"]);
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
      personas: [],
      organization: null,
      journey: null,
      mode: "conversational",
      touches_identity: false,
      is_self_moment: false,
      is_trivial: false,
      would_have_persona: null,
      would_have_organization: null,
      would_have_journey: null,
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
      personas: ["escritora"],
      organization: "sz",
      journey: "o-espelho",
      mode: "conversational",
      touches_identity: false,
      is_self_moment: false,
      is_trivial: false,
      would_have_persona: null,
      would_have_organization: null,
      would_have_journey: null,
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

    expect(result.personas).toEqual(["mentora"]);
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

  it("persona tag list restricts the SESSION POOL to only those personas; out-of-pool listed separately (CV1.E7.S8)", async () => {
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
    const sessionPoolIdx = prompt.indexOf("personas — SESSION POOL");
    const outOfPoolIdx = prompt.indexOf("personas — OUT-OF-POOL");
    // Both section headers render because the constraint splits the pool.
    expect(sessionPoolIdx).toBeGreaterThan(-1);
    expect(outOfPoolIdx).toBeGreaterThan(sessionPoolIdx);
    // The tagged persona appears in the SESSION POOL section.
    const terapeutaIdx = prompt.indexOf("- terapeuta");
    expect(terapeutaIdx).toBeGreaterThan(sessionPoolIdx);
    expect(terapeutaIdx).toBeLessThan(outOfPoolIdx);
    // The other personas appear in the OUT-OF-POOL section (after the
    // header). They're visible to reception but flagged "do not pick
    // canonically" by the section's framing.
    expect(prompt.indexOf("- mentora")).toBeGreaterThan(outOfPoolIdx);
    expect(prompt.indexOf("- tecnica")).toBeGreaterThan(outOfPoolIdx);
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
    expect(result.personas).toEqual([]);
  });

  it("scope tags narrow both orgs and journeys independently into SESSION POOL; out-of-pool listed separately (CV1.E7.S8)", async () => {
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
    // Org SESSION POOL contains sz; out-of-pool contains nova.
    const orgSessionIdx = prompt.indexOf("organizations — SESSION POOL");
    const orgOutIdx = prompt.indexOf("organizations — OUT-OF-POOL");
    expect(orgSessionIdx).toBeGreaterThan(-1);
    expect(orgOutIdx).toBeGreaterThan(orgSessionIdx);
    expect(prompt.indexOf("- sz ")).toBeGreaterThan(orgSessionIdx);
    expect(prompt.indexOf("- sz ")).toBeLessThan(orgOutIdx);
    expect(prompt.indexOf("- nova ")).toBeGreaterThan(orgOutIdx);
    // Journey SESSION POOL contains vida; out-of-pool contains deserto.
    const journeySessionIdx = prompt.indexOf("journeys — SESSION POOL");
    const journeyOutIdx = prompt.indexOf("journeys — OUT-OF-POOL");
    expect(journeySessionIdx).toBeGreaterThan(-1);
    expect(journeyOutIdx).toBeGreaterThan(journeySessionIdx);
    expect(prompt.indexOf("- vida ")).toBeGreaterThan(journeySessionIdx);
    expect(prompt.indexOf("- vida ")).toBeLessThan(journeyOutIdx);
    expect(prompt.indexOf("- deserto ")).toBeGreaterThan(journeyOutIdx);
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

  it("prompt carries the form-beats-topic rule (CV1.E7.S2 refinement)", async () => {
    // Regression guard for the 'sometimes I can't understand my kids'
    // miscalibration — the prompt must state that short first-person
    // statements are conversational even on deep topics.
    const { fn, getSystemPrompt } = capturingComplete();
    await receive(db, userId, "hi", {}, fn);
    const prompt = getSystemPrompt()!;
    expect(prompt).toContain("Form beats topic");
    // Named examples are in the prompt so the model anchors against them.
    expect(prompt).toContain("Sometimes I can't understand my kids");
    // The lighter-mode tiebreaker is promoted from fallback to primary.
    expect(prompt).toMatch(/lighter.mode tiebreaker.*primary|pick the lighter one/i);
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

describe("receive — touches_identity axis (CV1.E7.S4)", () => {
  let db: Database.Database;
  let userId: string;

  beforeEach(() => {
    db = openDb(":memory:");
    userId = createUser(db, "alice", "hash").id;
    // Need at least one candidate to avoid the no-candidates short-
    // circuit that returns NULL_RESULT without calling the LLM.
    setIdentityLayer(db, userId, "persona", "any", "# Any\nA persona.");
  });

  it("returns touches_identity = true when LLM classifies it as such", async () => {
    const result = await receive(
      db,
      userId,
      "Quem sou eu nesse momento?",
      {},
      fakeComplete(
        '{"personas": [], "organization": null, "journey": null, "mode": "essayistic", "touches_identity": true}',
      ),
    );
    expect(result.touches_identity).toBe(true);
  });

  it("returns touches_identity = false when LLM classifies it as such", async () => {
    const result = await receive(
      db,
      userId,
      "bom dia",
      {},
      fakeComplete(
        '{"personas": [], "organization": null, "journey": null, "mode": "conversational", "touches_identity": false}',
      ),
    );
    expect(result.touches_identity).toBe(false);
  });

  it("identity-conservative default: missing field falls to false", async () => {
    // Reception's prompt asks for touches_identity but a drifted model
    // could omit it. Conservative default skips identity (matches the
    // modal turn — most are operational).
    const result = await receive(
      db,
      userId,
      "hi",
      {},
      fakeComplete(
        '{"personas": [], "organization": null, "journey": null, "mode": "conversational"}',
      ),
    );
    expect(result.touches_identity).toBe(false);
  });

  it("identity-conservative default: non-boolean value falls to false", async () => {
    const result = await receive(
      db,
      userId,
      "hi",
      {},
      fakeComplete(
        '{"personas": [], "organization": null, "journey": null, "mode": "conversational", "touches_identity": "true"}',
      ),
    );
    // The string "true" is not the boolean true — caller must use the
    // primitive. This pins the strict-check semantics.
    expect(result.touches_identity).toBe(false);
  });

  it("identity-conservative default: explicit null falls to false", async () => {
    const result = await receive(
      db,
      userId,
      "hi",
      {},
      fakeComplete(
        '{"personas": [], "organization": null, "journey": null, "mode": "conversational", "touches_identity": null}',
      ),
    );
    expect(result.touches_identity).toBe(false);
  });

  it("touches_identity: false on LLM failure", async () => {
    const result = await receive(db, userId, "hi", {}, failingComplete());
    expect(result.touches_identity).toBe(false);
  });

  it("touches_identity: false when no candidates (skips the LLM call)", async () => {
    // Recreate user without candidates so the no-candidates short
    // circuit fires.
    db = openDb(":memory:");
    userId = createUser(db, "alice2", "hash").id;
    let called = false;
    const completeFn = (async () => {
      called = true;
      return { content: [{ type: "text", text: "{}" }] };
    }) as unknown as CompleteFn;
    const result = await receive(db, userId, "hi", {}, completeFn);
    expect(called).toBe(false);
    expect(result.touches_identity).toBe(false);
  });

  it("the system prompt mentions the touches_identity axis", async () => {
    const cap = capturingComplete();
    await receive(db, userId, "hi", {}, cap.fn);
    const prompt = cap.getSystemPrompt();
    expect(prompt).toContain("touches_identity");
    // Also confirm the new axis is described in the body — not just
    // cargo-culted into the JSON return shape.
    expect(prompt).toContain("self/soul");
    expect(prompt).toContain("identity-conservative");
  });
});

describe("receive — would_have_X axes (CV1.E7.S8)", () => {
  let db: Database.Database;
  let userId: string;

  beforeEach(() => {
    db = openDb(":memory:");
    userId = createUser(db, "alice", "hash").id;
  });

  it("returns would_have_persona when LLM flags an out-of-pool match", async () => {
    setIdentityLayer(db, userId, "persona", "engineer", "# Engineer\nIT/sysadmin lens.");
    setIdentityLayer(db, userId, "persona", "maker", "# Maker\nWoodwork, hand tools.");
    const result = await receive(
      db,
      userId,
      "Stanley No.4 vs No.5?",
      {
        sessionTags: {
          personaKeys: ["engineer"],
          organizationKeys: [],
          journeyKeys: [],
        },
      },
      fakeComplete(
        '{"personas": ["engineer"], "organization": null, "journey": null, "mode": "conversational", "touches_identity": false, "would_have_persona": "maker"}',
      ),
    );
    expect(result.personas).toEqual(["engineer"]);
    expect(result.would_have_persona).toBe("maker");
    expect(result.would_have_organization).toBeNull();
    expect(result.would_have_journey).toBeNull();
  });

  it("returns would_have_organization when LLM flags an out-of-pool org", async () => {
    setIdentityLayer(db, userId, "persona", "p", "# P");
    createOrganization(db, userId, "sz", "Software Zen", "...", "");
    createOrganization(db, userId, "kvh", "Keystone", "...", "");
    const result = await receive(
      db,
      userId,
      "How does Keystone affect strategy at SZ?",
      {
        sessionTags: {
          personaKeys: [],
          organizationKeys: ["sz"],
          journeyKeys: [],
        },
      },
      fakeComplete(
        '{"personas": [], "organization": "sz", "journey": null, "mode": "compositional", "touches_identity": false, "would_have_organization": "kvh"}',
      ),
    );
    expect(result.organization).toBe("sz");
    expect(result.would_have_organization).toBe("kvh");
  });

  it("returns would_have_journey when LLM flags an out-of-pool journey", async () => {
    setIdentityLayer(db, userId, "persona", "p", "# P");
    createJourney(db, userId, "o-espelho", "Espelho", "...", "");
    createJourney(db, userId, "vida-economica", "Vida Econômica", "...", "");
    const result = await receive(
      db,
      userId,
      "How does my financial situation affect strategy?",
      {
        sessionTags: {
          personaKeys: [],
          organizationKeys: [],
          journeyKeys: ["o-espelho"],
        },
      },
      fakeComplete(
        '{"personas": [], "organization": null, "journey": "o-espelho", "mode": "conversational", "touches_identity": false, "would_have_journey": "vida-economica"}',
      ),
    );
    expect(result.journey).toBe("o-espelho");
    expect(result.would_have_journey).toBe("vida-economica");
  });

  it("drops would_have_persona when key is in the session pool (drift guard)", async () => {
    // The LLM hallucinated by returning a session-pool key in the
    // would_have axis. The parser strict-validates against the
    // out-of-pool set and drops the value.
    setIdentityLayer(db, userId, "persona", "engineer", "# E");
    setIdentityLayer(db, userId, "persona", "maker", "# M");
    const result = await receive(
      db,
      userId,
      "hi",
      {
        sessionTags: {
          personaKeys: ["engineer"],
          organizationKeys: [],
          journeyKeys: [],
        },
      },
      fakeComplete(
        '{"personas": ["engineer"], "organization": null, "journey": null, "mode": "conversational", "touches_identity": false, "would_have_persona": "engineer"}',
      ),
    );
    expect(result.would_have_persona).toBeNull();
  });

  it("drops would_have_persona when key doesn't exist in user data (drift guard)", async () => {
    setIdentityLayer(db, userId, "persona", "engineer", "# E");
    const result = await receive(
      db,
      userId,
      "hi",
      {},
      fakeComplete(
        '{"personas": ["engineer"], "organization": null, "journey": null, "mode": "conversational", "touches_identity": false, "would_have_persona": "ghost"}',
      ),
    );
    expect(result.would_have_persona).toBeNull();
  });

  it("all would_have_X null when LLM omits the fields", async () => {
    setIdentityLayer(db, userId, "persona", "engineer", "# E");
    setIdentityLayer(db, userId, "persona", "maker", "# M");
    const result = await receive(
      db,
      userId,
      "hi",
      {
        sessionTags: {
          personaKeys: ["engineer"],
          organizationKeys: [],
          journeyKeys: [],
        },
      },
      fakeComplete(
        '{"personas": ["engineer"], "organization": null, "journey": null, "mode": "conversational", "touches_identity": false}',
      ),
    );
    expect(result.would_have_persona).toBeNull();
    expect(result.would_have_organization).toBeNull();
    expect(result.would_have_journey).toBeNull();
  });

  it("all would_have_X null on LLM failure (NULL_RESULT)", async () => {
    setIdentityLayer(db, userId, "persona", "p", "# P");
    const result = await receive(db, userId, "hi", {}, failingComplete());
    expect(result.would_have_persona).toBeNull();
    expect(result.would_have_organization).toBeNull();
    expect(result.would_have_journey).toBeNull();
  });

  it("system prompt shows OUT-OF-POOL section when session pool is constrained", async () => {
    setIdentityLayer(db, userId, "persona", "engineer", "# E");
    setIdentityLayer(db, userId, "persona", "maker", "# M");
    const cap = capturingComplete();
    await receive(
      db,
      userId,
      "anything",
      {
        sessionTags: {
          personaKeys: ["engineer"],
          organizationKeys: [],
          journeyKeys: [],
        },
      },
      cap.fn,
    );
    const prompt = cap.getSystemPrompt();
    expect(prompt).toContain("SESSION POOL");
    expect(prompt).toContain("OUT-OF-POOL");
    expect(prompt).toContain("would_have_persona");
  });

  it("system prompt does NOT render an OUT-OF-POOL listing when session pool == full pool", async () => {
    setIdentityLayer(db, userId, "persona", "engineer", "# E");
    const cap = capturingComplete();
    // No session tags, so the full pool is everything (engineer alone)
    await receive(db, userId, "anything", {}, cap.fn);
    const prompt = cap.getSystemPrompt() ?? "";
    // SESSION POOL listing renders.
    expect(prompt).toContain("personas — SESSION POOL");
    // No OUT-OF-POOL section header (the rule text below mentions
    // "OUT-OF-POOL" as a concept, but the listing header is what we
    // care about — and it's only emitted when there are out-of-pool
    // candidates to list).
    expect(prompt).not.toContain("personas — OUT-OF-POOL");
  });
});

describe("receive — is_self_moment axis (CV1.E9.S3)", () => {
  let db: Database.Database;
  let userId: string;

  beforeEach(() => {
    db = openDb(":memory:");
    userId = createUser(db, "alice", "hash").id;
    setIdentityLayer(db, userId, "persona", "mentora", "# Mentora");
  });

  it("returns is_self_moment = true when LLM classifies it as such", async () => {
    const result = await receive(
      db,
      userId,
      "hoje atendi um caso difícil",
      {},
      fakeComplete(
        '{"personas": [], "organization": null, "journey": null, "mode": "conversational", "touches_identity": false, "is_self_moment": true}',
      ),
    );
    expect(result.is_self_moment).toBe(true);
  });

  it("returns is_self_moment = false when LLM classifies it as such", async () => {
    const result = await receive(
      db,
      userId,
      "compare A e B",
      {},
      fakeComplete(
        '{"personas": [], "organization": null, "journey": null, "mode": "conversational", "touches_identity": false, "is_self_moment": false}',
      ),
    );
    expect(result.is_self_moment).toBe(false);
  });

  it("missing field defaults to false (conservative)", async () => {
    const result = await receive(
      db,
      userId,
      "anything",
      {},
      fakeComplete(
        '{"personas": [], "organization": null, "journey": null, "mode": "conversational", "touches_identity": false}',
      ),
    );
    expect(result.is_self_moment).toBe(false);
  });

  it("non-boolean drift (string \"true\") defaults to false", async () => {
    const result = await receive(
      db,
      userId,
      "anything",
      {},
      fakeComplete(
        '{"personas": [], "organization": null, "journey": null, "mode": "conversational", "touches_identity": false, "is_self_moment": "true"}',
      ),
    );
    expect(result.is_self_moment).toBe(false);
  });

  it("explicit null defaults to false", async () => {
    const result = await receive(
      db,
      userId,
      "anything",
      {},
      fakeComplete(
        '{"personas": [], "organization": null, "journey": null, "mode": "conversational", "touches_identity": false, "is_self_moment": null}',
      ),
    );
    expect(result.is_self_moment).toBe(false);
  });

  it("is_self_moment: false on LLM failure (NULL_RESULT)", async () => {
    const result = await receive(db, userId, "hi", {}, failingComplete());
    expect(result.is_self_moment).toBe(false);
  });

  it("is_self_moment: false on no-candidates short circuit", async () => {
    db = openDb(":memory:");
    userId = createUser(db, "bob", "hash").id;
    let called = false;
    const result = await receive(
      db,
      userId,
      "anything",
      {},
      (async () => {
        called = true;
        return { content: [] };
      }) as unknown as CompleteFn,
    );
    expect(result.is_self_moment).toBe(false);
    expect(called).toBe(false);
  });

  it("is independent from touches_identity (both can be true)", async () => {
    const result = await receive(
      db,
      userId,
      "hoje pensei muito sobre quem eu estou me tornando",
      {},
      fakeComplete(
        '{"personas": [], "organization": null, "journey": null, "mode": "essayistic", "touches_identity": true, "is_self_moment": true}',
      ),
    );
    expect(result.touches_identity).toBe(true);
    expect(result.is_self_moment).toBe(true);
  });

  it("is independent from touches_identity (both can be false)", async () => {
    const result = await receive(
      db,
      userId,
      "compare A e B",
      {},
      fakeComplete(
        '{"personas": [], "organization": null, "journey": null, "mode": "compositional", "touches_identity": false, "is_self_moment": false}',
      ),
    );
    expect(result.touches_identity).toBe(false);
    expect(result.is_self_moment).toBe(false);
  });

  it("system prompt includes the is_self_moment classification block", async () => {
    const cap = capturingComplete();
    await receive(db, userId, "anything", {}, cap.fn);
    const prompt = cap.getSystemPrompt() ?? "";
    expect(prompt).toContain("is_self_moment");
    expect(prompt).toContain("Soul Voice");
    expect(prompt).toContain("Apontamento de vida");
    expect(prompt).toContain("Conservative-by-default");
  });
});

describe("receive — is_trivial axis (CV1.E10.S1)", () => {
  let db: Database.Database;
  let userId: string;

  beforeEach(() => {
    db = openDb(":memory:");
    userId = createUser(db, "alice", "hash").id;
    setIdentityLayer(db, userId, "persona", "mentora", "# Mentora");
  });

  it("returns is_trivial = true when LLM classifies it as such", async () => {
    const result = await receive(
      db,
      userId,
      "boa noite",
      {},
      fakeComplete(
        '{"personas": [], "organization": null, "journey": null, "mode": "conversational", "touches_identity": false, "is_self_moment": false, "is_trivial": true}',
      ),
    );
    expect(result.is_trivial).toBe(true);
  });

  it("returns is_trivial = false when LLM classifies it as such", async () => {
    const result = await receive(
      db,
      userId,
      "compare A e B",
      {},
      fakeComplete(
        '{"personas": [], "organization": null, "journey": null, "mode": "conversational", "touches_identity": false, "is_self_moment": false, "is_trivial": false}',
      ),
    );
    expect(result.is_trivial).toBe(false);
  });

  it("missing field defaults to false (conservative)", async () => {
    const result = await receive(
      db,
      userId,
      "anything",
      {},
      fakeComplete(
        '{"personas": [], "organization": null, "journey": null, "mode": "conversational", "touches_identity": false, "is_self_moment": false}',
      ),
    );
    expect(result.is_trivial).toBe(false);
  });

  it("non-boolean drift (string \"true\") defaults to false", async () => {
    const result = await receive(
      db,
      userId,
      "anything",
      {},
      fakeComplete(
        '{"personas": [], "organization": null, "journey": null, "mode": "conversational", "touches_identity": false, "is_self_moment": false, "is_trivial": "true"}',
      ),
    );
    expect(result.is_trivial).toBe(false);
  });

  it("explicit null defaults to false", async () => {
    const result = await receive(
      db,
      userId,
      "anything",
      {},
      fakeComplete(
        '{"personas": [], "organization": null, "journey": null, "mode": "conversational", "touches_identity": false, "is_self_moment": false, "is_trivial": null}',
      ),
    );
    expect(result.is_trivial).toBe(false);
  });

  it("is_trivial: false on LLM failure (NULL_RESULT)", async () => {
    const result = await receive(db, userId, "hi", {}, failingComplete());
    expect(result.is_trivial).toBe(false);
  });

  it("is_trivial: false on no-candidates short circuit", async () => {
    db = openDb(":memory:");
    userId = createUser(db, "bob", "hash").id;
    let called = false;
    const result = await receive(
      db,
      userId,
      "anything",
      {},
      (async () => {
        called = true;
        return { content: [] };
      }) as unknown as CompleteFn,
    );
    expect(result.is_trivial).toBe(false);
    expect(called).toBe(false);
  });

  it("MUTUAL EXCLUSION: when is_self_moment is true, is_trivial is forced to false even if model says both", async () => {
    // Drift case — model claims both true. Apontamento wins; trivial
    // is forced false post-parse.
    const result = await receive(
      db,
      userId,
      "hoje passei a tarde lutando contra o tédio",
      {},
      fakeComplete(
        '{"personas": [], "organization": null, "journey": null, "mode": "conversational", "touches_identity": false, "is_self_moment": true, "is_trivial": true}',
      ),
    );
    expect(result.is_self_moment).toBe(true);
    expect(result.is_trivial).toBe(false);
  });

  it("both false is the modal turn (no mutual-exclusion concern)", async () => {
    const result = await receive(
      db,
      userId,
      "compare VMware vs Proxmox",
      {},
      fakeComplete(
        '{"personas": [], "organization": null, "journey": null, "mode": "compositional", "touches_identity": false, "is_self_moment": false, "is_trivial": false}',
      ),
    );
    expect(result.is_self_moment).toBe(false);
    expect(result.is_trivial).toBe(false);
  });

  it("system prompt includes the is_trivial classification block", async () => {
    const cap = capturingComplete();
    await receive(db, userId, "anything", {}, cap.fn);
    const prompt = cap.getSystemPrompt() ?? "";
    expect(prompt).toContain("is_trivial");
    expect(prompt).toContain("Trivial turn");
    expect(prompt).toContain("Greetings");
    expect(prompt).toContain("Acknowledgments");
    expect(prompt).toContain("Mutual exclusion with is_self_moment");
  });
});
