import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { createHash } from "node:crypto";
import type Database from "better-sqlite3";
import {
  openDb,
  createUser,
  setIdentityLayer,
  getOrCreateSession,
  appendEntry,
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

  it("GET /admin/users/:name shows unified profile", async () => {
    const res = await app.request("/admin/users/testuser", {
      headers: { Cookie: cookieHeader(token) },
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("self/soul");
    expect(html).toContain("ego/identity");
    expect(html).toContain("ego/behavior");
  });

  it("GET /admin/users/:name returns 404 for unknown user", async () => {
    const res = await app.request("/admin/users/nobody", {
      headers: { Cookie: cookieHeader(token) },
    });
    expect(res.status).toBe(404);
  });

  it("GET /admin/identity/:name redirects to /admin/users/:name", async () => {
    const res = await app.request("/admin/identity/testuser", {
      headers: { Cookie: cookieHeader(token) },
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/admin/users/testuser");
  });

  it("GET /admin/personas/:name redirects to /admin/users/:name", async () => {
    const res = await app.request("/admin/personas/testuser", {
      headers: { Cookie: cookieHeader(token) },
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/admin/users/testuser");
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

  it("footer link points to the current user's profile", async () => {
    const res = await app.request("/mirror", {
      headers: { Cookie: cookieHeader(token) },
    });
    const html = await res.text();
    expect(html).toContain('href="/admin/users/testuser"');
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
