import type Database from "better-sqlite3";
import { loadMessages } from "./db.js";
import { getModels } from "./db/models.js";

/** CV1.E15 follow-up: per-model turn counts in a session. Surface for
 *  the Composto row when the admin is comparing models — a single
 *  string was a lie when the session mixes (rerun + scene/session
 *  override). */
export interface SessionModelUsage {
  model_id: string;
  count: number;
}

export interface SessionStats {
  messages: number;
  tokensIn: number;
  tokensOut: number;
  /**
   * CV1.E15 follow-up: every distinct `_model_id` stamped on the
   * session's assistant entries, with its turn count. Sorted by count
   * desc, then model_id asc. Empty array for sessions with no turns.
   * Pre-S4 entries have no `_model_id` and are skipped silently.
   */
  models: SessionModelUsage[];
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

  // CV1.E15 follow-up: per-model breakdown read straight from the
  // stamped meta on assistant entries. Pre-S4 entries (without
  // `_model_id`) skip via the IS NOT NULL filter.
  const modelRows = db
    .prepare(
      `SELECT json_extract(data, '$._model_id') AS model_id,
              COUNT(*) AS count
       FROM entries
       WHERE session_id = ? AND type = 'message'
         AND json_extract(data, '$.role') = 'assistant'
         AND json_extract(data, '$._model_id') IS NOT NULL
       GROUP BY model_id
       ORDER BY count DESC, model_id ASC`,
    )
    .all(sessionId) as { model_id: string; count: number }[];

  return {
    messages,
    tokensIn,
    tokensOut,
    models: modelRows,
    costBRL,
  };
}

/**
 * Per-persona turn counts for a session — how many assistant messages
 * each persona participated in. Read from `_persona` meta stamped on
 * each assistant entry (the same mechanism that powers per-message
 * badges). Returns a plain object keyed by persona key, value = count.
 *
 * Used by the conversation header (CV1.E7.S2) to surface "N turns this
 * session" in each cast avatar's popover.
 */
export function getPersonaTurnCountsInSession(
  db: Database.Database,
  sessionId: string,
): Record<string, number> {
  const rows = db
    .prepare(
      `SELECT json_extract(data, '$._persona') AS persona
       FROM entries
       WHERE session_id = ? AND type = 'message'
         AND json_extract(data, '$.role') = 'assistant'
         AND json_extract(data, '$._persona') IS NOT NULL`,
    )
    .all(sessionId) as { persona: string | null }[];

  const counts: Record<string, number> = {};
  for (const row of rows) {
    if (typeof row.persona !== "string") continue;
    counts[row.persona] = (counts[row.persona] ?? 0) + 1;
  }
  return counts;
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
