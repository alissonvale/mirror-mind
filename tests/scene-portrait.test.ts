import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import {
  openDb,
  createUser,
  createScene,
  setScenePersonas,
  setIdentityLayer,
  setIdentitySummary,
  createOrganization,
  createJourney,
  getSceneById,
} from "../server/db.js";
import {
  composeScenePortrait,
  composeSceneLede,
  composeSceneClose,
} from "../server/portraits/scene-synthesis.js";

function setup() {
  const db = openDb(":memory:");
  const tokenHash = createHash("sha256").update("t").digest("hex");
  const user = createUser(db, "Antonio", tokenHash);
  return { db, user };
}

describe("composeSceneLede — pure (CV1.E13.S3)", () => {
  it("returns the briefing as-is when present", () => {
    const scene = {
      briefing: "Bia chegou de plantão. A casa está em silêncio.",
    } as any;
    expect(composeSceneLede(scene)).toContain("Bia chegou de plantão");
  });

  it("returns null when briefing is empty", () => {
    expect(composeSceneLede({ briefing: "" } as any)).toBeNull();
    expect(composeSceneLede({ briefing: "   " } as any)).toBeNull();
  });
});

describe("composeSceneClose — pure", () => {
  it("picks the last sentence of briefing as close", () => {
    const scene = {
      briefing:
        "Long briefing introduction here. The mirror here is the voice that helps me see the father I am becoming.",
    } as any;
    const close = composeSceneClose(scene);
    expect(close).not.toBeNull();
    expect(close!.text).toContain("father I am becoming");
    expect(close!.source).toBe("briefing");
  });

  it("returns null when last sentence is too short", () => {
    expect(composeSceneClose({ briefing: "Short." } as any)).toBeNull();
  });

  it("returns null when briefing is empty", () => {
    expect(composeSceneClose({ briefing: "" } as any)).toBeNull();
  });
});

describe("composeScenePortrait — integration", () => {
  it("persona-voiced cena returns kind=personas with cast list", () => {
    const { db, user } = setup();
    setIdentityLayer(db, user.id, "persona", "marido", "voice");
    setIdentitySummary(
      db,
      user.id,
      "persona",
      "marido",
      "o ângulo do espelho que trabalha o casamento",
    );
    const scene = createScene(db, user.id, "noite-com-bia", {
      title: "Noite — depois que a Bia chega",
      briefing: "Bia chegou de plantão. A casa está em silêncio.",
      temporal_pattern: "noites, depois dos plantões da Bia",
    });
    setScenePersonas(db, scene.id, ["marido"]);

    const fresh = getSceneById(db, scene.id, user.id)!;
    const portrait = composeScenePortrait(db, user.id, fresh);

    expect(portrait.cast.kind).toBe("personas");
    if (portrait.cast.kind === "personas") {
      expect(portrait.cast.personas).toHaveLength(1);
      expect(portrait.cast.personas[0]!.key).toBe("marido");
      expect(portrait.cast.personas[0]!.descriptor).toContain(
        "trabalha o casamento",
      );
    }
    expect(portrait.temporalPattern).toBe(
      "noites, depois dos plantões da Bia",
    );
    expect(portrait.lede).toContain("Bia chegou de plantão");
    expect(portrait.conversationsEmpty).toBe(true);
  });

  it("alma-voiced cena returns kind=alma regardless of personas table", () => {
    const { db, user } = setup();
    const scene = createScene(db, user.id, "voz-da-alma", {
      title: "Voz da Alma",
      voice: "alma",
      briefing: "",
    });
    const fresh = getSceneById(db, scene.id, user.id)!;
    const portrait = composeScenePortrait(db, user.id, fresh);

    expect(portrait.voice).toBe("alma");
    expect(portrait.cast.kind).toBe("alma");
    // Empty briefing → null lede, page renders the stub block.
    expect(portrait.lede).toBeNull();
  });

  it("territory section populates org and journey when both declared", () => {
    const { db, user } = setup();
    createOrganization(db, user.id, "pages-inteiras", "Pages Inteiras");
    createJourney(db, user.id, "o-livro", "O Livro");
    const scene = createScene(db, user.id, "escrita-do-livro", {
      title: "Sessão de escrita do livro",
      briefing: "Manhã cedo, antes da casa acordar.",
      organization_key: "pages-inteiras",
      journey_key: "o-livro",
    });
    const fresh = getSceneById(db, scene.id, user.id)!;
    const portrait = composeScenePortrait(db, user.id, fresh);

    expect(portrait.territory.org).toEqual({
      key: "pages-inteiras",
      name: "Pages Inteiras",
    });
    expect(portrait.territory.journey).toEqual({
      key: "o-livro",
      name: "O Livro",
    });
  });

  it("territory is fully null when scene is unscoped", () => {
    const { db, user } = setup();
    const scene = createScene(db, user.id, "free", { title: "Free Scene" });
    const fresh = getSceneById(db, scene.id, user.id)!;
    const portrait = composeScenePortrait(db, user.id, fresh);
    expect(portrait.territory.org).toBeNull();
    expect(portrait.territory.journey).toBeNull();
  });

  it("tiles emit conversation count + recency when sessions exist for the scene", () => {
    const { db, user } = setup();
    const scene = createScene(db, user.id, "s", { title: "S" });
    const sessionTs = Date.now() - 3 * 24 * 60 * 60 * 1000;
    db.prepare(
      "INSERT INTO sessions (id, user_id, scene_id, title, created_at) VALUES (?, ?, ?, ?, ?)",
    ).run("sess-1", user.id, scene.id, "First session", sessionTs);

    const fresh = getSceneById(db, scene.id, user.id)!;
    const portrait = composeScenePortrait(db, user.id, fresh);

    expect(portrait.tiles).toHaveLength(2);
    expect(portrait.tiles[0]!.number).toBe("1 conversa");
    expect(portrait.tiles[1]!.number).toMatch(/dias/);
  });

  it("tiles are empty when no sessions are linked to the scene", () => {
    const { db, user } = setup();
    const scene = createScene(db, user.id, "s", { title: "S" });
    const fresh = getSceneById(db, scene.id, user.id)!;
    const portrait = composeScenePortrait(db, user.id, fresh);
    expect(portrait.tiles).toEqual([]);
  });
});
