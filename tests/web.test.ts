import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { createHash } from "node:crypto";
import type Database from "better-sqlite3";
import {
  openDb,
  createUser,
  setIdentityLayer,
  getIdentityLayers,
  getOrCreateSession,
  appendEntry,
  loadMessages,
  type User,
} from "../server/db.js";
import { setupWeb } from "../adapters/web/index.js";

function createTestApp(): {
  app: Hono<{ Variables: { user: User } }>;
  db: Database.Database;
  token: string;
  userId: string;
} {
  const db = openDb(":memory:");
  const token = "test-token-123";
  const hash = createHash("sha256").update(token).digest("hex");
  const user = createUser(db, "testuser", hash);
  setIdentityLayer(db, user.id, "self", "soul", "Test soul");
  setIdentityLayer(db, user.id, "ego", "identity", "Test identity");
  setIdentityLayer(db, user.id, "ego", "behavior", "Test behavior");

  const app = new Hono<{ Variables: { user: User } }>();
  setupWeb(app, db);

  return { app, db, token, userId: user.id };
}

function createTestAppWithRoles(): {
  app: Hono<{ Variables: { user: User } }>;
  db: Database.Database;
  adminToken: string;
  userToken: string;
} {
  const db = openDb(":memory:");

  const adminToken = "admin-token";
  const adminHash = createHash("sha256").update(adminToken).digest("hex");
  const admin = createUser(db, "adminuser", adminHash); // first → admin
  setIdentityLayer(db, admin.id, "self", "soul", "admin soul");
  setIdentityLayer(db, admin.id, "ego", "identity", "admin identity");
  setIdentityLayer(db, admin.id, "ego", "behavior", "admin behavior");

  const userToken = "user-token";
  const userHash = createHash("sha256").update(userToken).digest("hex");
  const regular = createUser(db, "regularuser", userHash); // second → user
  setIdentityLayer(db, regular.id, "self", "soul", "regular soul");
  setIdentityLayer(db, regular.id, "ego", "identity", "regular identity");
  setIdentityLayer(db, regular.id, "ego", "behavior", "regular behavior");

  const app = new Hono<{ Variables: { user: User } }>();
  setupWeb(app, db);

  return { app, db, adminToken, userToken };
}

function cookieHeader(token: string): string {
  return `mirror_token=${token}`;
}

describe("web routes — login", () => {
  let app: Hono<{ Variables: { user: User } }>;
  let token: string;

  beforeEach(() => {
    ({ app, token } = createTestApp());
  });

  it("GET /login returns login page", async () => {
    const res = await app.request("/login");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Login");
    expect(html).toContain('name="token"');
  });

  it("POST /login with valid token redirects to /mirror", async () => {
    const res = await app.request("/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `token=${token}`,
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/mirror");
  });

  it("POST /login with invalid token shows error", async () => {
    const res = await app.request("/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "token=wrong-token",
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Invalid token");
  });

  it("POST /login with empty token shows error", async () => {
    const res = await app.request("/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "token=",
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Token is required");
  });

  it("POST /logout redirects to /login", async () => {
    const res = await app.request("/logout", { method: "POST" });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/login");
  });
});

describe("web routes — auth required", () => {
  let app: Hono<{ Variables: { user: User } }>;
  let token: string;

  beforeEach(() => {
    ({ app, token } = createTestApp());
  });

  it("GET /mirror without cookie redirects to /login", async () => {
    const res = await app.request("/mirror");
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/login");
  });

  it("GET /mirror with valid cookie returns mirror page", async () => {
    const res = await app.request("/mirror", {
      headers: { Cookie: cookieHeader(token) },
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("chat-form");
    expect(html).toContain("messages");
  });

  it("GET /mirror with invalid cookie redirects to /login", async () => {
    const res = await app.request("/mirror", {
      headers: { Cookie: cookieHeader("bad-token") },
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/login");
  });

  it("legacy /chat redirects to /mirror for authenticated users", async () => {
    const res = await app.request("/chat", {
      headers: { Cookie: cookieHeader(token) },
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/mirror");
  });
});

describe("web routes — admin", () => {
  let app: Hono<{ Variables: { user: User } }>;
  let token: string;

  beforeEach(() => {
    ({ app, token } = createTestApp());
  });

  it("GET /admin/users lists users", async () => {
    const res = await app.request("/admin/users", {
      headers: { Cookie: cookieHeader(token) },
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("testuser");
  });

  it("GET /admin/users/:name redirects to /map/:name (legacy → Cognitive Map)", async () => {
    const res = await app.request("/admin/users/testuser", {
      headers: { Cookie: cookieHeader(token) },
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/map/testuser");
  });

  it("GET /admin/users/:name returns 404 for unknown user", async () => {
    const res = await app.request("/admin/users/nobody", {
      headers: { Cookie: cookieHeader(token) },
    });
    expect(res.status).toBe(404);
  });

  it("GET /admin/identity/:name redirects to /map/:name", async () => {
    const res = await app.request("/admin/identity/testuser", {
      headers: { Cookie: cookieHeader(token) },
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/map/testuser");
  });

  it("GET /admin/personas/:name redirects to /map/:name", async () => {
    const res = await app.request("/admin/personas/testuser", {
      headers: { Cookie: cookieHeader(token) },
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/map/testuser");
  });
});

describe("web routes — context rail", () => {
  let app: Hono<{ Variables: { user: User } }>;
  let token: string;
  let db: Database.Database;
  let userId: string;

  beforeEach(() => {
    ({ app, token, db, userId } = createTestApp());
  });

  it("GET /mirror renders the rail container", async () => {
    const res = await app.request("/mirror", {
      headers: { Cookie: cookieHeader(token) },
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('id="context-rail"');
    expect(html).toContain("rail-persona");
    expect(html).toContain("rail-session");
    expect(html).toContain("rail-composed");
  });

  it("shows the 'ego · voz base' empty state when no persona is active", async () => {
    const res = await app.request("/mirror", {
      headers: { Cookie: cookieHeader(token) },
    });
    const html = await res.text();
    expect(html).toContain("voz base");
    expect(html).toContain('data-persona=""');
  });

  it("shows the last persona when it is present on the most recent assistant entry", async () => {
    setIdentityLayer(
      db,
      userId,
      "persona",
      "mentora",
      "You are a warm mentor with a calm voice.",
    );
    const sessionId = getOrCreateSession(db, userId);
    appendEntry(db, sessionId, null, "message", {
      role: "user",
      content: "hi",
    });
    appendEntry(db, sessionId, null, "message", {
      role: "assistant",
      content: [{ type: "text", text: "hello" }],
      _persona: "mentora",
    });

    const res = await app.request("/mirror", {
      headers: { Cookie: cookieHeader(token) },
    });
    const html = await res.text();
    expect(html).toContain('data-persona="mentora"');
    expect(html).toContain("mentora");
    // composed section shows ◇ persona signature
    expect(html).toContain("◇ mentora");
  });

  it("lists composed layers in the rail", async () => {
    const res = await app.request("/mirror", {
      headers: { Cookie: cookieHeader(token) },
    });
    const html = await res.text();
    expect(html).toContain("self.soul");
    expect(html).toContain("ego.identity");
    expect(html).toContain("ego.behavior");
  });

  it("footer link points to the user's Cognitive Map", async () => {
    const res = await app.request("/mirror", {
      headers: { Cookie: cookieHeader(token) },
    });
    const html = await res.text();
    expect(html).toContain('href="/map"');
    expect(html).toContain("Grounded in your identity");
  });
});

describe("web routes — sidebar identity and role", () => {
  it("shows the logged-in user's name in the sidebar", async () => {
    const { app, adminToken } = createTestAppWithRoles();
    const res = await app.request("/mirror", {
      headers: { Cookie: cookieHeader(adminToken) },
    });
    const html = await res.text();
    expect(html).toContain("sidebar-user");
    expect(html).toContain("sidebar-avatar");
    expect(html).toContain("adminuser");
  });

  it("admin sees the Users link in the sidebar", async () => {
    const { app, adminToken } = createTestAppWithRoles();
    const res = await app.request("/mirror", {
      headers: { Cookie: cookieHeader(adminToken) },
    });
    const html = await res.text();
    expect(html).toContain('href="/admin/users"');
  });

  it("regular user does not see the Users link in the sidebar", async () => {
    const { app, userToken } = createTestAppWithRoles();
    const res = await app.request("/mirror", {
      headers: { Cookie: cookieHeader(userToken) },
    });
    const html = await res.text();
    expect(html).not.toContain('href="/admin/users"');
  });
});

describe("web routes — admin guard", () => {
  it("admin can access /admin/users", async () => {
    const { app, adminToken } = createTestAppWithRoles();
    const res = await app.request("/admin/users", {
      headers: { Cookie: cookieHeader(adminToken) },
    });
    expect(res.status).toBe(200);
  });

  it("regular user gets 403 on /admin/users", async () => {
    const { app, userToken } = createTestAppWithRoles();
    const res = await app.request("/admin/users", {
      headers: { Cookie: cookieHeader(userToken) },
    });
    expect(res.status).toBe(403);
  });

  it("regular user gets 403 on /admin/users/:name", async () => {
    const { app, userToken } = createTestAppWithRoles();
    const res = await app.request("/admin/users/adminuser", {
      headers: { Cookie: cookieHeader(userToken) },
    });
    expect(res.status).toBe(403);
  });

  it("regular user gets 403 on legacy /admin/identity redirect", async () => {
    const { app, userToken } = createTestAppWithRoles();
    const res = await app.request("/admin/identity/adminuser", {
      headers: { Cookie: cookieHeader(userToken) },
    });
    expect(res.status).toBe(403);
  });

  it("regular user gets 403 on legacy /admin/personas redirect", async () => {
    const { app, userToken } = createTestAppWithRoles();
    const res = await app.request("/admin/personas/adminuser", {
      headers: { Cookie: cookieHeader(userToken) },
    });
    expect(res.status).toBe(403);
  });

  it("regular user gets 403 on POST /admin/users", async () => {
    const { app, userToken } = createTestAppWithRoles();
    const res = await app.request("/admin/users", {
      method: "POST",
      headers: {
        Cookie: cookieHeader(userToken),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "name=intruder",
    });
    expect(res.status).toBe(403);
  });
});

describe("web routes — create user with role", () => {
  it("POST /admin/users without is_admin creates a regular user", async () => {
    const { app, db, adminToken } = createTestAppWithRoles();
    const res = await app.request("/admin/users", {
      method: "POST",
      headers: {
        Cookie: cookieHeader(adminToken),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "name=alice",
    });
    expect(res.status).toBe(200);
    const created = db
      .prepare("SELECT role FROM users WHERE name = ?")
      .get("alice") as { role: string } | undefined;
    expect(created?.role).toBe("user");
  });

  it("POST /admin/users with is_admin=1 creates an admin", async () => {
    const { app, db, adminToken } = createTestAppWithRoles();
    const res = await app.request("/admin/users", {
      method: "POST",
      headers: {
        Cookie: cookieHeader(adminToken),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "name=bob&is_admin=1",
    });
    expect(res.status).toBe(200);
    const created = db
      .prepare("SELECT role FROM users WHERE name = ?")
      .get("bob") as { role: string } | undefined;
    expect(created?.role).toBe("admin");
  });
});

// ---------------------------------------------------------------------------
// CV0.E2.S8 — Cognitive Map
// ---------------------------------------------------------------------------

describe("web routes — cognitive map dashboard", () => {
  let app: Hono<{ Variables: { user: User } }>;
  let token: string;

  beforeEach(() => {
    ({ app, token } = createTestApp());
  });

  it("GET /map returns 200 with the identity title and all five cards", async () => {
    const res = await app.request("/map", {
      headers: { Cookie: cookieHeader(token) },
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Cognitive Map of");
    expect(html).toContain("testuser");
    expect(html).toContain('data-layer="self-soul"');
    expect(html).toContain('data-layer="ego-identity"');
    expect(html).toContain('data-layer="ego-behavior"');
    expect(html).toContain('data-layer="personas"');
    expect(html).toContain('data-layer="skills"');
  });

  it("shows the memory column with shortcuts to rail, conversations, insights", async () => {
    const res = await app.request("/map", {
      headers: { Cookie: cookieHeader(token) },
    });
    const html = await res.text();
    expect(html).toContain('data-layer="memory"');
    expect(html).toContain("Attention");
    expect(html).toContain("Conversations");
    expect(html).toContain("Insights");
  });

  it("renders real session stats on the memory card", async () => {
    const { app: freshApp, token: freshToken, db: freshDb, userId: freshUserId } =
      createTestApp();
    // A fresh user has no sessions yet → card shows "0 sessions"
    let res = await freshApp.request("/map", {
      headers: { Cookie: cookieHeader(freshToken) },
    });
    let html = await res.text();
    expect(html).toContain("0 sessions");

    // Create a session; the next render shows "1 session · last just now"
    getOrCreateSession(freshDb, freshUserId);
    res = await freshApp.request("/map", {
      headers: { Cookie: cookieHeader(freshToken) },
    });
    html = await res.text();
    expect(html).toContain("1 session");
    expect(html).toContain("last just now");
  });

  it("shows the self-service edit affordance for the logged-in user's name", async () => {
    const res = await app.request("/map", {
      headers: { Cookie: cookieHeader(token) },
    });
    const html = await res.text();
    expect(html).toContain('href="/map?editName=1"');
  });

  it("GET /map?editName=1 renders the name edit form", async () => {
    const res = await app.request("/map?editName=1", {
      headers: { Cookie: cookieHeader(token) },
    });
    const html = await res.text();
    expect(html).toContain('class="map-identity-form"');
    expect(html).toContain('name="name"');
  });

  it("empty structural cards render rich invitations, not grey placeholders", async () => {
    // Fresh user with no layers beyond what createTestApp seeds.
    // We delete soul/identity/behavior to force the empty state.
    const fresh = createTestApp();
    const bareDb = fresh.db;
    const bareUserId = fresh.userId;
    bareDb.prepare("DELETE FROM identity WHERE user_id = ?").run(bareUserId);

    const res = await fresh.app.request("/map", {
      headers: { Cookie: cookieHeader(fresh.token) },
    });
    const html = await res.text();
    // Each structural card carries its own invitation, not a placeholder.
    expect(html).toContain("Your soul is the deepest voice");
    expect(html).toContain("Your operational identity");
    expect(html).toContain("Your behavior");
    // Personas card shows its invitation when no persona exists.
    expect(html).toContain(
      "Personas are the specialized voices the mirror speaks in",
    );
    // Skills keeps its S8 invitation intact.
    expect(html).toContain("Skills are what the mirror knows how to do");
  });

  it("Personas invitation disappears once at least one persona exists", async () => {
    const fresh = createTestApp();
    setIdentityLayer(fresh.db, fresh.userId, "persona", "mentora", "a voice");

    const res = await fresh.app.request("/map", {
      headers: { Cookie: cookieHeader(fresh.token) },
    });
    const html = await res.text();
    expect(html).not.toContain(
      "Personas are the specialized voices the mirror speaks in",
    );
    expect(html).toContain("mentora"); // badge rendered
  });
});

describe("web routes — layer workshop", () => {
  let app: Hono<{ Variables: { user: User } }>;
  let token: string;
  let db: Database.Database;
  let userId: string;

  beforeEach(() => {
    ({ app, token, db, userId } = createTestApp());
  });

  it("GET /map/self/soul renders the workshop with current content", async () => {
    const res = await app.request("/map/self/soul", {
      headers: { Cookie: cookieHeader(token) },
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("workshop-textarea");
    expect(html).toContain("Test soul");
    expect(html).toContain("workshop-preview");
  });

  it("GET /map/unknown/key returns 404 for non-allowed layers", async () => {
    const res = await app.request("/map/unknown/thing", {
      headers: { Cookie: cookieHeader(token) },
    });
    expect(res.status).toBe(404);
  });

  it("POST /map/self/soul saves the content and redirects to /map", async () => {
    const res = await app.request("/map/self/soul", {
      method: "POST",
      headers: {
        Cookie: cookieHeader(token),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "content=I am my new soul",
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/map");
    const saved = getIdentityLayers(db, userId).find(
      (l) => l.layer === "self" && l.key === "soul",
    );
    expect(saved?.content).toBe("I am my new soul");
  });

  it("POST /map/self/soul/compose returns JSON with the draft applied", async () => {
    const res = await app.request("/map/self/soul/compose", {
      method: "POST",
      headers: {
        Cookie: cookieHeader(token),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "content=DRAFT SOUL",
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { composed: string };
    expect(body.composed).toContain("DRAFT SOUL");
    // Non-overridden layers still appear
    expect(body.composed).toContain("Test identity");
  });
});

describe("web routes — persona CRUD via /map", () => {
  let app: Hono<{ Variables: { user: User } }>;
  let token: string;
  let db: Database.Database;
  let userId: string;

  beforeEach(() => {
    ({ app, token, db, userId } = createTestApp());
  });

  it("POST /map/persona creates a new persona and redirects", async () => {
    const res = await app.request("/map/persona", {
      method: "POST",
      headers: {
        Cookie: cookieHeader(token),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "name=mentora&content=You are a calm mentor",
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/map");
    const created = getIdentityLayers(db, userId).find(
      (l) => l.layer === "persona" && l.key === "mentora",
    );
    expect(created?.content).toBe("You are a calm mentor");
  });

  it("POST /map/persona rejects invalid name pattern", async () => {
    const res = await app.request("/map/persona", {
      method: "POST",
      headers: {
        Cookie: cookieHeader(token),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "name=Bad%20Name&content=something",
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("lowercase letters, numbers, and hyphens");
  });

  it("POST /map/persona rejects duplicate name", async () => {
    setIdentityLayer(db, userId, "persona", "mentora", "existing");
    const res = await app.request("/map/persona", {
      method: "POST",
      headers: {
        Cookie: cookieHeader(token),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "name=mentora&content=another",
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("already exists");
    const stored = getIdentityLayers(db, userId).find(
      (l) => l.layer === "persona" && l.key === "mentora",
    );
    expect(stored?.content).toBe("existing"); // unchanged
  });

  it("POST /map/persona/:key updates an existing persona", async () => {
    setIdentityLayer(db, userId, "persona", "mentora", "v1");
    const res = await app.request("/map/persona/mentora", {
      method: "POST",
      headers: {
        Cookie: cookieHeader(token),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "content=v2",
    });
    expect(res.status).toBe(302);
    const updated = getIdentityLayers(db, userId).find(
      (l) => l.layer === "persona" && l.key === "mentora",
    );
    expect(updated?.content).toBe("v2");
  });

  it("POST /map/persona/:key/delete removes the persona", async () => {
    setIdentityLayer(db, userId, "persona", "mentora", "bye");
    const res = await app.request("/map/persona/mentora/delete", {
      method: "POST",
      headers: { Cookie: cookieHeader(token) },
    });
    expect(res.status).toBe(302);
    const exists = getIdentityLayers(db, userId).find(
      (l) => l.layer === "persona" && l.key === "mentora",
    );
    expect(exists).toBeUndefined();
  });
});

describe("web routes — self-service name edit", () => {
  let app: Hono<{ Variables: { user: User } }>;
  let token: string;
  let db: Database.Database;
  let userId: string;

  beforeEach(() => {
    ({ app, token, db, userId } = createTestApp());
  });

  it("POST /map/name updates the user's display name and redirects", async () => {
    const res = await app.request("/map/name", {
      method: "POST",
      headers: {
        Cookie: cookieHeader(token),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "name=newname",
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/map");
    const row = db
      .prepare("SELECT name FROM users WHERE id = ?")
      .get(userId) as { name: string };
    expect(row.name).toBe("newname");
  });

  it("POST /map/name allows names with spaces", async () => {
    const res = await app.request("/map/name", {
      method: "POST",
      headers: {
        Cookie: cookieHeader(token),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "name=Alisson+Vale",
    });
    expect(res.status).toBe(302);
    const row = db
      .prepare("SELECT name FROM users WHERE id = ?")
      .get(userId) as { name: string };
    expect(row.name).toBe("Alisson Vale");
  });

  it("POST /map/name rejects names containing slashes", async () => {
    const res = await app.request("/map/name", {
      method: "POST",
      headers: {
        Cookie: cookieHeader(token),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "name=foo%2Fbar",
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("cannot contain slashes");
  });

  it("POST /map/name rejects empty names", async () => {
    const res = await app.request("/map/name", {
      method: "POST",
      headers: {
        Cookie: cookieHeader(token),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "name=%20%20%20",
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("cannot be empty");
  });
});

describe("web routes — cognitive map admin modality", () => {
  it("GET /map/:name is 403 for non-admin users", async () => {
    const { app, userToken } = createTestAppWithRoles();
    const res = await app.request("/map/adminuser", {
      headers: { Cookie: cookieHeader(userToken) },
    });
    expect(res.status).toBe(403);
  });

  it("admin GET /map/:name renders the target user's map", async () => {
    const { app, adminToken } = createTestAppWithRoles();
    const res = await app.request("/map/regularuser", {
      headers: { Cookie: cookieHeader(adminToken) },
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Cognitive Map of");
    expect(html).toContain("regularuser");
    expect(html).toContain("viewing as admin");
    // Name edit is hidden when viewing another user's map
    expect(html).not.toContain('href="/map?editName=1"');
  });

  it("admin GET /map/:name/self/soul renders the target's workshop", async () => {
    const { app, adminToken } = createTestAppWithRoles();
    const res = await app.request("/map/regularuser/self/soul", {
      headers: { Cookie: cookieHeader(adminToken) },
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    // Target's content, not the admin's
    expect(html).toContain("regular soul");
    // Form action and compose endpoint include the target user's name
    expect(html).toContain("/map/regularuser/self/soul");
    expect(html).toContain("/map/regularuser/self/soul/compose");
  });

  it("admin POST /map/:name/self/soul saves on the target and redirects to their map", async () => {
    const { app, db, adminToken } = createTestAppWithRoles();
    const res = await app.request("/map/regularuser/self/soul", {
      method: "POST",
      headers: {
        Cookie: cookieHeader(adminToken),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "content=rewritten+by+admin",
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/map/regularuser");
    const regular = db
      .prepare("SELECT id FROM users WHERE name = ?")
      .get("regularuser") as { id: string };
    const soul = getIdentityLayers(db, regular.id).find(
      (l) => l.layer === "self" && l.key === "soul",
    );
    expect(soul?.content).toBe("rewritten by admin");
  });

  it("admin POST /map/:name/persona creates a persona on the target user", async () => {
    const { app, db, adminToken } = createTestAppWithRoles();
    const res = await app.request("/map/regularuser/persona", {
      method: "POST",
      headers: {
        Cookie: cookieHeader(adminToken),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "name=mentora&content=created+by+admin",
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/map/regularuser");
    const regular = db
      .prepare("SELECT id FROM users WHERE name = ?")
      .get("regularuser") as { id: string };
    const persona = getIdentityLayers(db, regular.id).find(
      (l) => l.layer === "persona" && l.key === "mentora",
    );
    expect(persona?.content).toBe("created by admin");
  });

  it("regular user POST /map/:name/persona returns 403", async () => {
    const { app, userToken } = createTestAppWithRoles();
    const res = await app.request("/map/adminuser/persona", {
      method: "POST",
      headers: {
        Cookie: cookieHeader(userToken),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "name=intruder&content=nope",
    });
    expect(res.status).toBe(403);
  });
});


// ---------------------------------------------------------------------------
// CV1.E3.S4 — Reset conversation
// ---------------------------------------------------------------------------

describe("web routes — session lifecycle (reset)", () => {
  let app: Hono<{ Variables: { user: User } }>;
  let token: string;
  let db: Database.Database;
  let userId: string;

  beforeEach(() => {
    ({ app, token, db, userId } = createTestApp());
  });

  it("POST /mirror/begin-again creates a new session and preserves the old one", async () => {
    // Establish an existing session with one message so it's distinct.
    const originalSessionId = getOrCreateSession(db, userId);
    appendEntry(db, originalSessionId, null, "message", {
      role: "user",
      content: "hello",
    });

    const res = await app.request("/mirror/begin-again", {
      method: "POST",
      headers: { Cookie: cookieHeader(token) },
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/mirror");

    // Two sessions exist now; original still carries its entry.
    const rows = db
      .prepare("SELECT id FROM sessions WHERE user_id = ? ORDER BY created_at")
      .all(userId) as { id: string }[];
    expect(rows).toHaveLength(2);
    expect(rows[0].id).toBe(originalSessionId);
    expect(loadMessages(db, originalSessionId)).toHaveLength(1);

    // getOrCreateSession now returns the new, empty session.
    const currentSessionId = getOrCreateSession(db, userId);
    expect(currentSessionId).not.toBe(originalSessionId);
    expect(loadMessages(db, currentSessionId)).toHaveLength(0);
  });

  it("POST /mirror/forget deletes entries and the session row, then starts fresh", async () => {
    const original = getOrCreateSession(db, userId);
    appendEntry(db, original, null, "message", {
      role: "user",
      content: "to be forgotten",
    });

    const res = await app.request("/mirror/forget", {
      method: "POST",
      headers: { Cookie: cookieHeader(token) },
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/mirror");

    // Original session is gone entirely — row + entries.
    const row = db
      .prepare("SELECT id FROM sessions WHERE id = ?")
      .get(original) as { id: string } | undefined;
    expect(row).toBeUndefined();
    const entries = db
      .prepare("SELECT id FROM entries WHERE session_id = ?")
      .all(original) as { id: string }[];
    expect(entries).toHaveLength(0);

    // A fresh session took its place.
    const current = getOrCreateSession(db, userId);
    expect(current).not.toBe(original);
    expect(loadMessages(db, current)).toHaveLength(0);
  });

  it("mirror page renders the Begin again and Forget actions in the rail", async () => {
    const res = await app.request("/mirror", {
      headers: { Cookie: cookieHeader(token) },
    });
    const html = await res.text();
    expect(html).toContain('action="/mirror/begin-again"');
    expect(html).toContain("Begin again");
    expect(html).toContain('action="/mirror/forget"');
    expect(html).toContain("Forget this conversation");
  });
});

// ---------------------------------------------------------------------------
// CV0.E3.S3 — In-app docs reader
// ---------------------------------------------------------------------------

describe("web routes — docs reader", () => {
  it("regular user gets 403 on /docs", async () => {
    const { app, userToken } = createTestAppWithRoles();
    const res = await app.request("/docs", {
      headers: { Cookie: cookieHeader(userToken) },
    });
    expect(res.status).toBe(403);
  });

  it("regular user gets 403 on /docs/<path>", async () => {
    const { app, userToken } = createTestAppWithRoles();
    const res = await app.request("/docs/process/worklog", {
      headers: { Cookie: cookieHeader(userToken) },
    });
    expect(res.status).toBe(403);
  });

  it("admin GET /docs renders the docs index with the nav tree", async () => {
    const { app, adminToken } = createTestAppWithRoles();
    const res = await app.request("/docs", {
      headers: { Cookie: cookieHeader(adminToken) },
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    // The nav header and root link render
    expect(html).toContain("docs-nav-root");
    // Prose container renders
    expect(html).toContain("docs-prose");
  });

  it("admin GET /docs/<valid-path> renders the page", async () => {
    const { app, adminToken } = createTestAppWithRoles();
    // worklog is a stable, short-named doc that exists in the repo
    const res = await app.request("/docs/process/worklog", {
      headers: { Cookie: cookieHeader(adminToken) },
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Worklog");
  });

  it("admin GET /docs/<unknown> returns 404", async () => {
    const { app, adminToken } = createTestAppWithRoles();
    const res = await app.request("/docs/this/does/not/exist", {
      headers: { Cookie: cookieHeader(adminToken) },
    });
    expect(res.status).toBe(404);
  });

  it("rewrites relative .md links to /docs routes", async () => {
    const { app, adminToken } = createTestAppWithRoles();
    // The worklog doc contains relative links to the project docs.
    const res = await app.request("/docs/process/worklog", {
      headers: { Cookie: cookieHeader(adminToken) },
    });
    const html = await res.text();
    // Worklog links to ../project/decisions.md — should rewrite to
    // /docs/project/decisions (no `.md`, no trailing `..`).
    expect(html).not.toContain(".md\"");
    expect(html).not.toContain(".md#");
  });
});

// ---------------------------------------------------------------------------
// CV0.E3.S4 — Admin dashboard
// ---------------------------------------------------------------------------

describe("web routes — admin dashboard", () => {
  it("regular user gets 403 on /admin", async () => {
    const { app, userToken } = createTestAppWithRoles();
    const res = await app.request("/admin", {
      headers: { Cookie: cookieHeader(userToken) },
    });
    expect(res.status).toBe(403);
  });

  it("admin GET /admin renders the dashboard with all card headers", async () => {
    const { app, adminToken } = createTestAppWithRoles();
    const res = await app.request("/admin", {
      headers: { Cookie: cookieHeader(adminToken) },
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Admin Workspace");
    // Each card's header appears
    expect(html).toContain(">Users<");
    expect(html).toContain("Cost · last 30 days");
    expect(html).toContain(">Activity<");
    expect(html).toContain("Latest release");
    expect(html).toContain("Mirror memory");
    expect(html).toContain(">System<");
  });

  it("dashboard survives on a fresh DB with no sessions", async () => {
    const fresh = createTestApp();
    const res = await fresh.app.request("/admin", {
      headers: { Cookie: cookieHeader(fresh.token) },
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    // 0-sessions state: cost R$ 0,00
    expect(html).toContain("R$ 0,00");
    // Activity: 0 sessions today
    expect(html).toMatch(/admin-card-metric">0<span class="admin-card-unit">session/);
  });
});

// ---------------------------------------------------------------------------
// CV0.E3.S5 — User management (delete + role toggle)
// ---------------------------------------------------------------------------

describe("web routes — user delete", () => {
  it("admin POST /admin/users/:name/delete cascades and redirects", async () => {
    const { app, db, adminToken } = createTestAppWithRoles();
    // Set up target user's data to verify cascade
    const regular = db
      .prepare("SELECT id FROM users WHERE name = ?")
      .get("regularuser") as { id: string };
    setIdentityLayer(db, regular.id, "persona", "mentora", "a voice");
    const sessionId = getOrCreateSession(db, regular.id);
    appendEntry(db, sessionId, null, "message", { role: "user", content: "hi" });

    const res = await app.request("/admin/users/regularuser/delete", {
      method: "POST",
      headers: { Cookie: cookieHeader(adminToken) },
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/admin/users");

    // User row gone
    expect(
      db.prepare("SELECT id FROM users WHERE name = ?").get("regularuser"),
    ).toBeUndefined();
    // Cascade: sessions, entries, identity all removed for that user
    expect(
      db.prepare("SELECT id FROM sessions WHERE user_id = ?").get(regular.id),
    ).toBeUndefined();
    expect(
      db.prepare("SELECT id FROM entries WHERE session_id = ?").get(sessionId),
    ).toBeUndefined();
    expect(
      db.prepare("SELECT id FROM identity WHERE user_id = ?").get(regular.id),
    ).toBeUndefined();
  });

  it("admin cannot delete themselves (403)", async () => {
    const { app, adminToken } = createTestAppWithRoles();
    const res = await app.request("/admin/users/adminuser/delete", {
      method: "POST",
      headers: { Cookie: cookieHeader(adminToken) },
    });
    expect(res.status).toBe(403);
  });

  it("regular user gets 403 on POST /admin/users/:name/delete", async () => {
    const { app, userToken } = createTestAppWithRoles();
    const res = await app.request("/admin/users/adminuser/delete", {
      method: "POST",
      headers: { Cookie: cookieHeader(userToken) },
    });
    expect(res.status).toBe(403);
  });

  it("POST /admin/users/:name/delete returns 404 for unknown name", async () => {
    const { app, adminToken } = createTestAppWithRoles();
    const res = await app.request("/admin/users/nobody/delete", {
      method: "POST",
      headers: { Cookie: cookieHeader(adminToken) },
    });
    expect(res.status).toBe(404);
  });
});

describe("web routes — user role toggle", () => {
  it("admin POST /admin/users/:name/role flips role and redirects", async () => {
    const { app, db, adminToken } = createTestAppWithRoles();
    const res = await app.request("/admin/users/regularuser/role", {
      method: "POST",
      headers: {
        Cookie: cookieHeader(adminToken),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "role=admin",
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/admin/users");
    const row = db
      .prepare("SELECT role FROM users WHERE name = ?")
      .get("regularuser") as { role: string };
    expect(row.role).toBe("admin");
  });

  it("admin cannot change their own role (403)", async () => {
    const { app, adminToken } = createTestAppWithRoles();
    const res = await app.request("/admin/users/adminuser/role", {
      method: "POST",
      headers: {
        Cookie: cookieHeader(adminToken),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "role=user",
    });
    expect(res.status).toBe(403);
  });

  it("regular user gets 403 on POST /admin/users/:name/role", async () => {
    const { app, userToken } = createTestAppWithRoles();
    const res = await app.request("/admin/users/adminuser/role", {
      method: "POST",
      headers: {
        Cookie: cookieHeader(userToken),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "role=user",
    });
    expect(res.status).toBe(403);
  });

  it("Users page shows role toggle for others and '(you)' label for self", async () => {
    const { app, adminToken } = createTestAppWithRoles();
    const res = await app.request("/admin/users", {
      headers: { Cookie: cookieHeader(adminToken) },
    });
    const html = await res.text();
    // Self row shows (you)
    expect(html).toContain("admin (you)");
    // Other user row shows a toggle form with flipped role
    expect(html).toContain('action="/admin/users/regularuser/role"');
    expect(html).toContain('value="admin"'); // next role for regularuser is admin
    // Delete button for others exists
    expect(html).toContain('action="/admin/users/regularuser/delete"');
    // Delete button for self does not
    expect(html).not.toContain('action="/admin/users/adminuser/delete"');
  });
});

// ---------------------------------------------------------------------------
// CV0.E3.S1 — Admin customizes models
// ---------------------------------------------------------------------------

describe("web routes — admin models", () => {
  it("regular user gets 403 on /admin/models", async () => {
    const { app, userToken } = createTestAppWithRoles();
    const res = await app.request("/admin/models", {
      headers: { Cookie: cookieHeader(userToken) },
    });
    expect(res.status).toBe(403);
  });

  it("admin GET /admin/models renders each seeded role", async () => {
    const { app, adminToken } = createTestAppWithRoles();
    const res = await app.request("/admin/models", {
      headers: { Cookie: cookieHeader(adminToken) },
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    // Headings for the three seeded roles from config/models.json
    expect(html).toContain(">main<");
    expect(html).toContain(">reception<");
    expect(html).toContain(">title<");
    // One form per role
    expect(html).toContain('action="/admin/models/main"');
    expect(html).toContain('action="/admin/models/reception"');
    expect(html).toContain('action="/admin/models/title"');
  });

  it("POST /admin/models/:role updates DB and redirects", async () => {
    const { app, db, adminToken } = createTestAppWithRoles();
    const res = await app.request("/admin/models/main", {
      method: "POST",
      headers: {
        Cookie: cookieHeader(adminToken),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body:
        "provider=openrouter&model=anthropic/claude-sonnet-4&timeout_ms=&price_brl_per_1m_input=5&price_brl_per_1m_output=20&purpose=Testing+swap",
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/admin/models");
    const row = db
      .prepare("SELECT model_id, provider, price_brl_per_1m_input, purpose FROM models WHERE role = ?")
      .get("main") as {
        model_id: string;
        provider: string;
        price_brl_per_1m_input: number;
        purpose: string;
      };
    expect(row.model_id).toBe("anthropic/claude-sonnet-4");
    expect(row.provider).toBe("openrouter");
    expect(row.price_brl_per_1m_input).toBe(5);
    expect(row.purpose).toContain("Testing swap");
  });

  it("POST /admin/models/:role returns 404 for unknown role", async () => {
    const { app, adminToken } = createTestAppWithRoles();
    const res = await app.request("/admin/models/nonexistent", {
      method: "POST",
      headers: {
        Cookie: cookieHeader(adminToken),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "provider=x&model=y",
    });
    expect(res.status).toBe(404);
  });

  it("POST /admin/models/:role rejects empty provider or model", async () => {
    const { app, adminToken } = createTestAppWithRoles();
    const res = await app.request("/admin/models/main", {
      method: "POST",
      headers: {
        Cookie: cookieHeader(adminToken),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "provider=&model=",
    });
    expect(res.status).toBe(400);
  });

  it("POST /admin/models/:role/reset restores seed values", async () => {
    const { app, db, adminToken } = createTestAppWithRoles();
    // First change
    await app.request("/admin/models/main", {
      method: "POST",
      headers: {
        Cookie: cookieHeader(adminToken),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "provider=changed&model=changed-model&purpose=junk",
    });
    // Then reset
    const res = await app.request("/admin/models/main/reset", {
      method: "POST",
      headers: { Cookie: cookieHeader(adminToken) },
    });
    expect(res.status).toBe(302);
    const row = db
      .prepare("SELECT provider, model_id FROM models WHERE role = ?")
      .get("main") as { provider: string; model_id: string };
    // Should match the shipped config/models.json main entry
    expect(row.provider).toBe("openrouter");
    expect(row.model_id).toContain("deepseek");
  });

  it("non-admin POST /admin/models/:role is 403", async () => {
    const { app, userToken } = createTestAppWithRoles();
    const res = await app.request("/admin/models/main", {
      method: "POST",
      headers: {
        Cookie: cookieHeader(userToken),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "provider=x&model=y",
    });
    expect(res.status).toBe(403);
  });

  it("seedModelsIfEmpty populated the three roles on first boot", async () => {
    const { db } = createTestApp();
    const rows = db
      .prepare("SELECT role FROM models ORDER BY role")
      .all() as { role: string }[];
    const roles = rows.map((r) => r.role);
    expect(roles).toContain("main");
    expect(roles).toContain("reception");
    expect(roles).toContain("title");
  });
});
