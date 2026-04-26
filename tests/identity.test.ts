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
import { composeSystemPrompt } from "../server/identity.js";

describe("composeSystemPrompt", () => {
  let db: Database.Database;
  let userId: string;

  beforeEach(() => {
    db = openDb(":memory:");
    userId = createUser(db, "alice", "hash123").id;
  });

  it("returns empty string for user with no layers", () => {
    expect(composeSystemPrompt(db, userId)).toBe("");
  });

  it("joins layers with separators", () => {
    setIdentityLayer(db, userId, "self", "soul", "I am the soul.");
    setIdentityLayer(db, userId, "ego", "identity", "I am the identity.");
    setIdentityLayer(db, userId, "ego", "behavior", "I am the behavior.");

    const prompt = composeSystemPrompt(db, userId);

    expect(prompt).toContain("I am the behavior.");
    expect(prompt).toContain("---");
    expect(prompt).toContain("I am the soul.");
  });

  it("orders layers by psychic depth (self before ego)", () => {
    setIdentityLayer(db, userId, "self", "soul", "SOUL");
    setIdentityLayer(db, userId, "ego", "behavior", "BEHAVIOR");

    const prompt = composeSystemPrompt(db, userId);
    const soulPos = prompt.indexOf("SOUL");
    const behaviorPos = prompt.indexOf("BEHAVIOR");

    // Self (essence) leads; ego (operational) follows.
    // See decisions.md 2026-04-18 "identity layers are ordered by psychic depth".
    expect(soulPos).toBeLessThan(behaviorPos);
  });

  it("excludes persona layers from base composition", () => {
    setIdentityLayer(db, userId, "self", "soul", "SOUL");
    setIdentityLayer(db, userId, "persona", "mentora", "MENTORA");

    const prompt = composeSystemPrompt(db, userId);

    expect(prompt).toContain("SOUL");
    expect(prompt).not.toContain("MENTORA");
  });

  it("empty personaKeys array behaves the same as null (base voice)", () => {
    setIdentityLayer(db, userId, "self", "soul", "SOUL");
    setIdentityLayer(db, userId, "persona", "mentora", "MENTORA");

    const promptEmpty = composeSystemPrompt(db, userId, []);
    const promptNull = composeSystemPrompt(db, userId, null);

    expect(promptEmpty).toBe(promptNull);
    expect(promptEmpty).not.toContain("MENTORA");
  });

  it("CV1.E7.S5: two personas render under a shared 'one voice, multiple lenses' instruction", () => {
    setIdentityLayer(db, userId, "self", "soul", "SOUL");
    setIdentityLayer(db, userId, "persona", "estrategista", "ESTRATEGISTA_BLOCK");
    setIdentityLayer(db, userId, "persona", "divulgadora", "DIVULGADORA_BLOCK");

    const prompt = composeSystemPrompt(db, userId, [
      "estrategista",
      "divulgadora",
    ]);

    // Both persona contents present.
    expect(prompt).toContain("ESTRATEGISTA_BLOCK");
    expect(prompt).toContain("DIVULGADORA_BLOCK");
    // Multi-lens instruction prefix is present.
    expect(prompt).toContain("Multiple persona lenses are active simultaneously");
    expect(prompt).toContain("one coherent voice");
    // Order preserved (leading lens first).
    const estPos = prompt.indexOf("ESTRATEGISTA_BLOCK");
    const divPos = prompt.indexOf("DIVULGADORA_BLOCK");
    expect(estPos).toBeLessThan(divPos);
  });

  it("CV1.E7.S5: single persona in array renders identically to the legacy singular — no multi-lens prefix", () => {
    setIdentityLayer(db, userId, "persona", "mentora", "MENTORA_BLOCK");

    const prompt = composeSystemPrompt(db, userId, ["mentora"]);

    expect(prompt).toContain("MENTORA_BLOCK");
    expect(prompt).not.toContain("Multiple persona lenses");
  });

  it("CV1.E7.S5: unknown keys in the array are silently dropped", () => {
    setIdentityLayer(db, userId, "persona", "mentora", "MENTORA_BLOCK");

    const prompt = composeSystemPrompt(db, userId, ["mentora", "ghost"]);

    expect(prompt).toContain("MENTORA_BLOCK");
    // Ghost didn't exist so the prompt reads as single-persona (no prefix).
    expect(prompt).not.toContain("Multiple persona lenses");
  });

  it("places persona between identity and behavior", () => {
    setIdentityLayer(db, userId, "self", "soul", "SOUL");
    setIdentityLayer(db, userId, "ego", "identity", "IDENTITY");
    setIdentityLayer(db, userId, "ego", "behavior", "BEHAVIOR");
    setIdentityLayer(db, userId, "persona", "mentora", "MENTORA");

    const prompt = composeSystemPrompt(db, userId, ["mentora"]);

    // Composition order: soul → identity → persona → behavior. Persona
    // joins the identity cluster; behavior closes the form cluster.
    const soulPos = prompt.indexOf("SOUL");
    const identityPos = prompt.indexOf("IDENTITY");
    const mentoraPos = prompt.indexOf("MENTORA");
    const behaviorPos = prompt.indexOf("BEHAVIOR");

    expect(soulPos).toBeLessThan(identityPos);
    expect(identityPos).toBeLessThan(mentoraPos);
    expect(mentoraPos).toBeLessThan(behaviorPos);
  });

  it("omits ego/expression from the composed prompt (CV1.E7.S1)", () => {
    // Expression used to be the last block of the main prompt. Starting
    // with CV1.E7.S1, it is input to a post-generation pass (server/
    // expression.ts) and no longer participates in composition. This
    // regression guard pins the contract.
    setIdentityLayer(db, userId, "self", "soul", "SOUL");
    setIdentityLayer(db, userId, "ego", "behavior", "BEHAVIOR");
    setIdentityLayer(db, userId, "ego", "expression", "EXPRESSION_SHOULD_NOT_APPEAR");

    const prompt = composeSystemPrompt(db, userId);

    expect(prompt).toContain("SOUL");
    expect(prompt).toContain("BEHAVIOR");
    expect(prompt).not.toContain("EXPRESSION_SHOULD_NOT_APPEAR");
  });

  it("falls back to base when persona key is unknown", () => {
    setIdentityLayer(db, userId, "self", "soul", "SOUL");
    setIdentityLayer(db, userId, "ego", "behavior", "BEHAVIOR");

    const prompt = composeSystemPrompt(db, userId, ["nonexistent"]);

    expect(prompt).toContain("SOUL");
    expect(prompt).toContain("BEHAVIOR");
  });

  it("appends adapter instruction when adapter is specified", () => {
    setIdentityLayer(db, userId, "self", "soul", "SOUL");

    const prompt = composeSystemPrompt(db, userId, null, "telegram");

    expect(prompt).toContain("SOUL");
    expect(prompt).toContain("Telegram");
    expect(prompt.indexOf("Telegram")).toBeGreaterThan(prompt.indexOf("SOUL"));
  });

  it("does not append adapter instruction for unknown adapter", () => {
    setIdentityLayer(db, userId, "self", "soul", "SOUL");

    const prompt = composeSystemPrompt(db, userId, null, "unknown");

    expect(prompt).toContain("SOUL");
    expect(prompt).not.toContain("Telegram");
  });

  it("appends adapter instruction at the very end", () => {
    setIdentityLayer(db, userId, "self", "soul", "SOUL");
    setIdentityLayer(db, userId, "ego", "behavior", "BEHAVIOR");
    setIdentityLayer(db, userId, "persona", "mentora", "MENTORA");

    const prompt = composeSystemPrompt(db, userId, ["mentora"], "telegram");

    const soulPos = prompt.indexOf("SOUL");
    const mentoraPos = prompt.indexOf("MENTORA");
    const behaviorPos = prompt.indexOf("BEHAVIOR");
    const telegramPos = prompt.indexOf("Telegram");

    expect(mentoraPos).toBeGreaterThan(soulPos);
    expect(behaviorPos).toBeGreaterThan(mentoraPos);
    expect(telegramPos).toBeGreaterThan(behaviorPos);
  });
});

describe("composeSystemPrompt — scope injection", () => {
  let db: Database.Database;
  let userId: string;

  beforeEach(() => {
    db = openDb(":memory:");
    userId = createUser(db, "alice", "hash123").id;
  });

  it("injects organization briefing + situation block", () => {
    setIdentityLayer(db, userId, "self", "soul", "SOUL");
    createOrganization(db, userId, "sz", "Software Zen", "ORG_BRIEFING", "ORG_SITUATION");

    const prompt = composeSystemPrompt(db, userId, null, undefined, { organization: "sz" });

    expect(prompt).toContain("ORG_BRIEFING");
    expect(prompt).toContain("Current situation:");
    expect(prompt).toContain("ORG_SITUATION");
  });

  it("injects only briefing when situation is empty", () => {
    createOrganization(db, userId, "sz", "Software Zen", "ORG_BRIEFING", "");

    const prompt = composeSystemPrompt(db, userId, null, undefined, { organization: "sz" });

    expect(prompt).toContain("ORG_BRIEFING");
    expect(prompt).not.toContain("Current situation:");
  });

  it("skips the scope entirely when both briefing and situation are empty", () => {
    setIdentityLayer(db, userId, "self", "soul", "SOUL");
    createOrganization(db, userId, "sz", "Software Zen", "", "");

    const prompt = composeSystemPrompt(db, userId, null, undefined, { organization: "sz" });

    expect(prompt).toBe("SOUL");
  });

  it("skips the scope when the key is unknown", () => {
    setIdentityLayer(db, userId, "self", "soul", "SOUL");

    const prompt = composeSystemPrompt(db, userId, null, undefined, { organization: "ghost" });

    expect(prompt).toBe("SOUL");
  });

  it("skips archived scopes even when the key is passed", () => {
    setIdentityLayer(db, userId, "self", "soul", "SOUL");
    createOrganization(db, userId, "sz", "Software Zen", "ORG_BRIEFING", "ORG_SITUATION");
    archiveOrganization(db, userId, "sz");

    const prompt = composeSystemPrompt(db, userId, null, undefined, { organization: "sz" });

    expect(prompt).not.toContain("ORG_BRIEFING");
    expect(prompt).toContain("SOUL");
  });

  it("places organization between persona and behavior", () => {
    setIdentityLayer(db, userId, "self", "soul", "SOUL");
    setIdentityLayer(db, userId, "ego", "identity", "IDENTITY");
    setIdentityLayer(db, userId, "ego", "behavior", "BEHAVIOR");
    setIdentityLayer(db, userId, "persona", "mentora", "MENTORA");
    createOrganization(db, userId, "sz", "Software Zen", "ORG_BRIEFING", "ORG_SITUATION");

    const prompt = composeSystemPrompt(db, userId, ["mentora"], undefined, { organization: "sz" });

    const mentoraPos = prompt.indexOf("MENTORA");
    const orgPos = prompt.indexOf("ORG_BRIEFING");
    const behaviorPos = prompt.indexOf("BEHAVIOR");

    expect(mentoraPos).toBeLessThan(orgPos);
    expect(orgPos).toBeLessThan(behaviorPos);
  });

  it("places journey after organization, both before behavior", () => {
    setIdentityLayer(db, userId, "ego", "behavior", "BEHAVIOR");
    createOrganization(db, userId, "sz", "Software Zen", "ORG_BRIEFING", "");
    createJourney(db, userId, "o-espelho", "O Espelho", "JOURNEY_BRIEFING", "");

    const prompt = composeSystemPrompt(db, userId, null, undefined, {
      organization: "sz",
      journey: "o-espelho",
    });

    const orgPos = prompt.indexOf("ORG_BRIEFING");
    const journeyPos = prompt.indexOf("JOURNEY_BRIEFING");
    const behaviorPos = prompt.indexOf("BEHAVIOR");

    expect(orgPos).toBeLessThan(journeyPos);
    expect(journeyPos).toBeLessThan(behaviorPos);
  });

  it("injects journey alone when organization is null", () => {
    createJourney(db, userId, "vida", "Vida", "JOURNEY_BRIEFING", "JOURNEY_SITUATION");

    const prompt = composeSystemPrompt(db, userId, null, undefined, { journey: "vida" });

    expect(prompt).toContain("JOURNEY_BRIEFING");
    expect(prompt).toContain("JOURNEY_SITUATION");
  });

  it("skips archived journeys", () => {
    setIdentityLayer(db, userId, "self", "soul", "SOUL");
    createJourney(db, userId, "old", "Old", "JOURNEY_BRIEFING", "");
    archiveJourney(db, userId, "old");

    const prompt = composeSystemPrompt(db, userId, null, undefined, { journey: "old" });

    expect(prompt).not.toContain("JOURNEY_BRIEFING");
    expect(prompt).toContain("SOUL");
  });

  it("handles all four scope combinations (none, org only, journey only, both)", () => {
    setIdentityLayer(db, userId, "self", "soul", "SOUL");
    createOrganization(db, userId, "sz", "Software Zen", "ORG", "");
    createJourney(db, userId, "j", "J", "JOURNEY", "");

    const none = composeSystemPrompt(db, userId);
    expect(none).toContain("SOUL");
    expect(none).not.toContain("ORG");
    expect(none).not.toContain("JOURNEY");

    const orgOnly = composeSystemPrompt(db, userId, null, undefined, { organization: "sz" });
    expect(orgOnly).toContain("ORG");
    expect(orgOnly).not.toContain("JOURNEY");

    const journeyOnly = composeSystemPrompt(db, userId, null, undefined, { journey: "j" });
    expect(journeyOnly).not.toContain("ORG");
    expect(journeyOnly).toContain("JOURNEY");

    const both = composeSystemPrompt(db, userId, null, undefined, {
      organization: "sz",
      journey: "j",
    });
    expect(both).toContain("ORG");
    expect(both).toContain("JOURNEY");
    expect(both.indexOf("ORG")).toBeLessThan(both.indexOf("JOURNEY"));
  });
});

describe("composeSystemPrompt — conditional scope activation (CV1.E7.S3)", () => {
  let db: Database.Database;
  let userId: string;

  beforeEach(() => {
    db = openDb(":memory:");
    userId = createUser(db, "alice", "hash").id;
    setIdentityLayer(db, userId, "self", "soul", "SOUL");
    createOrganization(db, userId, "sz", "Software Zen", "ORG-SZ", "");
    createOrganization(db, userId, "nova", "Nova", "ORG-NOVA", "");
    createJourney(db, userId, "vida", "Vida", "JOURNEY-VIDA", "");
    createJourney(db, userId, "deserto", "Deserto", "JOURNEY-DESERTO", "");
  });

  it("renders only the organization reception activated, ignoring others available", () => {
    // The user has two orgs available; reception picked one. The other
    // is not in the prompt — pre-S3 the composer would have rendered
    // both when both were session-tagged. Post-S3, reception's pick
    // is the single source of truth.
    const prompt = composeSystemPrompt(db, userId, null, undefined, {
      organization: "sz",
    });
    expect(prompt).toContain("ORG-SZ");
    expect(prompt).not.toContain("ORG-NOVA");
  });

  it("renders no scope content when reception returned null for the axis", () => {
    // Both orgs and both journeys exist in the user's data; reception
    // declined to activate any (e.g., a small-talk turn). No scope
    // block reaches the prompt.
    const prompt = composeSystemPrompt(db, userId, null, undefined, {
      organization: null,
      journey: null,
    });
    expect(prompt).toContain("SOUL");
    expect(prompt).not.toContain("ORG-SZ");
    expect(prompt).not.toContain("ORG-NOVA");
    expect(prompt).not.toContain("JOURNEY-VIDA");
    expect(prompt).not.toContain("JOURNEY-DESERTO");
  });

  it("undefined scopes argument behaves identically to null picks (no scope block)", () => {
    const prompt = composeSystemPrompt(db, userId);
    expect(prompt).toContain("SOUL");
    expect(prompt).not.toContain("ORG-SZ");
    expect(prompt).not.toContain("JOURNEY-VIDA");
  });

  it("renders both axes when reception activated org and journey together (pair pattern)", () => {
    const prompt = composeSystemPrompt(db, userId, null, undefined, {
      organization: "sz",
      journey: "vida",
    });
    expect(prompt).toContain("ORG-SZ");
    expect(prompt).toContain("JOURNEY-VIDA");
    expect(prompt).not.toContain("ORG-NOVA");
    expect(prompt).not.toContain("JOURNEY-DESERTO");
    // Order preserved: org (broader) before journey (narrower).
    expect(prompt.indexOf("ORG-SZ")).toBeLessThan(
      prompt.indexOf("JOURNEY-VIDA"),
    );
  });
});

describe("composeSystemPrompt — conditional identity layers (CV1.E7.S4)", () => {
  let db: Database.Database;
  let userId: string;

  beforeEach(() => {
    db = openDb(":memory:");
    userId = createUser(db, "alice", "hash").id;
    setIdentityLayer(db, userId, "self", "soul", "SOUL_BLOCK");
    setIdentityLayer(db, userId, "ego", "identity", "IDENTITY_BLOCK");
    setIdentityLayer(db, userId, "ego", "behavior", "BEHAVIOR_BLOCK");
  });

  it("includes self/soul + ego/identity when touchesIdentity is true", () => {
    const prompt = composeSystemPrompt(db, userId, null, undefined, {
      touchesIdentity: true,
    });
    expect(prompt).toContain("SOUL_BLOCK");
    expect(prompt).toContain("IDENTITY_BLOCK");
    expect(prompt).toContain("BEHAVIOR_BLOCK");
  });

  it("skips both self/soul and ego/identity when touchesIdentity is false", () => {
    const prompt = composeSystemPrompt(db, userId, null, undefined, {
      touchesIdentity: false,
    });
    expect(prompt).not.toContain("SOUL_BLOCK");
    expect(prompt).not.toContain("IDENTITY_BLOCK");
    // ego/behavior continues to compose — form is transversal.
    expect(prompt).toContain("BEHAVIOR_BLOCK");
  });

  it("back-compat: omitting touchesIdentity defaults to true (compose both)", () => {
    // Callers that pre-date S4 (or test paths that don't pass the
    // flag) get the default-include behavior. The canonical caller
    // (reception result) always provides an explicit boolean; the
    // default exists only for legacy/test paths.
    const prompt = composeSystemPrompt(db, userId);
    expect(prompt).toContain("SOUL_BLOCK");
    expect(prompt).toContain("IDENTITY_BLOCK");
    expect(prompt).toContain("BEHAVIOR_BLOCK");
  });

  it("back-compat: scopes object without touchesIdentity defaults to true", () => {
    const prompt = composeSystemPrompt(db, userId, null, undefined, {
      organization: null,
      journey: null,
    });
    expect(prompt).toContain("SOUL_BLOCK");
    expect(prompt).toContain("IDENTITY_BLOCK");
  });

  it("identity gate is independent from persona — persona still composes when identity is skipped", () => {
    setIdentityLayer(db, userId, "persona", "tecnica", "TECNICA_BLOCK");
    const prompt = composeSystemPrompt(db, userId, ["tecnica"], undefined, {
      touchesIdentity: false,
    });
    expect(prompt).not.toContain("SOUL_BLOCK");
    expect(prompt).not.toContain("IDENTITY_BLOCK");
    expect(prompt).toContain("TECNICA_BLOCK");
    expect(prompt).toContain("BEHAVIOR_BLOCK");
  });

  it("identity gate is independent from scope — orgs/journeys still compose when identity is skipped", () => {
    createOrganization(db, userId, "sz", "Software Zen", "ORG-SZ", "");
    const prompt = composeSystemPrompt(db, userId, null, undefined, {
      organization: "sz",
      touchesIdentity: false,
    });
    expect(prompt).not.toContain("SOUL_BLOCK");
    expect(prompt).not.toContain("IDENTITY_BLOCK");
    expect(prompt).toContain("ORG-SZ");
    expect(prompt).toContain("BEHAVIOR_BLOCK");
  });

  it("composition order preserved when identity is included", () => {
    setIdentityLayer(db, userId, "persona", "tecnica", "TECNICA_BLOCK");
    const prompt = composeSystemPrompt(db, userId, ["tecnica"], undefined, {
      touchesIdentity: true,
    });
    // soul → identity → persona → behavior (the canonical order)
    expect(prompt.indexOf("SOUL_BLOCK")).toBeLessThan(
      prompt.indexOf("IDENTITY_BLOCK"),
    );
    expect(prompt.indexOf("IDENTITY_BLOCK")).toBeLessThan(
      prompt.indexOf("TECNICA_BLOCK"),
    );
    expect(prompt.indexOf("TECNICA_BLOCK")).toBeLessThan(
      prompt.indexOf("BEHAVIOR_BLOCK"),
    );
  });

  it("when both layers and identity are skipped, prompt is just the form cluster", () => {
    // No persona, no scope, identity skipped — only behavior remains.
    const prompt = composeSystemPrompt(db, userId, null, undefined, {
      touchesIdentity: false,
    });
    expect(prompt).toBe("BEHAVIOR_BLOCK");
  });
});
