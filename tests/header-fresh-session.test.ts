import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { createHash } from "node:crypto";
import {
  openDb,
  createUser,
  setIdentityLayer,
  type User,
} from "../server/db.js";
import { setupWeb } from "../adapters/web/index.js";

/**
 * Probe: in a fresh session (no messages yet), does the conversation
 * header still render the Advanced zone? User reported it disappearing.
 */
describe("conversation header — fresh session probe", () => {
  it("renders the Advanced zone even when there are no messages", async () => {
    const db = openDb(":memory:");
    const token = "fresh-probe";
    const hash = createHash("sha256").update(token).digest("hex");
    const user = createUser(db, "freshuser", hash);
    setIdentityLayer(db, user.id, "self", "soul", "soul");
    setIdentityLayer(db, user.id, "ego", "identity", "id");
    setIdentityLayer(db, user.id, "ego", "behavior", "behavior");

    const app = new Hono<{ Variables: { user: User } }>();
    setupWeb(app, db);

    const res = await app.request("/conversation", {
      headers: { Cookie: `mirror_token=${token}` },
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    // The Advanced pouch is the unique fingerprint — pill summary
    // contains the localized "Advanced" / "Avançado" text and the
    // pouch class anchors it.
    expect(html).toContain("header-advanced-pouch");
    expect(html).toContain("header-advanced-pill");
  });
});
