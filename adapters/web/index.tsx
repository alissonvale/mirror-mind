import { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";
import { createHash } from "node:crypto";
import { deleteCookie } from "hono/cookie";
import { Agent } from "@mariozechner/pi-agent-core";
import { getModel } from "@mariozechner/pi-ai";
import { streamSSE } from "hono/streaming";
import type Database from "better-sqlite3";
import {
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
} from "../../server/db.js";
import { composeSystemPrompt } from "../../server/identity.js";
import { receive } from "../../server/reception.js";
import { models } from "../../server/config/models.js";
import { computeSessionStats } from "../../server/session-stats.js";
import { composedSnapshot } from "../../server/composed-snapshot.js";
import {
  type RailState,
  personaInitials,
  personaColor,
} from "./pages/context-rail.js";
import { webAuthMiddleware, setTokenCookie } from "./auth.js";
import { LoginPage } from "./pages/login.js";
import { ChatPage } from "./pages/chat.js";
import { UsersPage } from "./pages/admin/users.js";
import { UserProfilePage } from "./pages/admin/user-profile.js";

/**
 * Extract a short descriptor from a persona's content — the first
 * non-heading non-empty line, trimmed to a short length. Mirrors the
 * logic in reception.ts so the rail and the classifier see the same
 * summary surface.
 */
function personaDescriptor(
  db: Database.Database,
  userId: string,
  personaKey: string | null,
): string | null {
  if (!personaKey) return null;
  const layers = getIdentityLayers(db, userId);
  const persona = layers.find(
    (l) => l.layer === "persona" && l.key === personaKey,
  );
  if (!persona) return null;
  const line = persona.content
    .split("\n")
    .find((l) => l.trim() && !l.startsWith("#"));
  if (!line) return null;
  const trimmed = line.trim();
  return trimmed.length > 120 ? trimmed.slice(0, 120) + "…" : trimmed;
}

/**
 * Build the rail state from the current session. Persona is derived
 * from the last assistant entry's stored meta — the same source the
 * chat history uses to show the persona badge.
 */
function buildRailState(
  db: Database.Database,
  user: User,
  sessionId: string,
  overridePersona?: string | null,
): RailState {
  const sessionStats = computeSessionStats(db, sessionId);

  let persona: string | null = overridePersona ?? null;
  if (overridePersona === undefined) {
    const messagesWithMeta = loadMessagesWithMeta(db, sessionId);
    for (let i = messagesWithMeta.length - 1; i >= 0; i--) {
      const m = messagesWithMeta[i];
      if (m.data.role === "assistant" && typeof m.meta.persona === "string") {
        persona = m.meta.persona as string;
        break;
      }
    }
  }

  const composed = composedSnapshot(db, user.id, persona);
  return {
    sessionStats,
    composed,
    personaDescriptor: personaDescriptor(db, user.id, persona),
    personaInitials: personaInitials(persona),
    personaColor: personaColor(persona),
    userName: user.name,
  };
}

export function setupWeb(
  app: Hono<{ Variables: { user: User } }>,
  db: Database.Database,
) {
  const model = getModel(models.main.provider, models.main.model);

  // --- Static files ---

  app.use("/public/*", serveStatic({ root: "adapters/web/" }));

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

  // --- Web routes (cookie auth) ---

  const web = new Hono<{ Variables: { user: User } }>();
  web.use("*", webAuthMiddleware(db));

  web.get("/chat", (c) => {
    const user = c.get("user");
    const sessionId = getOrCreateSession(db, user.id);
    const messages = loadMessagesWithMeta(db, sessionId);
    const rail = buildRailState(db, user, sessionId);
    return c.html(<ChatPage user={user} messages={messages} rail={rail} />);
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

      const rail = buildRailState(db, user, sessionId, reception.persona);
      await stream.writeSSE({
        data: JSON.stringify({ type: "done", reply, rail }),
      });
    });
  });

  // --- Admin routes ---

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

    const loadTemplate = (n: string) =>
      readFileSync(
        join(import.meta.dirname, "../../server/templates", `${n}.md`),
        "utf-8",
      );
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

  // Legacy redirects
  web.get("/admin/identity/:name", (c) =>
    c.redirect(`/admin/users/${c.req.param("name")}`),
  );
  web.get("/admin/personas/:name", (c) =>
    c.redirect(`/admin/users/${c.req.param("name")}`),
  );

  // Unified user profile
  web.get("/admin/users/:name", (c) => {
    const name = c.req.param("name");
    const targetUser = getUserByName(db, name);
    if (!targetUser) return c.text("User not found", 404);
    const layers = getIdentityLayers(db, targetUser.id);
    const baseLayers = layers.filter(
      (l) => l.layer === "self" || l.layer === "ego",
    );
    const personas = layers.filter((l) => l.layer === "persona");
    return c.html(
      <UserProfilePage
        userName={name}
        baseLayers={baseLayers}
        personas={personas}
      />,
    );
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
    const baseLayers = layers.filter(
      (l) => l.layer === "self" || l.layer === "ego",
    );
    const personas = layers.filter((l) => l.layer === "persona");
    return c.html(
      <UserProfilePage
        userName={name}
        baseLayers={baseLayers}
        personas={personas}
        saved={saved}
        deleted={deleted}
      />,
    );
  });

  app.route("/", web);

  console.log("Web adapter enabled");
}
