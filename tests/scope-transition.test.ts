import { describe, it, expect } from "vitest";
import { decideScopeTransition } from "../server/scope-transition.js";

describe("decideScopeTransition (bubble badge visibility)", () => {
  it("first turn with org — counts as transition from null", () => {
    const d = decideScopeTransition({
      previousOrg: null,
      previousJourney: null,
      currentOrg: "software-zen",
      currentJourney: "o-espelho",
    });
    expect(d.newOrgThisTurn).toBe("software-zen");
    expect(d.newJourneyThisTurn).toBe("o-espelho");
  });

  it("same scope two turns in a row — no transition, no badge", () => {
    const d = decideScopeTransition({
      previousOrg: "software-zen",
      previousJourney: "o-espelho",
      currentOrg: "software-zen",
      currentJourney: "o-espelho",
    });
    expect(d.newOrgThisTurn).toBeNull();
    expect(d.newJourneyThisTurn).toBeNull();
  });

  it("scope changes — transition fires for the changed axis only", () => {
    const d = decideScopeTransition({
      previousOrg: "software-zen",
      previousJourney: "o-espelho",
      currentOrg: "another-org",
      currentJourney: "o-espelho",
    });
    expect(d.newOrgThisTurn).toBe("another-org");
    expect(d.newJourneyThisTurn).toBeNull();
  });

  it("scope clears (current null) — no transition fires", () => {
    const d = decideScopeTransition({
      previousOrg: "software-zen",
      previousJourney: "o-espelho",
      currentOrg: null,
      currentJourney: null,
    });
    expect(d.newOrgThisTurn).toBeNull();
    expect(d.newJourneyThisTurn).toBeNull();
  });

  it("scope returns after a scope-less turn — counts as transition", () => {
    // E.g., trivial turn (current null) interrupts, then user resumes
    // the scoped conversation. The bubble that resumes scope is a
    // transition from the null state and shows the badge.
    const d = decideScopeTransition({
      previousOrg: null,
      previousJourney: null,
      currentOrg: "software-zen",
      currentJourney: "o-espelho",
    });
    expect(d.newOrgThisTurn).toBe("software-zen");
    expect(d.newJourneyThisTurn).toBe("o-espelho");
  });

  it("axes are independent — org transitions while journey continues", () => {
    const d = decideScopeTransition({
      previousOrg: null,
      previousJourney: "o-espelho",
      currentOrg: "software-zen",
      currentJourney: "o-espelho",
    });
    expect(d.newOrgThisTurn).toBe("software-zen");
    expect(d.newJourneyThisTurn).toBeNull();
  });
});
