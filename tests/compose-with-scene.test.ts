import { describe, it, expect, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import {
  openDb,
  createUser,
  setIdentityLayer,
  createScene,
  createOrganization,
  createJourney,
} from "../server/db.js";
import {
  composeSystemPrompt,
  composeMinimalPrompt,
  renderSceneBlock,
} from "../server/identity.js";
import { composeAlmaPrompt } from "../server/voz-da-alma.js";

describe("compose with scene (CV1.E11.S1)", () => {
  let db: Database.Database;
  let userId: string;

  beforeEach(() => {
    db = openDb(":memory:");
    const user = createUser(db, "u", "h");
    userId = user.id;
    setIdentityLayer(db, userId, "self", "soul", "soul-content");
    setIdentityLayer(db, userId, "ego", "identity", "identity-content");
    setIdentityLayer(db, userId, "ego", "behavior", "behavior-content");
  });

  it("renderSceneBlock returns header + briefing when briefing is non-empty", () => {
    const scene = createScene(db, userId, "k", {
      title: "Aula NA",
      briefing: "Conversa durante aula",
    });
    expect(renderSceneBlock(scene)).toBe(
      "## Cena: Aula NA\n\nConversa durante aula",
    );
  });

  it("renderSceneBlock returns header alone when briefing is empty", () => {
    const scene = createScene(db, userId, "k", { title: "T", briefing: "" });
    expect(renderSceneBlock(scene)).toBe("## Cena: T");
  });

  it("composeSystemPrompt without scene preserves pre-S1 behavior", () => {
    const prompt = composeSystemPrompt(db, userId, [], "web", {
      touchesIdentity: true,
    });
    expect(prompt).not.toContain("## Cena:");
  });

  it("composeSystemPrompt with scene injects the cena block", () => {
    const scene = createScene(db, userId, "aula", {
      title: "Aula NA",
      briefing: "briefing body",
    });
    const prompt = composeSystemPrompt(db, userId, [], "web", {
      touchesIdentity: true,
      scene,
    });
    expect(prompt).toContain("## Cena: Aula NA");
    expect(prompt).toContain("briefing body");
  });

  it("composeSystemPrompt places scene between persona and org/journey", () => {
    setIdentityLayer(db, userId, "persona", "thinker", "thinker-content");
    createOrganization(db, userId, "test-org", "Test Org", "org-briefing");
    createJourney(db, userId, "test-j", "Test J", "journey-briefing");
    const scene = createScene(db, userId, "k", {
      title: "T",
      briefing: "scene-briefing",
    });
    const prompt = composeSystemPrompt(db, userId, ["thinker"], "web", {
      touchesIdentity: true,
      organization: "test-org",
      journey: "test-j",
      scene,
    });
    const personaIdx = prompt.indexOf("thinker-content");
    const sceneIdx = prompt.indexOf("scene-briefing");
    const orgIdx = prompt.indexOf("org-briefing");
    expect(personaIdx).toBeGreaterThan(-1);
    expect(sceneIdx).toBeGreaterThan(-1);
    expect(orgIdx).toBeGreaterThan(-1);
    expect(personaIdx).toBeLessThan(sceneIdx);
    expect(sceneIdx).toBeLessThan(orgIdx);
  });

  it("composeAlmaPrompt with scene injects the cena block", () => {
    const scene = createScene(db, userId, "k", {
      title: "Voz",
      briefing: "alma-scene-briefing",
      voice: "alma",
    });
    const prompt = composeAlmaPrompt(db, userId, { scene }, "web");
    expect(prompt).toContain("## Cena: Voz");
    expect(prompt).toContain("alma-scene-briefing");
    expect(prompt).toContain("soul-content");
  });

  it("composeAlmaPrompt without scene preserves pre-S1 behavior", () => {
    const prompt = composeAlmaPrompt(db, userId, {}, "web");
    expect(prompt).not.toContain("## Cena:");
    expect(prompt).toContain("soul-content");
  });

  it("composeMinimalPrompt is unaffected by scene (trivial path skips everything)", () => {
    const prompt = composeMinimalPrompt("web");
    expect(prompt).not.toContain("## Cena:");
  });

  it("scene with empty briefing still renders the header in the prompt", () => {
    const scene = createScene(db, userId, "k", { title: "Empty", briefing: "" });
    const prompt = composeSystemPrompt(db, userId, [], "web", {
      touchesIdentity: false,
      scene,
    });
    expect(prompt).toContain("## Cena: Empty");
  });
});
