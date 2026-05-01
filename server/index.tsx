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
import { composeSystemPrompt, composeMinimalPrompt } from "./identity.js";
import { composeAlmaPrompt } from "./voz-da-alma.js";
import { receive } from "./reception.js";
import { logLlmCall } from "./llm-logging.js";
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

  const reception = await receive(db, user.id, text, { sessionId });
  const history = loadMessages(db, sessionId);
  // CV1.E7.S4: identity layers gate from reception.
  // CV1.E9.S3: when reception flags is_self_moment, route to the
  // Soul Voice composer instead of the canonical persona path.
  // CV1.E10.S1: trivial turns route to the minimal composer (adapter
  // only). Branch order: trivial → alma → canonical. Mutual
  // exclusion: alma wins over trivial if both are true.
  const isAlma = reception.is_self_moment === true;
  const isTrivial = !isAlma && reception.is_trivial === true;
  const personasForRun = isAlma || isTrivial ? [] : reception.personas;
  const systemPrompt = isTrivial
    ? composeMinimalPrompt(adapter)
    : isAlma
      ? composeAlmaPrompt(
          db,
          user.id,
          {
            organization: reception.organization,
            journey: reception.journey,
          },
          adapter,
        )
      : composeSystemPrompt(
          db,
          user.id,
          reception.personas,
          adapter,
          {
            touchesIdentity: reception.touches_identity,
            mode: reception.mode,
          },
        );
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

  // CV1.E8.S1: capture latency around main generation for the log row.
  const mainStartedAt = Date.now();
  await agent.prompt(text);
  const mainLatencyMs = Date.now() - mainStartedAt;

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
  // CV1.E9 follow-up: skip expression on Alma turns — the Alma's own
  // preamble owns its form (acolher → iluminar → revelar, 2–5
  // paragraphs of prose). Mode-aware expression compresses that to
  // a line of validation when the mode lands conversational.
  let reply: string;
  if (isAlma) {
    reply = draft;
  } else {
    const expressed = await express(
      db,
      user.id,
      {
        draft,
        userMessage: text,
        personaKeys: personasForRun,
        mode: reception.mode,
      },
      { sessionId },
    );
    reply = expressed.text;
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
  const assistantForPersist = assistantMsg
    ? { ...assistantMsg, content: [{ type: "text", text: reply }] }
    : {
        role: "assistant" as const,
        content: [{ type: "text", text: reply }],
      };
  // CV1.E7.S5: stamp both meta shapes.
  // CV1.E7.S9: also stamp _mode + _mode_source. The base API path
  // has no session override (rail-only feature), so source is always
  // "reception" here — field exists for cross-adapter parity.
  // CV1.E7.S4: also stamp _touches_identity for cross-adapter parity.
  // CV1.E9.S3: Alma turns force personas empty (no _personas/_persona);
  // _touches_identity persists as true (Alma always loads identity);
  // _is_alma flag stamped so F5 reload reproduces the routing decision.
  const primaryPersona = isAlma ? null : reception.personas[0] ?? null;
  const meta: Record<string, unknown> = {
    _mode: reception.mode,
    _mode_source: "reception",
    _touches_identity: isAlma ? true : reception.touches_identity,
  };
  if (!isAlma && primaryPersona) {
    meta._personas = reception.personas;
    meta._persona = primaryPersona;
  }
  if (isAlma) meta._is_alma = true;
  if (isTrivial) meta._is_trivial = true;
  const assistantWithMeta = { ...assistantForPersist, ...meta };
  const assistantEntryId = appendEntry(
    db,
    sessionId,
    userEntryId,
    "message",
    assistantWithMeta,
  );

  // CV1.E8.S1: log the main LLM call. entry_id populates because the
  // entry was just appended above.
  try {
    const mainTokensIn =
      assistantMsg && "usage" in assistantMsg
        ? ((assistantMsg as any).usage?.input_tokens as number | undefined) ?? null
        : null;
    const mainTokensOut =
      assistantMsg && "usage" in assistantMsg
        ? ((assistantMsg as any).usage?.output_tokens as number | undefined) ?? null
        : null;
    const mainCostUsd =
      assistantMsg && "cost" in assistantMsg
        ? ((assistantMsg as any).cost as number | undefined) ?? null
        : null;
    logLlmCall(db, {
      role: "main",
      provider: main.provider,
      model: main.model,
      system_prompt: systemPrompt,
      user_message: text,
      response: draft || null,
      tokens_in: mainTokensIn,
      tokens_out: mainTokensOut,
      cost_usd: mainCostUsd,
      latency_ms: mainLatencyMs,
      session_id: sessionId,
      entry_id: assistantEntryId,
      user_id: user.id,
      env: currentEnv(),
      error: draft ? null : "empty draft (model returned no text)",
    });
  } catch (err) {
    console.log("[api/main] logLlmCall wrap failed:", (err as Error).message);
  }

  if (isFirstTurn) {
    void generateSessionTitle(db, sessionId);
  }

  // CV1.E9.S3: Alma turns prepend a distinct ◈ marker instead of
  // persona signatures (no personas to mark; the Alma is the voice).
  // CV1.E10.S1: trivial turns get no marker — pure protocol response.
  // Personas marker block stays as-is for the canonical path.
  const almaLabel = user.locale === "pt-BR" ? "Voz da Alma" : "Soul Voice";
  const signature = isTrivial
    ? ""
    : isAlma
      ? `◈ ${almaLabel}\n\n`
      : reception.personas.length > 0
        ? `${reception.personas.map((k) => `◇ ${k}`).join(" ")}\n\n`
        : "";
  return c.json({
    reply: signature + reply,
    // Expose both shapes in the API response — new clients read
    // `personas`, legacy callers keep reading `persona` (first).
    personas: isAlma || isTrivial ? [] : reception.personas,
    persona: primaryPersona,
    isAlma,
    isTrivial,
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
