import { describe, it, expect, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import {
  openDb,
  createUser,
  setIdentityLayer,
  createOrganization,
  createJourney,
  archiveOrganization,
} from "../server/db.js";
import { composeAlmaPrompt, ALMA_PREAMBLE } from "../server/voz-da-alma.js";
import { composeSystemPrompt } from "../server/identity.js";
import { composedSnapshot } from "../server/composed-snapshot.js";

describe("composeAlmaPrompt — CV1.E9.S2", () => {
  let db: Database.Database;
  let userId: string;

  beforeEach(() => {
    db = openDb(":memory:");
    userId = createUser(db, "alice", "hash").id;
  });

  it("prepends the Alma identity preamble", () => {
    const prompt = composeAlmaPrompt(db, userId);
    expect(prompt.startsWith(ALMA_PREAMBLE)).toBe(true);
  });

  it("composes the full identity cluster (soul + doctrine + identity) when present", () => {
    setIdentityLayer(db, userId, "self", "soul", "SOUL_BLOCK");
    setIdentityLayer(db, userId, "self", "doctrine", "DOCTRINE_BLOCK");
    setIdentityLayer(db, userId, "ego", "identity", "IDENTITY_BLOCK");
    setIdentityLayer(db, userId, "ego", "behavior", "BEHAVIOR_BLOCK");

    const prompt = composeAlmaPrompt(db, userId);
    expect(prompt).toContain("SOUL_BLOCK");
    expect(prompt).toContain("DOCTRINE_BLOCK");
    expect(prompt).toContain("IDENTITY_BLOCK");
    expect(prompt).toContain("BEHAVIOR_BLOCK");
  });

  it("identity cluster always composes — bypasses the touchesIdentity gate of the canonical path", () => {
    // The Alma is identity-bearing by definition. Even on a "casual"
    // turn that the canonical composer would skip identity for, the
    // Alma path includes it.
    setIdentityLayer(db, userId, "self", "soul", "SOUL_BLOCK");
    setIdentityLayer(db, userId, "ego", "identity", "IDENTITY_BLOCK");

    const prompt = composeAlmaPrompt(db, userId);
    expect(prompt).toContain("SOUL_BLOCK");
    expect(prompt).toContain("IDENTITY_BLOCK");
  });

  it("does NOT compose persona blocks (Alma replaces persona voicing)", () => {
    setIdentityLayer(db, userId, "self", "soul", "SOUL_BLOCK");
    setIdentityLayer(db, userId, "persona", "mentora", "MENTORA_BLOCK");
    setIdentityLayer(db, userId, "persona", "estrategista", "ESTRATEGISTA_BLOCK");

    const prompt = composeAlmaPrompt(db, userId);
    expect(prompt).toContain("SOUL_BLOCK");
    expect(prompt).not.toContain("MENTORA_BLOCK");
    expect(prompt).not.toContain("ESTRATEGISTA_BLOCK");
  });

  it("composes organization scope when provided", () => {
    setIdentityLayer(db, userId, "self", "soul", "SOUL_BLOCK");
    createOrganization(db, userId, "sz", "Software Zen", "ORG-SZ-BRIEFING", "");

    const prompt = composeAlmaPrompt(db, userId, { organization: "sz" });
    expect(prompt).toContain("ORG-SZ-BRIEFING");
  });

  it("composes journey scope when provided", () => {
    setIdentityLayer(db, userId, "self", "soul", "SOUL_BLOCK");
    createJourney(db, userId, "vida-economica", "Vida Econômica", "JOURNEY-VIDA-BRIEFING", "");

    const prompt = composeAlmaPrompt(db, userId, { journey: "vida-economica" });
    expect(prompt).toContain("JOURNEY-VIDA-BRIEFING");
  });

  it("skips scope when not provided (Alma works without scope context)", () => {
    setIdentityLayer(db, userId, "self", "soul", "SOUL_BLOCK");
    createOrganization(db, userId, "sz", "Software Zen", "ORG-SZ-BRIEFING", "");
    createJourney(db, userId, "vida-economica", "Vida Econômica", "JOURNEY-VIDA", "");

    const prompt = composeAlmaPrompt(db, userId);
    expect(prompt).not.toContain("ORG-SZ-BRIEFING");
    expect(prompt).not.toContain("JOURNEY-VIDA");
  });

  it("composition order: preamble → soul → doctrine → identity → org → journey → behavior", () => {
    setIdentityLayer(db, userId, "self", "soul", "SOUL_BLOCK");
    setIdentityLayer(db, userId, "self", "doctrine", "DOCTRINE_BLOCK");
    setIdentityLayer(db, userId, "ego", "identity", "IDENTITY_BLOCK");
    setIdentityLayer(db, userId, "ego", "behavior", "BEHAVIOR_BLOCK");
    createOrganization(db, userId, "sz", "Software Zen", "ORG-BLOCK", "");
    createJourney(db, userId, "vida-economica", "Vida Econômica", "JOURNEY-BLOCK", "");

    const prompt = composeAlmaPrompt(db, userId, {
      organization: "sz",
      journey: "vida-economica",
    });

    const positions = [
      ["preamble", prompt.indexOf(ALMA_PREAMBLE)],
      ["soul", prompt.indexOf("SOUL_BLOCK")],
      ["doctrine", prompt.indexOf("DOCTRINE_BLOCK")],
      ["identity", prompt.indexOf("IDENTITY_BLOCK")],
      ["org", prompt.indexOf("ORG-BLOCK")],
      ["journey", prompt.indexOf("JOURNEY-BLOCK")],
      ["behavior", prompt.indexOf("BEHAVIOR_BLOCK")],
    ] as const;

    for (let i = 1; i < positions.length; i++) {
      const [_prevName, prev] = positions[i - 1];
      const [_currName, curr] = positions[i];
      expect(prev).toBeGreaterThanOrEqual(0);
      expect(curr).toBeGreaterThan(prev);
    }
  });

  it("handles missing doctrine row gracefully (most users have no doctrine)", () => {
    setIdentityLayer(db, userId, "self", "soul", "SOUL_BLOCK");
    setIdentityLayer(db, userId, "ego", "identity", "IDENTITY_BLOCK");

    const prompt = composeAlmaPrompt(db, userId);
    expect(prompt).toContain("SOUL_BLOCK");
    expect(prompt).toContain("IDENTITY_BLOCK");
    expect(prompt).toContain(ALMA_PREAMBLE);
  });

  it("handles user with no identity layers at all (preamble + behavior at most)", () => {
    const prompt = composeAlmaPrompt(db, userId);
    // Just the preamble — no identity rows to compose.
    expect(prompt).toBe(ALMA_PREAMBLE);
  });

  it("appends adapter instruction when adapter is registered", () => {
    setIdentityLayer(db, userId, "self", "soul", "SOUL_BLOCK");
    const prompt = composeAlmaPrompt(db, userId, undefined, "web");
    // Adapter instruction is the last block — preamble + soul before it.
    expect(prompt.indexOf("SOUL_BLOCK")).toBeLessThan(prompt.length - 100);
  });

  it("skips archived scopes even when key is passed", () => {
    setIdentityLayer(db, userId, "self", "soul", "SOUL_BLOCK");
    createOrganization(db, userId, "sz", "Software Zen", "ORG-SZ", "");
    archiveOrganization(db, userId, "sz");

    const prompt = composeAlmaPrompt(db, userId, { organization: "sz" });
    expect(prompt).not.toContain("ORG-SZ");
  });
});

describe("composedSnapshot — isAlma flag (CV1.E9.S2)", () => {
  let db: Database.Database;
  let userId: string;

  beforeEach(() => {
    db = openDb(":memory:");
    userId = createUser(db, "alice", "hash").id;
    setIdentityLayer(db, userId, "self", "soul", "SOUL");
    setIdentityLayer(db, userId, "self", "doctrine", "DOCTRINE");
    setIdentityLayer(db, userId, "ego", "identity", "IDENTITY");
    setIdentityLayer(db, userId, "ego", "behavior", "BEHAVIOR");
  });

  it("isAlma=true forces personas empty and identity layers visible", () => {
    const snap = composedSnapshot(
      db,
      userId,
      ["should-be-ignored"], // Alma forces empty
      "sz",
      null,
      "conversational",
      false, // includeIdentity false — Alma forces it true
      true, // isAlma
    );
    expect(snap.personas).toEqual([]);
    expect(snap.persona).toBeNull();
    expect(snap.layers).toContain("self.soul");
    expect(snap.layers).toContain("self.doctrine");
    expect(snap.layers).toContain("ego.identity");
    expect(snap.isAlma).toBe(true);
  });

  it("isAlma defaults to false; canonical snapshot behavior unchanged", () => {
    const snap = composedSnapshot(db, userId, ["mentora"]);
    expect(snap.isAlma).toBe(false);
    expect(snap.personas).toEqual(["mentora"]);
  });

  it("isAlma=true, includeIdentity=false → identity still composes (Alma override)", () => {
    const snap = composedSnapshot(db, userId, [], null, null, null, false, true);
    expect(snap.layers).toContain("self.soul");
    expect(snap.layers).toContain("self.doctrine");
    expect(snap.layers).toContain("ego.identity");
  });
});

/**
 * CV1.E9.S4 — manual override semantics. The pipeline-level wiring
 * (parse forced_destination from query, branch composer, stamp meta)
 * lives in adapters/web/index.tsx and is exercised end-to-end by the
 * S5 manual smoke test guide. The unit-test surface is the pure
 * composer choice given an isAlma vs forced-persona resolution: the
 * Alma path produces the Alma preamble + identity-always; the
 * canonical path with a forced single persona produces that persona's
 * block (and identity gated by the touchesIdentity argument the caller
 * passes).
 */
describe("manual destination override resolution (CV1.E9.S4)", () => {
  let db: Database.Database;
  let userId: string;

  beforeEach(() => {
    db = openDb(":memory:");
    userId = createUser(db, "alice", "hash").id;
    setIdentityLayer(db, userId, "self", "soul", "SOUL_BLOCK");
    setIdentityLayer(db, userId, "self", "doctrine", "DOCTRINE_BLOCK");
    setIdentityLayer(db, userId, "ego", "identity", "IDENTITY_BLOCK");
    setIdentityLayer(db, userId, "ego", "behavior", "BEHAVIOR_BLOCK");
    setIdentityLayer(db, userId, "persona", "mentora", "MENTORA_BLOCK");
    setIdentityLayer(db, userId, "persona", "estrategista", "ESTRATEGISTA_BLOCK");
  });

  it("forced=alma → Alma composer engages even when reception said is_self_moment=false", () => {
    // Simulates the pipeline decision: forced wins over reception.
    const isAlma = true; // pipeline computed: forcedDestination?.type === 'alma'
    const prompt = isAlma
      ? composeAlmaPrompt(db, userId, undefined, undefined)
      : "should-not-happen";
    expect(prompt).toContain(ALMA_PREAMBLE);
    expect(prompt).toContain("SOUL_BLOCK");
    expect(prompt).toContain("DOCTRINE_BLOCK");
    expect(prompt).toContain("IDENTITY_BLOCK");
    expect(prompt).not.toContain("MENTORA_BLOCK");
  });

  it("forced=persona:mentora → canonical composer engages with [mentora] only", () => {
    // The pipeline branches to composeSystemPrompt with the forced key,
    // overriding reception's persona pick. We test the composer's
    // behavior given that branch.
    const personasForRun = ["mentora"];
    const prompt = composeSystemPrompt(db, userId, personasForRun, undefined, {
      touchesIdentity: true, // S4 forces identity on for forced-persona turns
    });
    expect(prompt).toContain("MENTORA_BLOCK");
    expect(prompt).not.toContain("ESTRATEGISTA_BLOCK");
    expect(prompt).toContain("SOUL_BLOCK");
    expect(prompt).not.toContain(ALMA_PREAMBLE);
  });

  it("no override → reception's verdict drives composition (canonical path)", () => {
    // Simulate reception picking [estrategista], no Alma flag.
    const isAlma = false;
    const personasForRun: string[] = ["estrategista"];
    const prompt = isAlma
      ? composeAlmaPrompt(db, userId)
      : composeSystemPrompt(db, userId, personasForRun, undefined, {
          touchesIdentity: false,
        });
    expect(prompt).toContain("ESTRATEGISTA_BLOCK");
    expect(prompt).not.toContain("MENTORA_BLOCK");
    expect(prompt).not.toContain(ALMA_PREAMBLE);
    // touchesIdentity:false from reception → soul/doctrine/identity skipped.
    expect(prompt).not.toContain("SOUL_BLOCK");
    expect(prompt).not.toContain("DOCTRINE_BLOCK");
  });
});
