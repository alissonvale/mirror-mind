import { describe, it, expect, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import { openDb } from "../server/db.js";
import { loadNarrative } from "../server/import/narrative-loader.js";

/**
 * End-to-end probe of the narrative loader against the real
 * `docs/product-use-narrative/` tree. Runs in-memory so it doesn't
 * touch dev data.
 *
 * Specific to CV2.E1.S5: validates the locale plumbing — antonio-castro
 * lands with locale='pt-BR' (declared in profile.md frontmatter), while
 * the original Reilly/Marchetti tenants keep locale='en'.
 */
describe("narrative loader — CV2.E1.S5 locale plumbing", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = openDb(":memory:");
  });

  it("provisions antonio-castro with locale='pt-BR'", () => {
    loadNarrative(db);
    const row = db
      .prepare("SELECT name, locale FROM users WHERE name = ?")
      .get("Antonio Castro") as { name: string; locale: string } | undefined;
    expect(row).toBeDefined();
    expect(row!.locale).toBe("pt-BR");
  });

  it("keeps existing American tenants on locale='en'", () => {
    loadNarrative(db);
    const englishTenants = ["Dan Reilly", "Elena Marchetti", "Eli Reilly", "Nora Reilly"];
    for (const name of englishTenants) {
      const row = db
        .prepare("SELECT locale FROM users WHERE name = ?")
        .get(name) as { locale: string } | undefined;
      expect(row, `tenant ${name} should exist`).toBeDefined();
      expect(row!.locale, `tenant ${name} should be 'en'`).toBe("en");
    }
  });

  it("loads antonio-castro identity layers (self/soul + ego/{identity,behavior,expression} + 5 personas)", () => {
    loadNarrative(db);
    const userId = (
      db.prepare("SELECT id FROM users WHERE name = ?").get("Antonio Castro") as
        | { id: string }
        | undefined
    )?.id;
    expect(userId).toBeDefined();

    const layers = db
      .prepare("SELECT layer, key FROM identity WHERE user_id = ? ORDER BY layer, key")
      .all(userId) as Array<{ layer: string; key: string }>;

    const expected = new Set([
      "self/soul",
      "ego/identity",
      "ego/behavior",
      "ego/expression",
      "persona/creator",
      "persona/writer",
      "persona/father",
      "persona/husband",
      "persona/son",
    ]);
    const actual = new Set(layers.map((l) => `${l.layer}/${l.key}`));
    for (const key of expected) {
      expect(actual.has(key), `missing identity layer ${key}`).toBe(true);
    }
  });

  it("loads antonio-castro organizations (pages-inteiras, lagoa-letras)", () => {
    loadNarrative(db);
    const userId = (
      db.prepare("SELECT id FROM users WHERE name = ?").get("Antonio Castro") as
        | { id: string }
        | undefined
    )?.id;

    const orgs = db
      .prepare("SELECT key FROM organizations WHERE user_id = ? ORDER BY key")
      .all(userId) as Array<{ key: string }>;
    const keys = new Set(orgs.map((o) => o.key));
    expect(keys.has("pages-inteiras")).toBe(true);
    expect(keys.has("lagoa-letras")).toBe(true);
  });

  it("loads antonio-castro journeys (5 journeys)", () => {
    loadNarrative(db);
    const userId = (
      db.prepare("SELECT id FROM users WHERE name = ?").get("Antonio Castro") as
        | { id: string }
        | undefined
    )?.id;

    const journeys = db
      .prepare("SELECT key FROM journeys WHERE user_id = ? ORDER BY key")
      .all(userId) as Array<{ key: string }>;
    const keys = new Set(journeys.map((j) => j.key));
    expect(keys.has("o-livro")).toBe(true);
    expect(keys.has("voltar-a-bh")).toBe(true);
    expect(keys.has("pos-lancamento")).toBe(true);
    expect(keys.has("bia-saturada")).toBe(true);
    expect(keys.has("tonico-cresce")).toBe(true);
  });

  it("loads antonio-castro conversations (5 sessions)", () => {
    loadNarrative(db);
    const userId = (
      db.prepare("SELECT id FROM users WHERE name = ?").get("Antonio Castro") as
        | { id: string }
        | undefined
    )?.id;

    const sessions = db
      .prepare("SELECT title FROM sessions WHERE user_id = ?")
      .all(userId) as Array<{ title: string }>;
    expect(sessions.length).toBeGreaterThanOrEqual(5);

    const titles = new Set(sessions.map((s) => s.title));
    // Presence of one canonical title from each persona arc is enough
    // to validate the conversation parser ran on each file.
    expect(titles.has("O algoritmo me odeia")).toBe(true);
    expect(titles.has("Voltei a abrir o livro")).toBe(true);
  });

  it("links pos-lancamento journey to pages-inteiras organization", () => {
    loadNarrative(db);
    const userId = (
      db.prepare("SELECT id FROM users WHERE name = ?").get("Antonio Castro") as
        | { id: string }
        | undefined
    )?.id;

    const row = db
      .prepare(
        `SELECT o.key as org_key
         FROM journeys j
         LEFT JOIN organizations o ON j.organization_id = o.id
         WHERE j.user_id = ? AND j.key = 'pos-lancamento'`,
      )
      .get(userId) as { org_key: string | null } | undefined;
    expect(row?.org_key).toBe("pages-inteiras");
  });

  it("re-running the loader keeps locale stable on existing antonio-castro", () => {
    loadNarrative(db);
    loadNarrative(db);
    const row = db
      .prepare("SELECT locale FROM users WHERE name = ?")
      .get("Antonio Castro") as { locale: string } | undefined;
    expect(row!.locale).toBe("pt-BR");
  });
});
