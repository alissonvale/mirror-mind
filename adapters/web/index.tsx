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
  type UserRole,
  type IdentityLayer,
} from "../../server/db.js";
import { composeSystemPrompt } from "../../server/identity.js";
import { receive } from "../../server/reception.js";
import { models } from "../../server/config/models.js";
import { computeSessionStats } from "../../server/session-stats.js";
import { composedSnapshot } from "../../server/composed-snapshot.js";
import { extractPersonaDescriptor } from "../../server/personas.js";
import {
  type RailState,
  avatarInitials,
  avatarColor,
} from "./pages/context-rail.js";
import { webAuthMiddleware, setTokenCookie, adminOnlyMiddleware } from "./auth.js";
import { LoginPage } from "./pages/login.js";
import { MirrorPage } from "./pages/mirror.js";
import { UsersPage } from "./pages/admin/users.js";
import { UserProfilePage } from "./pages/admin/user-profile.js";
import { MapPage } from "./pages/map.js";
import { LayerWorkshopPage } from "./pages/layer-workshop.js";

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

  let descriptor: string | null = null;
  if (persona) {
    const personaLayer = getIdentityLayers(db, user.id).find(
      (l) => l.layer === "persona" && l.key === persona,
    );
    if (personaLayer) {
      descriptor = extractPersonaDescriptor(personaLayer.content, {
        ellipsis: true,
      });
    }
  }

  const composed = composedSnapshot(db, user.id, persona);
  return {
    sessionStats,
    composed,
    personaDescriptor: descriptor,
    personaInitials: avatarInitials(persona),
    personaColor: avatarColor(persona),
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
    return c.redirect("/mirror");
  });

  app.post("/logout", (c) => {
    deleteCookie(c, "mirror_token");
    return c.redirect("/login");
  });

  // --- Web routes (cookie auth) ---

  const web = new Hono<{ Variables: { user: User } }>();
  web.use("*", webAuthMiddleware(db));

  web.get("/chat", (c) => c.redirect("/mirror"));

  // --- Cognitive Map ---

  function renderMap(
    c: any,
    user: User,
    extras: {
      personaError?: string;
      editingPersona?: string;
      addingPersona?: boolean;
    } = {},
  ) {
    const layers = getIdentityLayers(db, user.id);
    const baseLayers = layers.filter(
      (l) => l.layer === "self" || l.layer === "ego",
    );
    const personas = layers.filter((l) => l.layer === "persona");
    return c.html(
      <MapPage
        currentUser={user}
        targetUser={user}
        baseLayers={baseLayers}
        personas={personas}
        personaError={extras.personaError}
        editingPersona={extras.editingPersona}
        addingPersona={extras.addingPersona}
      />,
    );
  }

  web.get("/map", (c) => {
    const user = c.get("user");
    const editingPersona = c.req.query("editPersona") || undefined;
    const addingPersona = c.req.query("addPersona") === "1";
    return renderMap(c, user, { editingPersona, addingPersona });
  });

  web.post("/map/persona", async (c) => {
    const user = c.get("user");
    const body = await c.req.parseBody();
    const name = String(body.name ?? "").trim();
    const content = String(body.content ?? "");
    if (!name || !/^[a-z0-9\-]+$/.test(name)) {
      return renderMap(c, user, {
        addingPersona: true,
        personaError:
          "Name must be lowercase letters, numbers, and hyphens only.",
      });
    }
    if (!content.trim()) {
      return renderMap(c, user, {
        addingPersona: true,
        personaError: "Prompt cannot be empty.",
      });
    }
    // Check uniqueness
    const existing = getIdentityLayers(db, user.id).find(
      (l) => l.layer === "persona" && l.key === name,
    );
    if (existing) {
      return renderMap(c, user, {
        addingPersona: true,
        personaError: `A persona named "${name}" already exists.`,
      });
    }
    setIdentityLayer(db, user.id, "persona", name, content);
    return c.redirect("/map");
  });

  web.post("/map/persona/:key", async (c) => {
    const user = c.get("user");
    const key = c.req.param("key");
    const body = await c.req.parseBody();
    const content = String(body.content ?? "");
    if (!content.trim()) {
      return renderMap(c, user, {
        editingPersona: key,
        personaError: "Prompt cannot be empty.",
      });
    }
    setIdentityLayer(db, user.id, "persona", key, content);
    return c.redirect("/map");
  });

  web.post("/map/persona/:key/delete", async (c) => {
    const user = c.get("user");
    const key = c.req.param("key");
    deleteIdentityLayer(db, user.id, "persona", key);
    return c.redirect("/map");
  });

  const ALLOWED_WORKSHOP_LAYERS: Record<string, Set<string>> = {
    self: new Set(["soul"]),
    ego: new Set(["identity", "behavior"]),
  };

  function isAllowedWorkshop(layer: string, key: string): boolean {
    return ALLOWED_WORKSHOP_LAYERS[layer]?.has(key) ?? false;
  }

  function composeWithOverride(
    userId: string,
    overrideLayer: string,
    overrideKey: string,
    overrideContent: string,
  ): string {
    const allLayers = getIdentityLayers(db, userId);
    const base = allLayers.filter(
      (l) => l.layer === "self" || l.layer === "ego",
    );
    let replaced = false;
    const adjusted: IdentityLayer[] = base.map((l) => {
      if (l.layer === overrideLayer && l.key === overrideKey) {
        replaced = true;
        return { ...l, content: overrideContent };
      }
      return l;
    });
    if (!replaced) {
      adjusted.push({
        id: "preview",
        user_id: userId,
        layer: overrideLayer,
        key: overrideKey,
        content: overrideContent,
        updated_at: Date.now(),
      });
    }
    return adjusted.map((l) => l.content).join("\n\n---\n\n");
  }

  web.get("/map/:layer/:key", (c) => {
    const user = c.get("user");
    const layer = c.req.param("layer");
    const key = c.req.param("key");
    if (!isAllowedWorkshop(layer, key)) {
      return c.text("Layer workshop not available", 404);
    }
    const layers = getIdentityLayers(db, user.id);
    const current = layers.find((l) => l.layer === layer && l.key === key);
    const content = current?.content ?? "";
    const composedPreview = composeSystemPrompt(db, user.id);
    return c.html(
      <LayerWorkshopPage
        currentUser={user}
        targetUser={user}
        layer={layer}
        layerKey={key}
        content={content}
        composedPreview={composedPreview}
      />,
    );
  });

  web.post("/map/:layer/:key", async (c) => {
    const user = c.get("user");
    const layer = c.req.param("layer");
    const key = c.req.param("key");
    if (!isAllowedWorkshop(layer, key)) {
      return c.text("Layer workshop not available", 404);
    }
    const body = await c.req.parseBody();
    const content = String(body.content ?? "");
    setIdentityLayer(db, user.id, layer, key, content);
    return c.redirect("/map");
  });

  web.post("/map/:layer/:key/compose", async (c) => {
    const user = c.get("user");
    const layer = c.req.param("layer");
    const key = c.req.param("key");
    if (!isAllowedWorkshop(layer, key)) {
      return c.json({ error: "Layer workshop not available" }, 404);
    }
    const body = await c.req.parseBody();
    const content = String(body.content ?? "");
    const composed = composeWithOverride(user.id, layer, key, content);
    return c.json({ composed });
  });

  web.get("/mirror", (c) => {
    const user = c.get("user");
    const sessionId = getOrCreateSession(db, user.id);
    const messages = loadMessagesWithMeta(db, sessionId);
    const rail = buildRailState(db, user, sessionId);
    return c.html(<MirrorPage user={user} messages={messages} rail={rail} />);
  });

  web.get("/mirror/stream", async (c) => {
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

  const admin = new Hono<{ Variables: { user: User } }>();
  admin.use("*", adminOnlyMiddleware());

  const listAllUsers = () =>
    db
      .prepare("SELECT id, name, role, created_at FROM users ORDER BY name")
      .all() as {
      id: string;
      name: string;
      role: UserRole;
      created_at: number;
    }[];

  admin.get("/users", async (c) => {
    return c.html(<UsersPage user={c.get("user")} users={listAllUsers()} />);
  });

  admin.post("/users", async (c) => {
    const { randomBytes } = await import("node:crypto");
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const body = await c.req.parseBody();
    const name = body.name as string;
    const isAdmin = body.is_admin === "1";

    if (!name) {
      return c.html(
        <UsersPage
          user={c.get("user")}
          users={listAllUsers()}
          error="Name is required"
        />,
      );
    }

    const token = randomBytes(32).toString("hex");
    const hash = createHash("sha256").update(token).digest("hex");
    const newUser = createUser(db, name, hash, isAdmin ? "admin" : "user");

    const loadTemplate = (n: string) =>
      readFileSync(
        join(import.meta.dirname, "../../server/templates", `${n}.md`),
        "utf-8",
      );
    setIdentityLayer(db, newUser.id, "self", "soul", loadTemplate("soul"));
    setIdentityLayer(db, newUser.id, "ego", "identity", loadTemplate("identity"));
    setIdentityLayer(db, newUser.id, "ego", "behavior", loadTemplate("behavior"));
    getOrCreateSession(db, newUser.id);

    return c.html(
      <UsersPage
        user={c.get("user")}
        users={listAllUsers()}
        createdUser={name}
        createdToken={token}
      />,
    );
  });

  // Legacy redirects
  admin.get("/identity/:name", (c) =>
    c.redirect(`/admin/users/${c.req.param("name")}`),
  );
  admin.get("/personas/:name", (c) =>
    c.redirect(`/admin/users/${c.req.param("name")}`),
  );

  // Unified user profile
  admin.get("/users/:name", (c) => {
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
        currentUser={c.get("user")}
        userName={name}
        baseLayers={baseLayers}
        personas={personas}
      />,
    );
  });

  admin.post("/users/:name", async (c) => {
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
        currentUser={c.get("user")}
        userName={name}
        baseLayers={baseLayers}
        personas={personas}
        saved={saved}
        deleted={deleted}
      />,
    );
  });

  web.route("/admin", admin);

  app.route("/", web);

  console.log("Web adapter enabled");
}
