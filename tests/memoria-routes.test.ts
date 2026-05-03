import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { createHash } from "node:crypto";
import type Database from "better-sqlite3";
import {
  openDb,
  createUser,
  setIdentityLayer,
  createScene,
  createFreshSession,
  type User,
} from "../server/db.js";
import { setupWeb } from "../adapters/web/index.js";

function createTestApp() {
  const db = openDb(":memory:");
  const token = "memoria-test";
  const hash = createHash("sha256").update(token).digest("hex");
  const user = createUser(db, "memoriauser", hash);
  setIdentityLayer(db, user.id, "self", "soul", "soul");
  setIdentityLayer(db, user.id, "ego", "identity", "id");
  setIdentityLayer(db, user.id, "ego", "behavior", "behavior");
  const app = new Hono<{ Variables: { user: User } }>();
  setupWeb(app, db);
  return { app, db, userId: user.id, cookie: `mirror_token=${token}` };
}

describe("web routes — /memorias + /cenas (after Território split)", () => {
  let app: Hono<{ Variables: { user: User } }>;
  let db: Database.Database;
  let cookie: string;
  let userId: string;

  beforeEach(() => {
    ({ app, db, cookie, userId } = createTestApp());
  });

  // --- /memorias (Library + Histórico — entity cards moved to /territorio) ---

  it("GET /memoria (legacy) redirects 301 to /memorias", async () => {
    const res = await app.request("/memoria", { headers: { Cookie: cookie } });
    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toBe("/memorias");
  });

  it("GET /memorias returns 200 with avatar bar + Library + Histórico section", async () => {
    const res = await app.request("/memorias", { headers: { Cookie: cookie } });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("avatar-top-bar");
    // Library card
    expect(html).toContain("memoria-library");
    expect(html).toMatch(/Biblioteca|Library/);
    // Histórico section
    expect(html).toContain("memoria-history-section");
    expect(html).toMatch(/Histórico|History/);
  });

  it("GET /memorias renders Library card with em-breve badge", async () => {
    const res = await app.request("/memorias", { headers: { Cookie: cookie } });
    const html = await res.text();
    expect(html).toContain("memoria-library-soon");
    expect(html).toMatch(/em breve|soon/);
    expect(html).toContain("memoria-library-body");
  });

  it("GET /memorias does NOT render entity cards (moved to /territorio)", async () => {
    // Even with scenes/journeys/orgs in the DB, /memorias must not
    // render them — that responsibility now lives on /territorio.
    createScene(db, userId, "should-not-appear", { title: "Should Not Appear" });
    const res = await app.request("/memorias", { headers: { Cookie: cookie } });
    const html = await res.text();
    expect(html).not.toContain("territorio-grid");
    expect(html).not.toContain("Should Not Appear");
  });

  it("GET /memorias with no conversations renders empty Histórico state", async () => {
    const res = await app.request("/memorias", { headers: { Cookie: cookie } });
    const html = await res.text();
    expect(html).toMatch(/No conversations yet|Ainda não há conversas/);
  });

  it("GET /memorias 'ver tudo →' present when recents non-empty, points to /conversations", async () => {
    const { appendEntry } = await import("../server/db.js");
    const sessId = createFreshSession(db, userId, null);
    appendEntry(db, sessId, null, "message", { role: "user", content: "x" });
    const res = await app.request("/memorias", { headers: { Cookie: cookie } });
    const html = await res.text();
    expect(html).toContain('href="/conversations"');
    expect(html).toMatch(/ver tudo|see all/);
  });

  // --- /cenas (unchanged by the split) ---

  it("GET /cenas returns 200 with TopBarLayout + cenas grid", async () => {
    createScene(db, userId, "first", { title: "First" });
    createScene(db, userId, "second", { title: "Second", voice: "alma" });
    const res = await app.request("/cenas", { headers: { Cookie: cookie } });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("avatar-top-bar");
    expect(html).toContain("cenas-list-grid");
    expect(html).toContain("First");
    expect(html).toContain("Second");
  });

  it("GET /cenas with no cenas renders empty state with create link", async () => {
    const res = await app.request("/cenas", { headers: { Cookie: cookie } });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("cenas-list-empty");
    expect(html).toContain('href="/cenas/nova"');
  });
});
