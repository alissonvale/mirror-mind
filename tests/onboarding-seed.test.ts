import { describe, it, expect, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import {
  openDb,
  getUserByName,
  getIdentityLayers,
  getSceneByKey,
} from "../server/db.js";
import { provisionUser } from "../server/admin.js";

describe("provisionUser onboarding seed (CV1.E11.S6)", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = openDb(":memory:");
  });

  it("creates the user with name + token", () => {
    const result = provisionUser(db, "freshuser");
    expect(result.user.name).toBe("freshuser");
    expect(result.token).toMatch(/^[0-9a-f]{64}$/);
    expect(getUserByName(db, "freshuser")?.id).toBe(result.user.id);
  });

  it("seeds ego/behavior and ego/expression from templates (pre-S6 baseline preserved)", () => {
    const result = provisionUser(db, "u");
    const layers = getIdentityLayers(db, result.user.id);
    const behavior = layers.find((l) => l.layer === "ego" && l.key === "behavior");
    const expression = layers.find(
      (l) => l.layer === "ego" && l.key === "expression",
    );
    expect(behavior?.content?.length ?? 0).toBeGreaterThan(0);
    expect(expression?.content?.length ?? 0).toBeGreaterThan(0);
  });

  it("seeds self/doctrine from docs/seed/alisson/doctrine.md when present", () => {
    const result = provisionUser(db, "u");
    expect(result.seeded.doctrine).toBe(true);
    const layers = getIdentityLayers(db, result.user.id);
    const doctrine = layers.find(
      (l) => l.layer === "self" && l.key === "doctrine",
    );
    expect(doctrine).toBeDefined();
    expect(doctrine?.content?.length ?? 0).toBeGreaterThan(100);
  });

  it("does NOT seed self/soul (left empty for the workshop's invitation to surface)", () => {
    const result = provisionUser(db, "u");
    const layers = getIdentityLayers(db, result.user.id);
    const soul = layers.find((l) => l.layer === "self" && l.key === "soul");
    expect(soul).toBeUndefined();
  });

  it("creates the Voz da Alma cena with voice='alma' and empty briefing", () => {
    const result = provisionUser(db, "u");
    expect(result.seeded.vozDaAlma).toBe(true);
    const cena = getSceneByKey(db, result.user.id, "voz-da-alma");
    expect(cena).toBeDefined();
    expect(cena?.title).toBe("Voz da Alma");
    expect(cena?.voice).toBe("alma");
    expect(cena?.briefing).toBe("");
  });

  it("returns the initial sessionId", () => {
    const result = provisionUser(db, "u");
    expect(result.sessionId).toMatch(/^[0-9a-f-]+$/);
    const sessRow = db
      .prepare("SELECT user_id FROM sessions WHERE id = ?")
      .get(result.sessionId) as { user_id: string };
    expect(sessRow.user_id).toBe(result.user.id);
  });

  it("throws (does not exit) when the user name already exists", () => {
    provisionUser(db, "duplicate");
    expect(() => provisionUser(db, "duplicate")).toThrow(/already exists/);
  });

  it("provisioning two users keeps their seeds isolated", () => {
    const a = provisionUser(db, "alpha");
    const b = provisionUser(db, "beta");
    const cenaA = getSceneByKey(db, a.user.id, "voz-da-alma");
    const cenaB = getSceneByKey(db, b.user.id, "voz-da-alma");
    expect(cenaA?.id).not.toBe(cenaB?.id);
    // Both have their own doctrine row (not shared)
    const doctrineA = getIdentityLayers(db, a.user.id).find(
      (l) => l.layer === "self" && l.key === "doctrine",
    );
    const doctrineB = getIdentityLayers(db, b.user.id).find(
      (l) => l.layer === "self" && l.key === "doctrine",
    );
    expect(doctrineA?.id).not.toBe(doctrineB?.id);
    expect(doctrineA?.content).toBe(doctrineB?.content); // same source file
  });
});
