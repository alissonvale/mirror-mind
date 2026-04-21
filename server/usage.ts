import type Database from "better-sqlite3";
import type { AssistantMessage } from "@mariozechner/pi-ai";
import { insertUsageLog, updateUsageLog } from "./db/usage-log.js";
import { getGeneration } from "./openrouter-billing.js";

/**
 * Per-call usage logger (CV0.E3.S6). Called after an LLM call completes.
 *
 * Two-step flow:
 *
 *  1. **Immediate insert.** Writes a row with role, provider, model, env,
 *     input_tokens, output_tokens, generation_id (from pi-ai's responseId)
 *     but with `cost_usd = NULL`. Synchronous, cheap — tells the budget
 *     page the call happened.
 *
 *  2. **Background reconcile.** Fires `getGeneration(id)` off the main
 *     thread, waits for OpenRouter to catch up, updates the same row
 *     with the real billed cost. Retries are handled inside getGeneration.
 *
 * Errors never propagate — callers should not await the reconciler. A
 * failed reconcile leaves the row with `cost_usd = NULL`, which the
 * budget aggregations skip (UsageTotals.resolved_calls vs total_calls
 * surfaces the gap).
 */

export interface LogUsageArgs {
  role: string;
  env: string;
  message: AssistantMessage;
  user_id?: string | null;
  session_id?: string | null;
}

export function logUsage(db: Database.Database, args: LogUsageArgs): string {
  const { role, env, message, user_id, session_id } = args;
  const generationId = message.responseId ?? null;

  const id = insertUsageLog(db, {
    user_id: user_id ?? null,
    session_id: session_id ?? null,
    role,
    provider: message.provider,
    model: message.model,
    input_tokens: message.usage?.input ?? null,
    output_tokens: message.usage?.output ?? null,
    generation_id: generationId,
    env,
  });

  // Only OpenRouter exposes a /generation endpoint we can hit for real cost.
  // Other providers (future OAuth paths) would need their own reconcilers.
  if (generationId && message.provider === "openrouter") {
    reconcileInBackground(db, id, generationId);
  }

  return id;
}

function reconcileInBackground(
  db: Database.Database,
  rowId: string,
  generationId: string,
): void {
  void (async () => {
    try {
      const gen = await getGeneration(generationId);
      if (!gen) return; // already logged inside getGeneration
      updateUsageLog(db, rowId, {
        cost_usd: gen.total_cost,
        input_tokens: gen.tokens_prompt,
        output_tokens: gen.tokens_completion,
      });
    } catch (err) {
      // getGeneration swallows its own errors; this catch is belt-and-braces
      // in case something in updateUsageLog throws (e.g. DB closed).
      console.log(
        `[usage] reconcile failed for ${generationId}:`,
        (err as Error).message,
      );
    }
  })();
}

/**
 * Resolve the current environment tag (dev | prod) from MIRROR_ENV, defaulting
 * to 'dev' when unset. Read at call time so tests can flip the value without
 * re-importing modules.
 */
export function currentEnv(): string {
  const raw = process.env.MIRROR_ENV?.toLowerCase() ?? "dev";
  return raw === "prod" || raw === "production" ? "prod" : "dev";
}
