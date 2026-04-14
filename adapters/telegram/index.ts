import { Bot, webhookCallback } from "grammy";
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
import { models } from "../../server/config/models.js";

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
  const model = getModel(models.main.provider, models.main.model);
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

    await ctx.reply(reply || "[empty reply]");
  });

  const handleUpdate = webhookCallback(bot, "hono", {
    secretToken: webhookSecret,
  });

  app.post("/telegram/webhook", (c) => handleUpdate(c));

  console.log("Telegram adapter enabled");
}
