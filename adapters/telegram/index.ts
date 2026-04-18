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
import { composeSystemPrompt } from "../../server/identity.js";
import { receive } from "../../server/reception.js";
import { formatForAdapter } from "../../server/formatters.js";
import { getModels } from "../../server/db/models.js";

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
    const reception = await receive(db, user.id, text);
    const history = loadMessages(db, sessionId);
    const systemPrompt = composeSystemPrompt(db, user.id, reception.persona, "telegram");
    const main = getModels(db).main;
    const model = getModel(main.provider as any, main.model);

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

    const signature = reception.persona ? `◇ ${reception.persona}\n\n` : "";
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
