import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { createHash } from "node:crypto";
import type Database from "better-sqlite3";
import {
  openDb,
  createUser,
  createScene,
  setScenePersonas,
  setIdentityLayer,
  createFreshSession,
  getSessionScene,
  type User,
} from "../server/db.js";
import type { ReceptionResult } from "../server/reception.js";
import { evaluateColdStart } from "../server/cold-start.js";
import { setupWeb } from "../adapters/web/index.js";

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

describe("evaluateColdStart (CV1.E11.S1 P5)", () => {
  let db: Database.Database;
  let userId: string;

  beforeEach(() => {
    db = openDb(":memory:");
    const user = createUser(db, "u", "h");
    userId = user.id;
  });

  it("returns null when session already has a scene_id", () => {
    createScene(db, userId, "k", { title: "T", voice: "alma" });
    const r = receptor({ is_self_moment: true });
    expect(
      evaluateColdStart(db, userId, "some-existing-scene-id", true, r),
    ).toBeNull();
  });

  it("returns null when not the first turn", () => {
    createScene(db, userId, "k", { title: "T", voice: "alma" });
    const r = receptor({ is_self_moment: true });
    expect(evaluateColdStart(db, userId, null, false, r)).toBeNull();
  });

  it("returns null when reception is trivial", () => {
    createScene(db, userId, "k", { title: "T", voice: "alma" });
    const r = receptor({ is_self_moment: true, is_trivial: true });
    expect(evaluateColdStart(db, userId, null, true, r)).toBeNull();
  });

  it("returns the matching alma cena with ♔ glyph", () => {
    createScene(db, userId, "alma", { title: "Voz da Alma", voice: "alma" });
    const r = receptor({ is_self_moment: true });
    const result = evaluateColdStart(db, userId, null, true, r);
    expect(result).toEqual({ key: "alma", title: "Voz da Alma", glyph: "♔" });
  });

  it("returns the matching persona cena with ❖ glyph", () => {
    const cena = createScene(db, userId, "p", {
      title: "Persona Cena",
      organization_key: "test-org",
    });
    setScenePersonas(db, cena.id, ["test-persona"]);
    const r = receptor({
      personas: ["test-persona"],
      organization: "test-org",
    });
    const result = evaluateColdStart(db, userId, null, true, r);
    expect(result).toEqual({
      key: "p",
      title: "Persona Cena",
      glyph: "❖",
    });
  });

  it("returns null when no cena matches", () => {
    const cena = createScene(db, userId, "p", { title: "P" });
    setScenePersonas(db, cena.id, ["different-persona"]);
    const r = receptor({ personas: ["does-not-match"] });
    expect(evaluateColdStart(db, userId, null, true, r)).toBeNull();
  });

  it("returns null when no cenas exist", () => {
    const r = receptor({ personas: ["x"], is_self_moment: true });
    expect(evaluateColdStart(db, userId, null, true, r)).toBeNull();
  });
});

describe("/conversation/:sessId/apply-scene endpoint (CV1.E11.S1 P5)", () => {
  let app: Hono<{ Variables: { user: User } }>;
  let db: Database.Database;
  let cookie: string;
  let userId: string;
  let sessId: string;

  beforeEach(() => {
    db = openDb(":memory:");
    const token = "apply-test";
    const hash = createHash("sha256").update(token).digest("hex");
    const user = createUser(db, "applyuser", hash);
    userId = user.id;
    setIdentityLayer(db, userId, "self", "soul", "soul");
    setIdentityLayer(db, userId, "ego", "identity", "id");
    setIdentityLayer(db, userId, "ego", "behavior", "beh");
    sessId = createFreshSession(db, userId);
    cookie = `mirror_token=${token}`;
    app = new Hono<{ Variables: { user: User } }>();
    setupWeb(app, db);
  });

  it("POST apply-scene with a valid key sets sessions.scene_id", async () => {
    const cena = createScene(db, userId, "alma", {
      title: "Voz",
      voice: "alma",
    });
    const res = await app.request(
      `/conversation/${sessId}/apply-scene`,
      {
        method: "POST",
        headers: { Cookie: cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ key: "alma" }),
      },
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean; sceneId: string };
    expect(json.ok).toBe(true);
    expect(json.sceneId).toBe(cena.id);
    expect(getSessionScene(db, sessId, userId)).toBe(cena.id);
  });

  it("POST apply-scene with unknown key returns 404", async () => {
    const res = await app.request(
      `/conversation/${sessId}/apply-scene`,
      {
        method: "POST",
        headers: { Cookie: cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ key: "ghost" }),
      },
    );
    expect(res.status).toBe(404);
    expect(getSessionScene(db, sessId, userId)).toBeNull();
  });

  it("POST apply-scene to a session owned by another user returns 404", async () => {
    createScene(db, userId, "k", { title: "T" });
    const other = createUser(db, "veronica", "h2");
    const otherSess = createFreshSession(db, other.id);
    const res = await app.request(
      `/conversation/${otherSess}/apply-scene`,
      {
        method: "POST",
        headers: { Cookie: cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ key: "k" }),
      },
    );
    expect(res.status).toBe(404);
  });

  it("POST apply-scene with empty key returns 400", async () => {
    createScene(db, userId, "k", { title: "T" });
    const res = await app.request(
      `/conversation/${sessId}/apply-scene`,
      {
        method: "POST",
        headers: { Cookie: cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ key: "" }),
      },
    );
    expect(res.status).toBe(400);
  });
});
