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
  type User,
} from "../server/db.js";
import { setupWeb } from "../adapters/web/index.js";

/**
 * CV1.E15.S6: destructive rerun endpoint validations.
 *
 * The happy path requires a live LLM call (mirror-mind tests don't
 * mock pi-ai), so this suite covers the validation surface — auth,
 * required body fields, ownership, entry-type guards. The caminho
 * feliz lives in the manual roteiro.
 */
function createTestApp() {
  const db = openDb(":memory:");
  const adminToken = "rerun-admin";
  const userToken = "rerun-user";
  const adminHash = createHash("sha256").update(adminToken).digest("hex");
  const userHash = createHash("sha256").update(userToken).digest("hex");
  const admin = createUser(db, "rerunadmin", adminHash);
  const user = createUser(db, "rerunuser", userHash);
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

const JSON_HEADERS = (cookie: string) => ({
  Cookie: cookie,
  "Content-Type": "application/json",
});

describe("/conversation/turn/rerun — admin gating + validation (CV1.E15.S6)", () => {
  let app: Hono<{ Variables: { user: User } }>;
  let db: Database.Database;
  let adminCookie: string;
  let userCookie: string;
  let adminId: string;

  beforeEach(() => {
    ({ app, db, adminCookie, userCookie, adminId } = createTestApp());
  });

  it("non-admin POST returns 403", async () => {
    const res = await app.request("/conversation/turn/rerun", {
      method: "POST",
      headers: JSON_HEADERS(userCookie),
      body: JSON.stringify({
        entryId: "irrelevant",
        model_provider: "openrouter",
        model_id: "google/gemini-2.5-flash",
      }),
    });
    expect(res.status).toBe(403);
  });

  it("missing entryId returns 400", async () => {
    const res = await app.request("/conversation/turn/rerun", {
      method: "POST",
      headers: JSON_HEADERS(adminCookie),
      body: JSON.stringify({ model_provider: "openrouter", model_id: "x" }),
    });
    expect(res.status).toBe(400);
  });

  it("missing model fields returns 400", async () => {
    const res = await app.request("/conversation/turn/rerun", {
      method: "POST",
      headers: JSON_HEADERS(adminCookie),
      body: JSON.stringify({ entryId: "x" }),
    });
    expect(res.status).toBe(400);
  });

  it("non-existent entryId returns 404", async () => {
    const res = await app.request("/conversation/turn/rerun", {
      method: "POST",
      headers: JSON_HEADERS(adminCookie),
      body: JSON.stringify({
        entryId: "00000000-0000-0000-0000-000000000000",
        model_provider: "openrouter",
        model_id: "google/gemini-2.5-flash",
      }),
    });
    expect(res.status).toBe(404);
  });

  it("rerunning a user-role entry returns 400", async () => {
    const sid = getOrCreateSession(db, adminId);
    const userEntryId = appendEntry(db, sid, null, "message", {
      role: "user",
      content: [{ type: "text", text: "hi" }],
    });
    const res = await app.request("/conversation/turn/rerun", {
      method: "POST",
      headers: JSON_HEADERS(adminCookie),
      body: JSON.stringify({
        entryId: userEntryId,
        model_provider: "openrouter",
        model_id: "google/gemini-2.5-flash",
      }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/assistant/i);
  });

  it("rerunning a trivial-stamped assistant entry returns 400", async () => {
    const sid = getOrCreateSession(db, adminId);
    const userEntryId = appendEntry(db, sid, null, "message", {
      role: "user",
      content: [{ type: "text", text: "ok" }],
    });
    const assistantEntryId = appendEntry(db, sid, userEntryId, "message", {
      role: "assistant",
      content: [{ type: "text", text: "ok." }],
      _is_trivial: true,
      _mode: "conversational",
    });
    const res = await app.request("/conversation/turn/rerun", {
      method: "POST",
      headers: JSON_HEADERS(adminCookie),
      body: JSON.stringify({
        entryId: assistantEntryId,
        model_provider: "openrouter",
        model_id: "google/gemini-2.5-flash",
      }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/trivial/i);
  });

  it("rerunning entry with no parent_id returns 400", async () => {
    const sid = getOrCreateSession(db, adminId);
    const orphanAssistantId = appendEntry(db, sid, null, "message", {
      role: "assistant",
      content: [{ type: "text", text: "orphan" }],
      _mode: "conversational",
    });
    const res = await app.request("/conversation/turn/rerun", {
      method: "POST",
      headers: JSON_HEADERS(adminCookie),
      body: JSON.stringify({
        entryId: orphanAssistantId,
        model_provider: "openrouter",
        model_id: "google/gemini-2.5-flash",
      }),
    });
    expect(res.status).toBe(400);
  });
});
