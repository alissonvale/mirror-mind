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

const db = openDb();
const port = parseInt(process.env.PORT ?? "3000", 10);
const model = getModel(
  "openrouter",
  process.env.LLM_MODEL ?? "google/gemini-2.0-flash-001",
);

const app = new Hono<{ Variables: { user: User } }>();

app.use("*", authMiddleware(db));

app.post("/message", async (c) => {
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

  // Fallback: some providers don't emit text_delta
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

  // Persist both messages
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

app.get("/thread", (c) => {
  const user = c.get("user");
  const sessionId = getOrCreateSession(db, user.id);
  const messages = loadMessages(db, sessionId);
  return c.json({ sessionId, messages, count: messages.length });
});

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`mirror-server running at http://localhost:${info.port}`);
});
