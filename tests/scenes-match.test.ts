import { describe, it, expect, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import {
  openDb,
  createUser,
  getOrCreateSession,
  setSessionScene,
  createScene,
  setScenePersonas,
} from "../server/db.js";
import type { ReceptionResult } from "../server/reception.js";
import { findMatchingScene } from "../server/scenes-match.js";

function receptor(overrides: Partial<ReceptionResult> = {}): ReceptionResult {
  return {
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
    ...overrides,
  };
}

describe("findMatchingScene (CV1.E11.S4)", () => {
  let db: Database.Database;
  let userId: string;

  beforeEach(() => {
    db = openDb(":memory:");
    const user = createUser(db, "alissonvale", "hash");
    userId = user.id;
  });

  it("trivial turn returns null even when other axes would match", () => {
    const cena = createScene(db, userId, "k", { title: "T" });
    setScenePersonas(db, cena.id, ["p"]);
    const r = receptor({ personas: ["p"], is_trivial: true });
    expect(findMatchingScene(db, userId, r)).toBeNull();
  });

  it("zero-cena tenant returns null", () => {
    const r = receptor({ personas: ["p"], is_self_moment: true });
    expect(findMatchingScene(db, userId, r)).toBeNull();
  });

  it("Alma match: is_self_moment=true + alma cena exists", () => {
    const alma = createScene(db, userId, "alma", {
      title: "Voz da Alma",
      voice: "alma",
    });
    const r = receptor({ is_self_moment: true });
    expect(findMatchingScene(db, userId, r)?.id).toBe(alma.id);
  });

  it("Alma wins over persona when both could match", () => {
    const alma = createScene(db, userId, "alma", {
      title: "Voz da Alma",
      voice: "alma",
    });
    const personaCena = createScene(db, userId, "p-cena", { title: "P" });
    setScenePersonas(db, personaCena.id, ["p"]);
    const r = receptor({ personas: ["p"], is_self_moment: true });
    expect(findMatchingScene(db, userId, r)?.id).toBe(alma.id);
  });

  it("falls through to persona match when is_self_moment=true but no alma cena exists", () => {
    const personaCena = createScene(db, userId, "p-cena", { title: "P" });
    setScenePersonas(db, personaCena.id, ["p"]);
    const r = receptor({ personas: ["p"], is_self_moment: true });
    expect(findMatchingScene(db, userId, r)?.id).toBe(personaCena.id);
  });

  it("persona match: leading persona ∈ cast + matching org + matching journey", () => {
    const cena = createScene(db, userId, "match", {
      title: "Match",
      organization_key: "org-a",
      journey_key: "j-a",
    });
    setScenePersonas(db, cena.id, ["p"]);
    const r = receptor({
      personas: ["p"],
      organization: "org-a",
      journey: "j-a",
    });
    expect(findMatchingScene(db, userId, r)?.id).toBe(cena.id);
  });

  it("persona match with both org and journey null on cena and receptor", () => {
    const cena = createScene(db, userId, "no-scope", { title: "T" });
    setScenePersonas(db, cena.id, ["p"]);
    const r = receptor({ personas: ["p"] });
    expect(findMatchingScene(db, userId, r)?.id).toBe(cena.id);
  });

  it("persona miss when cena requires org=X but receptor.organization=Y", () => {
    const cena = createScene(db, userId, "k", {
      title: "T",
      organization_key: "org-a",
    });
    setScenePersonas(db, cena.id, ["p"]);
    const r = receptor({ personas: ["p"], organization: "org-b" });
    expect(findMatchingScene(db, userId, r)).toBeNull();
  });

  it("persona miss when cena requires journey but receptor.journey=null", () => {
    const cena = createScene(db, userId, "k", {
      title: "T",
      journey_key: "j-a",
    });
    setScenePersonas(db, cena.id, ["p"]);
    const r = receptor({ personas: ["p"], journey: null });
    expect(findMatchingScene(db, userId, r)).toBeNull();
  });

  it("persona miss when leading persona not in any cast", () => {
    const cena = createScene(db, userId, "k", { title: "T" });
    setScenePersonas(db, cena.id, ["a", "b"]);
    const r = receptor({ personas: ["c"] });
    expect(findMatchingScene(db, userId, r)).toBeNull();
  });

  it("multi-match tie-break: most-recent activity wins", () => {
    const older = createScene(db, userId, "older", { title: "Older" });
    setScenePersonas(db, older.id, ["p"]);
    const newer = createScene(db, userId, "newer", { title: "Newer" });
    setScenePersonas(db, newer.id, ["p"]);

    // Link a session to `older` and bump its created_at far ahead so
    // listScenesForUser ranks it as the most-recent activity.
    const sessId = getOrCreateSession(db, userId);
    setSessionScene(db, sessId, userId, older.id);
    db.prepare("UPDATE sessions SET created_at = ? WHERE id = ?").run(
      Date.now() + 60_000,
      sessId,
    );

    const r = receptor({ personas: ["p"] });
    expect(findMatchingScene(db, userId, r)?.id).toBe(older.id);
  });

  it("empty receptor.personas with no alma cena returns null", () => {
    const cena = createScene(db, userId, "k", { title: "T" });
    setScenePersonas(db, cena.id, ["p"]);
    const r = receptor({ personas: [], is_self_moment: false });
    expect(findMatchingScene(db, userId, r)).toBeNull();
  });

  it("alma cena is skipped on the persona-match path", () => {
    // An alma cena sitting in the user's pool should NOT match a
    // non-self-moment turn just because the cast is empty (no alma
    // bleed into persona matching).
    createScene(db, userId, "alma", { title: "Alma", voice: "alma" });
    const r = receptor({ personas: ["p"], is_self_moment: false });
    expect(findMatchingScene(db, userId, r)).toBeNull();
  });
});
