import "dotenv/config";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { createHash } from "node:crypto";
import { getCookie, deleteCookie } from "hono/cookie";
import { Agent } from "@mariozechner/pi-agent-core";
import { getModel } from "@mariozechner/pi-ai";
import { streamSSE } from "hono/streaming";
import {
  openDb,
  createUser,
  getUserByTokenHash,
  getUserByName,
  setIdentityLayer,
  getIdentityLayers,
  getOrCreateSession,
  loadMessages,
  appendEntry,
  type User,
} from "./db.js";
import { authMiddleware } from "./auth.js";
import { composeSystemPrompt } from "./identity.js";
import { setupTelegram } from "../adapters/telegram/index.js";
import { webAuthMiddleware, setTokenCookie } from "./web/auth.js";
import { LoginPage } from "./web/login.js";
import { ChatPage } from "./web/chat.js";
import { UsersPage } from "./web/admin/users.js";
import { IdentityPage } from "./web/admin/identity.js";

const db = openDb();
const port = parseInt(process.env.PORT ?? "3000", 10);
const model = getModel(
  "openrouter",
  process.env.LLM_MODEL ?? "google/gemini-2.0-flash-001",
);

const app = new Hono<{ Variables: { user: User } }>();

// --- Static files ---

app.use("/public/*", serveStatic({ root: "server/" }));

// --- Login (no auth) ---

app.get("/login", (c) => c.html(<LoginPage />));

app.post("/login", async (c) => {
  const body = await c.req.parseBody();
  const token = body.token as string;
  if (!token) {
    return c.html(<LoginPage error="Token is required" />);
  }

  const hash = createHash("sha256").update(token).digest("hex");
  const user = getUserByTokenHash(db, hash);
  if (!user) {
    return c.html(<LoginPage error="Invalid token" />);
  }

  setTokenCookie(c, token);
  return c.redirect("/chat");
});

app.post("/logout", (c) => {
  deleteCookie(c, "mirror_token");
  return c.redirect("/login");
});

// --- API routes (bearer token auth) ---

const api = new Hono<{ Variables: { user: User } }>();
api.use("*", authMiddleware(db));

api.post("/message", async (c) => {
  const user = c.get("user");
  const { text } = await c.req.json<{ text: string }>();
  const sessionId = getOrCreateSession(db, user.id);

  const history = loadMessages(db, sessionId);
  const systemPrompt = composeSystemPrompt(db, user.id);

  const agent = new Agent({
    initialState: {
      systemPrompt,
      model,
      messages: history,
    },
    getApiKey: () => process.env.OPENROUTER_API_KEY,
  });

  let reply = "";
  agent.subscribe((event) => {
    if (
      event.type === "message_update" &&
      event.assistantMessageEvent.type === "text_delta"
    ) {
      reply += event.assistantMessageEvent.delta;
    }
  });

  await agent.prompt(text);

  if (!reply) {
    const lastMsg = agent.state.messages.findLast(
      (m) => m.role === "assistant",
    );
    if (lastMsg && "content" in lastMsg) {
      for (const block of lastMsg.content) {
        if ("text" in block) reply += block.text;
      }
    }
  }

  const userMsg = agent.state.messages.findLast((m) => m.role === "user");
  const assistantMsg = agent.state.messages.findLast(
    (m) => m.role === "assistant",
  );

  const lastEntry = db
    .prepare(
      "SELECT id FROM entries WHERE session_id = ? ORDER BY timestamp DESC LIMIT 1",
    )
    .get(sessionId) as { id: string } | undefined;

  const userEntryId = appendEntry(
    db,
    sessionId,
    lastEntry?.id ?? null,
    "message",
    userMsg,
  );
  appendEntry(db, sessionId, userEntryId, "message", assistantMsg);

  return c.json({ reply });
});

api.get("/thread", (c) => {
  const user = c.get("user");
  const sessionId = getOrCreateSession(db, user.id);
  const messages = loadMessages(db, sessionId);
  return c.json({ sessionId, messages, count: messages.length });
});

app.route("/api", api);

// Backwards compat: keep /message and /thread at root for CLI
app.use("/message", authMiddleware(db));
app.post("/message", async (c) => api.fetch(c.req.raw));
app.use("/thread", authMiddleware(db));
app.get("/thread", async (c) => api.fetch(c.req.raw));

// --- Web routes (cookie auth) ---

const web = new Hono<{ Variables: { user: User } }>();
web.use("*", webAuthMiddleware(db));

web.get("/chat", (c) => {
  const user = c.get("user");
  const sessionId = getOrCreateSession(db, user.id);
  const messages = loadMessages(db, sessionId);
  return c.html(<ChatPage user={user} messages={messages} />);
});

web.get("/chat/stream", async (c) => {
  const user = c.get("user");
  const text = c.req.query("text");
  if (!text) return c.json({ error: "Missing text" }, 400);

  const sessionId = getOrCreateSession(db, user.id);
  const history = loadMessages(db, sessionId);
  const systemPrompt = composeSystemPrompt(db, user.id);

  const agent = new Agent({
    initialState: {
      systemPrompt,
      model,
      messages: history,
    },
    getApiKey: () => process.env.OPENROUTER_API_KEY,
  });

  return streamSSE(c, async (stream) => {
    let reply = "";

    agent.subscribe((event) => {
      if (
        event.type === "message_update" &&
        event.assistantMessageEvent.type === "text_delta"
      ) {
        const delta = event.assistantMessageEvent.delta;
        reply += delta;
        stream.writeSSE({ data: JSON.stringify({ type: "delta", text: delta }) });
      }
    });

    await agent.prompt(text);

    if (!reply) {
      const lastMsg = agent.state.messages.findLast(
        (m) => m.role === "assistant",
      );
      if (lastMsg && "content" in lastMsg) {
        for (const block of lastMsg.content) {
          if ("text" in block) reply += block.text;
        }
      }
    }

    // Persist
    const userMsg = agent.state.messages.findLast((m) => m.role === "user");
    const assistantMsg = agent.state.messages.findLast(
      (m) => m.role === "assistant",
    );

    const lastEntry = db
      .prepare(
        "SELECT id FROM entries WHERE session_id = ? ORDER BY timestamp DESC LIMIT 1",
      )
      .get(sessionId) as { id: string } | undefined;

    const userEntryId = appendEntry(
      db,
      sessionId,
      lastEntry?.id ?? null,
      "message",
      userMsg,
    );
    appendEntry(db, sessionId, userEntryId, "message", assistantMsg);

    await stream.writeSSE({ data: JSON.stringify({ type: "done", reply }) });
  });
});

// Admin routes
web.get("/admin/users", async (c) => {
  const allUsers = db
    .prepare("SELECT id, name, created_at FROM users ORDER BY name")
    .all() as { id: string; name: string; created_at: number }[];
  return c.html(<UsersPage users={allUsers} />);
});

web.post("/admin/users", async (c) => {
  const { randomBytes } = await import("node:crypto");
  const { readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const body = await c.req.parseBody();
  const name = body.name as string;

  if (!name) {
    const allUsers = db
      .prepare("SELECT id, name, created_at FROM users ORDER BY name")
      .all() as { id: string; name: string; created_at: number }[];
    return c.html(<UsersPage users={allUsers} error="Name is required" />);
  }

  const token = randomBytes(32).toString("hex");
  const hash = createHash("sha256").update(token).digest("hex");
  const user = createUser(db, name, hash);

  // Starter identity layers
  const loadTemplate = (n: string) =>
    readFileSync(join(import.meta.dirname, "templates", `${n}.md`), "utf-8");
  setIdentityLayer(db, user.id, "self", "soul", loadTemplate("soul"));
  setIdentityLayer(db, user.id, "ego", "identity", loadTemplate("identity"));
  setIdentityLayer(db, user.id, "ego", "behavior", loadTemplate("behavior"));
  getOrCreateSession(db, user.id);

  const allUsers = db
    .prepare("SELECT id, name, created_at FROM users ORDER BY name")
    .all() as { id: string; name: string; created_at: number }[];
  return c.html(
    <UsersPage users={allUsers} createdUser={name} createdToken={token} />,
  );
});

web.get("/admin/identity/:name", (c) => {
  const name = c.req.param("name");
  const targetUser = getUserByName(db, name);
  if (!targetUser) return c.text("User not found", 404);
  const layers = getIdentityLayers(db, targetUser.id);
  return c.html(<IdentityPage userName={name} layers={layers} />);
});

web.post("/admin/identity/:name", async (c) => {
  const name = c.req.param("name");
  const targetUser = getUserByName(db, name);
  if (!targetUser) return c.text("User not found", 404);

  const body = await c.req.parseBody();
  const layer = body.layer as string;
  const key = body.key as string;
  const content = body.content as string;

  if (layer && key && content) {
    setIdentityLayer(db, targetUser.id, layer, key, content);
  }

  const layers = getIdentityLayers(db, targetUser.id);
  return c.html(<IdentityPage userName={name} layers={layers} saved />);
});

app.route("/", web);

// --- Root redirect ---

app.get("/", (c) => c.redirect("/chat"));

// --- Telegram ---

setupTelegram(app, db);

// --- Start ---

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`mirror-server running at http://localhost:${info.port}`);
});
