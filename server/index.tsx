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
import { express } from "./expression.js";
import { generateSessionTitle } from "./title.js";
import { getModels } from "./db/models.js";
import { resolveApiKey, headeredStreamFn } from "./model-auth.js";
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
  const priorEntryCount = (
    db
      .prepare("SELECT COUNT(*) as c FROM entries WHERE session_id = ?")
      .get(sessionId) as { c: number }
  ).c;
  const isFirstTurn = priorEntryCount === 0;

  const reception = await receive(db, user.id, text);
  const history = loadMessages(db, sessionId);
  const systemPrompt = composeSystemPrompt(db, user.id, reception.personas, adapter);
  const main = getModels(db).main;
  const model = getModel(main.provider as any, main.model);

  const agent = new Agent({
    initialState: {
      systemPrompt,
      model,
      messages: history,
    },
    streamFn: headeredStreamFn,
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

  let draft = "";
  agent.subscribe((event) => {
    if (
      event.type === "message_update" &&
      event.assistantMessageEvent.type === "text_delta"
    ) {
      draft += event.assistantMessageEvent.delta;
    }
  });

  await agent.prompt(text);

  if (!draft) {
    const lastMsg = agent.state.messages.findLast(
      (m) => m.role === "assistant",
    );
    if (lastMsg && "content" in lastMsg) {
      for (const block of lastMsg.content) {
        if ("text" in block) draft += block.text;
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

  // CV1.E7.S1 — expression pass. API-adapter sessions follow reception's
  // mode; there is no session-override surface here.
  const expressed = await express(
    db,
    user.id,
    {
      draft,
      userMessage: text,
      personaKeys: reception.personas,
      mode: reception.mode,
    },
    { sessionId },
  );
  const reply = expressed.text;

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
  const assistantForPersist = assistantMsg
    ? { ...assistantMsg, content: [{ type: "text", text: reply }] }
    : {
        role: "assistant" as const,
        content: [{ type: "text", text: reply }],
      };
  // CV1.E7.S5: stamp both meta shapes.
  const primaryPersona = reception.personas[0] ?? null;
  const assistantWithMeta = primaryPersona
    ? {
        ...assistantForPersist,
        _personas: reception.personas,
        _persona: primaryPersona,
      }
    : assistantForPersist;
  appendEntry(db, sessionId, userEntryId, "message", assistantWithMeta);

  if (isFirstTurn) {
    void generateSessionTitle(db, sessionId);
  }

  const signature =
    reception.personas.length > 0
      ? `${reception.personas.map((k) => `◇ ${k}`).join(" ")}\n\n`
      : "";
  return c.json({
    reply: signature + reply,
    // Expose both shapes in the API response — new clients read
    // `personas`, legacy callers keep reading `persona` (first).
    personas: reception.personas,
    persona: primaryPersona,
  });
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

// --- Start ---

// Note: the root `/` route is registered by setupWeb (the landing home,
// CV0.E4.S1). No fallback redirect needed at the server level.


serve({ fetch: app.fetch, port }, (info) => {
  console.log(`mirror-server running at http://localhost:${info.port}`);
});
