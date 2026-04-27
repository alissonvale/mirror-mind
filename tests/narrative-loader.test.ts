import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rmSync } from "node:fs";
import { randomBytes } from "node:crypto";
import type Database from "better-sqlite3";
import { openDb } from "../server/db.js";
import { loadNarrative } from "../server/import/narrative-loader.js";

/**
 * End-to-end probe of the narrative loader against the real
 * `docs/product-use-narrative/` tree. Runs in-memory so it doesn't
 * touch dev data, and writes tokens to a per-test temp file so it
 * doesn't pollute the production `.tokens.local` on disk.
 *
 * Specific to CV2.E1.S5: validates the locale plumbing — antonio-castro
 * lands with locale='pt-BR' (declared in profile.md frontmatter), while
 * the original Reilly/Marchetti tenants keep locale='en'.
 */
describe("narrative loader — CV2.E1.S5 locale plumbing", () => {
  let db: Database.Database;
  let tokensPath: string;

  beforeEach(() => {
    db = openDb(":memory:");
    tokensPath = join(
      tmpdir(),
      `mirror-mind-narrative-tokens-${randomBytes(8).toString("hex")}.json`,
    );
  });

  afterEach(() => {
    try {
      rmSync(tokensPath, { force: true });
    } catch {
      // ignore — file may not exist if the test never wrote it
    }
  });

  it("provisions antonio-castro with locale='pt-BR'", () => {
    loadNarrative(db, { tokensPath });
    const row = db
      .prepare("SELECT name, locale FROM users WHERE name = ?")
      .get("Antonio Castro") as { name: string; locale: string } | undefined;
    expect(row).toBeDefined();
    expect(row!.locale).toBe("pt-BR");
  });

  it("keeps existing American tenants on locale='en'", () => {
    loadNarrative(db, { tokensPath });
    const englishTenants = ["Dan Reilly", "Elena Marchetti", "Eli Reilly", "Nora Reilly"];
    for (const name of englishTenants) {
      const row = db
        .prepare("SELECT locale FROM users WHERE name = ?")
        .get(name) as { locale: string } | undefined;
      expect(row, `tenant ${name} should exist`).toBeDefined();
      expect(row!.locale, `tenant ${name} should be 'en'`).toBe("en");
    }
  });

  it("loads antonio-castro identity layers (self/soul + ego/{identity,behavior,expression} + 5 personas in pt-BR)", () => {
    loadNarrative(db, { tokensPath });
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
      "persona/criador",
      "persona/escritor",
      "persona/pai",
      "persona/marido",
      "persona/filho",
    ]);
    const actual = new Set(layers.map((l) => `${l.layer}/${l.key}`));
    for (const key of expected) {
      expect(actual.has(key), `missing identity layer ${key}`).toBe(true);
    }
  });

  it("loads antonio-castro organizations (pages-inteiras, lagoa-letras)", () => {
    loadNarrative(db, { tokensPath });
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
    loadNarrative(db, { tokensPath });
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
    loadNarrative(db, { tokensPath });
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
    loadNarrative(db, { tokensPath });
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
    loadNarrative(db, { tokensPath });
    loadNarrative(db, { tokensPath });
    const row = db
      .prepare("SELECT locale FROM users WHERE name = ?")
      .get("Antonio Castro") as { locale: string } | undefined;
    expect(row!.locale).toBe("pt-BR");
  });

  // CV2.E1.S5b — Bia Lima: second pt-BR tenant, coabita com Antonio.
  it("provisions bia-lima with locale='pt-BR'", () => {
    loadNarrative(db, { tokensPath });
    const row = db
      .prepare("SELECT name, locale FROM users WHERE name = ?")
      .get("Bia Lima") as { name: string; locale: string } | undefined;
    expect(row).toBeDefined();
    expect(row!.locale).toBe("pt-BR");
  });

  it("loads bia-lima identity layers (4 personas: medica, mae, esposa, amiga)", () => {
    loadNarrative(db, { tokensPath });
    const userId = (
      db.prepare("SELECT id FROM users WHERE name = ?").get("Bia Lima") as
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
      "persona/medica",
      "persona/mae",
      "persona/esposa",
      "persona/amiga",
    ]);
    const actual = new Set(layers.map((l) => `${l.layer}/${l.key}`));
    for (const key of expected) {
      expect(actual.has(key), `missing identity layer ${key}`).toBe(true);
    }
  });

  it("loads bia-lima organizations + journeys + conversations", () => {
    loadNarrative(db, { tokensPath });
    const userId = (
      db.prepare("SELECT id FROM users WHERE name = ?").get("Bia Lima") as
        | { id: string }
        | undefined
    )?.id;

    const orgs = new Set(
      (
        db.prepare("SELECT key FROM organizations WHERE user_id = ?").all(userId) as Array<{
          key: string;
        }>
      ).map((o) => o.key),
    );
    expect(orgs.has("hospital-sao-luis")).toBe(true);
    expect(orgs.has("acadepe")).toBe(true);

    const journeys = new Set(
      (
        db.prepare("SELECT key FROM journeys WHERE user_id = ?").all(userId) as Array<{
          key: string;
        }>
      ).map((j) => j.key),
    );
    expect(journeys.has("a-coordenacao")).toBe(true);
    expect(journeys.has("antonio-distante")).toBe(true);
    expect(journeys.has("lara")).toBe(true);
    expect(journeys.has("tonico-na-tela")).toBe(true);
    expect(journeys.has("as-amigas-de-bh")).toBe(true);

    const sessions = db
      .prepare("SELECT title FROM sessions WHERE user_id = ?")
      .all(userId) as Array<{ title: string }>;
    expect(sessions.length).toBeGreaterThanOrEqual(5);
    const titles = new Set(sessions.map((s) => s.title));
    expect(titles.has("A alta da Manuela")).toBe(true);
    expect(titles.has("Recusei a coordenação")).toBe(true);
  });

  it("antonio-castro lands with role='admin' (Brazilian household host)", () => {
    loadNarrative(db, { tokensPath });
    const row = db
      .prepare("SELECT name, role FROM users WHERE name = ?")
      .get("Antonio Castro") as { name: string; role: string } | undefined;
    expect(row).toBeDefined();
    expect(row!.role).toBe("admin");
  });

  it("bia-lima stays as role='user' (not admin)", () => {
    loadNarrative(db, { tokensPath });
    const row = db
      .prepare("SELECT role FROM users WHERE name = ?")
      .get("Bia Lima") as { role: string } | undefined;
    expect(row!.role).toBe("user");
  });

  it("antonio and bia exist as isolated tenants — no cross-user data", () => {
    loadNarrative(db, { tokensPath });
    const antonioId = (
      db.prepare("SELECT id FROM users WHERE name = ?").get("Antonio Castro") as
        | { id: string }
        | undefined
    )?.id;
    const biaId = (
      db.prepare("SELECT id FROM users WHERE name = ?").get("Bia Lima") as
        | { id: string }
        | undefined
    )?.id;
    expect(antonioId).toBeDefined();
    expect(biaId).toBeDefined();
    expect(antonioId).not.toBe(biaId);

    // Antonio's organizations don't appear under Bia and vice versa.
    const antonioOrgs = new Set(
      (
        db
          .prepare("SELECT key FROM organizations WHERE user_id = ?")
          .all(antonioId) as Array<{ key: string }>
      ).map((o) => o.key),
    );
    const biaOrgs = new Set(
      (
        db
          .prepare("SELECT key FROM organizations WHERE user_id = ?")
          .all(biaId) as Array<{ key: string }>
      ).map((o) => o.key),
    );
    expect(antonioOrgs.has("pages-inteiras")).toBe(true);
    expect(biaOrgs.has("pages-inteiras")).toBe(false);
    expect(biaOrgs.has("hospital-sao-luis")).toBe(true);
    expect(antonioOrgs.has("hospital-sao-luis")).toBe(false);
  });
});
