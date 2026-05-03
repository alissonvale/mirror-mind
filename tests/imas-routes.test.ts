import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { createHash } from "node:crypto";
import type Database from "better-sqlite3";
import {
  openDb,
  createUser,
  setIdentityLayer,
  createInscription,
  getInscriptionById,
  listActiveInscriptions,
  listArchivedInscriptions,
  type User,
} from "../server/db.js";
import { setupWeb } from "../adapters/web/index.js";

function createTestApp() {
  const db = openDb(":memory:");
  const token = "ins-routes";
  const hash = createHash("sha256").update(token).digest("hex");
  const user = createUser(db, "insrouter", hash);
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

const POST_NO_BODY = (cookie: string) => ({
  method: "POST",
  headers: { Cookie: cookie },
});

describe("web routes — /espelho/imas (CV1.E12.S3 ímãs management)", () => {
  let app: Hono<{ Variables: { user: User } }>;
  let db: Database.Database;
  let cookie: string;
  let userId: string;

  beforeEach(() => {
    ({ app, db, cookie, userId } = createTestApp());
  });

  // --- GET ---

  it("GET /espelho/imas returns 200 with the add form + back link", async () => {
    const res = await app.request("/espelho/imas", {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("imas-add");
    // Back link goes to / (the espelho page lives at root after the swap)
    expect(html).toMatch(/<a[^>]+href="\/"[^>]+class="imas-back"/);
  });

  it("GET /espelho/imas shows the empty-state copy when there are no inscriptions", async () => {
    const res = await app.request("/espelho/imas", {
      headers: { Cookie: cookie },
    });
    const html = await res.text();
    expect(html).toMatch(/Nenhum ímã ainda|No magnets yet/);
  });

  it("GET /espelho/imas lists active inscriptions with their text + author", async () => {
    createInscription(db, userId, "respira.", null);
    createInscription(db, userId, "Festina lente.", "Augustus");
    const res = await app.request("/espelho/imas", {
      headers: { Cookie: cookie },
    });
    const html = await res.text();
    expect(html).toContain("respira.");
    expect(html).toContain("Festina lente.");
    expect(html).toContain("Augustus");
  });

  it("GET /espelho/imas shows the archived band only when there are archived rows", async () => {
    // Without archived: no <details> band element
    const res1 = await app.request("/espelho/imas", {
      headers: { Cookie: cookie },
    });
    expect(await res1.text()).not.toMatch(/<details[^>]+class="imas-archived"/);

    // With one archived: band appears
    const i = createInscription(db, userId, "x");
    const { archiveInscription } = await import("../server/db.js");
    archiveInscription(db, userId, i.id);
    const res2 = await app.request("/espelho/imas", {
      headers: { Cookie: cookie },
    });
    expect(await res2.text()).toMatch(/<details[^>]+class="imas-archived"/);
  });

  // --- POST create ---

  it("POST /espelho/imas creates an inscription and redirects back", async () => {
    const res = await app.request(
      "/espelho/imas",
      POST_FORM(cookie, { text: "respira.", author: "" }),
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/espelho/imas");
    const active = listActiveInscriptions(db, userId);
    expect(active).toHaveLength(1);
    expect(active[0].text).toBe("respira.");
    expect(active[0].author).toBeNull(); // empty author becomes null
  });

  it("POST /espelho/imas accepts an author when provided", async () => {
    await app.request(
      "/espelho/imas",
      POST_FORM(cookie, { text: "Festina lente.", author: "Augustus" }),
    );
    const active = listActiveInscriptions(db, userId);
    expect(active[0].author).toBe("Augustus");
  });

  it("POST /espelho/imas ignores empty text (no row created)", async () => {
    await app.request(
      "/espelho/imas",
      POST_FORM(cookie, { text: "   ", author: "" }),
    );
    expect(listActiveInscriptions(db, userId)).toHaveLength(0);
  });

  // --- POST edit ---

  it("POST /espelho/imas/:id/edit updates text + author", async () => {
    const i = createInscription(db, userId, "old", "old");
    const res = await app.request(
      `/espelho/imas/${i.id}/edit`,
      POST_FORM(cookie, { text: "new", author: "new-author" }),
    );
    expect(res.status).toBe(302);
    const updated = getInscriptionById(db, userId, i.id);
    expect(updated?.text).toBe("new");
    expect(updated?.author).toBe("new-author");
  });

  it("POST /espelho/imas/:id/edit returns 404 for an id the user does not own", async () => {
    // Create a foreign user + their inscription
    const otherHash = createHash("sha256").update("other").digest("hex");
    const other = createUser(db, "otheruser", otherHash);
    const foreign = createInscription(db, other.id, "foreign");

    const res = await app.request(
      `/espelho/imas/${foreign.id}/edit`,
      POST_FORM(cookie, { text: "hijack", author: "" }),
    );
    expect(res.status).toBe(404);
    expect(getInscriptionById(db, other.id, foreign.id)?.text).toBe("foreign");
  });

  // --- POST pin/unpin ---

  it("POST /espelho/imas/:id/pin stamps pinned_at", async () => {
    const i = createInscription(db, userId, "x");
    expect(getInscriptionById(db, userId, i.id)?.pinned_at).toBeNull();
    await app.request(
      `/espelho/imas/${i.id}/pin`,
      POST_NO_BODY(cookie),
    );
    expect(getInscriptionById(db, userId, i.id)?.pinned_at).not.toBeNull();
  });

  it("POST /espelho/imas/:id/unpin clears pinned_at", async () => {
    const { pinInscription } = await import("../server/db.js");
    const i = createInscription(db, userId, "x");
    pinInscription(db, userId, i.id);
    await app.request(
      `/espelho/imas/${i.id}/unpin`,
      POST_NO_BODY(cookie),
    );
    expect(getInscriptionById(db, userId, i.id)?.pinned_at).toBeNull();
  });

  // --- POST archive/unarchive ---

  it("POST /espelho/imas/:id/archive moves the row out of active", async () => {
    const i = createInscription(db, userId, "x");
    await app.request(
      `/espelho/imas/${i.id}/archive`,
      POST_NO_BODY(cookie),
    );
    expect(listActiveInscriptions(db, userId)).toHaveLength(0);
    expect(listArchivedInscriptions(db, userId)).toHaveLength(1);
  });

  it("POST /espelho/imas/:id/unarchive restores the row to active", async () => {
    const { archiveInscription } = await import("../server/db.js");
    const i = createInscription(db, userId, "x");
    archiveInscription(db, userId, i.id);
    await app.request(
      `/espelho/imas/${i.id}/unarchive`,
      POST_NO_BODY(cookie),
    );
    expect(listActiveInscriptions(db, userId)).toHaveLength(1);
  });

  it("POST /espelho/imas/:nonexistent/<action> returns 404", async () => {
    for (const action of ["pin", "unpin", "archive", "unarchive"]) {
      const res = await app.request(
        `/espelho/imas/does-not-exist/${action}`,
        POST_NO_BODY(cookie),
      );
      expect(res.status).toBe(404);
    }
  });
});
