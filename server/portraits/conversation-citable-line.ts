import type Database from "better-sqlite3";
import { getModel, complete } from "@mariozechner/pi-ai";
import { loadMessages } from "../db.js";
import { getModels } from "../db/models.js";
import { resolveApiKey, buildLlmHeaders } from "../model-auth.js";
import { logUsage, currentEnv } from "../usage.js";
import { logLlmCall } from "../llm-logging.js";
import { getOrGenerate, computeSourceHash } from "./cache.js";

type CompleteFn = typeof complete;

/**
 * Extracts the most representative single sentence from the assistant
 * turns of a session — the line that best encapsulates what the
 * conversation was about. Used by the entity portraits' "Conversas que
 * a moldaram" section as a citable quote under each conversation
 * title (CV1.E13.S1).
 *
 * Cached by `(session_id, last_entry_timestamp)` source hash —
 * regenerates only when the session has a new turn. Fire-once-per-turn
 * cost.
 *
 * Returns null when the session has no assistant content, or on any
 * LLM error. The page short-circuits the quote rendering when null.
 */
export async function getCitableLineForSession(
  db: Database.Database,
  sessionId: string,
  completeFn: CompleteFn = complete,
): Promise<string | null> {
  const lastTs = lastAssistantTimestamp(db, sessionId);
  if (lastTs === null) return null;

  const sourceHash = computeSourceHash([sessionId, lastTs]);
  const fieldName = `citable_line:${sessionId}`;

  return getOrGenerate(
    db,
    "journey",
    // entity_id is the session — citable lines are session-scoped, not
    // journey-scoped, but we file them under the journey namespace for
    // simplicity. Re-use across orgs/scenes is a follow-up.
    sessionId,
    fieldName,
    sourceHash,
    () => extractCitableLine(db, sessionId, completeFn),
  );
}

function lastAssistantTimestamp(
  db: Database.Database,
  sessionId: string,
): number | null {
  const row = db
    .prepare(
      `SELECT MAX(timestamp) as ts FROM entries
       WHERE session_id = ? AND type = 'message'
         AND json_extract(data, '$.role') = 'assistant'`,
    )
    .get(sessionId) as { ts: number | null } | undefined;
  return row?.ts ?? null;
}

async function extractCitableLine(
  db: Database.Database,
  sessionId: string,
  completeFn: CompleteFn,
): Promise<string | null> {
  const messages = loadMessages(db, sessionId);
  if (messages.length === 0) return null;

  const assistantTurns = messages
    .filter((m: any) => m.role === "assistant")
    .map((m: any) =>
      typeof m.content === "string"
        ? m.content
        : Array.isArray(m.content)
          ? m.content
              .filter((b: any) => b.type === "text")
              .map((b: any) => b.text)
              .join(" ")
          : "",
    )
    .filter((t) => t.trim().length > 0);

  if (assistantTurns.length === 0) return null;

  const transcript = assistantTurns
    .map((text, i) => `[Assistant turn ${i + 1}]\n${text}`)
    .join("\n\n");

  const systemPrompt = `You read a conversation between a user and a personalized AI mirror.

The mirror is journaling-aware — it speaks in the user's own voice, with restraint, often in short pithy lines. Your task is to pick the SINGLE sentence from the assistant turns that best encapsulates the heart of this conversation.

Selection criteria:
- The line should land on its own — read aloud out of context, it should still carry weight.
- Prefer sentences that diagnose, name, or commit (e.g., "X is not Y, it is Z" / "the question is..." / "you will...").
- Reject filler: greetings, transitions, generic empathy, instructions about what to do next.
- Match the language of the conversation.
- Return ONLY the sentence, no preamble, no quotes, no attribution.

If no sentence rises above the others, return the most distinctive one — even imperfect output is better than null.`;

  const config = getModels(db).title;
  if (!config) return null; // no extractor model configured
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
        setTimeout(
          () => reject(new Error("Citable-line extraction timeout")),
          timeoutMs,
        ),
      ),
    ]);
  } catch (err) {
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
    return null;
  }

  try {
    logUsage(db, {
      role: "title",
      env: currentEnv(),
      message: response as any,
      session_id: sessionId,
    });
  } catch (err) {
    console.log(
      "[citable-line] logUsage failed:",
      (err as Error).message,
    );
  }

  let text = "";
  for (const block of response.content) {
    if (block.type === "text") text += block.text;
  }

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

  const cleaned = text
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/\s+/g, " ");

  if (cleaned.length === 0) return null;
  return cleaned.length > 280 ? cleaned.slice(0, 277) + "…" : cleaned;
}
