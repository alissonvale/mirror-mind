import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { createHash } from "node:crypto";
import type Database from "better-sqlite3";
import {
  openDb,
  createUser,
  setIdentityLayer,
  getOrCreateSession,
  appendEntry,
  getSessionShowModelBadges,
  setSessionShowModelBadges,
  type User,
} from "../server/db.js";
import { computeSessionStats } from "../server/session-stats.js";
import { setupWeb } from "../adapters/web/index.js";

/**
 * CV1.E15 follow-up: per-session model-badges toggle + per-model
 * breakdown in session stats.
 */
function createTestApp() {
  const db = openDb(":memory:");
  const adminToken = "show-model-admin";
  const userToken = "show-model-user";
  const adminHash = createHash("sha256").update(adminToken).digest("hex");
  const userHash = createHash("sha256").update(userToken).digest("hex");
  const admin = createUser(db, "showadmin", adminHash);
  const user = createUser(db, "showuser", userHash);
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

describe("show_model_badges helpers", () => {
  let db: Database.Database;
  let user: User;

  beforeEach(() => {
    ({ db, ...({ adminId: user } = createTestApp() as any) } as any);
    // Re-init manually since destructure above is convoluted.
    const fresh = createTestApp();
    db = fresh.db;
    user = { id: fresh.adminId } as User;
  });

  it("defaults to false", () => {
    const sid = getOrCreateSession(db, user.id);
    expect(getSessionShowModelBadges(db, sid, user.id)).toBe(false);
  });

  it("setSessionShowModelBadges round-trips true and false", () => {
    const sid = getOrCreateSession(db, user.id);
    setSessionShowModelBadges(db, sid, user.id, true);
    expect(getSessionShowModelBadges(db, sid, user.id)).toBe(true);
    setSessionShowModelBadges(db, sid, user.id, false);
    expect(getSessionShowModelBadges(db, sid, user.id)).toBe(false);
  });
});

describe("/conversation/show-model-badges route", () => {
  let app: Hono<{ Variables: { user: User } }>;
  let db: Database.Database;
  let adminCookie: string;
  let userCookie: string;
  let adminId: string;

  beforeEach(() => {
    ({ app, db, adminCookie, userCookie, adminId } = createTestApp());
  });

  it("admin POST persists the flag", async () => {
    const sid = getOrCreateSession(db, adminId);
    const res = await app.request("/conversation/show-model-badges", {
      method: "POST",
      headers: POST_HEADERS(adminCookie),
      body: form({ sessionId: sid, show: "1" }),
    });
    expect(res.status).toBe(302);
    expect(getSessionShowModelBadges(db, sid, adminId)).toBe(true);
  });

  it("admin POST with show=0 clears the flag", async () => {
    const sid = getOrCreateSession(db, adminId);
    setSessionShowModelBadges(db, sid, adminId, true);
    const res = await app.request("/conversation/show-model-badges", {
      method: "POST",
      headers: POST_HEADERS(adminCookie),
      body: form({ sessionId: sid, show: "0" }),
    });
    expect(res.status).toBe(302);
    expect(getSessionShowModelBadges(db, sid, adminId)).toBe(false);
  });

  it("non-admin POST returns 403", async () => {
    const res = await app.request("/conversation/show-model-badges", {
      method: "POST",
      headers: POST_HEADERS(userCookie),
      body: form({ sessionId: "x", show: "1" }),
    });
    expect(res.status).toBe(403);
  });
});

describe("computeSessionStats — per-model breakdown", () => {
  let db: Database.Database;
  let user: User;
  let sid: string;

  beforeEach(() => {
    ({ db, adminId: user } = createTestApp() as any);
    const fresh = createTestApp();
    db = fresh.db;
    user = { id: fresh.adminId } as User;
    sid = getOrCreateSession(db, user.id);
  });

  it("aggregates model_id from stamped meta on assistant entries", () => {
    appendEntry(db, sid, null, "message", {
      role: "user",
      content: [{ type: "text", text: "hi" }],
    });
    appendEntry(db, sid, null, "message", {
      role: "assistant",
      content: [{ type: "text", text: "hello" }],
      _model_id: "google/gemini-2.5-flash",
    });
    appendEntry(db, sid, null, "message", {
      role: "user",
      content: [{ type: "text", text: "again" }],
    });
    appendEntry(db, sid, null, "message", {
      role: "assistant",
      content: [{ type: "text", text: "again hello" }],
      _model_id: "google/gemini-2.5-flash",
    });
    appendEntry(db, sid, null, "message", {
      role: "user",
      content: [{ type: "text", text: "switch" }],
    });
    appendEntry(db, sid, null, "message", {
      role: "assistant",
      content: [{ type: "text", text: "switched" }],
      _model_id: "anthropic/claude-sonnet-4-6",
    });

    const stats = computeSessionStats(db, sid);
    expect(stats.models).toEqual([
      { model_id: "google/gemini-2.5-flash", count: 2 },
      { model_id: "anthropic/claude-sonnet-4-6", count: 1 },
    ]);
  });

  it("skips entries without _model_id (pre-S4 turns)", () => {
    appendEntry(db, sid, null, "message", {
      role: "assistant",
      content: [{ type: "text", text: "old" }],
    });
    appendEntry(db, sid, null, "message", {
      role: "assistant",
      content: [{ type: "text", text: "new" }],
      _model_id: "google/gemini-2.5-flash",
    });

    const stats = computeSessionStats(db, sid);
    expect(stats.models).toEqual([
      { model_id: "google/gemini-2.5-flash", count: 1 },
    ]);
  });
});
