import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import {
  openDb,
  createUser,
  setIdentityLayer,
  setIdentitySummary,
  setPersonaColor,
  createScene,
  setScenePersonas,
  createJourney,
  getOrCreateSession,
  appendEntry,
  getIdentityLayers,
} from "../server/db.js";
import {
  composePersonaPortrait,
  parsePersonaContent,
} from "../server/portraits/persona-synthesis.js";

function setup() {
  const db = openDb(":memory:");
  const tokenHash = createHash("sha256").update("t").digest("hex");
  const user = createUser(db, "Antonio", tokenHash);
  return { db, user };
}

const MARIDO_CONTENT = `# Marido

Eu sou o ângulo do espelho que trabalha com ele o casamento. Bia e Antonio estão juntos há 12 anos. Não é casamento em crise. É casamento adulto com fricção real e acumulada.

## Profundidade

Conheço a Bia. Beatriz Lima, 38, pediatra.

## Postura

Trabalho com ele a relação real, não o casamento como tema de coluna. Quando ele me traz uma cena com Bia, eu fico com a cena.

Não tomo partido. Não estou do lado do Antonio nem do lado da Bia. Estou do lado do casamento, o que às vezes significa dizer ao Antonio coisas que ele não quer ouvir.

Reconheço onde Bia tem razão e Antonio sabe que ela tem razão e ele está adiando admitir. Eu nomeio. Sem moralismo, mas claro.

## Anti-padrões

Não recomendo conversa de DR aleatoriamente.

Não dou check-list de "como melhorar o casamento".

Não cito a frase "comunicação é tudo".

Não acelero a conversa.

## Exemplo

[example response — should be ignored by parser]
`;

describe("parsePersonaContent — pure (CV1.E13.S4)", () => {
  it("extracts lede + posture paragraphs + anti-pattern lines", () => {
    const sections = parsePersonaContent(MARIDO_CONTENT);
    expect(sections.lede).toContain("ângulo do espelho");
    expect(sections.posture).not.toBeNull();
    expect(sections.posture!.length).toBe(3);
    expect(sections.posture![1]).toContain("Não tomo partido");
    expect(sections.antipatterns).not.toBeNull();
    expect(sections.antipatterns!.length).toBe(4);
    expect(sections.antipatterns![0]).toContain("DR aleatoriamente");
  });

  it("returns nulls when content is empty", () => {
    const sections = parsePersonaContent("");
    expect(sections.lede).toBeNull();
    expect(sections.posture).toBeNull();
    expect(sections.antipatterns).toBeNull();
  });

  it("handles content without Postura/Anti-padrões headings", () => {
    const sections = parsePersonaContent(
      "# Persona\n\nJust a plain paragraph with no sections at all.",
    );
    expect(sections.lede).toContain("Just a plain");
    expect(sections.posture).toBeNull();
    expect(sections.antipatterns).toBeNull();
  });

  it("matches English heading variants (Posture / Anti-patterns)", () => {
    const en = `# Coach

Lede paragraph.

## Posture

I show up.

## Anti-patterns

I don't moralize.

I don't fix.
`;
    const sections = parsePersonaContent(en);
    expect(sections.posture).not.toBeNull();
    expect(sections.posture![0]).toBe("I show up.");
    expect(sections.antipatterns).not.toBeNull();
    expect(sections.antipatterns!.length).toBe(2);
  });
});

describe("composePersonaPortrait — integration", () => {
  it("builds the portrait with sections, color, and where-it-appears", () => {
    const { db, user } = setup();
    setIdentityLayer(db, user.id, "persona", "marido", MARIDO_CONTENT);
    setPersonaColor(db, user.id, "marido", "#b88a6b");

    // Tag a journey + a scene to populate where-it-appears.
    createJourney(db, user.id, "bia-saturada", "Bia Saturada");
    const scene = createScene(db, user.id, "noite-com-bia", {
      title: "Noite com Bia",
    });
    setScenePersonas(db, scene.id, ["marido"]);

    // Tag a session via _persona meta on assistant entry.
    const sessionId = getOrCreateSession(db, user.id);
    appendEntry(db, sessionId, null, "message", {
      role: "user",
      content: [{ type: "text", text: "hi" }],
    });
    appendEntry(db, sessionId, null, "message", {
      role: "assistant",
      content: [{ type: "text", text: "hello" }],
      _persona: "marido",
      _journey: "bia-saturada",
    });
    db.prepare("UPDATE sessions SET title = ? WHERE id = ?").run(
      "Bia chegou em casa chorando",
      sessionId,
    );

    const layer = getIdentityLayers(db, user.id).find(
      (l) => l.layer === "persona" && l.key === "marido",
    )!;
    const portrait = composePersonaPortrait(db, user.id, layer);

    expect(portrait.color).toBe("#b88a6b");
    expect(portrait.lede).toContain("ângulo do espelho");
    expect(portrait.posture).not.toBeNull();
    expect(portrait.posture!.length).toBe(3);
    expect(portrait.antipatterns).not.toBeNull();
    expect(portrait.antipatterns!.length).toBe(4);

    // Where it appears
    expect(portrait.whereItAppears.journeys).toHaveLength(1);
    expect(portrait.whereItAppears.journeys[0]!.name).toBe("Bia Saturada");
    expect(portrait.whereItAppears.scenes).toHaveLength(1);
    expect(portrait.whereItAppears.scenes[0]!.title).toBe("Noite com Bia");

    // Tiles (count + recency)
    expect(portrait.tiles).toHaveLength(2);
    expect(portrait.tiles[0]!.number).toBe("1 conversa");
    expect(portrait.tiles[0]!.label).toContain("desta voz");

    // Conversations populated
    expect(portrait.conversationsEmpty).toBe(false);
    expect(portrait.conversations[0]!.title).toBe("Bia chegou em casa chorando");
  });

  it("renders cleanly when persona has no sections beyond a one-liner", () => {
    const { db, user } = setup();
    setIdentityLayer(db, user.id, "persona", "minimal", "# Minimal\n\nA short voice.");
    const layer = getIdentityLayers(db, user.id).find(
      (l) => l.layer === "persona" && l.key === "minimal",
    )!;
    const portrait = composePersonaPortrait(db, user.id, layer);

    expect(portrait.lede).toBe("A short voice.");
    expect(portrait.posture).toBeNull();
    expect(portrait.antipatterns).toBeNull();
    expect(portrait.tiles).toEqual([]);
    expect(portrait.conversationsEmpty).toBe(true);
  });

  it("color falls back to hash-derived when identity.color is null", () => {
    const { db, user } = setup();
    setIdentityLayer(db, user.id, "persona", "uncolored", "# X\n\nLede.");
    // setIdentityLayer seeded a hash color; clear it to test fallback.
    db.prepare(
      "UPDATE identity SET color = NULL WHERE user_id = ? AND layer = 'persona' AND key = 'uncolored'",
    ).run(user.id);

    const layer = getIdentityLayers(db, user.id).find(
      (l) => l.layer === "persona" && l.key === "uncolored",
    )!;
    const portrait = composePersonaPortrait(db, user.id, layer);

    // resolvePersonaColor returns a non-null hex even for null input.
    expect(portrait.color).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
});

describe("persona portrait routes", () => {
  it("GET /personas/:key returns 200 with the portrait HTML", async () => {
    const { Hono } = await import("hono");
    const { setupWeb } = await import("../adapters/web/index.js");
    const { db, user } = setup();
    setIdentityLayer(db, user.id, "persona", "marido", MARIDO_CONTENT);

    const token = "tok";
    const tokenHash = createHash("sha256").update(token).digest("hex");
    db.prepare("UPDATE users SET token_hash = ? WHERE id = ?").run(
      tokenHash,
      user.id,
    );

    const app = new Hono<any>();
    setupWeb(app, db);

    const res = await app.request("/personas/marido", {
      headers: { Cookie: `mirror_token=${token}` },
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain(">marido<");
    expect(html).toContain("ângulo do espelho");
    // Test app default locale is en — pt-BR ("POSTURA"/"ANTI-PADRÕES")
    // would render for tenants with users.locale = 'pt-BR'.
    expect(html).toMatch(/POSTURE|POSTURA/);
    expect(html).toMatch(/ANTI-PATTERNS|ANTI-PADRÕES/);
    expect(html).toContain('data-entity="persona"');
  });

  it("GET /personas/:key returns 404 for an unknown key", async () => {
    const { Hono } = await import("hono");
    const { setupWeb } = await import("../adapters/web/index.js");
    const { db, user } = setup();
    const token = "tok";
    const tokenHash = createHash("sha256").update(token).digest("hex");
    db.prepare("UPDATE users SET token_hash = ? WHERE id = ?").run(
      tokenHash,
      user.id,
    );
    const app = new Hono<any>();
    setupWeb(app, db);
    const res = await app.request("/personas/ghost", {
      headers: { Cookie: `mirror_token=${token}` },
    });
    expect(res.status).toBe(404);
  });

  it("GET /personas/:key/edit redirects to legacy workshop URL", async () => {
    const { Hono } = await import("hono");
    const { setupWeb } = await import("../adapters/web/index.js");
    const { db, user } = setup();
    setIdentityLayer(db, user.id, "persona", "marido", "# Marido\n\nLede.");
    const token = "tok";
    const tokenHash = createHash("sha256").update(token).digest("hex");
    db.prepare("UPDATE users SET token_hash = ? WHERE id = ?").run(
      tokenHash,
      user.id,
    );
    const app = new Hono<any>();
    setupWeb(app, db);

    const res = await app.request("/personas/marido/edit", {
      headers: { Cookie: `mirror_token=${token}` },
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/map/persona/marido");
  });
});
