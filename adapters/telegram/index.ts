import { Bot } from "grammy";
import type { Hono } from "hono";
import type Database from "better-sqlite3";
import { Agent } from "@mariozechner/pi-agent-core";
import { getModel } from "@mariozechner/pi-ai";
import {
  getUserByTelegramId,
  getOrCreateSession,
  loadMessages,
  appendEntry,
} from "../../server/db.js";
import {
  composeSystemPrompt,
  composeMinimalPrompt,
} from "../../server/identity.js";
import { composeAlmaPrompt } from "../../server/voz-da-alma.js";
import { receive } from "../../server/reception.js";
import { logLlmCall } from "../../server/llm-logging.js";
import { express } from "../../server/expression.js";
import { generateSessionTitle } from "../../server/title.js";
import { formatForAdapter } from "../../server/formatters.js";
import { getModels } from "../../server/db/models.js";
import { resolveApiKey, headeredStreamFn } from "../../server/model-auth.js";
import { logUsage, currentEnv } from "../../server/usage.js";

export function setupTelegram(
  app: Hono,
  db: Database.Database,
) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log("TELEGRAM_BOT_TOKEN not set — Telegram adapter disabled");
    return;
  }

  const bot = new Bot(token);
  // bot.init() must be called before handleUpdate when not using webhookCallback
  bot.init().catch((err) => console.error("[telegram] bot.init failed:", err));
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

  bot.on("message:text", async (ctx) => {
    const telegramId = String(ctx.from.id);
    const text = ctx.message.text;

    const user = getUserByTelegramId(db, telegramId);
    if (!user) {
      console.log(`Unknown Telegram user: ${telegramId} (@${ctx.from.username ?? "no-username"})`);
      await ctx.reply("Unknown user. Ask admin to register you.");
      return;
    }

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
    // CV1.E9.S3: route to Voz da Alma composer when reception flags it.
    // CV1.E10.S1: trivial turns route to minimal composer.
    const isAlma = reception.is_self_moment === true;
    const isTrivial = !isAlma && reception.is_trivial === true;
    const personasForRun = isAlma || isTrivial ? [] : reception.personas;
    const systemPrompt = isTrivial
      ? composeMinimalPrompt("telegram")
      : isAlma
        ? composeAlmaPrompt(
            db,
            user.id,
            {
              organization: reception.organization,
              journey: reception.journey,
            },
            "telegram",
          )
        : composeSystemPrompt(
            db,
            user.id,
            reception.personas,
            "telegram",
            { touchesIdentity: reception.touches_identity },
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
            "[telegram/main] resolveApiKey failed:",
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

    // CV1.E8.S1: capture latency for the log row.
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

    // Persist
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
        console.log("[telegram/main] logUsage failed:", (err as Error).message);
      }
    }

    // CV1.E7.S1 — expression pass. Mode follows reception on Telegram
    // (no rail override surface here; non-goal per plan.md).
    // CV1.E9 follow-up: skip expression on Alma turns. See
    // adapters/web/index.tsx for rationale — the Alma's preamble owns
    // its form, expression's conversational mode collapses it.
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
    // CV1.E7.S5: stamp both shapes on the assistant entry.
    // CV1.E7.S9: also stamp _mode and _mode_source. Telegram has no
    // rail override (non-goal per plan.md), so the source is always
    // "reception" here — the field exists for cross-adapter parity
    // with the web stream's persistence shape.
    // CV1.E7.S4: also stamp _touches_identity for cross-adapter parity.
    // CV1.E9.S3: Alma turns force personas empty + identity always-on,
    // and stamp _is_alma so F5 reload reproduces the routing decision.
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
    if (reception.organization) meta._organization = reception.organization;
    if (reception.journey) meta._journey = reception.journey;
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

    // CV1.E8.S1: log the main LLM call after the entry exists so
    // entry_id can populate.
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
      console.log("[telegram/main] logLlmCall wrap failed:", (err as Error).message);
    }

    if (isFirstTurn) {
      void generateSessionTitle(db, sessionId);
    }

    // CV1.E7.S5: when multiple personas collaborated, list them all
    // on the signature line so the Telegram user sees the cast for
    // the turn (no rich UI to carry avatars).
    // CV1.E9.S3: Alma turns get a distinct ◈ marker instead.
    // CV1.E10.S1: trivial turns get no marker — pure protocol reply.
    const signature = isTrivial
      ? ""
      : isAlma
        ? "◈ Voz da Alma\n\n"
        : reception.personas.length > 0
          ? `${reception.personas.map((k) => `◇ ${k}`).join(" ")}\n\n`
          : "";
    const fullReply = (signature + reply) || "[empty reply]";
    const formatted = formatForAdapter(fullReply, "telegram");
    try {
      await ctx.reply(formatted, { parse_mode: "MarkdownV2" });
    } catch (e) {
      console.log("[telegram] MarkdownV2 failed, trying HTML:", (e as Error).message);
      try {
        const html = fullReply
          .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
          .replace(/\*(.+?)\*/g, "<b>$1</b>")
          .replace(/_(.+?)_/g, "<i>$1</i>")
          .replace(/`([^`]+)`/g, "<code>$1</code>");
        await ctx.reply(html, { parse_mode: "HTML" });
      } catch {
        await ctx.reply(fullReply.replace(/[*_`]/g, ""));
      }
    }
  });

  // Process updates asynchronously — return 200 immediately to Telegram
  // so it doesn't time out and re-deliver the same update in a loop.
  app.post("/telegram/webhook", async (c) => {
    if (webhookSecret) {
      const headerSecret = c.req.header("X-Telegram-Bot-Api-Secret-Token");
      if (headerSecret !== webhookSecret) {
        return c.json({ error: "Invalid secret" }, 401);
      }
    }

    const update = await c.req.json();
    // Fire and forget — handle the update in the background
    bot.handleUpdate(update).catch((err) => {
      console.error("[telegram] handleUpdate failed:", err);
    });

    return c.json({ ok: true });
  });

  console.log("Telegram adapter enabled");
}
