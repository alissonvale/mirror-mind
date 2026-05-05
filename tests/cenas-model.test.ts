import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { createHash } from "node:crypto";
import type Database from "better-sqlite3";
import {
  openDb,
  createUser,
  setIdentityLayer,
  getSceneByKey,
  createScene,
  updateScene,
  type User,
} from "../server/db.js";
import { setupWeb } from "../adapters/web/index.js";

/**
 * CV1.E15.S2: per-scene model override.
 *
 * The test app boots two users: cenas-admin (auto-promoted to admin —
 * first user) and cenas-user (a regular user). Both have valid identity
 * layers so /cenas/* doesn't 4xx on missing prerequisites.
 */
function createTestApp(): {
  app: Hono<{ Variables: { user: User } }>;
  db: Database.Database;
  adminCookie: string;
  userCookie: string;
  adminId: string;
  userId: string;
} {
  const db = openDb(":memory:");
  const adminToken = "admin-test-token";
  const userToken = "user-test-token";
  const adminHash = createHash("sha256").update(adminToken).digest("hex");
  const userHash = createHash("sha256").update(userToken).digest("hex");
  const admin = createUser(db, "cenas-admin", adminHash); // auto-admin
  const user = createUser(db, "cenas-user", userHash); // 'user' role
  for (const u of [admin, user]) {
    setIdentityLayer(db, u.id, "self", "soul", "soul");
    setIdentityLayer(db, u.id, "ego", "identity", "id");
    setIdentityLayer(db, u.id, "ego", "behavior", "behavior");
  }
  const app = new Hono<{ Variables: { user: User } }>();
  setupWeb(app, db);
  return {
    app,
    db,
    adminCookie: `mirror_token=${adminToken}`,
    userCookie: `mirror_token=${userToken}`,
    adminId: admin.id,
    userId: user.id,
  };
}

function form(fields: Record<string, string>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(fields)) params.set(k, v);
  return params.toString();
}

const POST_HEADERS = (cookie: string) => ({
  Cookie: cookie,
  "Content-Type": "application/x-www-form-urlencoded",
});

describe("scenes — model override columns (CV1.E15.S2)", () => {
  let db: Database.Database;
  let adminId: string;

  beforeEach(() => {
    ({ db, adminId } = createTestApp());
  });

  it("createScene persists model_provider and model_id", () => {
    const scene = createScene(db, adminId, "essay", {
      title: "Essay",
      model_provider: "openrouter",
      model_id: "anthropic/claude-sonnet-4-6",
    });
    expect(scene.model_provider).toBe("openrouter");
    expect(scene.model_id).toBe("anthropic/claude-sonnet-4-6");

    const reloaded = getSceneByKey(db, adminId, "essay");
    expect(reloaded?.model_provider).toBe("openrouter");
    expect(reloaded?.model_id).toBe("anthropic/claude-sonnet-4-6");
  });

  it("createScene defaults model fields to null when omitted", () => {
    const scene = createScene(db, adminId, "casual", { title: "Casual" });
    expect(scene.model_provider).toBeNull();
    expect(scene.model_id).toBeNull();
  });

  it("updateScene clears model_provider/model_id when given empty string", () => {
    createScene(db, adminId, "diary", {
      title: "Diary",
      model_provider: "openrouter",
      model_id: "google/gemini-2.5-flash",
    });
    const updated = updateScene(db, adminId, "diary", {
      model_provider: "",
      model_id: "",
    });
    expect(updated?.model_provider).toBeNull();
    expect(updated?.model_id).toBeNull();
  });

  it("updateScene preserves model fields when keys are omitted", () => {
    createScene(db, adminId, "deliberation", {
      title: "Deliberation",
      model_provider: "openrouter",
      model_id: "anthropic/claude-opus-4",
    });
    const updated = updateScene(db, adminId, "deliberation", {
      title: "Strategic Deliberation",
    });
    expect(updated?.title).toBe("Strategic Deliberation");
    expect(updated?.model_provider).toBe("openrouter");
    expect(updated?.model_id).toBe("anthropic/claude-opus-4");
  });
});

describe("/cenas form — admin gating for model override (CV1.E15.S2)", () => {
  let app: Hono<{ Variables: { user: User } }>;
  let db: Database.Database;
  let adminCookie: string;
  let userCookie: string;
  let adminId: string;
  let userId: string;

  beforeEach(() => {
    ({ app, db, adminCookie, userCookie, adminId, userId } = createTestApp());
  });

  it("GET /cenas/nova as admin renders the model picker block", async () => {
    const res = await app.request("/cenas/nova", {
      headers: { Cookie: adminCookie },
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('name="model_provider"');
    expect(html).toContain('name="model_id"');
  });

  it("GET /cenas/nova as non-admin omits the model picker block", async () => {
    const res = await app.request("/cenas/nova", {
      headers: { Cookie: userCookie },
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).not.toContain('name="model_provider"');
    expect(html).not.toContain('name="model_id"');
  });

  it("POST /cenas/nova as admin persists model_provider/model_id", async () => {
    const res = await app.request("/cenas/nova", {
      method: "POST",
      headers: POST_HEADERS(adminCookie),
      body: form({
        title: "Strategic",
        model_provider: "openrouter",
        model_id: "anthropic/claude-sonnet-4-6",
        action: "save",
      }),
    });
    expect(res.status).toBe(302);
    const cena = getSceneByKey(db, adminId, "strategic");
    expect(cena?.model_provider).toBe("openrouter");
    expect(cena?.model_id).toBe("anthropic/claude-sonnet-4-6");
  });

  it("POST /cenas/nova as non-admin ignores model fields in the body", async () => {
    const res = await app.request("/cenas/nova", {
      method: "POST",
      headers: POST_HEADERS(userCookie),
      body: form({
        title: "Casual",
        model_provider: "openrouter",
        model_id: "evil/injected-model",
        action: "save",
      }),
    });
    expect(res.status).toBe(302);
    const cena = getSceneByKey(db, userId, "casual");
    expect(cena?.model_provider).toBeNull();
    expect(cena?.model_id).toBeNull();
  });

  it("POST /cenas/:key/editar as non-admin preserves admin-set model fields", async () => {
    // Admin sets model on a cena, then a non-admin tries to clear it.
    // Because the admin owns the cena, this scenario uses admin's user_id
    // — we just verify the route handler ignores model fields on non-admin
    // submissions even when the user owns the row.
    createScene(db, userId, "shared", {
      title: "Shared",
      model_provider: "openrouter",
      model_id: "anthropic/claude-sonnet-4-6",
    });
    const res = await app.request("/cenas/shared/editar", {
      method: "POST",
      headers: POST_HEADERS(userCookie),
      body: form({
        title: "Shared",
        model_provider: "",
        model_id: "",
        action: "save",
      }),
    });
    expect(res.status).toBe(302);
    const cena = getSceneByKey(db, userId, "shared");
    expect(cena?.model_provider).toBe("openrouter");
    expect(cena?.model_id).toBe("anthropic/claude-sonnet-4-6");
  });
});
