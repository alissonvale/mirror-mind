import type Database from "better-sqlite3";
import { getModel, complete } from "@mariozechner/pi-ai";
import { loadMessages, setSessionTitle } from "./db.js";
import { getModels } from "./db/models.js";

type CompleteFn = typeof complete;

/**
 * Background title generator. Reads the last handful of messages in a
 * session, asks the cheap "title" model for a 3-6 word label, and writes
 * it to `sessions.title`.
 *
 * Fire-and-forget by contract — callers should not await. On any failure
 * (no messages, timeout, parse error, API error), the session stays
 * untitled and the episodic browse surface falls back to "Untitled
 * conversation". Logged, not thrown.
 */
export async function generateSessionTitle(
  db: Database.Database,
  sessionId: string,
  completeFn: CompleteFn = complete,
): Promise<void> {
  try {
    const messages = loadMessages(db, sessionId);
    if (messages.length === 0) return; // nothing to title

    // Keep only the last ~6 messages to stay cheap.
    const recent = messages.slice(-6);
    const transcript = recent
      .map((m: any) => {
        const role = m.role ?? "unknown";
        const content =
          typeof m.content === "string"
            ? m.content
            : Array.isArray(m.content)
              ? m.content
                  .filter((b: any) => b.type === "text")
                  .map((b: any) => b.text)
                  .join(" ")
              : "";
        return `${role}: ${content}`;
      })
      .join("\n");

    const systemPrompt = `You generate concise titles for chat sessions.

Rules:
- Return a 3-6 word title that captures the theme of the conversation.
- No punctuation, no quotes, no emojis.
- Match the language of the conversation.
- Just the title text, nothing else.`;

    const config = getModels(db).title;
    if (!config) return; // no title role configured
    const timeoutMs = config.timeout_ms ?? 8000;

    const model = getModel(config.provider as any, config.model);
    const response = await Promise.race([
      completeFn(
        model,
        {
          systemPrompt,
          messages: [{ role: "user", content: transcript }],
        },
        { apiKey: process.env.OPENROUTER_API_KEY },
      ),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Title generation timeout")), timeoutMs),
      ),
    ]);

    let text = "";
    for (const block of response.content) {
      if (block.type === "text") text += block.text;
    }

    // Strip quotes, punctuation edges, collapse whitespace, cap length.
    const cleaned = text
      .trim()
      .replace(/^["'`.]+|["'`.]+$/g, "")
      .replace(/\s+/g, " ")
      .slice(0, 80);

    if (!cleaned) return;
    setSessionTitle(db, sessionId, cleaned);
  } catch (err) {
    console.log(
      "[title] generation failed, session stays untitled:",
      (err as Error).message,
    );
  }
}
