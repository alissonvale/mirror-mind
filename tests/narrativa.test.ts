import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { Hono } from "hono";
import {
  openDb,
  createUser,
  setIdentityLayer,
  setIdentitySummary,
} from "../server/db.js";
import {
  composeNarrativa,
  parseLayer,
} from "../server/portraits/narrativa-synthesis.js";
import { setupWeb } from "../adapters/web/index.js";

function setup() {
  const db = openDb(":memory:");
  const tokenHash = createHash("sha256").update("t").digest("hex");
  const user = createUser(db, "Antonio", tokenHash);
  return { db, user };
}

describe("parseLayer — pure (CV1.E14)", () => {
  it("strips the H1, captures preamble, and splits sections by H2", () => {
    const content = `# Soul

Eu sou alguém que confia na palavra.

## Quem eu sou

Sou mineiro num registro que ninguém ensina.

Carrego o nome do meu pai.

## Princípios

A palavra precisa.`;
    const parsed = parseLayer(content, "/map/self/soul");
    expect(parsed.isEmpty).toBe(false);
    expect(parsed.preamble).toEqual([
      "Eu sou alguém que confia na palavra.",
    ]);
    expect(parsed.subsections).toHaveLength(2);
    expect(parsed.subsections[0]!.heading).toBe("Quem eu sou");
    expect(parsed.subsections[0]!.paragraphs).toHaveLength(2);
    expect(parsed.subsections[1]!.heading).toBe("Princípios");
    expect(parsed.editPath).toBe("/map/self/soul");
  });

  it("returns isEmpty=true for empty content", () => {
    expect(parseLayer("", "/x").isEmpty).toBe(true);
    expect(parseLayer("   ", "/x").isEmpty).toBe(true);
  });

  it("returns isEmpty=true when content is only the H1", () => {
    expect(parseLayer("# Soul", "/x").isEmpty).toBe(true);
    expect(parseLayer("# Soul\n\n", "/x").isEmpty).toBe(true);
  });

  it("handles content with no H2 (only preamble)", () => {
    const parsed = parseLayer(
      "# Identity\n\nFirst paragraph.\n\nSecond paragraph.",
      "/x",
    );
    expect(parsed.isEmpty).toBe(false);
    expect(parsed.preamble).toHaveLength(2);
    expect(parsed.subsections).toEqual([]);
  });
});

describe("composeNarrativa — integration", () => {
  it("composes alma + identidade + comportamento + expressão + elenco", () => {
    const { db, user } = setup();
    setIdentityLayer(db, user.id, "self", "soul", "# Soul\n\n## Quem eu sou\n\nLede.");
    setIdentityLayer(db, user.id, "ego", "identity", "# Identity\n\n## O que faço\n\nBody.");
    setIdentityLayer(db, user.id, "ego", "behavior", "# Behavior\n\n## Como respondo\n\nBody.");
    setIdentityLayer(db, user.id, "ego", "expression", "# Expression\n\n## Vocabulário\n\nBody.");
    setIdentityLayer(db, user.id, "persona", "marido", "# Marido\n\nLede do marido.");
    setIdentitySummary(db, user.id, "persona", "marido", "trabalha o casamento");

    const state = composeNarrativa(db, user.id);

    expect(state.alma.isEmpty).toBe(false);
    expect(state.alma.subsections[0]!.heading).toBe("Quem eu sou");
    expect(state.identidade.subsections[0]!.heading).toBe("O que faço");
    expect(state.comportamento.subsections[0]!.heading).toBe("Como respondo");
    expect(state.expressao.subsections[0]!.heading).toBe("Vocabulário");
    expect(state.elenco).toHaveLength(1);
    expect(state.elenco[0]!.key).toBe("marido");
    expect(state.elenco[0]!.descriptor).toBe("trabalha o casamento");
    expect(state.elenco[0]!.portraitPath).toBe("/personas/marido");
  });

  it("each layer carries the correct edit path", () => {
    const { db, user } = setup();
    const state = composeNarrativa(db, user.id);
    expect(state.alma.editPath).toBe("/map/self/soul");
    expect(state.identidade.editPath).toBe("/map/ego/identity");
    expect(state.comportamento.editPath).toBe("/map/ego/behavior");
    expect(state.expressao.editPath).toBe("/map/ego/expression");
  });

  it("layers are isEmpty when not written", () => {
    const { db, user } = setup();
    const state = composeNarrativa(db, user.id);
    expect(state.alma.isEmpty).toBe(true);
    expect(state.identidade.isEmpty).toBe(true);
    expect(state.comportamento.isEmpty).toBe(true);
    expect(state.expressao.isEmpty).toBe(true);
    expect(state.elenco).toEqual([]);
  });

  it("personas are sorted by sort_order then key", () => {
    const { db, user } = setup();
    setIdentityLayer(db, user.id, "persona", "zebra", "# Zebra");
    setIdentityLayer(db, user.id, "persona", "alpha", "# Alpha");
    const state = composeNarrativa(db, user.id);
    expect(state.elenco.map((p) => p.key)).toEqual(["alpha", "zebra"]);
  });
});

describe("/narrativa route", () => {
  it("GET /narrativa returns 200 with the narrativa HTML", async () => {
    const { db, user } = setup();
    setIdentityLayer(db, user.id, "self", "soul", "# Soul\n\nMy soul lede.");

    const token = "tok";
    const tokenHash = createHash("sha256").update(token).digest("hex");
    db.prepare("UPDATE users SET token_hash = ? WHERE id = ?").run(
      tokenHash,
      user.id,
    );

    const app = new Hono<any>();
    setupWeb(app, db);

    const res = await app.request("/narrativa", {
      headers: { Cookie: `mirror_token=${token}` },
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    // Bookplate carries the user name.
    expect(html).toContain("Antonio");
    // Section labels — test app default locale is en, so SOUL/IDENTITY/etc.
    expect(html).toMatch(/SOUL|ALMA/);
    expect(html).toMatch(/IDENTITY|IDENTIDADE/);
    expect(html).toMatch(/BEHAVIOR|COMPORTAMENTO/);
    expect(html).toMatch(/EXPRESSION|EXPRESSÃO/);
    expect(html).toMatch(/CAST|ELENCO/);
    // Soul lede renders in body.
    expect(html).toContain("My soul lede.");
    // Single edit link in footer pointing to /map.
    expect(html).toContain('href="/map"');
  });

  it("GET /narrative (en alias) returns the same page", async () => {
    const { db, user } = setup();
    const token = "tok";
    const tokenHash = createHash("sha256").update(token).digest("hex");
    db.prepare("UPDATE users SET token_hash = ? WHERE id = ?").run(
      tokenHash,
      user.id,
    );
    const app = new Hono<any>();
    setupWeb(app, db);
    const res = await app.request("/narrative", {
      headers: { Cookie: `mirror_token=${token}` },
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toMatch(/SOUL|ALMA/);
  });

  it("renders stub block when a layer is unwritten", async () => {
    const { db, user } = setup();
    // Only the soul is written; the three others stay unwritten.
    setIdentityLayer(db, user.id, "self", "soul", "# Soul\n\nBody.");

    const token = "tok";
    const tokenHash = createHash("sha256").update(token).digest("hex");
    db.prepare("UPDATE users SET token_hash = ? WHERE id = ?").run(
      tokenHash,
      user.id,
    );
    const app = new Hono<any>();
    setupWeb(app, db);
    const res = await app.request("/narrativa", {
      headers: { Cookie: `mirror_token=${token}` },
    });
    const html = await res.text();
    // Three stub blocks — one per unwritten ego layer. The edit link
    // inside each stub points to the workshop URL.
    expect(html).toContain('href="/map/ego/identity"');
    expect(html).toContain('href="/map/ego/behavior"');
    expect(html).toContain('href="/map/ego/expression"');
  });
});
