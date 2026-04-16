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
  deleteIdentityLayer,
  getIdentityLayers,
  getOrCreateSession,
  loadMessages,
  loadMessagesWithMeta,
  appendEntry,
  type User,
} from "./db.js";
import { authMiddleware } from "./auth.js";
import { composeSystemPrompt } from "./identity.js";
import { receive } from "./reception.js";
import { setupTelegram } from "../adapters/telegram/index.js";
import { models } from "./config/models.js";
import { webAuthMiddleware, setTokenCookie } from "./web/auth.js";
import { LoginPage } from "./web/login.js";
import { ChatPage } from "./web/chat.js";
import { UsersPage } from "./web/admin/users.js";
import { IdentityPage } from "./web/admin/identity.js";
import { PersonasPage } from "./web/admin/personas.js";
import { UserProfilePage } from "./web/admin/user-profile.js";

const db = openDb();
const port = parseInt(process.env.PORT ?? "3000", 10);
const model = getModel(models.main.provider, models.main.model);

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
  const { text, client } = await c.req.json<{ text: string; client?: string }>();
  const adapter = client || "api";
  const sessionId = getOrCreateSession(db, user.id);

  const reception = await receive(db, user.id, text);
  const history = loadMessages(db, sessionId);
  const systemPrompt = composeSystemPrompt(db, user.id, reception.persona, adapter);

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
  // Attach persona as metadata — not part of the content the LLM will re-read
  const assistantWithMeta = reception.persona
    ? { ...assistantMsg, _persona: reception.persona }
    : assistantMsg;
  appendEntry(db, sessionId, userEntryId, "message", assistantWithMeta);

  const signature = reception.persona ? `◇ ${reception.persona}\n\n` : "";
  return c.json({ reply: signature + reply, persona: reception.persona });
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
  const messages = loadMessagesWithMeta(db, sessionId);
  return c.html(<ChatPage user={user} messages={messages} />);
});

web.get("/chat/stream", async (c) => {
  const user = c.get("user");
  const text = c.req.query("text");
  if (!text) return c.json({ error: "Missing text" }, 400);

  const sessionId = getOrCreateSession(db, user.id);
  const reception = await receive(db, user.id, text);
  const history = loadMessages(db, sessionId);
  const systemPrompt = composeSystemPrompt(db, user.id, reception.persona, "web");

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

    // Emit signature first (so UI can prefix the bubble before tokens arrive)
    await stream.writeSSE({
      data: JSON.stringify({ type: "persona", persona: reception.persona }),
    });

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
    const assistantWithMeta = reception.persona
      ? { ...assistantMsg, _persona: reception.persona }
      : assistantMsg;
    appendEntry(db, sessionId, userEntryId, "message", assistantWithMeta);

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

// Legacy routes — redirect to unified profile
web.get("/admin/identity/:name", (c) => c.redirect(`/admin/users/${c.req.param("name")}`));
web.get("/admin/personas/:name", (c) => c.redirect(`/admin/users/${c.req.param("name")}`));

// Unified user profile — base identity + personas on one page
web.get("/admin/users/:name", (c) => {
  const name = c.req.param("name");
  const targetUser = getUserByName(db, name);
  if (!targetUser) return c.text("User not found", 404);
  const layers = getIdentityLayers(db, targetUser.id);
  const baseLayers = layers.filter((l) => l.layer === "self" || l.layer === "ego");
  const personas = layers.filter((l) => l.layer === "persona");
  return c.html(<UserProfilePage userName={name} baseLayers={baseLayers} personas={personas} />);
});

web.post("/admin/users/:name", async (c) => {
  const name = c.req.param("name");
  const targetUser = getUserByName(db, name);
  if (!targetUser) return c.text("User not found", 404);

  const body = await c.req.parseBody();
  const group = body.group as string;
  const action = body.action as string;
  const key = body.key as string;
  const content = body.content as string;

  let saved: string | undefined;
  let deleted: string | undefined;

  if (action === "delete" && group === "persona" && key) {
    deleteIdentityLayer(db, targetUser.id, "persona", key);
    deleted = key;
  } else if (group === "base" && key && content) {
    const layer = body.layer as string;
    setIdentityLayer(db, targetUser.id, layer, key, content);
    saved = `${layer}/${key}`;
  } else if (group === "persona" && key && content) {
    setIdentityLayer(db, targetUser.id, "persona", key, content);
    saved = key;
  }

  const layers = getIdentityLayers(db, targetUser.id);
  const baseLayers = layers.filter((l) => l.layer === "self" || l.layer === "ego");
  const personas = layers.filter((l) => l.layer === "persona");
  return c.html(
    <UserProfilePage userName={name} baseLayers={baseLayers} personas={personas} saved={saved} deleted={deleted} />,
  );
});

// --- Telegram (before web routes — no auth middleware) ---

setupTelegram(app, db);

app.route("/", web);

// --- Root redirect ---

app.get("/", (c) => c.redirect("/chat"));

// --- Start ---

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`mirror-server running at http://localhost:${info.port}`);
});
