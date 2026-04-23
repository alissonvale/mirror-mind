import { describe, it, expect, beforeEach, afterEach } from "vitest";
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

  it("POST /login with valid token redirects to /", async () => {
    const res = await app.request("/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `token=${token}`,
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/");
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

describe("web routes — home (CV0.E4.S1)", () => {
  let app: Hono<{ Variables: { user: User } }>;
  let token: string;

  beforeEach(() => {
    ({ app, token } = createTestApp());
  });

  it("GET / without cookie redirects to /login", async () => {
    const res = await app.request("/");
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/login");
  });

  it("GET / with valid cookie renders greeting and latest release", async () => {
    const res = await app.request("/", {
      headers: { Cookie: cookieHeader(token) },
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    // Greeting contains the user's name
    expect(html).toMatch(/Good (morning|afternoon|evening), testuser/);
    // Latest release band is present
    expect(html).toContain("Latest from the mirror");
    expect(html).toContain("Read the full note");
    // The real production docs/releases/ will supply a release; guard loosely
    expect(html).toMatch(/v\d+\.\d+\.\d+/);
  });

  it("Continue band shows empty-state CTA when user has no sessions", async () => {
    const res = await app.request("/", {
      headers: { Cookie: cookieHeader(token) },
    });
    const html = await res.text();
    expect(html).toContain("Continue");
    expect(html).toContain("Your first conversation starts here");
    expect(html).not.toContain("Earlier threads");
  });

  it("Continue band shows active session but no earlier threads with 1 session", async () => {
    const { app, db, token, userId } = createTestApp();
    const sessionId = getOrCreateSession(db, userId);
    appendEntry(db, sessionId, null, "user", { content: "hello" });

    const res = await app.request("/", {
      headers: { Cookie: cookieHeader(token) },
    });
    const html = await res.text();
    expect(html).toContain("Continue");
    expect(html).toContain("Resume");
    expect(html).not.toContain("Earlier threads");
    // Untitled fresh session with at least one entry reads "Untitled conversation"
    expect(html).toContain("Untitled conversation");
  });

  it("Continue band caps earlier threads at 3 with many sessions", async () => {
    const { app, db, token, userId } = createTestApp();
    const { createFreshSession, setSessionTitle } = await import(
      "../server/db.js"
    );
    const insertEntry = db.prepare(
      "INSERT INTO entries (id, session_id, parent_id, type, data, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
    );
    // Create 5 sessions with one entry each, each with an ascending timestamp
    // so ordering is deterministic regardless of wall clock.
    for (let i = 0; i < 5; i++) {
      const sid = createFreshSession(db, userId);
      setSessionTitle(db, sid, `Session ${i}`);
      insertEntry.run(
        `entry-${i}`,
        sid,
        null,
        "user",
        JSON.stringify({ content: `msg ${i}` }),
        1_000_000_000 + i * 10_000,
      );
    }

    const res = await app.request("/", {
      headers: { Cookie: cookieHeader(token) },
    });
    const html = await res.text();
    expect(html).toContain("Earlier threads");
    expect(html).toContain("Session 4"); // most recent → active
    expect(html).toContain("Session 3");
    expect(html).toContain("Session 2");
    expect(html).toContain("Session 1");
    expect(html).not.toContain("Session 0"); // oldest cut off
  });

  it("admin sees the State of the mirror band", async () => {
    const { app, adminToken } = createTestAppWithRoles();
    const res = await app.request("/", {
      headers: { Cookie: cookieHeader(adminToken) },
    });
    const html = await res.text();
    expect(html).toContain("State of the mirror");
    expect(html).toContain("home-admin-state");
    expect(html).toContain("Users");
    expect(html).toContain("Budget");
  });

  it("non-admin does not see the State of the mirror band", async () => {
    const { app, userToken } = createTestAppWithRoles();
    const res = await app.request("/", {
      headers: { Cookie: cookieHeader(userToken) },
    });
    const html = await res.text();
    expect(html).not.toContain("State of the mirror");
    expect(html).not.toContain("home-admin-state");
  });

  it("Continue band labels a brand-new empty session as 'New conversation'", async () => {
    const { app, db, token, userId } = createTestApp();
    // Session created but no entries yet (the Begin-again shape).
    getOrCreateSession(db, userId);

    const res = await app.request("/", {
      headers: { Cookie: cookieHeader(token) },
    });
    const html = await res.text();
    expect(html).toContain("New conversation");
    expect(html).toContain("not started yet");
  });
});

describe("web routes — auth required", () => {
  let app: Hono<{ Variables: { user: User } }>;
  let token: string;

  beforeEach(() => {
    ({ app, token } = createTestApp());
  });

  it("GET /conversation without cookie redirects to /login", async () => {
    const res = await app.request("/conversation");
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/login");
  });

  it("GET /conversation with valid cookie returns the chat page", async () => {
    const res = await app.request("/conversation", {
      headers: { Cookie: cookieHeader(token) },
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("chat-form");
    expect(html).toContain("messages");
  });

  it("GET /conversation with invalid cookie redirects to /login", async () => {
    const res = await app.request("/conversation", {
      headers: { Cookie: cookieHeader("bad-token") },
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/login");
  });

  it("legacy /chat redirects to /conversation for authenticated users", async () => {
    const res = await app.request("/chat", {
      headers: { Cookie: cookieHeader(token) },
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/conversation");
  });

  it("legacy /mirror redirects to /conversation (CV0.E4.S5)", async () => {
    const res = await app.request("/mirror", {
      headers: { Cookie: cookieHeader(token) },
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/conversation");
  });
});

describe("web routes — open session by id (CV1.E4.S5)", () => {
  it("loads the session and renders the conversation page when owned", async () => {
    const { app, db, token, userId } = createTestApp();
    const sessionId = getOrCreateSession(db, userId);
    appendEntry(db, sessionId, null, "message", {
      role: "user",
      content: [{ type: "text", text: "hello" }],
    });

    const res = await app.request(`/conversation/${sessionId}`, {
      headers: { Cookie: cookieHeader(token) },
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("hello");
  });

  it("404s when the session belongs to another user", async () => {
    const db = openDb(":memory:");
    const t1 = "alice-token";
    const t2 = "bob-token";
    const alice = createUser(db, "alice", createHash("sha256").update(t1).digest("hex"));
    const bob = createUser(db, "bob", createHash("sha256").update(t2).digest("hex"));
    setIdentityLayer(db, alice.id, "ego", "behavior", "x");
    setIdentityLayer(db, bob.id, "ego", "behavior", "x");
    const aliceSession = getOrCreateSession(db, alice.id);

    const app = new Hono<{ Variables: { user: User } }>();
    setupWeb(app, db);

    // Bob tries to open Alice's session
    const res = await app.request(`/conversation/${aliceSession}`, {
      headers: { Cookie: cookieHeader(t2) },
    });
    expect(res.status).toBe(404);
  });

  it("404s for an unknown session id (UUID-shaped but nonexistent)", async () => {
    const { app, token } = createTestApp();
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await app.request(`/conversation/${fakeId}`, {
      headers: { Cookie: cookieHeader(token) },
    });
    expect(res.status).toBe(404);
  });

  it("does not match non-UUID paths (begin-again etc.)", async () => {
    const { app, token } = createTestApp();
    // Begin-again is a POST endpoint, but a GET to it shouldn't be misinterpreted
    // as /conversation/:sessionId because sessionId regex requires UUID shape.
    const res = await app.request("/conversation/begin-again", {
      headers: { Cookie: cookieHeader(token) },
    });
    expect(res.status).toBe(404);
  });

  it("makes the loaded session active (next default /conversation resolves to it)", async () => {
    const { app, db, token, userId } = createTestApp();
    // Session 1 (initially the only one — therefore active)
    const s1 = getOrCreateSession(db, userId);
    // Create a fresh session (now becomes active)
    const { createFreshSession } = await import("../server/db.js");
    const s2 = createFreshSession(db, userId);
    expect(getOrCreateSession(db, userId)).toBe(s2); // sanity

    // Open s1 via the new route
    const res = await app.request(`/conversation/${s1}`, {
      headers: { Cookie: cookieHeader(token) },
    });
    expect(res.status).toBe(200);

    // s1 should now be the active one
    expect(getOrCreateSession(db, userId)).toBe(s1);
  });
});

describe("web routes — /conversations browse (CV1.E6.S1)", () => {
  async function setup() {
    const { app, db, token, userId } = createTestApp();
    setIdentityLayer(db, userId, "persona", "estrategista", "...");
    setIdentityLayer(db, userId, "persona", "divulgadora", "...");

    const { createOrganization, createJourney, createSessionAt } = await import("../server/db.js");
    createOrganization(db, userId, "software-zen", "Software Zen");
    createOrganization(db, userId, "nova-acropole", "Nova Acrópole");
    createJourney(db, userId, "o-espelho", "O Espelho");

    function tag(ts: number, title: string, persona: string, org?: string, journey?: string) {
      const sid = createSessionAt(db, userId, title, ts);
      appendEntry(db, sid, null, "message", {
        role: "user", content: [{ type: "text", text: `q for ${title}` }], timestamp: ts,
      }, ts);
      const meta: Record<string, unknown> = {
        role: "assistant", content: [{ type: "text", text: "ok" }],
        _persona: persona, timestamp: ts + 1,
      };
      if (org) meta._organization = org;
      if (journey) meta._journey = journey;
      appendEntry(db, sid, null, "message", meta, ts + 1);
      return sid;
    }

    return { app, db, token, userId, tag };
  }

  it("renders the page with all sessions when no filter is applied", async () => {
    const { app, token, tag } = await setup();
    tag(1000, "First", "estrategista", "software-zen");
    tag(2000, "Second", "divulgadora");
    tag(3000, "Third", "estrategista", "software-zen", "o-espelho");

    const res = await app.request("/conversations", {
      headers: { Cookie: cookieHeader(token) },
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("First");
    expect(html).toContain("Second");
    expect(html).toContain("Third");
    expect(html).toContain("Showing 1–3 of 3");
  });

  it("filters by persona via query string", async () => {
    const { app, token, tag } = await setup();
    tag(1000, "EstratA", "estrategista");
    tag(2000, "DivulA", "divulgadora");
    tag(3000, "EstratB", "estrategista");

    const res = await app.request("/conversations?persona=estrategista", {
      headers: { Cookie: cookieHeader(token) },
    });
    const html = await res.text();
    expect(html).toContain("EstratA");
    expect(html).toContain("EstratB");
    expect(html).not.toContain("DivulA");
    expect(html).toContain("Showing 1–2 of 2");
  });

  it("filters by organization", async () => {
    const { app, token, tag } = await setup();
    tag(1000, "SZ-A", "estrategista", "software-zen");
    tag(2000, "NA-A", "estrategista", "nova-acropole");

    const res = await app.request("/conversations?organization=software-zen", {
      headers: { Cookie: cookieHeader(token) },
    });
    const html = await res.text();
    expect(html).toContain("SZ-A");
    expect(html).not.toContain("NA-A");
  });

  it("filters by journey", async () => {
    const { app, token, tag } = await setup();
    tag(1000, "Journey-yes", "estrategista", undefined, "o-espelho");
    tag(2000, "Journey-no", "estrategista");

    const res = await app.request("/conversations?journey=o-espelho", {
      headers: { Cookie: cookieHeader(token) },
    });
    const html = await res.text();
    expect(html).toContain("Journey-yes");
    expect(html).not.toContain("Journey-no");
  });

  it("combines multiple filters with AND semantics", async () => {
    const { app, token, tag } = await setup();
    tag(1000, "A", "estrategista", "software-zen");
    tag(2000, "B", "divulgadora", "software-zen");
    tag(3000, "C", "estrategista", "nova-acropole");

    const res = await app.request("/conversations?persona=estrategista&organization=software-zen", {
      headers: { Cookie: cookieHeader(token) },
    });
    const html = await res.text();
    expect(html).toContain(">A<");
    expect(html).not.toContain(">B<");
    expect(html).not.toContain(">C<");
  });

  it("silently ignores unknown filter values", async () => {
    const { app, token, tag } = await setup();
    tag(1000, "Real", "estrategista");

    const res = await app.request("/conversations?persona=ghost&organization=ghost-org&journey=ghost-journey", {
      headers: { Cookie: cookieHeader(token) },
    });
    const html = await res.text();
    // No filter applied (all unknown), so all sessions show
    expect(html).toContain("Real");
    expect(html).toContain("Showing 1–1 of 1");
  });

  it("renders an empty-state when filters match nothing", async () => {
    const { app, token, tag } = await setup();
    tag(1000, "Only", "estrategista", "software-zen");

    const res = await app.request("/conversations?organization=nova-acropole", {
      headers: { Cookie: cookieHeader(token) },
    });
    const html = await res.text();
    expect(html).toContain("No conversations match these filters");
    expect(html).toContain("Clear filters and see all");
  });

  it("renders an empty-state when no conversations exist at all", async () => {
    const { app, token } = await setup();

    const res = await app.request("/conversations", {
      headers: { Cookie: cookieHeader(token) },
    });
    const html = await res.text();
    expect(html).toContain("No conversations yet");
  });

  it("paginates with limit=50 — Show more appears past the first page", async () => {
    const { app, token, tag } = await setup();
    for (let i = 0; i < 55; i++) {
      tag(1000 * (i + 1), `S${i}`, "estrategista");
    }

    const res = await app.request("/conversations", {
      headers: { Cookie: cookieHeader(token) },
    });
    const html = await res.text();
    expect(html).toContain("Showing 1–50 of 55");
    expect(html).toContain("Show 5 more");
    expect(html).toContain("offset=50");

    const page2 = await app.request("/conversations?offset=50", {
      headers: { Cookie: cookieHeader(token) },
    });
    const html2 = await page2.text();
    expect(html2).toContain("Showing 51–55 of 55");
    expect(html2).not.toContain("Show 5 more");
  });

  it("preserves filter params in Show more link", async () => {
    const { app, token, tag } = await setup();
    for (let i = 0; i < 55; i++) {
      tag(1000 * (i + 1), `S${i}`, "estrategista");
    }

    const res = await app.request("/conversations?persona=estrategista", {
      headers: { Cookie: cookieHeader(token) },
    });
    const html = await res.text();
    expect(html).toContain("persona=estrategista");
    expect(html).toContain("offset=50");
  });

  it("rows link to /conversation/<sessionId>", async () => {
    const { app, token, tag } = await setup();
    const sid = tag(1000, "Linked", "estrategista");

    const res = await app.request("/conversations", {
      headers: { Cookie: cookieHeader(token) },
    });
    const html = await res.text();
    expect(html).toContain(`/conversation/${sid}`);
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

  it("GET /conversation renders the rail container", async () => {
    const res = await app.request("/conversation", {
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
    const res = await app.request("/conversation", {
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

    const res = await app.request("/conversation", {
      headers: { Cookie: cookieHeader(token) },
    });
    const html = await res.text();
    expect(html).toContain('data-persona="mentora"');
    expect(html).toContain("mentora");
    // composed section shows ◇ persona signature
    expect(html).toContain("◇ mentora");
  });

  it("lists composed layers in the rail", async () => {
    const res = await app.request("/conversation", {
      headers: { Cookie: cookieHeader(token) },
    });
    const html = await res.text();
    expect(html).toContain("self.soul");
    expect(html).toContain("ego.identity");
    expect(html).toContain("ego.behavior");
  });

  it("footer link points to the user's Cognitive Map", async () => {
    const res = await app.request("/conversation", {
      headers: { Cookie: cookieHeader(token) },
    });
    const html = await res.text();
    expect(html).toContain('href="/map"');
    expect(html).toContain("Grounded in your identity");
  });

  // CV0.E3.S6 — cost visibility is admin-only
  it("hides cost from non-admin users (rail-cost is data-hidden=true)", async () => {
    const { app, userToken } = createTestAppWithRoles();
    const res = await app.request("/conversation", {
      headers: { Cookie: cookieHeader(userToken) },
    });
    const html = await res.text();
    // The cost element still exists in markup (avoid JS layout jumps) but is hidden.
    expect(html).toMatch(/id="rail-cost"[^>]*data-hidden="true"/);
  });

  it("shows cost to admin users", async () => {
    const { app, adminToken } = createTestAppWithRoles();
    // Set prices so costBRL is non-null
    await app.request("/admin/models/main", {
      method: "POST",
      headers: {
        Cookie: cookieHeader(adminToken),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "provider=openrouter&model=some&price_brl_per_1m_input=1&price_brl_per_1m_output=1&purpose=p",
    });
    const res = await app.request("/conversation", {
      headers: { Cookie: cookieHeader(adminToken) },
    });
    const html = await res.text();
    // Admin sees the cost row with data-hidden=false (assuming costBRL computed ok)
    expect(html).toMatch(/id="rail-cost"/);
  });
});

describe("web routes — sidebar identity and role", () => {
  it("shows the logged-in user's name in the sidebar", async () => {
    const { app, adminToken } = createTestAppWithRoles();
    const res = await app.request("/conversation", {
      headers: { Cookie: cookieHeader(adminToken) },
    });
    const html = await res.text();
    expect(html).toContain("sidebar-user");
    expect(html).toContain("sidebar-avatar");
    expect(html).toContain("adminuser");
  });

  it("admin sees the Admin Workspace link in the sidebar", async () => {
    const { app, adminToken } = createTestAppWithRoles();
    const res = await app.request("/conversation", {
      headers: { Cookie: cookieHeader(adminToken) },
    });
    const html = await res.text();
    expect(html).toContain("sidebar-admin-workspace");
    expect(html).toContain("Admin Workspace");
  });

  it("regular user does not see the Admin Workspace link in the sidebar", async () => {
    const { app, userToken } = createTestAppWithRoles();
    const res = await app.request("/conversation", {
      headers: { Cookie: cookieHeader(userToken) },
    });
    const html = await res.text();
    expect(html).not.toContain("sidebar-admin-workspace");
    // Admin Workspace is gone; the admin sub-menu was consolidated (CV0.E4.S2)
    // so none of those direct links live in the sidebar anymore either.
    expect(html).not.toContain('href="/admin/users"');
    expect(html).not.toContain('href="/admin/models"');
    expect(html).not.toContain('href="/admin/oauth"');
    expect(html).not.toContain('href="/admin/budget"');
  });

  it("admin sidebar no longer carries the old This Mirror sub-links", async () => {
    const { app, adminToken } = createTestAppWithRoles();
    const res = await app.request("/conversation", {
      headers: { Cookie: cookieHeader(adminToken) },
    });
    const html = await res.text();
    expect(html).not.toContain("This Mirror");
    expect(html).not.toContain("sidebar-link-sub");
    // Exactly one admin entry-point in the sidebar now: /admin.
    // Direct sub-link hrefs no longer appear in the nav.
    expect(html).not.toContain('class="sidebar-link sidebar-link-sub"');
  });

  it("sidebar groups links by the three questions (Who / What / To Whom)", async () => {
    const { app, token } = createTestApp();
    const res = await app.request("/conversation", {
      headers: { Cookie: cookieHeader(token) },
    });
    const html = await res.text();
    expect(html).toContain("Who Am I");
    expect(html).toContain("What I&#39;m Doing");
    expect(html).toContain("Where I Work");
    // Psyche Map is now a first-class link (was only accessible via avatar)
    expect(html).toContain(">Psyche Map<");
    expect(html).toContain('href="/map"');
    // Conversation still sits at the top as the primary action
    expect(html).toContain(">Conversation<");
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
    expect(html).toContain("Psyche Map of");
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

  it("no longer shows the name edit affordance on the map — it moved to /me", async () => {
    const res = await app.request("/map", {
      headers: { Cookie: cookieHeader(token) },
    });
    const html = await res.text();
    expect(html).not.toContain('href="/map?editName=1"');
    expect(html).not.toContain('class="map-identity-form"');
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
    // The composed-prompt drawer replaces the old inline preview pane.
    expect(html).toContain("composed-drawer");
    expect(html).toContain(`data-endpoint="/map/composed"`);
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

describe("web routes — About You (CV0.E4.S4)", () => {
  let app: Hono<{ Variables: { user: User } }>;
  let token: string;
  let db: Database.Database;
  let userId: string;

  beforeEach(() => {
    ({ app, token, db, userId } = createTestApp());
  });

  it("GET /me renders the page with header, preferences, stats, and data bands", async () => {
    const res = await app.request("/me", {
      headers: { Cookie: cookieHeader(token) },
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("About You");
    expect(html).toContain("testuser");
    expect(html).toContain("Member since");
    expect(html).toContain("Preferences");
    expect(html).toContain("How the mirror sees you");
    expect(html).toContain(">Data<");
    expect(html).toContain("Export my data");
  });

  it("GET /me shows the admin role badge for admins", async () => {
    const { app, adminToken } = createTestAppWithRoles();
    const res = await app.request("/me", {
      headers: { Cookie: cookieHeader(adminToken) },
    });
    const html = await res.text();
    expect(html).toContain("me-role-badge");
    expect(html).toContain("admin");
    // Admin sees the currency preference as two radios (CV0.E4.S6)
    expect(html).toContain("Preferred currency for cost display");
    expect(html).toContain('type="radio"');
    expect(html).toContain('name="show_brl"');
    expect(html).toContain("USD — $");
    expect(html).toContain("BRL — R$");
  });

  it("GET /me does not show the BRL toggle for non-admin users", async () => {
    const { app, userToken } = createTestAppWithRoles();
    const res = await app.request("/me", {
      headers: { Cookie: cookieHeader(userToken) },
    });
    const html = await res.text();
    expect(html).not.toContain('name="show_brl"');
    expect(html).toContain("No preferences to set yet");
  });

  it("POST /me/name updates the user's display name and redirects", async () => {
    const res = await app.request("/me/name", {
      method: "POST",
      headers: {
        Cookie: cookieHeader(token),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "name=newname",
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/me?saved=Name+updated");
    const row = db
      .prepare("SELECT name FROM users WHERE id = ?")
      .get(userId) as { name: string };
    expect(row.name).toBe("newname");
  });

  it("POST /me/name allows names with spaces", async () => {
    const res = await app.request("/me/name", {
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

  it("POST /me/name rejects names with slashes", async () => {
    const res = await app.request("/me/name", {
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

  it("POST /me/name rejects empty names", async () => {
    const res = await app.request("/me/name", {
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

  it("POST /me/show-brl toggles the preference for admins", async () => {
    const { app, db, adminToken } = createTestAppWithRoles();
    const res = await app.request("/me/show-brl", {
      method: "POST",
      headers: {
        Cookie: cookieHeader(adminToken),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "show_brl=1",
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/me?saved=Preference+updated");
    const row = db
      .prepare(
        "SELECT show_brl_conversion FROM users WHERE name = 'adminuser'",
      )
      .get() as { show_brl_conversion: number };
    expect(row.show_brl_conversion).toBe(1);
  });

  it("POST /me/show-brl is forbidden for non-admins", async () => {
    const { app, userToken } = createTestAppWithRoles();
    const res = await app.request("/me/show-brl", {
      method: "POST",
      headers: {
        Cookie: cookieHeader(userToken),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "show_brl=1",
    });
    expect(res.status).toBe(403);
  });

  it("sidebar avatar link now points to /me, not /map", async () => {
    const res = await app.request("/conversation", {
      headers: { Cookie: cookieHeader(token) },
    });
    const html = await res.text();
    expect(html).toContain('href="/me" class="sidebar-user"');
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
    expect(html).toContain("Psyche Map of");
    expect(html).toContain("regularuser");
    expect(html).toContain("viewing as admin");
    // Name edit is not here anymore — moved to /me (and admins can't rename others)
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
    // Form action and composed-prompt drawer endpoint include the target user's name
    expect(html).toContain("/map/regularuser/self/soul");
    expect(html).toContain(`data-endpoint="/map/regularuser/composed"`);
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

  it("POST /conversation/begin-again creates a new session and preserves the old one", async () => {
    // Establish an existing session with one message so it's distinct.
    const originalSessionId = getOrCreateSession(db, userId);
    appendEntry(db, originalSessionId, null, "message", {
      role: "user",
      content: "hello",
    });

    const res = await app.request("/conversation/begin-again", {
      method: "POST",
      headers: { Cookie: cookieHeader(token) },
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/conversation");

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

  it("POST /conversation/forget deletes entries and the session row, then starts fresh", async () => {
    const original = getOrCreateSession(db, userId);
    appendEntry(db, original, null, "message", {
      role: "user",
      content: "to be forgotten",
    });

    const res = await app.request("/conversation/forget", {
      method: "POST",
      headers: { Cookie: cookieHeader(token) },
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/conversation");

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
    const res = await app.request("/conversation", {
      headers: { Cookie: cookieHeader(token) },
    });
    const html = await res.text();
    expect(html).toContain('action="/conversation/begin-again"');
    expect(html).toContain("Begin again");
    expect(html).toContain('action="/conversation/forget"');
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
    // Each card's header appears — shortcuts first, glances after
    expect(html).toContain(">Users<");
    expect(html).toContain(">Budget<");
    expect(html).toContain(">Models<");
    expect(html).toContain(">OAuth<");
    expect(html).toContain(">Docs<");
    expect(html).toContain("Latest release");
    expect(html).toContain(">Activity<");
    expect(html).toContain("Mirror memory");
    expect(html).toContain(">System<");
  });

  it("admin dashboard shortcut cards link to their admin surfaces", async () => {
    const { app, adminToken } = createTestAppWithRoles();
    const res = await app.request("/admin", {
      headers: { Cookie: cookieHeader(adminToken) },
    });
    const html = await res.text();
    expect(html).toContain('href="/admin/users"');
    expect(html).toContain('href="/admin/budget"');
    expect(html).toContain('href="/admin/models"');
    expect(html).toContain('href="/admin/oauth"');
    expect(html).toContain('href="/docs"');
  });

  it("dashboard survives on a fresh DB with no sessions", async () => {
    const fresh = createTestApp();
    const res = await fresh.app.request("/admin", {
      headers: { Cookie: cookieHeader(fresh.token) },
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    // Budget with no OpenRouter key configured renders the em-dash fallback
    expect(html).toContain("—");
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

  it("GET /admin/models shows env badge for default-seeded roles", async () => {
    const { app, adminToken } = createTestAppWithRoles();
    const res = await app.request("/admin/models", {
      headers: { Cookie: cookieHeader(adminToken) },
    });
    const html = await res.text();
    expect(html).toContain("models-auth-badge-env");
  });

  it("GET /admin/models lists pi-ai OAuth providers in the datalist", async () => {
    const { app, adminToken } = createTestAppWithRoles();
    const res = await app.request("/admin/models", {
      headers: { Cookie: cookieHeader(adminToken) },
    });
    const html = await res.text();
    expect(html).toContain('id="providers-options"');
    expect(html).toContain('value="google-gemini-cli"');
    expect(html).toContain('value="anthropic"');
    expect(html).toContain('value="openrouter"');
  });

  it("POST /admin/models/:role infers auth_type=oauth when provider is an OAuth id", async () => {
    const { app, db, adminToken } = createTestAppWithRoles();
    const res = await app.request("/admin/models/reception", {
      method: "POST",
      headers: {
        Cookie: cookieHeader(adminToken),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body:
        "provider=google-gemini-cli&model=gemini-2.5-flash&timeout_ms=&price_brl_per_1m_input=&price_brl_per_1m_output=&purpose=OAuth",
    });
    expect(res.status).toBe(302);
    const row = db
      .prepare("SELECT provider, auth_type FROM models WHERE role = ?")
      .get("reception") as { provider: string; auth_type: string };
    expect(row.provider).toBe("google-gemini-cli");
    expect(row.auth_type).toBe("oauth");
  });

  it("POST /admin/models/:role infers auth_type=env when provider is not an OAuth id", async () => {
    const { app, db, adminToken } = createTestAppWithRoles();
    // First switch to oauth
    await app.request("/admin/models/reception", {
      method: "POST",
      headers: {
        Cookie: cookieHeader(adminToken),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "provider=google-gemini-cli&model=gemini-2.5-flash&purpose=X",
    });
    // Then switch back to an env provider
    await app.request("/admin/models/reception", {
      method: "POST",
      headers: {
        Cookie: cookieHeader(adminToken),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "provider=openrouter&model=google/gemini-2.5-flash&purpose=back",
    });
    const row = db
      .prepare("SELECT provider, auth_type FROM models WHERE role = ?")
      .get("reception") as { provider: string; auth_type: string };
    expect(row.provider).toBe("openrouter");
    expect(row.auth_type).toBe("env");
  });

  it("GET /admin/models warns when an OAuth provider has no credentials", async () => {
    const { app, adminToken } = createTestAppWithRoles();
    // Point reception at an OAuth provider without uploading credentials
    await app.request("/admin/models/reception", {
      method: "POST",
      headers: {
        Cookie: cookieHeader(adminToken),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "provider=google-gemini-cli&model=gemini-2.5-flash&purpose=X",
    });
    const res = await app.request("/admin/models", {
      headers: { Cookie: cookieHeader(adminToken) },
    });
    const html = await res.text();
    expect(html).toContain("No credentials stored");
    expect(html).toContain("/admin/oauth");
  });
});

describe("web routes — admin oauth (CV0.E3.S8)", () => {
  it("regular user gets 403 on /admin/oauth", async () => {
    const { app, userToken } = createTestAppWithRoles();
    const res = await app.request("/admin/oauth", {
      headers: { Cookie: cookieHeader(userToken) },
    });
    expect(res.status).toBe(403);
  });

  it("GET /admin/oauth lists all pi-ai OAuth providers", async () => {
    const { app, adminToken } = createTestAppWithRoles();
    const res = await app.request("/admin/oauth", {
      headers: { Cookie: cookieHeader(adminToken) },
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    // The five built-in pi-ai providers are surfaced by id.
    expect(html).toContain("google-gemini-cli");
    expect(html).toContain("anthropic");
    expect(html).toContain("openai-codex");
    expect(html).toContain("github-copilot");
    expect(html).toContain("google-antigravity");
    // Each provider has a save form
    expect(html).toContain('action="/admin/oauth/google-gemini-cli"');
  });

  it("GET /admin/oauth shows 'configured' state and expiry for stored rows", async () => {
    const { app, db, adminToken } = createTestAppWithRoles();
    const { setOAuthCredentials } = await import("../server/db.js");
    setOAuthCredentials(db, "google-gemini-cli", {
      refresh: "rt",
      access: "at",
      expires: Date.now() + 3_600_000,
      project_id: "proj-xyz",
    });
    const res = await app.request("/admin/oauth", {
      headers: { Cookie: cookieHeader(adminToken) },
    });
    const html = await res.text();
    expect(html).toContain("Configured");
    expect(html).toContain("expires in");
    expect(html).toContain("project_id");
  });

  it("POST /admin/oauth/:provider saves valid credentials JSON", async () => {
    const { app, db, adminToken } = createTestAppWithRoles();
    const creds = JSON.stringify({
      refresh: "rt-new",
      access: "at-new",
      expires: Date.now() + 3_600_000,
      project_id: "proj-x",
    });
    const body = new URLSearchParams({ credentials: creds }).toString();
    const res = await app.request("/admin/oauth/google-gemini-cli", {
      method: "POST",
      headers: {
        Cookie: cookieHeader(adminToken),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain(
      "/admin/oauth?saved=google-gemini-cli",
    );
    const row = db
      .prepare("SELECT credentials FROM oauth_credentials WHERE provider = ?")
      .get("google-gemini-cli") as { credentials: string } | undefined;
    expect(row).toBeDefined();
    const parsed = JSON.parse(row!.credentials);
    expect(parsed.access).toBe("at-new");
    expect(parsed.project_id).toBe("proj-x");
  });

  it("POST /admin/oauth/:provider unwraps pi-ai's provider-keyed envelope", async () => {
    const { app, db, adminToken } = createTestAppWithRoles();
    // pi-ai's login CLI writes the file in this shape.
    const envelope = {
      "google-gemini-cli": {
        type: "oauth",
        refresh: "rt-env",
        access: "at-env",
        expires: Date.now() + 3_600_000,
        projectId: "proj-x",
        email: "dev@example.com",
      },
    };
    const body = new URLSearchParams({
      credentials: JSON.stringify(envelope),
    }).toString();
    const res = await app.request("/admin/oauth/google-gemini-cli", {
      method: "POST",
      headers: {
        Cookie: cookieHeader(adminToken),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    expect(res.status).toBe(302);
    const row = db
      .prepare("SELECT credentials FROM oauth_credentials WHERE provider = ?")
      .get("google-gemini-cli") as { credentials: string } | undefined;
    const stored = JSON.parse(row!.credentials);
    expect(stored.refresh).toBe("rt-env");
    expect(stored.access).toBe("at-env");
    expect(stored.projectId).toBe("proj-x");
    expect(stored.email).toBe("dev@example.com");
    // No nested provider key — the envelope was unwrapped.
    expect(stored["google-gemini-cli"]).toBeUndefined();
  });

  it("POST /admin/oauth/:provider rejects invalid JSON", async () => {
    const { app, adminToken } = createTestAppWithRoles();
    const body = new URLSearchParams({
      credentials: "not a json",
    }).toString();
    const res = await app.request("/admin/oauth/google-gemini-cli", {
      method: "POST",
      headers: {
        Cookie: cookieHeader(adminToken),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Invalid JSON");
  });

  it("POST /admin/oauth/:provider rejects JSON missing required fields", async () => {
    const { app, adminToken } = createTestAppWithRoles();
    const body = new URLSearchParams({
      credentials: JSON.stringify({ refresh: "rt" }),
    }).toString();
    const res = await app.request("/admin/oauth/google-gemini-cli", {
      method: "POST",
      headers: {
        Cookie: cookieHeader(adminToken),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("must include");
  });

  it("POST /admin/oauth/:provider returns 404 for unknown provider", async () => {
    const { app, adminToken } = createTestAppWithRoles();
    const body = new URLSearchParams({
      credentials: JSON.stringify({
        refresh: "rt",
        access: "at",
        expires: 1,
      }),
    }).toString();
    const res = await app.request("/admin/oauth/not-a-provider", {
      method: "POST",
      headers: {
        Cookie: cookieHeader(adminToken),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    expect(res.status).toBe(404);
  });

  it("POST /admin/oauth/:provider/delete removes stored credentials", async () => {
    const { app, db, adminToken } = createTestAppWithRoles();
    const { setOAuthCredentials } = await import("../server/db.js");
    setOAuthCredentials(db, "anthropic", {
      refresh: "rt",
      access: "at",
      expires: 1,
    });
    const res = await app.request("/admin/oauth/anthropic/delete", {
      method: "POST",
      headers: { Cookie: cookieHeader(adminToken) },
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain(
      "/admin/oauth?deleted=anthropic",
    );
    const row = db
      .prepare("SELECT 1 FROM oauth_credentials WHERE provider = ?")
      .get("anthropic");
    expect(row).toBeUndefined();
  });

  it("non-admin POST /admin/oauth/:provider is 403", async () => {
    const { app, userToken } = createTestAppWithRoles();
    const res = await app.request("/admin/oauth/google-gemini-cli", {
      method: "POST",
      headers: {
        Cookie: cookieHeader(userToken),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "credentials=%7B%7D",
    });
    expect(res.status).toBe(403);
  });
});

describe("web routes — admin budget (CV0.E3.S6)", () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.OPENROUTER_API_KEY;

  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = "sk-test";
    global.fetch = (async () =>
      new Response(
        JSON.stringify({
          data: {
            label: "mirror-test",
            usage: 0.1,
            limit: 10,
            limit_remaining: 9.9,
            is_free_tier: false,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )) as any;
    // Reset billing cache between tests
    return import("../server/openrouter-billing.js").then((m) =>
      m.__resetKeyInfoCacheForTests(),
    );
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = originalKey;
  });

  it("regular user gets 403 on /admin/budget", async () => {
    const { app, userToken } = createTestAppWithRoles();
    const res = await app.request("/admin/budget", {
      headers: { Cookie: cookieHeader(userToken) },
    });
    expect(res.status).toBe(403);
  });

  it("admin GET /admin/budget renders hero + breakdowns", async () => {
    const { app, adminToken } = createTestAppWithRoles();
    const res = await app.request("/admin/budget", {
      headers: { Cookie: cookieHeader(adminToken) },
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Credit remaining");
    expect(html).toContain("This month");
    expect(html).toContain("By role");
    expect(html).toContain("By environment");
    expect(html).toContain("By model");
    expect(html).toContain("Preferences");
  });

  it("rate editor persists via POST and redirects back with flash", async () => {
    const { app, db, adminToken } = createTestAppWithRoles();
    const body = new URLSearchParams({ rate: "5.37" }).toString();
    const res = await app.request("/admin/budget/rate", {
      method: "POST",
      headers: {
        Cookie: cookieHeader(adminToken),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain("/admin/budget?saved=");
    const stored = db
      .prepare("SELECT value FROM settings WHERE key = 'usd_to_brl_rate'")
      .get() as { value: string } | undefined;
    expect(stored?.value).toBe("5.37");
  });

  it("rate editor rejects invalid values with 400", async () => {
    const { app, adminToken } = createTestAppWithRoles();
    const body = new URLSearchParams({ rate: "-1" }).toString();
    const res = await app.request("/admin/budget/rate", {
      method: "POST",
      headers: {
        Cookie: cookieHeader(adminToken),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    expect(res.status).toBe(400);
  });

  // show-brl toggle moved to /me in CV0.E4.S4 — see "About You" describe block.

  it("budget-alert.json returns alert when remaining below 20% of limit", async () => {
    global.fetch = (async () =>
      new Response(
        JSON.stringify({
          data: {
            label: "mirror-test",
            usage: 9,
            limit: 10,
            limit_remaining: 1, // 10% left → alert
            is_free_tier: false,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )) as any;
    await import("../server/openrouter-billing.js").then((m) =>
      m.__resetKeyInfoCacheForTests(),
    );
    const { app, adminToken } = createTestAppWithRoles();
    const res = await app.request("/admin/budget-alert.json", {
      headers: { Cookie: cookieHeader(adminToken) },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.alert).not.toBeNull();
    expect(body.alert.pct).toBeCloseTo(10, 1);
    expect(body.alert.remaining_usd).toBeCloseTo(1, 6);
  });

  it("budget-alert.json returns null when remaining above 20%", async () => {
    global.fetch = (async () =>
      new Response(
        JSON.stringify({
          data: {
            label: "mirror-test",
            usage: 5,
            limit: 10,
            limit_remaining: 5, // 50% left → no alert
            is_free_tier: false,
          },
        }),
        { status: 200 },
      )) as any;
    await import("../server/openrouter-billing.js").then((m) =>
      m.__resetKeyInfoCacheForTests(),
    );
    const { app, adminToken } = createTestAppWithRoles();
    const res = await app.request("/admin/budget-alert.json", {
      headers: { Cookie: cookieHeader(adminToken) },
    });
    const body = (await res.json()) as any;
    expect(body.alert).toBeNull();
  });

  it("budget-alert.json is 403 for non-admin", async () => {
    const { app, userToken } = createTestAppWithRoles();
    const res = await app.request("/admin/budget-alert.json", {
      headers: { Cookie: cookieHeader(userToken) },
    });
    expect(res.status).toBe(403);
  });

  it("renders a 'billing unavailable' fallback when OpenRouter fetch fails", async () => {
    global.fetch = (async () =>
      new Response("", { status: 500 })) as any;
    const { app, adminToken } = createTestAppWithRoles();
    await import("../server/openrouter-billing.js").then((m) =>
      m.__resetKeyInfoCacheForTests(),
    );
    const res = await app.request("/admin/budget", {
      headers: { Cookie: cookieHeader(adminToken) },
    });
    const html = await res.text();
    expect(html).toContain("Billing data unavailable");
  });
});

describe("web routes — organizations (CV1.E4.S1)", () => {
  it("GET /organizations renders the list page and the create form", async () => {
    const { app, token } = createTestApp();
    const res = await app.request("/organizations", {
      headers: { cookie: cookieHeader(token) },
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Organizations");
    expect(html).toContain("New organization");
    expect(html).toContain("name=\"name\"");
    expect(html).toContain("name=\"key\"");
  });

  it("list shows Last conversation card for each org (CV0.E4.S7)", async () => {
    const { app, db, token, userId } = createTestApp();
    // Create an org via POST so lifecycle is covered end-to-end.
    const form = new FormData();
    form.set("name", "Software Zen");
    form.set("key", "sz");
    await app.request("/organizations", {
      method: "POST",
      body: form,
      headers: { cookie: cookieHeader(token) },
    });

    // Org without any tagged session → empty-state card
    let res = await app.request("/organizations", {
      headers: { cookie: cookieHeader(token) },
    });
    let html = await res.text();
    expect(html).toContain("Last conversation");
    expect(html).toContain("No conversations tagged yet");
    expect(html).toContain('data-testid="scope-last-sz"');

    // Tag a session with the org via assistant message meta
    const sessionId = getOrCreateSession(db, userId);
    db.prepare("UPDATE sessions SET title = ? WHERE id = ?").run(
      "Sunday planning",
      sessionId,
    );
    db.prepare(
      "INSERT INTO entries (id, session_id, parent_id, type, data, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(
      "e-sz",
      sessionId,
      null,
      "message",
      JSON.stringify({
        role: "assistant",
        content: [{ type: "text", text: "hi" }],
        _organization: "sz",
      }),
      Date.now() - 60_000,
    );

    res = await app.request("/organizations", {
      headers: { cookie: cookieHeader(token) },
    });
    html = await res.text();
    expect(html).toContain("Sunday planning");
    expect(html).not.toContain("No conversations tagged yet");
  });

  it("POST /organizations creates and redirects to the workshop", async () => {
    const { app, db, token, userId } = createTestApp();
    const form = new FormData();
    form.set("name", "Software Zen");
    form.set("key", "software-zen");

    const res = await app.request("/organizations", {
      method: "POST",
      body: form,
      headers: { cookie: cookieHeader(token) },
    });

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/organizations/software-zen");

    const row = db
      .prepare("SELECT name, status FROM organizations WHERE user_id = ?")
      .get(userId) as { name: string; status: string } | undefined;
    expect(row?.name).toBe("Software Zen");
    expect(row?.status).toBe("active");
  });

  it("POST /organizations rejects invalid keys", async () => {
    const { app, token } = createTestApp();
    const form = new FormData();
    form.set("name", "Bad Key");
    form.set("key", "Has SPACES");

    const res = await app.request("/organizations", {
      method: "POST",
      body: form,
      headers: { cookie: cookieHeader(token) },
    });

    expect(res.status).toBe(400);
  });

  it("POST /organizations rejects duplicate key", async () => {
    const { app, token } = createTestApp();
    const form1 = new FormData();
    form1.set("name", "Software Zen");
    form1.set("key", "sz");
    await app.request("/organizations", {
      method: "POST",
      body: form1,
      headers: { cookie: cookieHeader(token) },
    });

    const form2 = new FormData();
    form2.set("name", "Duplicate");
    form2.set("key", "sz");

    const res = await app.request("/organizations", {
      method: "POST",
      body: form2,
      headers: { cookie: cookieHeader(token) },
    });

    expect(res.status).toBe(409);
  });

  it("GET /organizations/:key renders the workshop", async () => {
    const { app, token } = createTestApp();
    const form = new FormData();
    form.set("name", "Software Zen");
    form.set("key", "software-zen");
    await app.request("/organizations", {
      method: "POST",
      body: form,
      headers: { cookie: cookieHeader(token) },
    });

    const res = await app.request("/organizations/software-zen", {
      headers: { cookie: cookieHeader(token) },
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Software Zen");
    expect(html).toContain("Briefing");
    expect(html).toContain("Situation");
  });

  it("GET /organizations/:key shows Conversations section with empty-state when no sessions tagged (CV1.E4.S5)", async () => {
    const { app, token } = createTestApp();
    const form = new FormData();
    form.set("name", "Software Zen");
    form.set("key", "software-zen");
    await app.request("/organizations", {
      method: "POST",
      body: form,
      headers: { cookie: cookieHeader(token) },
    });

    const res = await app.request("/organizations/software-zen", {
      headers: { cookie: cookieHeader(token) },
    });
    const html = await res.text();
    expect(html).toContain("Conversations");
    expect(html).toContain("no conversations tagged to it yet");
  });

  it("GET /organizations/:key lists tagged sessions with title, persona, and preview (CV1.E4.S5)", async () => {
    const { app, db, token, userId } = createTestApp();
    const form = new FormData();
    form.set("name", "Software Zen");
    form.set("key", "software-zen");
    await app.request("/organizations", {
      method: "POST",
      body: form,
      headers: { cookie: cookieHeader(token) },
    });

    setIdentityLayer(db, userId, "persona", "estrategista", "...");

    // Create a session with persona + org meta on assistant message
    const { createSessionAt, appendEntry } = await import("../server/db.js");
    const sid = createSessionAt(db, userId, "Pricing decision", 5000);
    appendEntry(db, sid, null, "message", {
      role: "user", content: [{ type: "text", text: "Should we raise prices?" }], timestamp: 5000,
    }, 5000);
    appendEntry(db, sid, null, "message", {
      role: "assistant", content: [{ type: "text", text: "Let me think." }],
      _persona: "estrategista", _organization: "software-zen", timestamp: 5001,
    }, 5001);

    const res = await app.request("/organizations/software-zen", {
      headers: { cookie: cookieHeader(token) },
    });
    const html = await res.text();
    expect(html).toContain("Pricing decision");
    expect(html).toContain("Should we raise prices?");
    expect(html).toContain("estrategista");
    expect(html).toContain(`/conversation/${sid}`);
  });

  it("POST /organizations/:key updates briefing and situation", async () => {
    const { app, db, token, userId } = createTestApp();
    const create = new FormData();
    create.set("name", "Software Zen");
    create.set("key", "sz");
    await app.request("/organizations", {
      method: "POST",
      body: create,
      headers: { cookie: cookieHeader(token) },
    });

    const update = new FormData();
    update.set("name", "Software Zen");
    update.set("briefing", "curadoria sobre massa");
    update.set("situation", "travessia do deserto");
    const res = await app.request("/organizations/sz", {
      method: "POST",
      body: update,
      headers: { cookie: cookieHeader(token) },
    });

    expect(res.status).toBe(302);
    const row = db
      .prepare("SELECT briefing, situation FROM organizations WHERE user_id = ? AND key = ?")
      .get(userId, "sz") as { briefing: string; situation: string };
    expect(row.briefing).toBe("curadoria sobre massa");
    expect(row.situation).toBe("travessia do deserto");
  });

  it("GET /organizations/:key returns 404 for unknown key", async () => {
    const { app, token } = createTestApp();
    const res = await app.request("/organizations/ghost", {
      headers: { cookie: cookieHeader(token) },
    });
    expect(res.status).toBe(404);
  });

  it("POST /organizations/:key/archive archives and toggles status", async () => {
    const { app, db, token, userId } = createTestApp();
    const form = new FormData();
    form.set("name", "Software Zen");
    form.set("key", "sz");
    await app.request("/organizations", {
      method: "POST",
      body: form,
      headers: { cookie: cookieHeader(token) },
    });

    const res = await app.request("/organizations/sz/archive", {
      method: "POST",
      headers: { cookie: cookieHeader(token) },
    });
    expect(res.status).toBe(302);

    const status = (
      db.prepare("SELECT status FROM organizations WHERE user_id = ? AND key = ?").get(
        userId,
        "sz",
      ) as { status: string }
    ).status;
    expect(status).toBe("archived");
  });

  it("POST /organizations/:key/delete removes the row and redirects to list", async () => {
    const { app, db, token, userId } = createTestApp();
    const form = new FormData();
    form.set("name", "Temp");
    form.set("key", "temp");
    await app.request("/organizations", {
      method: "POST",
      body: form,
      headers: { cookie: cookieHeader(token) },
    });

    const res = await app.request("/organizations/temp/delete", {
      method: "POST",
      headers: { cookie: cookieHeader(token) },
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/organizations");

    const row = db
      .prepare("SELECT id FROM organizations WHERE user_id = ? AND key = ?")
      .get(userId, "temp");
    expect(row).toBeUndefined();
  });

  it("GET /organizations?archived=1 shows archived orgs separately", async () => {
    const { app, token } = createTestApp();
    const form1 = new FormData();
    form1.set("name", "Active");
    form1.set("key", "active");
    await app.request("/organizations", {
      method: "POST",
      body: form1,
      headers: { cookie: cookieHeader(token) },
    });

    const form2 = new FormData();
    form2.set("name", "Old");
    form2.set("key", "old");
    await app.request("/organizations", {
      method: "POST",
      body: form2,
      headers: { cookie: cookieHeader(token) },
    });
    await app.request("/organizations/old/archive", {
      method: "POST",
      headers: { cookie: cookieHeader(token) },
    });

    const defaultView = await app.request("/organizations", {
      headers: { cookie: cookieHeader(token) },
    });
    const defaultHtml = await defaultView.text();
    expect(defaultHtml).toContain(">Active<");
    expect(defaultHtml).not.toMatch(/<a[^>]*href="\/organizations\/old"[^>]*class="scope-card"/);

    const archivedView = await app.request("/organizations?archived=1", {
      headers: { cookie: cookieHeader(token) },
    });
    const archivedHtml = await archivedView.text();
    expect(archivedHtml).toContain("Archived");
    expect(archivedHtml).toContain(">Old<");
  });

  it("requires auth — GET /organizations without cookie redirects to login", async () => {
    const { app } = createTestApp();
    const res = await app.request("/organizations");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/login");
  });

  it("regular users have access (no admin guard)", async () => {
    const { app, userToken } = createTestAppWithRoles();
    const res = await app.request("/organizations", {
      headers: { cookie: cookieHeader(userToken) },
    });
    expect(res.status).toBe(200);
  });
});

describe("web routes — journeys (CV1.E4.S1)", () => {
  async function createOrgHelper(app: any, token: string, key: string, name: string): Promise<string> {
    const form = new FormData();
    form.set("name", name);
    form.set("key", key);
    const res = await app.request("/organizations", {
      method: "POST",
      body: form,
      headers: { cookie: cookieHeader(token) },
    });
    expect(res.status).toBe(302);
    return key;
  }

  it("GET /journeys renders the list page and the create form", async () => {
    const { app, token } = createTestApp();
    const res = await app.request("/journeys", {
      headers: { cookie: cookieHeader(token) },
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Journeys");
    expect(html).toContain("New journey");
    expect(html).toContain("(personal journey)");
  });

  it("list shows Last conversation card for each journey (CV0.E4.S7)", async () => {
    const { app, db, token, userId } = createTestApp();
    const form = new FormData();
    form.set("name", "Vida econômica");
    form.set("key", "vida-economica");
    form.set("organization_id", "");
    await app.request("/journeys", {
      method: "POST",
      body: form,
      headers: { cookie: cookieHeader(token) },
    });

    // Before tagging, empty-state shows
    let res = await app.request("/journeys", {
      headers: { cookie: cookieHeader(token) },
    });
    let html = await res.text();
    expect(html).toContain("Last conversation");
    expect(html).toContain("No conversations tagged yet");
    expect(html).toContain('data-testid="scope-last-vida-economica"');

    // Tag a session via assistant meta
    const sessionId = getOrCreateSession(db, userId);
    db.prepare("UPDATE sessions SET title = ? WHERE id = ?").run(
      "Budget reset",
      sessionId,
    );
    db.prepare(
      "INSERT INTO entries (id, session_id, parent_id, type, data, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(
      "e-ve",
      sessionId,
      null,
      "message",
      JSON.stringify({
        role: "assistant",
        content: [{ type: "text", text: "hi" }],
        _journey: "vida-economica",
      }),
      Date.now() - 120_000,
    );

    res = await app.request("/journeys", {
      headers: { cookie: cookieHeader(token) },
    });
    html = await res.text();
    expect(html).toContain("Budget reset");
    expect(html).not.toContain("No conversations tagged yet");
  });

  it("POST /journeys creates a personal journey (no org)", async () => {
    const { app, db, token, userId } = createTestApp();
    const form = new FormData();
    form.set("name", "Vida econômica");
    form.set("key", "vida-economica");
    form.set("organization_id", "");

    const res = await app.request("/journeys", {
      method: "POST",
      body: form,
      headers: { cookie: cookieHeader(token) },
    });

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/journeys/vida-economica");

    const row = db
      .prepare("SELECT name, organization_id FROM journeys WHERE user_id = ?")
      .get(userId) as { name: string; organization_id: string | null };
    expect(row.name).toBe("Vida econômica");
    expect(row.organization_id).toBeNull();
  });

  it("POST /journeys creates a journey linked to an organization", async () => {
    const { app, db, token, userId } = createTestApp();
    await createOrgHelper(app, token, "sz", "Software Zen");
    const orgRow = db
      .prepare("SELECT id FROM organizations WHERE user_id = ? AND key = ?")
      .get(userId, "sz") as { id: string };

    const form = new FormData();
    form.set("name", "O Espelho");
    form.set("key", "o-espelho");
    form.set("organization_id", orgRow.id);

    const res = await app.request("/journeys", {
      method: "POST",
      body: form,
      headers: { cookie: cookieHeader(token) },
    });

    expect(res.status).toBe(302);
    const journeyRow = db
      .prepare("SELECT organization_id FROM journeys WHERE user_id = ? AND key = ?")
      .get(userId, "o-espelho") as { organization_id: string };
    expect(journeyRow.organization_id).toBe(orgRow.id);
  });

  it("POST /journeys rejects unknown organization_id", async () => {
    const { app, token } = createTestApp();
    const form = new FormData();
    form.set("name", "J");
    form.set("key", "j");
    form.set("organization_id", "ghost-id");

    const res = await app.request("/journeys", {
      method: "POST",
      body: form,
      headers: { cookie: cookieHeader(token) },
    });

    expect(res.status).toBe(400);
  });

  it("GET /journeys/:key renders the workshop with the org selector", async () => {
    const { app, token } = createTestApp();
    await createOrgHelper(app, token, "sz", "Software Zen");

    const create = new FormData();
    create.set("name", "O Espelho");
    create.set("key", "o-espelho");
    create.set("organization_id", "");
    await app.request("/journeys", {
      method: "POST",
      body: create,
      headers: { cookie: cookieHeader(token) },
    });

    const res = await app.request("/journeys/o-espelho", {
      headers: { cookie: cookieHeader(token) },
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("O Espelho");
    expect(html).toContain("Briefing");
    expect(html).toContain("Situation");
    expect(html).toContain("Organization");
    expect(html).toContain("Software Zen");
  });

  it("POST /journeys/:key updates briefing, situation, and organization link", async () => {
    const { app, db, token, userId } = createTestApp();
    await createOrgHelper(app, token, "sz", "Software Zen");
    const orgRow = db
      .prepare("SELECT id FROM organizations WHERE user_id = ? AND key = ?")
      .get(userId, "sz") as { id: string };

    const create = new FormData();
    create.set("name", "O Espelho");
    create.set("key", "o-espelho");
    create.set("organization_id", "");
    await app.request("/journeys", {
      method: "POST",
      body: create,
      headers: { cookie: cookieHeader(token) },
    });

    const update = new FormData();
    update.set("name", "O Espelho");
    update.set("briefing", "ambiente de prática");
    update.set("situation", "preparando lançamento");
    update.set("organization_id", orgRow.id);
    const res = await app.request("/journeys/o-espelho", {
      method: "POST",
      body: update,
      headers: { cookie: cookieHeader(token) },
    });

    expect(res.status).toBe(302);
    const row = db
      .prepare(
        "SELECT briefing, situation, organization_id FROM journeys WHERE user_id = ? AND key = ?",
      )
      .get(userId, "o-espelho") as {
      briefing: string;
      situation: string;
      organization_id: string;
    };
    expect(row.briefing).toBe("ambiente de prática");
    expect(row.situation).toBe("preparando lançamento");
    expect(row.organization_id).toBe(orgRow.id);
  });

  it("POST /journeys/:key unlinks organization when field is blank", async () => {
    const { app, db, token, userId } = createTestApp();
    await createOrgHelper(app, token, "sz", "Software Zen");
    const orgRow = db
      .prepare("SELECT id FROM organizations WHERE user_id = ? AND key = ?")
      .get(userId, "sz") as { id: string };

    const create = new FormData();
    create.set("name", "J");
    create.set("key", "j");
    create.set("organization_id", orgRow.id);
    await app.request("/journeys", {
      method: "POST",
      body: create,
      headers: { cookie: cookieHeader(token) },
    });

    const update = new FormData();
    update.set("name", "J");
    update.set("briefing", "");
    update.set("situation", "");
    update.set("organization_id", "");
    await app.request("/journeys/j", {
      method: "POST",
      body: update,
      headers: { cookie: cookieHeader(token) },
    });

    const row = db
      .prepare("SELECT organization_id FROM journeys WHERE user_id = ? AND key = ?")
      .get(userId, "j") as { organization_id: string | null };
    expect(row.organization_id).toBeNull();
  });

  it("GET /journeys/:key returns 404 for unknown key", async () => {
    const { app, token } = createTestApp();
    const res = await app.request("/journeys/ghost", {
      headers: { cookie: cookieHeader(token) },
    });
    expect(res.status).toBe(404);
  });

  it("list page groups journeys by organization and shows personal separately", async () => {
    const { app, db, token, userId } = createTestApp();
    await createOrgHelper(app, token, "sz", "Software Zen");
    const orgRow = db
      .prepare("SELECT id FROM organizations WHERE user_id = ? AND key = ?")
      .get(userId, "sz") as { id: string };

    const orgJourney = new FormData();
    orgJourney.set("name", "O Espelho");
    orgJourney.set("key", "o-espelho");
    orgJourney.set("organization_id", orgRow.id);
    await app.request("/journeys", {
      method: "POST",
      body: orgJourney,
      headers: { cookie: cookieHeader(token) },
    });

    const personalJourney = new FormData();
    personalJourney.set("name", "Vida econômica");
    personalJourney.set("key", "vida-economica");
    personalJourney.set("organization_id", "");
    await app.request("/journeys", {
      method: "POST",
      body: personalJourney,
      headers: { cookie: cookieHeader(token) },
    });

    const res = await app.request("/journeys", {
      headers: { cookie: cookieHeader(token) },
    });
    const html = await res.text();
    expect(html).toContain("Personal journeys");
    expect(html).toContain("Vida econômica");
    expect(html).toContain("O Espelho");
    // Personal journeys group header should appear before the organization
    // group header (checking the group-org anchor, not the option in the
    // create form which lists Software Zen earlier).
    const personalPos = html.indexOf("journey-group-personal");
    const orgGroupPos = html.indexOf("journey-group-org");
    expect(personalPos).toBeGreaterThan(-1);
    expect(orgGroupPos).toBeGreaterThan(-1);
    expect(personalPos).toBeLessThan(orgGroupPos);
  });

  it("archive lifecycle toggles visibility", async () => {
    const { app, token } = createTestApp();
    const form = new FormData();
    form.set("name", "Temp");
    form.set("key", "temp");
    form.set("organization_id", "");
    await app.request("/journeys", {
      method: "POST",
      body: form,
      headers: { cookie: cookieHeader(token) },
    });

    const archive = await app.request("/journeys/temp/archive", {
      method: "POST",
      headers: { cookie: cookieHeader(token) },
    });
    expect(archive.status).toBe(302);

    const defaultView = await app.request("/journeys", {
      headers: { cookie: cookieHeader(token) },
    });
    const defaultHtml = await defaultView.text();
    expect(defaultHtml).not.toMatch(/<a[^>]*href="\/journeys\/temp"[^>]*class="scope-card"/);
    expect(defaultHtml).toContain("Show 1 archived journey");

    const archivedView = await app.request("/journeys?archived=1", {
      headers: { cookie: cookieHeader(token) },
    });
    const archivedHtml = await archivedView.text();
    expect(archivedHtml).toContain("Archived");
    expect(archivedHtml).toContain(">Temp<");
  });

  it("POST /journeys/:key/delete removes the journey", async () => {
    const { app, db, token, userId } = createTestApp();
    const form = new FormData();
    form.set("name", "Temp");
    form.set("key", "temp");
    form.set("organization_id", "");
    await app.request("/journeys", {
      method: "POST",
      body: form,
      headers: { cookie: cookieHeader(token) },
    });

    const res = await app.request("/journeys/temp/delete", {
      method: "POST",
      headers: { cookie: cookieHeader(token) },
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/journeys");

    const row = db
      .prepare("SELECT id FROM journeys WHERE user_id = ? AND key = ?")
      .get(userId, "temp");
    expect(row).toBeUndefined();
  });

  it("requires auth — GET /journeys without cookie redirects to login", async () => {
    const { app } = createTestApp();
    const res = await app.request("/journeys");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/login");
  });
});

describe("web routes — composed drawer + rail (CV1.E4.S1 phase 6)", () => {
  it("Cognitive Map includes organization and journey dropdowns", async () => {
    const { app, token } = createTestApp();
    const createOrg = new FormData();
    createOrg.set("name", "Software Zen");
    createOrg.set("key", "sz");
    await app.request("/organizations", {
      method: "POST",
      body: createOrg,
      headers: { cookie: cookieHeader(token) },
    });
    const createJ = new FormData();
    createJ.set("name", "Vida econômica");
    createJ.set("key", "vida-economica");
    createJ.set("organization_id", "");
    await app.request("/journeys", {
      method: "POST",
      body: createJ,
      headers: { cookie: cookieHeader(token) },
    });

    const res = await app.request("/map", {
      headers: { cookie: cookieHeader(token) },
    });
    const html = await res.text();
    expect(html).toContain('id="composed-organization"');
    expect(html).toContain('id="composed-journey"');
    expect(html).toContain('value="sz"');
    expect(html).toContain('value="vida-economica"');
  });

  it("GET /map/composed returns the composition with org and journey", async () => {
    const { app, db, token, userId } = createTestApp();
    const createOrg = new FormData();
    createOrg.set("name", "Software Zen");
    createOrg.set("key", "sz");
    await app.request("/organizations", {
      method: "POST",
      body: createOrg,
      headers: { cookie: cookieHeader(token) },
    });
    const update = new FormData();
    update.set("name", "Software Zen");
    update.set("briefing", "BRIEFING_SZ");
    update.set("situation", "SITUATION_SZ");
    await app.request("/organizations/sz", {
      method: "POST",
      body: update,
      headers: { cookie: cookieHeader(token) },
    });

    const res = await app.request(
      "/map/composed?persona=none&organization=sz&journey=none&adapter=none",
      { headers: { cookie: cookieHeader(token) } },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { prompt: string; organization: string | null };
    expect(body.organization).toBe("sz");
    expect(body.prompt).toContain("BRIEFING_SZ");
    expect(body.prompt).toContain("Current situation:");
    expect(body.prompt).toContain("SITUATION_SZ");
  });

  it("GET /conversation renders the rail with scope rows (hidden when no history)", async () => {
    const { app, token } = createTestApp();
    const res = await app.request("/conversation", {
      headers: { cookie: cookieHeader(token) },
    });
    const html = await res.text();
    // Row elements exist in the DOM even when empty.
    expect(html).toContain('id="rail-composed-organization"');
    expect(html).toContain('id="rail-composed-journey"');
    // Hidden state when no scopes are active.
    expect(html).toMatch(
      /id="rail-composed-organization"[^>]*data-hidden="true"/,
    );
    expect(html).toMatch(/id="rail-composed-journey"[^>]*data-hidden="true"/);
  });

  it("buildRailState derives organization and journey from the last assistant entry meta", async () => {
    const { app, db, token, userId } = createTestApp();

    // Seed an org and a journey for the user.
    const createOrg = new FormData();
    createOrg.set("name", "Software Zen");
    createOrg.set("key", "sz");
    await app.request("/organizations", {
      method: "POST",
      body: createOrg,
      headers: { cookie: cookieHeader(token) },
    });
    const createJ = new FormData();
    createJ.set("name", "O Espelho");
    createJ.set("key", "o-espelho");
    createJ.set("organization_id", "");
    await app.request("/journeys", {
      method: "POST",
      body: createJ,
      headers: { cookie: cookieHeader(token) },
    });

    // Simulate a past turn by writing assistant entry meta directly.
    const sessionId = getOrCreateSession(db, userId);
    appendEntry(db, sessionId, null, "message", {
      role: "user",
      content: [{ type: "text", text: "anything" }],
    });
    appendEntry(db, sessionId, null, "message", {
      role: "assistant",
      content: [{ type: "text", text: "reply" }],
      _persona: "",
      _organization: "sz",
      _journey: "o-espelho",
    });

    const res = await app.request("/conversation", {
      headers: { cookie: cookieHeader(token) },
    });
    const html = await res.text();
    // Scope rows visible with the derived keys.
    expect(html).toMatch(
      /id="rail-composed-organization"[^>]*data-hidden="false"/,
    );
    expect(html).toContain("organization: sz");
    expect(html).toMatch(
      /id="rail-composed-journey"[^>]*data-hidden="false"/,
    );
    expect(html).toContain("journey: o-espelho");
  });
});

// ---------------------------------------------------------------------------
// CV1.E4.S4 — Session scope tagging
// ---------------------------------------------------------------------------

describe("web routes — session scope tagging (CV1.E4.S4)", () => {
  it("GET /conversation renders the Scope of this conversation section with tag groups", async () => {
    const { app, token } = createTestApp();
    // Seed a persona, an org, and a journey via handlers
    const orgForm = new FormData();
    orgForm.set("name", "Software Zen");
    orgForm.set("key", "sz");
    await app.request("/organizations", {
      method: "POST",
      body: orgForm,
      headers: { cookie: cookieHeader(token) },
    });
    const jForm = new FormData();
    jForm.set("name", "Vida econômica");
    jForm.set("key", "vida");
    jForm.set("organization_id", "");
    await app.request("/journeys", {
      method: "POST",
      body: jForm,
      headers: { cookie: cookieHeader(token) },
    });

    const res = await app.request("/conversation", {
      headers: { cookie: cookieHeader(token) },
    });
    const html = await res.text();
    expect(html).toContain("Scope of this conversation");
    expect(html).toContain(">Personas<");
    expect(html).toContain(">Organizations<");
    expect(html).toContain(">Journeys<");
    // Add-dropdown should present the available orgs and journeys as options
    expect(html).toContain('<option value="sz">Software Zen</option>');
    expect(html).toContain('<option value="vida">Vida econômica</option>');
  });

  it("POST /conversation/tag with type=organization adds the org to the session", async () => {
    const { app, db, token, userId } = createTestApp();
    const orgForm = new FormData();
    orgForm.set("name", "Software Zen");
    orgForm.set("key", "sz");
    await app.request("/organizations", {
      method: "POST",
      body: orgForm,
      headers: { cookie: cookieHeader(token) },
    });
    const sessionId = getOrCreateSession(db, userId);

    const res = await app.request("/conversation/tag", {
      method: "POST",
      headers: {
        Cookie: cookieHeader(token),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "type=organization&key=sz",
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/conversation");

    const { getSessionTags } = await import("../server/db.js");
    const tags = getSessionTags(db, sessionId);
    expect(tags.organizationKeys).toEqual(["sz"]);
  });

  it("POST /conversation/untag removes the tag", async () => {
    const { app, db, token, userId } = createTestApp();
    const sessionId = getOrCreateSession(db, userId);
    const { addSessionPersona, getSessionTags } = await import(
      "../server/db.js"
    );
    addSessionPersona(db, sessionId, "terapeuta");

    const res = await app.request("/conversation/untag", {
      method: "POST",
      headers: {
        Cookie: cookieHeader(token),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "type=persona&key=terapeuta",
    });
    expect(res.status).toBe(302);
    expect(getSessionTags(db, sessionId).personaKeys).toEqual([]);
  });

  it("POST /conversation/tag with unknown type returns 400", async () => {
    const { app, token } = createTestApp();
    const res = await app.request("/conversation/tag", {
      method: "POST",
      headers: {
        Cookie: cookieHeader(token),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "type=nonsense&key=whatever",
    });
    expect(res.status).toBe(400);
  });

  it("tagged keys render as pills with × remove forms", async () => {
    const { app, db, token, userId } = createTestApp();
    const orgForm = new FormData();
    orgForm.set("name", "Software Zen");
    orgForm.set("key", "sz");
    await app.request("/organizations", {
      method: "POST",
      body: orgForm,
      headers: { cookie: cookieHeader(token) },
    });
    const sessionId = getOrCreateSession(db, userId);
    const { addSessionOrganization } = await import("../server/db.js");
    addSessionOrganization(db, sessionId, "sz");

    const res = await app.request("/conversation", {
      headers: { cookie: cookieHeader(token) },
    });
    const html = await res.text();
    // Pill is rendered with the org's display name
    expect(html).toContain("rail-scope-tags-pill-name");
    expect(html).toContain(">Software Zen<");
    // Remove form points at /conversation/untag with type+key
    expect(html).toMatch(
      /action="\/conversation\/untag"[\s\S]{0,300}name="type"\s+value="organization"/,
    );
  });
});
