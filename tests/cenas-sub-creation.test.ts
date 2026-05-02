import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { createHash } from "node:crypto";
import type Database from "better-sqlite3";
import {
  openDb,
  createUser,
  setIdentityLayer,
  getIdentityLayers,
  getOrganizationByKey,
  getJourneyByKey,
  setPersonaIsDraft,
  setOrganizationIsDraft,
  setJourneyIsDraft,
  createOrganization,
  createJourney,
  createDraftPersona,
  type User,
} from "../server/db.js";
import { setupWeb } from "../adapters/web/index.js";

function createTestApp() {
  const db = openDb(":memory:");
  const token = "sub-test-token";
  const hash = createHash("sha256").update(token).digest("hex");
  const user = createUser(db, "subuser", hash);
  setIdentityLayer(db, user.id, "self", "soul", "soul");
  setIdentityLayer(db, user.id, "ego", "identity", "id");
  setIdentityLayer(db, user.id, "ego", "behavior", "behavior");

  const app = new Hono<{ Variables: { user: User } }>();
  setupWeb(app, db);
  return { app, db, userId: user.id, cookie: `mirror_token=${token}` };
}

const POST = (cookie: string, body: unknown) => ({
  method: "POST",
  headers: {
    Cookie: cookie,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(body),
});

describe("/cenas/sub/* — stub-first inline sub-creation (CV1.E11.S7)", () => {
  let app: Hono<{ Variables: { user: User } }>;
  let db: Database.Database;
  let cookie: string;
  let userId: string;

  beforeEach(() => {
    ({ app, db, cookie, userId } = createTestApp());
  });

  // --- Persona ---

  it("POST /cenas/sub/persona creates a draft persona row", async () => {
    const res = await app.request(
      "/cenas/sub/persona",
      POST(cookie, { name: "filosofa", key: "filosofa", description: "Lente filosófica." }),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { key: string; name: string };
    expect(json).toEqual({ key: "filosofa", name: "filosofa" });
    const layer = getIdentityLayers(db, userId).find(
      (l) => l.layer === "persona" && l.key === "filosofa",
    );
    expect(layer).toBeDefined();
    expect(layer?.is_draft).toBe(1);
    expect(layer?.content).toBe("Lente filosófica.");
  });

  it("POST /cenas/sub/persona uses name as content when description is empty", async () => {
    await app.request(
      "/cenas/sub/persona",
      POST(cookie, { name: "barenome", key: "barenome", description: "" }),
    );
    const layer = getIdentityLayers(db, userId).find(
      (l) => l.layer === "persona" && l.key === "barenome",
    );
    expect(layer?.content).toBe("barenome");
  });

  it("POST /cenas/sub/persona returns 409 on existing key", async () => {
    setIdentityLayer(db, userId, "persona", "exists", "real persona");
    const res = await app.request(
      "/cenas/sub/persona",
      POST(cookie, { name: "exists", key: "exists" }),
    );
    expect(res.status).toBe(409);
  });

  it("POST /cenas/sub/persona returns 400 on invalid key format", async () => {
    const res = await app.request(
      "/cenas/sub/persona",
      POST(cookie, { name: "Bad", key: "BAD KEY" }),
    );
    expect(res.status).toBe(400);
  });

  it("POST /cenas/sub/persona returns 400 on empty name", async () => {
    const res = await app.request(
      "/cenas/sub/persona",
      POST(cookie, { name: "  ", key: "noname" }),
    );
    expect(res.status).toBe(400);
  });

  // --- Organization ---

  it("POST /cenas/sub/organization creates a draft org", async () => {
    const res = await app.request(
      "/cenas/sub/organization",
      POST(cookie, { name: "Nova", key: "nova", description: "uma org" }),
    );
    expect(res.status).toBe(200);
    const org = getOrganizationByKey(db, userId, "nova");
    expect(org?.is_draft).toBe(1);
    expect(org?.briefing).toBe("uma org");
  });

  it("POST /cenas/sub/organization 409 on existing key", async () => {
    createOrganization(db, userId, "exists", "Existing");
    const res = await app.request(
      "/cenas/sub/organization",
      POST(cookie, { name: "Existing", key: "exists" }),
    );
    expect(res.status).toBe(409);
  });

  // --- Journey ---

  it("POST /cenas/sub/journey creates a draft journey", async () => {
    const res = await app.request(
      "/cenas/sub/journey",
      POST(cookie, { name: "Caminho", key: "caminho", description: "uma travessia" }),
    );
    expect(res.status).toBe(200);
    const j = getJourneyByKey(db, userId, "caminho");
    expect(j?.is_draft).toBe(1);
    expect(j?.briefing).toBe("uma travessia");
  });

  it("POST /cenas/sub/journey 409 on existing key", async () => {
    createJourney(db, userId, "exists", "Existing");
    const res = await app.request(
      "/cenas/sub/journey",
      POST(cookie, { name: "Existing", key: "exists" }),
    );
    expect(res.status).toBe(409);
  });
});

describe("promote-on-edit (CV1.E11.S7)", () => {
  let db: Database.Database;
  let userId: string;

  beforeEach(() => {
    db = openDb(":memory:");
    const user = createUser(db, "promo", "h");
    userId = user.id;
  });

  it("setPersonaIsDraft(false) flips the flag on a draft persona", () => {
    createDraftPersona(db, userId, "drafty", "drafty", "stub content");
    const before = getIdentityLayers(db, userId).find((l) => l.key === "drafty");
    expect(before?.is_draft).toBe(1);

    expect(setPersonaIsDraft(db, userId, "drafty", false)).toBe(true);

    const after = getIdentityLayers(db, userId).find((l) => l.key === "drafty");
    expect(after?.is_draft).toBe(0);
  });

  it("setPersonaIsDraft(false) on a non-draft persona is a no-op success", () => {
    setIdentityLayer(db, userId, "persona", "real", "real content");
    expect(setPersonaIsDraft(db, userId, "real", false)).toBe(true);
    const layer = getIdentityLayers(db, userId).find((l) => l.key === "real");
    expect(layer?.is_draft).toBe(0);
  });

  it("setOrganizationIsDraft promotes a draft org", () => {
    const org = createOrganization(db, userId, "draft-org", "Org", "", "", true);
    expect(org.is_draft).toBe(1);
    setOrganizationIsDraft(db, userId, "draft-org", false);
    expect(getOrganizationByKey(db, userId, "draft-org")?.is_draft).toBe(0);
  });

  it("setJourneyIsDraft promotes a draft journey", () => {
    const j = createJourney(db, userId, "draft-j", "J", "", "", null, true);
    expect(j.is_draft).toBe(1);
    setJourneyIsDraft(db, userId, "draft-j", false);
    expect(getJourneyByKey(db, userId, "draft-j")?.is_draft).toBe(0);
  });

  it("ownership: setPersonaIsDraft on a foreign user is no-op (returns false)", () => {
    createDraftPersona(db, userId, "owned", "owned", "");
    const other = createUser(db, "other", "h2");
    expect(setPersonaIsDraft(db, other.id, "owned", false)).toBe(false);
    expect(
      getIdentityLayers(db, userId).find((l) => l.key === "owned")?.is_draft,
    ).toBe(1);
  });
});
