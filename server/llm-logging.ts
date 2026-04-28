import type Database from "better-sqlite3";
import {
  insertLlmCall,
  setLlmCallEntryId,
  getLlmLoggingEnabled,
  type InsertLlmCallInput,
} from "./db.js";

/**
 * CV1.E8.S1 — full-prompt + response capture for every LLM invocation.
 *
 * Wraps `insertLlmCall` with two guarantees:
 *   1. Honors the `llm_logging_enabled` setting toggle. When the
 *      toggle is off, this is a no-op and returns null. Caller can
 *      still receive a stable id (null) without branching.
 *   2. Defensive: never throws. Any DB or unexpected error is caught
 *      and logged to stderr so a logging issue never breaks the
 *      pipeline.
 *
 * Returns the new row's id on success, or null when logging is off
 * or the insert failed. Callers that need to backfill `entry_id`
 * later (the main pipeline) check for non-null and call
 * `linkLlmCallEntry`.
 */
export function logLlmCall(
  db: Database.Database,
  input: InsertLlmCallInput,
): string | null {
  let enabled = false;
  try {
    enabled = getLlmLoggingEnabled(db);
  } catch (err) {
    console.log(
      "[llm-logging] failed to read toggle, treating as off:",
      (err as Error).message,
    );
    return null;
  }
  if (!enabled) return null;

  try {
    return insertLlmCall(db, input);
  } catch (err) {
    console.log(
      `[llm-logging] insert failed for role=${input.role} model=${input.model}:`,
      (err as Error).message,
    );
    return null;
  }
}

/**
 * Backfill `entry_id` on a logged call. Used by the main pipeline:
 * the call is logged before the assistant entry exists; once the
 * entry is appended, this links the row back. Defensive in the same
 * spirit as `logLlmCall` — null callId is a no-op (the insert
 * already failed); errors are swallowed.
 */
export function linkLlmCallEntry(
  db: Database.Database,
  callId: string | null,
  entryId: string,
): void {
  if (!callId) return;
  try {
    setLlmCallEntryId(db, callId, entryId);
  } catch (err) {
    console.log(
      `[llm-logging] entry_id backfill failed for call=${callId}:`,
      (err as Error).message,
    );
  }
}
