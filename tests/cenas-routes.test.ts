import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { createHash } from "node:crypto";
import type Database from "better-sqlite3";
import {
  openDb,
  createUser,
  setIdentityLayer,
  getSceneByKey,
  getScenePersonas,
  type User,
} from "../server/db.js";
import { setupWeb } from "../adapters/web/index.js";

function createTestApp(): {
  app: Hono<{ Variables: { user: User } }>;
  db: Database.Database;
  token: string;
  userId: string;
  cookie: string;
} {
  const db = openDb(":memory:");
  const token = "cena-test-token";
  const hash = createHash("sha256").update(token).digest("hex");
  const user = createUser(db, "cenauser", hash);
  setIdentityLayer(db, user.id, "self", "soul", "soul");
  setIdentityLayer(db, user.id, "ego", "identity", "id");
  setIdentityLayer(db, user.id, "ego", "behavior", "behavior");

  const app = new Hono<{ Variables: { user: User } }>();
  setupWeb(app, db);
  return { app, db, token, userId: user.id, cookie: `mirror_token=${token}` };
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

describe("web routes — /cenas (CV1.E11.S7)", () => {
  let app: Hono<{ Variables: { user: User } }>;
  let db: Database.Database;
  let cookie: string;
  let userId: string;

  beforeEach(() => {
    ({ app, db, cookie, userId } = createTestApp());
  });

  it("GET /cenas/nova returns 200 with the form", async () => {
    const res = await app.request("/cenas/nova", { headers: { Cookie: cookie } });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toMatch(/Nova cena|New scene/);
    expect(html).toContain('name="title"');
    expect(html).toContain('name="briefing"');
    expect(html).toContain('name="voice"');
  });

  it("POST /cenas/nova with title only creates the cena and redirects", async () => {
    const res = await app.request("/cenas/nova", {
      method: "POST",
      headers: POST_HEADERS(cookie),
      body: form({ title: "Aula Nova", action: "save" }),
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toMatch(/^\/cenas\/aula-nova\/editar\?saved=created$/);
    const cena = getSceneByKey(db, userId, "aula-nova");
    expect(cena?.title).toBe("Aula Nova");
    expect(cena?.voice).toBeNull();
  });

  it("POST /cenas/nova with voice=alma stores voice + empty cast", async () => {
    const res = await app.request("/cenas/nova", {
      method: "POST",
      headers: POST_HEADERS(cookie),
      body: form({
        title: "Voz",
        voice: "alma",
        personas: "ignored, also-ignored",   // server-side mutex wins
        action: "save",
      }),
    });
    expect(res.status).toBe(302);
    const cena = getSceneByKey(db, userId, "voz");
    expect(cena?.voice).toBe("alma");
    expect(getScenePersonas(db, cena!.id)).toEqual([]);
  });

  it("POST /cenas/nova with action=save_and_start creates session and redirects to /conversation", async () => {
    const res = await app.request("/cenas/nova", {
      method: "POST",
      headers: POST_HEADERS(cookie),
      body: form({ title: "Diário", action: "save_and_start" }),
    });
    expect(res.status).toBe(302);
    const loc = res.headers.get("location") ?? "";
    expect(loc).toMatch(/^\/conversation\/[0-9a-f-]+$/);
    const sessId = loc.replace("/conversation/", "");
    const cena = getSceneByKey(db, userId, "diario");
    const sessRow = db
      .prepare("SELECT scene_id FROM sessions WHERE id = ?")
      .get(sessId) as { scene_id: string | null } | undefined;
    expect(sessRow?.scene_id).toBe(cena?.id);
  });

  it("POST /cenas/nova with empty title returns 400 + form re-rendered", async () => {
    const res = await app.request("/cenas/nova", {
      method: "POST",
      headers: POST_HEADERS(cookie),
      body: form({ title: "", briefing: "lost work", action: "save" }),
    });
    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toMatch(/Título é obrigatório|Title is required/);
    expect(html).toContain("lost work");   // user input preserved
  });

  it("POST /cenas/nova with personas csv stores them as cast", async () => {
    const res = await app.request("/cenas/nova", {
      method: "POST",
      headers: POST_HEADERS(cookie),
      body: form({
        title: "P",
        personas: "alpha, beta, gamma",
        action: "save",
      }),
    });
    expect(res.status).toBe(302);
    const cena = getSceneByKey(db, userId, "p");
    expect(getScenePersonas(db, cena!.id)).toEqual(["alpha", "beta", "gamma"]);
  });

  it("GET /cenas/<key>/editar pre-fills the form with existing data", async () => {
    await app.request("/cenas/nova", {
      method: "POST",
      headers: POST_HEADERS(cookie),
      body: form({
        title: "Pre Fill",
        briefing: "the briefing body",
        temporal_pattern: "qua 20h",
        action: "save",
      }),
    });
    const res = await app.request("/cenas/pre-fill/editar", {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('value="Pre Fill"');
    expect(html).toContain("the briefing body");
    expect(html).toContain('value="qua 20h"');
  });

  it("POST /cenas/<key>/editar updates fields", async () => {
    await app.request("/cenas/nova", {
      method: "POST",
      headers: POST_HEADERS(cookie),
      body: form({ title: "Original", briefing: "first", action: "save" }),
    });
    const res = await app.request("/cenas/original/editar", {
      method: "POST",
      headers: POST_HEADERS(cookie),
      body: form({ title: "Original", briefing: "second", action: "save" }),
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/cenas/original/editar?saved=updated");
    const cena = getSceneByKey(db, userId, "original");
    expect(cena?.briefing).toBe("second");
  });

  it("POST /cenas/<key>/archive flips status to archived", async () => {
    await app.request("/cenas/nova", {
      method: "POST",
      headers: POST_HEADERS(cookie),
      body: form({ title: "A", action: "save" }),
    });
    const res = await app.request("/cenas/a/archive", {
      method: "POST",
      headers: POST_HEADERS(cookie),
    });
    expect(res.status).toBe(302);
    expect(getSceneByKey(db, userId, "a")?.status).toBe("archived");
  });

  it("POST /cenas/<key>/unarchive flips back", async () => {
    await app.request("/cenas/nova", {
      method: "POST",
      headers: POST_HEADERS(cookie),
      body: form({ title: "B", action: "save" }),
    });
    await app.request("/cenas/b/archive", {
      method: "POST",
      headers: POST_HEADERS(cookie),
    });
    const res = await app.request("/cenas/b/unarchive", {
      method: "POST",
      headers: POST_HEADERS(cookie),
    });
    expect(res.status).toBe(302);
    expect(getSceneByKey(db, userId, "b")?.status).toBe("active");
  });

  it("POST /cenas/<key>/delete hard-deletes; sessions become scene_id=NULL", async () => {
    await app.request("/cenas/nova", {
      method: "POST",
      headers: POST_HEADERS(cookie),
      body: form({ title: "Del", action: "save_and_start" }),
    });
    const cena = getSceneByKey(db, userId, "del");
    expect(cena).toBeDefined();
    const sessRow = db
      .prepare("SELECT id FROM sessions WHERE scene_id = ?")
      .get(cena!.id) as { id: string } | undefined;
    expect(sessRow).toBeDefined();

    const res = await app.request("/cenas/del/delete", {
      method: "POST",
      headers: POST_HEADERS(cookie),
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/");
    expect(getSceneByKey(db, userId, "del")).toBeUndefined();
    const sessAfter = db
      .prepare("SELECT scene_id FROM sessions WHERE id = ?")
      .get(sessRow!.id) as { scene_id: string | null };
    expect(sessAfter.scene_id).toBeNull();
  });

  it("GET /cenas/<key>/editar for a missing cena returns 404", async () => {
    const res = await app.request("/cenas/does-not-exist/editar", {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(404);
  });

  it("auto-suffixes the key when the slug collides", async () => {
    await app.request("/cenas/nova", {
      method: "POST",
      headers: POST_HEADERS(cookie),
      body: form({ title: "Same Title", action: "save" }),
    });
    const res = await app.request("/cenas/nova", {
      method: "POST",
      headers: POST_HEADERS(cookie),
      body: form({ title: "Same Title", action: "save" }),
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/cenas/same-title-2/editar?saved=created");
  });
});
