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
  type User,
} from "../server/db.js";
import { setupWeb } from "../adapters/web/index.js";

function createTestApp() {
  const db = openDb(":memory:");
  const token = "territorio-test";
  const hash = createHash("sha256").update(token).digest("hex");
  const user = createUser(db, "territoriouser", hash);
  setIdentityLayer(db, user.id, "self", "soul", "soul");
  setIdentityLayer(db, user.id, "ego", "identity", "id");
  setIdentityLayer(db, user.id, "ego", "behavior", "behavior");
  const app = new Hono<{ Variables: { user: User } }>();
  setupWeb(app, db);
  return { app, db, userId: user.id, cookie: `mirror_token=${token}` };
}

describe("web routes — /territorio (split out of /memorias)", () => {
  let app: Hono<{ Variables: { user: User } }>;
  let db: Database.Database;
  let cookie: string;
  let userId: string;

  beforeEach(() => {
    ({ app, db, cookie, userId } = createTestApp());
  });

  it("GET /territorio returns 200 with avatar bar + grid + the 3 entity cards", async () => {
    const res = await app.request("/territorio", { headers: { Cookie: cookie } });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("avatar-top-bar");
    expect(html).toContain("territorio-grid");
    expect(html).toMatch(/Cenas|Scenes/);
    expect(html).toMatch(/Travessias|Journeys/);
    expect(html).toMatch(/Organizações|Organizations/);
  });

  it("GET /territorio with empty collections renders empty states for each card", async () => {
    const res = await app.request("/territorio", { headers: { Cookie: cookie } });
    const html = await res.text();
    expect(html).toMatch(/No scenes yet|Nenhuma cena ainda/);
    expect(html).toMatch(/No journeys yet|Nenhuma travessia ainda/);
    expect(html).toMatch(/No organizations yet|Nenhuma organização ainda/);
  });

  it("GET /territorio renders cards with items when collections are populated", async () => {
    createScene(db, userId, "test-scene", { title: "Test Scene" });
    createOrganization(db, userId, "test-org", "Test Org");
    createJourney(db, userId, "test-journey", "Test Journey");
    const res = await app.request("/territorio", { headers: { Cookie: cookie } });
    const html = await res.text();
    expect(html).toContain("Test Scene");
    expect(html).toContain("Test Org");
    expect(html).toContain("Test Journey");
    // Item-level link to the cena workshop
    expect(html).toContain('href="/cenas/test-scene/editar"');
    // "ver →" footer links to the listing pages
    expect(html).toContain('href="/cenas"');
    expect(html).toContain('href="/journeys"');
    expect(html).toContain('href="/organizations"');
  });
});
