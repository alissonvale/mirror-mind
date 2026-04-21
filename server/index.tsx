import "dotenv/config";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { Agent } from "@mariozechner/pi-agent-core";
import { getModel } from "@mariozechner/pi-ai";
import {
  openDb,
  getOrCreateSession,
  loadMessages,
  appendEntry,
  type User,
} from "./db.js";
import { authMiddleware } from "./auth.js";
import { composeSystemPrompt } from "./identity.js";
import { receive } from "./reception.js";
import { getModels } from "./db/models.js";
import { resolveApiKey } from "./model-auth.js";
import { logUsage, currentEnv } from "./usage.js";
import { setupTelegram } from "../adapters/telegram/index.js";
import { setupWeb } from "../adapters/web/index.js";

const db = openDb();
const port = parseInt(process.env.PORT ?? "3000", 10);

const app = new Hono<{ Variables: { user: User } }>();

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
  const main = getModels(db).main;
  const model = getModel(main.provider as any, main.model);

  const agent = new Agent({
    initialState: {
      systemPrompt,
      model,
      messages: history,
    },
    getApiKey: async () => {
      try {
        return await resolveApiKey(db, "main");
      } catch (err) {
        console.log(
          "[api/main] resolveApiKey failed:",
          (err as Error).message,
        );
        return undefined;
      }
    },
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

  if (assistantMsg && "provider" in assistantMsg) {
    try {
      logUsage(db, {
        role: "main",
        env: currentEnv(),
        message: assistantMsg as any,
        user_id: user.id,
        session_id: sessionId,
      });
    } catch (err) {
      console.log("[api/main] logUsage failed:", (err as Error).message);
    }
  }

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

// --- Adapters ---

setupTelegram(app, db);
setupWeb(app, db);

// --- Root redirect ---

app.get("/", (c) => c.redirect("/mirror"));

// --- Start ---

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`mirror-server running at http://localhost:${info.port}`);
});
