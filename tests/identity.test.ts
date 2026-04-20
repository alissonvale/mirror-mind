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

  it("places persona between identity and form clusters", () => {
    setIdentityLayer(db, userId, "self", "soul", "SOUL");
    setIdentityLayer(db, userId, "ego", "identity", "IDENTITY");
    setIdentityLayer(db, userId, "ego", "behavior", "BEHAVIOR");
    setIdentityLayer(db, userId, "ego", "expression", "EXPRESSION");
    setIdentityLayer(db, userId, "persona", "mentora", "MENTORA");

    const prompt = composeSystemPrompt(db, userId, "mentora");

    // Composition order: soul → identity → persona → behavior → expression.
    // Persona joins the identity cluster; expression stays last so its
    // absolute rules keep recency weight over any persona content.
    const soulPos = prompt.indexOf("SOUL");
    const identityPos = prompt.indexOf("IDENTITY");
    const mentoraPos = prompt.indexOf("MENTORA");
    const behaviorPos = prompt.indexOf("BEHAVIOR");
    const expressionPos = prompt.indexOf("EXPRESSION");

    expect(soulPos).toBeLessThan(identityPos);
    expect(identityPos).toBeLessThan(mentoraPos);
    expect(mentoraPos).toBeLessThan(behaviorPos);
    expect(behaviorPos).toBeLessThan(expressionPos);
  });

  it("falls back to base when persona key is unknown", () => {
    setIdentityLayer(db, userId, "self", "soul", "SOUL");
    setIdentityLayer(db, userId, "ego", "behavior", "BEHAVIOR");

    const prompt = composeSystemPrompt(db, userId, "nonexistent");

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
    setIdentityLayer(db, userId, "ego", "expression", "EXPRESSION");
    setIdentityLayer(db, userId, "persona", "mentora", "MENTORA");

    const prompt = composeSystemPrompt(db, userId, "mentora", "telegram");

    const soulPos = prompt.indexOf("SOUL");
    const mentoraPos = prompt.indexOf("MENTORA");
    const expressionPos = prompt.indexOf("EXPRESSION");
    const telegramPos = prompt.indexOf("Telegram");

    expect(mentoraPos).toBeGreaterThan(soulPos);
    expect(expressionPos).toBeGreaterThan(mentoraPos);
    expect(telegramPos).toBeGreaterThan(expressionPos);
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

    const prompt = composeSystemPrompt(db, userId, "mentora", undefined, { organization: "sz" });

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
