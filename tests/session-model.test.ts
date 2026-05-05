import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { createHash } from "node:crypto";
import type Database from "better-sqlite3";
import {
  openDb,
  createUser,
  setIdentityLayer,
  getOrCreateSession,
  getSessionModel,
  setSessionModel,
  type User,
} from "../server/db.js";
import { setupWeb } from "../adapters/web/index.js";

/**
 * CV1.E15.S3: per-session model override (helpers + admin-only POST).
 *
 * The test app boots two users — first one auto-promotes to admin,
 * second is a regular user. Both have valid identity layers so
 * /conversation/* doesn't 4xx on missing prerequisites.
 */
function createTestApp() {
  const db = openDb(":memory:");
  const adminToken = "session-model-admin";
  const userToken = "session-model-user";
  const adminHash = createHash("sha256").update(adminToken).digest("hex");
  const userHash = createHash("sha256").update(userToken).digest("hex");
  const admin = createUser(db, "smadmin", adminHash);
  const user = createUser(db, "smuser", userHash);
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

describe("sessions — model override helpers (CV1.E15.S3)", () => {
  let db: Database.Database;
  let adminId: string;

  beforeEach(() => {
    ({ db, adminId } = createTestApp());
  });

  it("getSessionModel returns null/null when no override is set", () => {
    const sid = getOrCreateSession(db, adminId);
    expect(getSessionModel(db, sid, adminId)).toEqual({
      provider: null,
      id: null,
    });
  });

  it("setSessionModel persists provider and id", () => {
    const sid = getOrCreateSession(db, adminId);
    setSessionModel(db, sid, adminId, {
      provider: "openrouter",
      id: "anthropic/claude-sonnet-4-6",
    });
    expect(getSessionModel(db, sid, adminId)).toEqual({
      provider: "openrouter",
      id: "anthropic/claude-sonnet-4-6",
    });
  });

  it("setSessionModel collapses empty strings to null", () => {
    const sid = getOrCreateSession(db, adminId);
    setSessionModel(db, sid, adminId, { provider: "", id: "" });
    expect(getSessionModel(db, sid, adminId)).toEqual({
      provider: null,
      id: null,
    });
  });

  it("setSessionModel respects ownership — UPDATE is a no-op for foreign sessions", () => {
    const sid = getOrCreateSession(db, adminId);
    setSessionModel(db, sid, "another-user-id", {
      provider: "evil",
      id: "injected/model",
    });
    expect(getSessionModel(db, sid, adminId)).toEqual({
      provider: null,
      id: null,
    });
  });
});

describe("/conversation/model — admin-gated POST (CV1.E15.S3)", () => {
  let app: Hono<{ Variables: { user: User } }>;
  let db: Database.Database;
  let adminCookie: string;
  let userCookie: string;
  let adminId: string;
  let userId: string;

  beforeEach(() => {
    ({ app, db, adminCookie, userCookie, adminId, userId } = createTestApp());
  });

  it("admin POST persists model_provider and model_id", async () => {
    const sid = getOrCreateSession(db, adminId);
    const res = await app.request("/conversation/model", {
      method: "POST",
      headers: POST_HEADERS(adminCookie),
      body: form({
        sessionId: sid,
        model_provider: "openrouter",
        model_id: "anthropic/claude-sonnet-4-6",
      }),
    });
    expect(res.status).toBe(302);
    expect(getSessionModel(db, sid, adminId)).toEqual({
      provider: "openrouter",
      id: "anthropic/claude-sonnet-4-6",
    });
  });

  it("admin POST with empty fields clears the override", async () => {
    const sid = getOrCreateSession(db, adminId);
    setSessionModel(db, sid, adminId, {
      provider: "openrouter",
      id: "anthropic/claude-sonnet-4-6",
    });
    const res = await app.request("/conversation/model", {
      method: "POST",
      headers: POST_HEADERS(adminCookie),
      body: form({ sessionId: sid, model_provider: "", model_id: "" }),
    });
    expect(res.status).toBe(302);
    expect(getSessionModel(db, sid, adminId)).toEqual({
      provider: null,
      id: null,
    });
  });

  it("non-admin POST returns 403 and does not change the override", async () => {
    const sid = getOrCreateSession(db, userId);
    const res = await app.request("/conversation/model", {
      method: "POST",
      headers: POST_HEADERS(userCookie),
      body: form({
        sessionId: sid,
        model_provider: "openrouter",
        model_id: "evil/injected-model",
      }),
    });
    expect(res.status).toBe(403);
    expect(getSessionModel(db, sid, userId)).toEqual({
      provider: null,
      id: null,
    });
  });
});

describe("conversation header — admin-only model row (CV1.E15.S3)", () => {
  let app: Hono<{ Variables: { user: User } }>;
  let adminCookie: string;
  let userCookie: string;

  beforeEach(() => {
    ({ app, adminCookie, userCookie } = createTestApp());
  });

  it("admin GET /conversation renders the model row in the advanced pouch", async () => {
    const res = await app.request("/conversation", {
      headers: { Cookie: adminCookie },
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    // The form action is the unique fingerprint of the row. Casts a
    // wider net than the i18n label so the test is locale-tolerant.
    expect(html).toContain('action="/conversation/model"');
    expect(html).toContain('name="model_provider"');
    expect(html).toContain('name="model_id"');
  });

  it("non-admin GET /conversation does not render the model row", async () => {
    const res = await app.request("/conversation", {
      headers: { Cookie: userCookie },
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).not.toContain('action="/conversation/model"');
    expect(html).not.toContain('name="model_provider"');
    expect(html).not.toContain('name="model_id"');
  });
});
