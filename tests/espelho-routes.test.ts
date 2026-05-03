import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { createHash } from "node:crypto";
import type Database from "better-sqlite3";
import {
  openDb,
  createUser,
  setIdentityLayer,
  type User,
} from "../server/db.js";
import { setupWeb } from "../adapters/web/index.js";

function createTestApp() {
  const db = openDb(":memory:");
  const token = "espelho-test";
  const hash = createHash("sha256").update(token).digest("hex");
  const user = createUser(db, "espelhouser", hash);
  setIdentityLayer(db, user.id, "self", "soul", "soul");
  setIdentityLayer(db, user.id, "ego", "identity", "id");
  setIdentityLayer(db, user.id, "ego", "behavior", "behavior");
  const app = new Hono<{ Variables: { user: User } }>();
  setupWeb(app, db);
  return { app, cookie: `mirror_token=${token}` };
}

describe("web routes — /espelho (CV1.E12.S1) + chrome inversion", () => {
  let app: Hono<{ Variables: { user: User } }>;
  let cookie: string;

  beforeEach(() => {
    ({ app, cookie } = createTestApp());
  });

  // --- /espelho (the new contemplative surface) ---

  it("GET /espelho returns 200 with avatar bar + page shell", async () => {
    const res = await app.request("/espelho", { headers: { Cookie: cookie } });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("avatar-top-bar");
    expect(html).toContain("espelho-page");
  });

  it("GET /espelho includes the placeholder copy (S1 shell, S2 will replace)", async () => {
    const res = await app.request("/espelho", { headers: { Cookie: cookie } });
    const html = await res.text();
    expect(html).toContain("espelho-placeholder");
    expect(html).toMatch(/em construção|in progress/i);
  });

  // --- Chrome inversion: logo points to /espelho, Iniciar pill points to / ---

  it("avatar bar on / has brand link → /espelho AND Iniciar pill → /", async () => {
    const res = await app.request("/", { headers: { Cookie: cookie } });
    const html = await res.text();
    // Brand link points to the contemplative page now
    expect(html).toMatch(
      /<a[^>]+href="\/espelho"[^>]+class="avatar-top-bar-brand"/,
    );
    // Operational entry has its own pill, pointing where the logo
    // used to point
    expect(html).toMatch(
      /<a[^>]+href="\/"[^>]+class="avatar-top-bar-start"/,
    );
    expect(html).toMatch(/Iniciar|Start/);
  });

  it("avatar bar on /espelho is identical chrome (brand and pill present)", async () => {
    const res = await app.request("/espelho", { headers: { Cookie: cookie } });
    const html = await res.text();
    expect(html).toMatch(
      /<a[^>]+href="\/espelho"[^>]+class="avatar-top-bar-brand"/,
    );
    expect(html).toMatch(
      /<a[^>]+href="\/"[^>]+class="avatar-top-bar-start"/,
    );
  });

  // --- Avatar dropdown gains an explicit "Início" shortcut ---

  it("avatar dropdown includes Início item pointing to / (operational shortcut)", async () => {
    const res = await app.request("/espelho", { headers: { Cookie: cookie } });
    const html = await res.text();
    // The dropdown has a textual fallback to the operational home,
    // for users who don't immediately recognize what the Iniciar
    // pill does.
    expect(html).toMatch(
      /<a[^>]+href="\/"[^>]+class="avatar-top-bar-dropdown-item"[^>]*>\s*(Início|Home)\s*</,
    );
  });

  it("avatar dropdown does NOT include an Espelho item (logo IS the entry)", async () => {
    // Re-introducing an Espelho menu item would duplicate the logo's
    // role, which is exactly the conflict the chrome inversion
    // exists to resolve.
    const res = await app.request("/espelho", { headers: { Cookie: cookie } });
    const html = await res.text();
    expect(html).not.toMatch(
      /class="avatar-top-bar-dropdown-item"[^>]*>\s*Espelho\s*</,
    );
  });
});
