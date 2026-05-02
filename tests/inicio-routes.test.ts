import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { createHash } from "node:crypto";
import type Database from "better-sqlite3";
import {
  openDb,
  createUser,
  setIdentityLayer,
  createScene,
  type User,
} from "../server/db.js";
import { setupWeb } from "../adapters/web/index.js";

function createTestApp() {
  const db = openDb(":memory:");
  const token = "inicio-test";
  const hash = createHash("sha256").update(token).digest("hex");
  const user = createUser(db, "iniciouser", hash);
  setIdentityLayer(db, user.id, "self", "soul", "soul");
  setIdentityLayer(db, user.id, "ego", "identity", "id");
  setIdentityLayer(db, user.id, "ego", "behavior", "behavior");

  const app = new Hono<{ Variables: { user: User } }>();
  setupWeb(app, db);
  return { app, db, userId: user.id, cookie: `mirror_token=${token}` };
}

const POST_FORM = (cookie: string, body: Record<string, string>) => ({
  method: "POST",
  headers: {
    Cookie: cookie,
    "Content-Type": "application/x-www-form-urlencoded",
  },
  body: new URLSearchParams(body).toString(),
});

describe("web routes — /inicio (CV1.E11.S1)", () => {
  let app: Hono<{ Variables: { user: User } }>;
  let db: Database.Database;
  let cookie: string;
  let userId: string;

  beforeEach(() => {
    ({ app, db, cookie, userId } = createTestApp());
  });

  it("GET /inicio returns 200 with avatar bar + cards section + recents heading", async () => {
    const res = await app.request("/", { headers: { Cookie: cookie } });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("avatar-top-bar");
    expect(html).toContain("inicio-cards-row");
    expect(html).toContain("inicio-input-form");
    expect(html).toMatch(/Recent|Recentes/);
  });

  it("GET /inicio renders existing cenas as cards", async () => {
    createScene(db, userId, "test-cena-a", { title: "Test Cena A" });
    createScene(db, userId, "test-cena-b", { title: "Test Cena B" });
    const res = await app.request("/", { headers: { Cookie: cookie } });
    const html = await res.text();
    expect(html).toContain("Test Cena A");
    expect(html).toContain("Test Cena B");
    expect(html).toContain('action="/cenas/test-cena-a/start"');
    expect(html).toContain('action="/cenas/test-cena-b/start"');
  });

  it("GET /inicio renders 'Nova cena' card linking to /cenas/nova", async () => {
    const res = await app.request("/", { headers: { Cookie: cookie } });
    const html = await res.text();
    expect(html).toContain('href="/cenas/nova"');
  });

  it("POST /inicio with text creates session + redirects with seed param", async () => {
    const res = await app.request(
      "/",
      POST_FORM(cookie, { text: "estou pensando em pricing" }),
    );
    expect(res.status).toBe(302);
    const loc = res.headers.get("location") ?? "";
    expect(loc).toMatch(/^\/conversation\/[0-9a-f-]+\?seed=estou%20pensando%20em%20pricing$/);
    const sessId = loc.match(/\/conversation\/([0-9a-f-]+)/)?.[1];
    const sess = db
      .prepare("SELECT user_id, scene_id FROM sessions WHERE id = ?")
      .get(sessId) as { user_id: string; scene_id: string | null };
    expect(sess.user_id).toBe(userId);
    expect(sess.scene_id).toBeNull();
  });

  it("POST /inicio with empty text redirects back without creating session", async () => {
    const before = (db.prepare("SELECT COUNT(*) as c FROM sessions").get() as { c: number }).c;
    const res = await app.request(
      "/",
      POST_FORM(cookie, { text: "   " }),
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/");
    const after = (db.prepare("SELECT COUNT(*) as c FROM sessions").get() as { c: number }).c;
    expect(after).toBe(before);
  });

  it("POST /cenas/:key/start creates a session linked to the cena", async () => {
    const cena = createScene(db, userId, "test-cena", { title: "T" });
    const res = await app.request("/cenas/test-cena/start", {
      method: "POST",
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(302);
    const loc = res.headers.get("location") ?? "";
    expect(loc).toMatch(/^\/conversation\/[0-9a-f-]+$/);
    const sessId = loc.replace("/conversation/", "");
    const sess = db
      .prepare("SELECT scene_id FROM sessions WHERE id = ?")
      .get(sessId) as { scene_id: string | null };
    expect(sess.scene_id).toBe(cena.id);
  });

  it("POST /cenas/:key/start seeds session_personas + org/journey from cena", async () => {
    const { setScenePersonas, getSessionTags } = await import("../server/db.js");
    const cena = createScene(db, userId, "rich-cena", {
      title: "Rich",
      organization_key: "test-org",
      journey_key: "test-journey",
    });
    setScenePersonas(db, cena.id, ["alpha", "beta"]);
    const res = await app.request("/cenas/rich-cena/start", {
      method: "POST",
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(302);
    const sessId = (res.headers.get("location") ?? "").replace(
      "/conversation/",
      "",
    );
    const tags = getSessionTags(db, sessId);
    expect(tags.personaKeys).toEqual(["alpha", "beta"]);
    expect(tags.organizationKeys).toEqual(["test-org"]);
    expect(tags.journeyKeys).toEqual(["test-journey"]);
  });

  it("POST /cenas/:key/start with voice=alma sets session voice instead of cast", async () => {
    const { getSessionVoice, getSessionTags } = await import("../server/db.js");
    createScene(db, userId, "alma-cena", {
      title: "Alma",
      voice: "alma",
    });
    const res = await app.request("/cenas/alma-cena/start", {
      method: "POST",
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(302);
    const sessId = (res.headers.get("location") ?? "").replace(
      "/conversation/",
      "",
    );
    expect(getSessionVoice(db, sessId, userId)).toBe("alma");
    expect(getSessionTags(db, sessId).personaKeys).toEqual([]);
  });

  it("POST /cenas/:nonexistent/start returns 404", async () => {
    const res = await app.request("/cenas/missing-cena/start", {
      method: "POST",
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(404);
  });

  it("recents shows scene title when session has scene_id, '(no scene)' otherwise", async () => {
    const cena = createScene(db, userId, "scoped", { title: "Scoped Cena" });
    // Manually create two sessions: one linked to cena, one without
    const { createFreshSession } = await import("../server/db.js");
    createFreshSession(db, userId, cena.id);
    createFreshSession(db, userId);
    const res = await app.request("/", { headers: { Cookie: cookie } });
    const html = await res.text();
    expect(html).toContain("Scoped Cena");
    expect(html).toMatch(/\(no scene\)|\(sem cena\)/);
  });
});
