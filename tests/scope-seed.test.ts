import { describe, it, expect } from "vitest";
import { decideScopeSeeding } from "../server/scope-seed.js";
import type { SessionTags } from "../server/db.js";

const empty: SessionTags = {
  personaKeys: [],
  organizationKeys: [],
  journeyKeys: [],
};

const noFlags = {
  isAlma: false,
  isTrivial: false,
  forcedPersonaKey: null as string | null,
};

describe("decideScopeSeeding (scope auto-seed gate)", () => {
  it("seeds personas, org and journey when all pools are empty", () => {
    const decision = decideScopeSeeding(
      empty,
      {
        personas: ["mentora", "terapeuta"],
        organization: "software-zen",
        journey: "o-espelho",
      },
      noFlags,
    );
    expect(decision.seedPersonas).toEqual(["mentora", "terapeuta"]);
    expect(decision.seedOrganization).toBe("software-zen");
    expect(decision.seedJourney).toBe("o-espelho");
  });

  // The 28/Apr/2026 prod incident — under the previous `isFirstTurn`
  // gate, this returned no org/journey seeds. Now it should seed both
  // because the pools are still empty before this turn (turn 2).
  it("seeds org/journey on a non-first turn when the pools are still empty", () => {
    const before: SessionTags = {
      personaKeys: ["mentora"],
      organizationKeys: [],
      journeyKeys: [],
    };
    const decision = decideScopeSeeding(
      before,
      {
        personas: ["mentora"],
        organization: "software-zen",
        journey: "o-espelho",
      },
      noFlags,
    );
    expect(decision.seedOrganization).toBe("software-zen");
    expect(decision.seedJourney).toBe("o-espelho");
  });

  it("does not seed an axis once its pool is non-empty (no creep)", () => {
    const before: SessionTags = {
      personaKeys: ["mentora"],
      organizationKeys: ["software-zen"],
      journeyKeys: ["o-espelho"],
    };
    const decision = decideScopeSeeding(
      before,
      {
        personas: ["terapeuta"],
        organization: "another-org",
        journey: "another-journey",
      },
      noFlags,
    );
    expect(decision.seedPersonas).toEqual([]);
    expect(decision.seedOrganization).toBeNull();
    expect(decision.seedJourney).toBeNull();
  });

  it("returns null org/journey when reception did not classify any", () => {
    const decision = decideScopeSeeding(
      empty,
      { personas: ["mentora"], organization: null, journey: null },
      noFlags,
    );
    expect(decision.seedOrganization).toBeNull();
    expect(decision.seedJourney).toBeNull();
  });

  it("alma turns skip persona seeding but still seed org/journey", () => {
    const decision = decideScopeSeeding(
      empty,
      {
        personas: ["mentora"],
        organization: "software-zen",
        journey: "o-espelho",
      },
      { ...noFlags, isAlma: true },
    );
    expect(decision.seedPersonas).toEqual([]);
    expect(decision.seedOrganization).toBe("software-zen");
    expect(decision.seedJourney).toBe("o-espelho");
  });

  it("trivial turns skip persona seeding but still seed org/journey", () => {
    const decision = decideScopeSeeding(
      empty,
      {
        personas: ["mentora"],
        organization: "software-zen",
        journey: "o-espelho",
      },
      { ...noFlags, isTrivial: true },
    );
    expect(decision.seedPersonas).toEqual([]);
    expect(decision.seedOrganization).toBe("software-zen");
    expect(decision.seedJourney).toBe("o-espelho");
  });

  it("forced-persona turns skip persona seeding (manual choice owns the pick)", () => {
    const decision = decideScopeSeeding(
      empty,
      { personas: ["mentora"], organization: null, journey: null },
      { ...noFlags, forcedPersonaKey: "estrategista" },
    );
    expect(decision.seedPersonas).toEqual([]);
  });

  it("axes are independent — seeding org does not affect persona/journey gates", () => {
    const before: SessionTags = {
      personaKeys: [],
      organizationKeys: ["software-zen"],
      journeyKeys: [],
    };
    const decision = decideScopeSeeding(
      before,
      {
        personas: ["mentora"],
        organization: "ignored",
        journey: "o-espelho",
      },
      noFlags,
    );
    expect(decision.seedPersonas).toEqual(["mentora"]);
    expect(decision.seedOrganization).toBeNull();
    expect(decision.seedJourney).toBe("o-espelho");
  });

  it("reception with empty personas array seeds nothing on persona axis even when gate is open", () => {
    const decision = decideScopeSeeding(
      empty,
      { personas: [], organization: null, journey: null },
      noFlags,
    );
    expect(decision.seedPersonas).toEqual([]);
  });
});
