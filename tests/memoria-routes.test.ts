import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { createHash } from "node:crypto";
import type Database from "better-sqlite3";
import {
  openDb,
  createUser,
  setIdentityLayer,
  createScene,
  createOrganization,
  createJourney,
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

describe("web routes — /memoria + /cenas (CV1.E11.S3)", () => {
  let app: Hono<{ Variables: { user: User } }>;
  let db: Database.Database;
  let cookie: string;
  let userId: string;

  beforeEach(() => {
    ({ app, db, cookie, userId } = createTestApp());
  });

  // --- /memorias ---

  it("GET /memoria (legacy) redirects 301 to /memorias", async () => {
    const res = await app.request("/memoria", { headers: { Cookie: cookie } });
    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toBe("/memorias");
  });

  it("GET /memorias returns 200 with avatar bar + 4 cards + Histórico section", async () => {
    const res = await app.request("/memorias", { headers: { Cookie: cookie } });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("avatar-top-bar");
    expect(html).toContain("memoria-grid");
    // 4 cards present
    expect(html).toMatch(/Cenas|Scenes/);
    expect(html).toMatch(/Travessias|Journeys/);
    expect(html).toMatch(/Organizações|Organizations/);
    expect(html).toContain("Library");
    // Histórico section
    expect(html).toMatch(/Histórico|History/);
  });

  it("GET /memoria renders Library card with em-breve badge", async () => {
    const res = await app.request("/memorias", { headers: { Cookie: cookie } });
    const html = await res.text();
    expect(html).toContain("memoria-card-soon-badge");
    expect(html).toMatch(/em breve|soon/);
    expect(html).toContain("memoria-card-library-body");
  });

  it("GET /memoria with empty collections renders empty states", async () => {
    const res = await app.request("/memorias", { headers: { Cookie: cookie } });
    const html = await res.text();
    expect(html).toMatch(/No scenes yet|Nenhuma cena ainda/);
    expect(html).toMatch(/No journeys yet|Nenhuma travessia ainda/);
    expect(html).toMatch(/No organizations yet|Nenhuma organização ainda/);
    expect(html).toMatch(/No conversations yet|Ainda não há conversas/);
  });

  it("GET /memoria renders cards with items when collections are populated", async () => {
    createScene(db, userId, "test-scene", { title: "Test Scene" });
    createOrganization(db, userId, "test-org", "Test Org");
    createJourney(db, userId, "test-journey", "Test Journey");
    createFreshSession(db, userId, null);
    const res = await app.request("/memorias", { headers: { Cookie: cookie } });
    const html = await res.text();
    expect(html).toContain("Test Scene");
    expect(html).toContain("Test Org");
    expect(html).toContain("Test Journey");
    // "ver →" links to the listing pages
    expect(html).toContain('href="/cenas"');
    expect(html).toContain('href="/journeys"');
    expect(html).toContain('href="/organizations"');
    // Item-level link to the cena workshop
    expect(html).toContain('href="/cenas/test-scene/editar"');
  });

  it("GET /memoria 'ver tudo →' present when recents non-empty, points to /conversations", async () => {
    createFreshSession(db, userId, null);
    const res = await app.request("/memorias", { headers: { Cookie: cookie } });
    const html = await res.text();
    expect(html).toContain('href="/conversations"');
    expect(html).toMatch(/ver tudo|see all/);
  });

  // --- /cenas ---

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
