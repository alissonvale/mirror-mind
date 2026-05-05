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

  it("seeds every narrative tenant with a Voz da Alma cena (CV1.E11.S5 follow-up)", () => {
    loadNarrative(db, { tokensPath });
    const tenants = ["Dan Reilly", "Elena Marchetti", "Antonio Castro"];
    for (const name of tenants) {
      const userId = (
        db.prepare("SELECT id FROM users WHERE name = ?").get(name) as
          | { id: string }
          | undefined
      )?.id;
      expect(userId, `tenant ${name} exists`).toBeDefined();
      const cena = db
        .prepare(
          "SELECT key, voice FROM scenes WHERE user_id = ? AND key = 'voz-da-alma'",
        )
        .get(userId!) as { key: string; voice: string } | undefined;
      expect(cena, `tenant ${name} has Voz da Alma cena`).toBeDefined();
      expect(cena!.voice).toBe("alma");
    }
  });

  it("Voz da Alma seed is idempotent across re-runs", () => {
    loadNarrative(db, { tokensPath });
    loadNarrative(db, { tokensPath });
    const userId = (
      db.prepare("SELECT id FROM users WHERE name = ?").get("Dan Reilly") as
        | { id: string }
        | undefined
    )?.id;
    const count = (
      db
        .prepare(
          "SELECT COUNT(*) as c FROM scenes WHERE user_id = ? AND key = 'voz-da-alma'",
        )
        .get(userId!) as { c: number }
    ).c;
    expect(count).toBe(1);
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

describe("parseSceneFile (CV1.E11.S5 follow-up)", () => {
  it("parses a persona-voice cena with all fields", async () => {
    const { parseSceneFile } = await import(
      "../server/import/narrative-loader.js"
    );
    const content = `# Sessão de escrita

**Voice:** persona
**Temporal:** terças 7h
**Organization:** pages-inteiras
**Journey:** o-livro
**Personas:** criador, escritor
**Mode:** essayistic
**Length:** standard

## Briefing

Conversa que acontece quando estou escrevendo o livro de manhã.`;
    const parsed = parseSceneFile(content);
    expect(parsed.title).toBe("Sessão de escrita");
    expect(parsed.voice).toBeNull();
    expect(parsed.temporal_pattern).toBe("terças 7h");
    expect(parsed.organization_key).toBe("pages-inteiras");
    expect(parsed.journey_key).toBe("o-livro");
    expect(parsed.personas).toEqual(["criador", "escritor"]);
    expect(parsed.response_mode).toBe("essayistic");
    expect(parsed.response_length).toBe("standard");
    expect(parsed.briefing).toContain("Conversa que acontece");
  });

  it("voice=alma forces personas to empty even if listed", async () => {
    const { parseSceneFile } = await import(
      "../server/import/narrative-loader.js"
    );
    const content = `# Voz da Alma

**Voice:** alma
**Personas:** ignored

## Briefing

body`;
    const parsed = parseSceneFile(content);
    expect(parsed.voice).toBe("alma");
    expect(parsed.personas).toEqual([]);
  });

  it("missing optional fields default to null/empty", async () => {
    const { parseSceneFile } = await import(
      "../server/import/narrative-loader.js"
    );
    const content = `# Minimal

## Briefing

body only`;
    const parsed = parseSceneFile(content);
    expect(parsed.voice).toBeNull();
    expect(parsed.temporal_pattern).toBeNull();
    expect(parsed.organization_key).toBeNull();
    expect(parsed.journey_key).toBeNull();
    expect(parsed.personas).toEqual([]);
    expect(parsed.response_mode).toBeNull();
    expect(parsed.response_length).toBeNull();
    expect(parsed.briefing).toBe("body only");
  });
});

describe("narrative loader — soul summary + inscriptions", () => {
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
      // ignore
    }
  });

  it("populates self/soul summary for every narrative tenant", () => {
    loadNarrative(db, { tokensPath });
    const tenants = [
      "Antonio Castro",
      "Bia Lima",
      "Dan Reilly",
      "Elena Marchetti",
      "Eli Reilly",
      "Nora Reilly",
    ];
    for (const name of tenants) {
      const row = db
        .prepare(
          `SELECT i.summary
           FROM identity i
           JOIN users u ON u.id = i.user_id
           WHERE u.name = ? AND i.layer = 'self' AND i.key = 'soul'`,
        )
        .get(name) as { summary: string | null } | undefined;
      expect(row, `tenant ${name} has self/soul row`).toBeDefined();
      expect(
        row!.summary,
        `tenant ${name} self/soul has summary`,
      ).toBeTruthy();
      // Defensive: the rendered SOU pane breaks when the summary leaks
      // markdown headings — assert the cleanup the synthesis depends on.
      expect(row!.summary!.startsWith("#")).toBe(false);
      expect(row!.summary!.startsWith("##")).toBe(false);
    }
  });

  it("seeds 3-5 inscriptions per tenant with at least one pinned", () => {
    loadNarrative(db, { tokensPath });
    const tenants = [
      "Antonio Castro",
      "Bia Lima",
      "Dan Reilly",
      "Elena Marchetti",
      "Eli Reilly",
      "Nora Reilly",
    ];
    for (const name of tenants) {
      const userId = (
        db.prepare("SELECT id FROM users WHERE name = ?").get(name) as
          | { id: string }
          | undefined
      )?.id;
      expect(userId, `tenant ${name} exists`).toBeDefined();
      const total = (
        db
          .prepare(
            "SELECT COUNT(*) as c FROM inscriptions WHERE user_id = ? AND archived_at IS NULL",
          )
          .get(userId!) as { c: number }
      ).c;
      expect(total, `tenant ${name} has 3-5 inscriptions`).toBeGreaterThanOrEqual(
        3,
      );
      expect(total, `tenant ${name} has 3-5 inscriptions`).toBeLessThanOrEqual(5);
      const pinned = (
        db
          .prepare(
            "SELECT COUNT(*) as c FROM inscriptions WHERE user_id = ? AND pinned_at IS NOT NULL",
          )
          .get(userId!) as { c: number }
      ).c;
      expect(pinned, `tenant ${name} has at least one pinned`).toBeGreaterThanOrEqual(
        1,
      );
    }
  });

  it("inscriptions seed is idempotent — re-runs do not duplicate or clobber", () => {
    loadNarrative(db, { tokensPath });
    const userId = (
      db.prepare("SELECT id FROM users WHERE name = ?").get("Dan Reilly") as
        | { id: string }
        | undefined
    )!.id;
    const firstCount = (
      db
        .prepare("SELECT COUNT(*) as c FROM inscriptions WHERE user_id = ?")
        .get(userId) as { c: number }
    ).c;
    expect(firstCount).toBeGreaterThan(0);

    loadNarrative(db, { tokensPath });
    const secondCount = (
      db
        .prepare("SELECT COUNT(*) as c FROM inscriptions WHERE user_id = ?")
        .get(userId) as { c: number }
    ).c;
    expect(secondCount).toBe(firstCount);
  });

  it("self-attributed inscriptions persist with author=null (bookplate carries the name)", () => {
    loadNarrative(db, { tokensPath });
    const tenants = [
      "Antonio Castro",
      "Bia Lima",
      "Dan Reilly",
      "Elena Marchetti",
      "Eli Reilly",
      "Nora Reilly",
    ];
    for (const name of tenants) {
      const userId = (
        db.prepare("SELECT id FROM users WHERE name = ?").get(name) as
          | { id: string }
          | undefined
      )!.id;
      const selfRows = db
        .prepare("SELECT author FROM inscriptions WHERE user_id = ? AND author = ?")
        .all(userId, name);
      expect(
        selfRows,
        `tenant ${name} should have no inscription persisted with their own name as author`,
      ).toHaveLength(0);
      // …but at least one of their authored lines should still be there
      // (with author=null), so the test isn't just passing because the
      // file is empty.
      const totalRows = db
        .prepare(
          "SELECT COUNT(*) as c FROM inscriptions WHERE user_id = ? AND author IS NULL",
        )
        .get(userId) as { c: number };
      expect(
        totalRows.c,
        `tenant ${name} should have at least one author=null inscription`,
      ).toBeGreaterThan(0);
    }
  });
});

describe("parseInscriptionLine", () => {
  it("parses a fully-formed line with author and pinned marker", async () => {
    const { parseInscriptionLine } = await import(
      "../server/import/narrative-loader.js"
    );
    const result = parseInscriptionLine(
      `- "Pay attention. This is the whole of it." — Nora Reilly *(pinned)*`,
    );
    expect(result).not.toBeNull();
    expect(result!.text).toBe("Pay attention. This is the whole of it.");
    expect(result!.author).toBe("Nora Reilly");
    expect(result!.pinned).toBe(true);
  });

  it("parses a line with author but no pin", async () => {
    const { parseInscriptionLine } = await import(
      "../server/import/narrative-loader.js"
    );
    const result = parseInscriptionLine(
      `- "Be joyful though you have considered all the facts." — Wendell Berry`,
    );
    expect(result).not.toBeNull();
    expect(result!.text).toBe(
      "Be joyful though you have considered all the facts.",
    );
    expect(result!.author).toBe("Wendell Berry");
    expect(result!.pinned).toBe(false);
  });

  it("parses a line with no author", async () => {
    const { parseInscriptionLine } = await import(
      "../server/import/narrative-loader.js"
    );
    const result = parseInscriptionLine(`- "Just text, no author."`);
    expect(result).not.toBeNull();
    expect(result!.text).toBe("Just text, no author.");
    expect(result!.author).toBeNull();
    expect(result!.pinned).toBe(false);
  });

  it("returns null for non-inscription lines", async () => {
    const { parseInscriptionLine } = await import(
      "../server/import/narrative-loader.js"
    );
    expect(parseInscriptionLine("# Heading")).toBeNull();
    expect(parseInscriptionLine("Some prose.")).toBeNull();
    expect(parseInscriptionLine("- bullet without a quoted phrase")).toBeNull();
    expect(parseInscriptionLine("")).toBeNull();
  });
});
