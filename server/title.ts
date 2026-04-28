import type Database from "better-sqlite3";
import { getModel, complete } from "@mariozechner/pi-ai";
import { loadMessages, setSessionTitle } from "./db.js";
import { getModels } from "./db/models.js";
import { resolveApiKey, buildLlmHeaders } from "./model-auth.js";
import { logUsage, currentEnv } from "./usage.js";
import { logLlmCall } from "./llm-logging.js";

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
    const apiKey = await resolveApiKey(db, "title");
    const startedAt = Date.now();
    let response: Awaited<ReturnType<CompleteFn>>;
    try {
      response = await Promise.race([
        completeFn(
          model,
          {
            systemPrompt,
            messages: [{ role: "user", content: transcript }],
          },
          { apiKey, headers: buildLlmHeaders() } as any,
        ),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Title generation timeout")), timeoutMs),
        ),
      ]);
    } catch (err) {
      // CV1.E8.S1: log the failed call so the failure is debuggable.
      logLlmCall(db, {
        role: "title",
        provider: config.provider,
        model: config.model,
        system_prompt: systemPrompt,
        user_message: transcript,
        response: null,
        latency_ms: Date.now() - startedAt,
        session_id: sessionId,
        env: currentEnv(),
        error: (err as Error).message,
      });
      throw err;
    }

    try {
      logUsage(db, {
        role: "title",
        env: currentEnv(),
        message: response as any,
        session_id: sessionId,
      });
    } catch (err) {
      console.log("[title] logUsage failed:", (err as Error).message);
    }

    let text = "";
    for (const block of response.content) {
      if (block.type === "text") text += block.text;
    }

    // CV1.E8.S1: full prompt + response capture.
    const tokensIn =
      ((response as any).usage?.input_tokens as number | undefined) ?? null;
    const tokensOut =
      ((response as any).usage?.output_tokens as number | undefined) ?? null;
    const costUsd = ((response as any).cost as number | undefined) ?? null;
    logLlmCall(db, {
      role: "title",
      provider: config.provider,
      model: config.model,
      system_prompt: systemPrompt,
      user_message: transcript,
      response: text,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      cost_usd: costUsd,
      latency_ms: Date.now() - startedAt,
      session_id: sessionId,
      env: currentEnv(),
    });

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
