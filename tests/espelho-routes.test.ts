import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { createHash } from "node:crypto";
import type Database from "better-sqlite3";
import {
  openDb,
  createUser,
  setIdentityLayer,
  createScene,
  createJourney,
  createOrganization,
  createFreshSession,
  addSessionJourney,
  getLastMirrorVisit,
  setLastMirrorVisit,
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
  return { app, db, userId: user.id, cookie: `mirror_token=${token}` };
}

describe("web routes — /espelho (CV1.E12.S1 chrome + S2 synthesis)", () => {
  let app: Hono<{ Variables: { user: User } }>;
  let db: Database.Database;
  let cookie: string;
  let userId: string;

  beforeEach(() => {
    ({ app, db, cookie, userId } = createTestApp());
  });

  // --- Page returns 200 with chrome ---

  it("GET /espelho returns 200 with avatar bar + page shell", async () => {
    const res = await app.request("/", { headers: { Cookie: cookie } });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("avatar-top-bar");
    expect(html).toContain("espelho-page");
  });

  // --- Empty state for users with no synthesis-worthy data ---

  it("renders the espelho-empty copy when user has no journeys/scenes/sessions/layers", async () => {
    // The default test user has minimal seed layers — wipe them so
    // synthesis truly has nothing to reflect, and the page falls to
    // the empty-state copy.
    db.prepare("DELETE FROM identity WHERE user_id = ?").run(userId);
    const res = await app.request("/", { headers: { Cookie: cookie } });
    const html = await res.text();
    expect(html).toMatch(/Ainda não há substância|Nothing yet for the Mirror/);
  });

  // --- Populated state renders 3 depth panes (Vivo → Estou → Sou) + drill-downs ---

  it("renders 3 depth panes + drill-down links + the focus journey inside Vivo", async () => {
    const { addSessionJourney } = await import("../server/db.js");
    createJourney(db, userId, "mirror-mind", "Mirror Mind");
    createScene(db, userId, "diario", { title: "Diário" });
    const sess = createFreshSession(db, userId, null);
    addSessionJourney(db, sess, "mirror-mind");

    const res = await app.request("/", { headers: { Cookie: cookie } });
    const html = await res.text();

    // Three depth panes — titles flipped to the questions each pane
    // answers (subtitle carries the placa-style descriptor below).
    expect(html).toContain("espelho-pane-heading");
    expect(html).toMatch(/Who am I\?|Quem sou\?/);
    expect(html).toMatch(/Where do I operate\?|Por onde opero\?/);
    expect(html).toMatch(/What am I living\?|O que estou vivendo\?/);

    // Focus journey now lives in Vivo as a tag — the journey name renders
    expect(html).toMatch(/Mirror Mind/);

    // Glance no longer rendered — there's no top sentence anymore
    expect(html).not.toMatch(/<p[^>]+class="espelho-glance"/);

    // Column order: Vivo first, Estou middle, Sou last.
    // Match the actual <article> opening, not any data-axis string —
    // the CSS rules in the inline <style> block also contain
    // `data-axis="..."` selectors which would race indexOf otherwise.
    const vivoIdx = html.indexOf('<article class="espelho-pane" data-axis="vivo"');
    const estouIdx = html.indexOf('<article class="espelho-pane" data-axis="estou"');
    const souIdx = html.indexOf('<article class="espelho-pane" data-axis="sou"');
    expect(vivoIdx).toBeGreaterThan(-1);
    expect(vivoIdx).toBeLessThan(estouIdx);
    expect(estouIdx).toBeLessThan(souIdx);

    // Drill-down links — Sou pane links to /identidade post CV1.E14
    // (was /map under the cognitive-map metaphor).
    expect(html).toContain('href="/identidade"');
    expect(html).toContain('href="/territorio"');
    expect(html).toContain('href="/memorias"');
  });

  // --- Inscription block (S3) ---

  it("renders the inscription mounting <aside> regardless of state", async () => {
    const res = await app.request("/", { headers: { Cookie: cookie } });
    const html = await res.text();
    expect(html).toContain("espelho-inscription");
  });

  it("renders an inscription's text + author at the top when one is active", async () => {
    const { createInscription } = await import("../server/db.js");
    createInscription(db, userId, "Festina lente.", "Augustus");
    const res = await app.request("/", { headers: { Cookie: cookie } });
    const html = await res.text();
    expect(html).toContain("espelho-inscription-text");
    expect(html).toContain("Festina lente.");
    expect(html).toContain("Augustus");
  });

  it("does NOT render the inscription text block when the user has no active inscriptions", async () => {
    const res = await app.request("/", { headers: { Cookie: cookie } });
    const html = await res.text();
    // The mounting <aside> is present (so CSS :empty hides it) but
    // the <blockquote> with the text class only appears when an
    // inscription is rendered. Probe the actual element opener, not
    // the substring (the CSS rule lives in the inline <style> too).
    expect(html).not.toMatch(/<blockquote[^>]+class="espelho-inscription-text"/);
  });

  it("includes the discrete footer link to the ímãs management page", async () => {
    const res = await app.request("/", { headers: { Cookie: cookie } });
    const html = await res.text();
    expect(html).toMatch(/<a[^>]+href="\/espelho\/imas"/);
  });

  // --- last_mirror_visit_at updated on visit ---

  it("stamps last_mirror_visit_at after the GET", async () => {
    expect(getLastMirrorVisit(db, userId)).toBeNull();
    await app.request("/", { headers: { Cookie: cookie } });
    const stamped = getLastMirrorVisit(db, userId);
    expect(stamped).not.toBeNull();
    expect(stamped!).toBeGreaterThan(0);
  });

  // --- "What shifted" surfaces only when there's a previous visit ---

  it("does NOT render the shifts list on the first ever visit (lastVisit is null)", async () => {
    // No matter what's in the DB, first visit shows no shift markers —
    // there's no baseline to diff against. (We probe for the actual
    // <ul> opening tag, not the substring, because the CSS rule
    // `.espelho-shifts` lives in the inline <style> block on every
    // render.)
    createJourney(db, userId, "fresh", "Fresh");
    const res = await app.request("/", { headers: { Cookie: cookie } });
    const html = await res.text();
    expect(html).not.toMatch(/<ul[^>]+class="espelho-shifts"/);
  });

  it("renders the shifts list after a previous visit when something changed since", async () => {
    // Simulate a previous visit 1 hour ago — bypassing the GET
    // (which would stamp the timestamp to now and void the diff).
    setLastMirrorVisit(db, userId, Date.now() - 60 * 60 * 1000);
    // Then create a new journey AFTER the simulated last visit
    createJourney(db, userId, "fresh", "Fresh Journey");

    const res = await app.request("/", { headers: { Cookie: cookie } });
    const html = await res.text();
    expect(html).toMatch(/<ul[^>]+class="espelho-shifts"/);
    // Marker text + linked entity name (entity now lives inside an <a>)
    expect(html).toMatch(/Nova travessia|New journey/);
    expect(html).toContain("Fresh Journey");
    expect(html).toContain('href="/journeys/fresh"');
  });

  // --- Voice-of-the-mirror constraints (no timestamps surfaced) ---

  it("does NOT render any 'updated N hours ago' or absolute timestamp on /espelho", async () => {
    // The mirror is in present-tense — no document timestamps.
    createOrganization(db, userId, "sz", "Software Zen");
    const res = await app.request("/", { headers: { Cookie: cookie } });
    const html = await res.text();
    expect(html).not.toMatch(/atualizado há \d+\s*h|updated \d+\s*h ago/i);
  });

  // --- Chrome inversion sanity (still in place after S2 changes) ---

  it("avatar bar has brand link → / AND Iniciar pill → /inicio (post-swap)", async () => {
    const res = await app.request("/", { headers: { Cookie: cookie } });
    const html = await res.text();
    expect(html).toMatch(
      /<a[^>]+href="\/"[^>]+class="avatar-top-bar-brand"/,
    );
    expect(html).toMatch(
      /<a[^>]+href="\/inicio"[^>]+class="avatar-top-bar-start"/,
    );
  });
});
