import type Database from "better-sqlite3";
import { loadMessages } from "./db.js";
import { getModels } from "./db/models.js";

export interface SessionStats {
  messages: number;
  tokensIn: number;
  tokensOut: number;
  model: string;
  costBRL: number | null;
}

/**
 * Compute aggregate stats for a session. Token counts are approximate
 * (chars/4 heuristic) — pi-ai does not surface usage at the Agent level,
 * and a rough estimate is honest enough for the rail. Cost is derived
 * from models.json rates when present; otherwise returns null and the
 * rail omits the cost line.
 */
export function computeSessionStats(
  db: Database.Database,
  sessionId: string,
): SessionStats {
  const msgs = loadMessages(db, sessionId) as Array<{
    role?: string;
    content?: unknown;
  }>;

  let tokensIn = 0;
  let tokensOut = 0;
  let messages = 0;

  for (const msg of msgs) {
    const text = extractText(msg.content);
    const approxTokens = Math.ceil(text.length / 4);
    if (msg.role === "user") {
      tokensIn += approxTokens;
      messages += 1;
    } else if (msg.role === "assistant") {
      tokensOut += approxTokens;
      messages += 1;
    }
  }

  const main = getModels(db).main;
  const priceIn = main?.price_brl_per_1m_input;
  const priceOut = main?.price_brl_per_1m_output;

  let costBRL: number | null = null;
  if (typeof priceIn === "number" && typeof priceOut === "number") {
    costBRL = (tokensIn / 1_000_000) * priceIn + (tokensOut / 1_000_000) * priceOut;
  }

  return {
    messages,
    tokensIn,
    tokensOut,
    model: main?.model ?? "",
    costBRL,
  };
}

function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    let out = "";
    for (const block of content) {
      if (block && typeof block === "object" && "text" in block) {
        out += (block as { text: string }).text;
      }
    }
    return out;
  }
  return "";
}
