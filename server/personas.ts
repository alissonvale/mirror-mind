/**
 * Shared persona helpers. Keeps the extraction logic in one place so
 * reception (which feeds the classifier) and the Context Rail (which
 * shows it to the user) can't drift apart.
 */

import type { IdentityLayer } from "./db/identity.js";

export interface ExtractOptions {
  /** Append "…" when the line is truncated. */
  ellipsis?: boolean;
  /** Max length in characters before truncation. Default 120. */
  maxLength?: number;
}

/**
 * Extract a short descriptor from a persona. Prefers `summary` (generated
 * by lite model on Save) when available; falls back to the first non-heading
 * non-empty line of content otherwise.
 *
 * Accepts either an `IdentityLayer` (preferred, gives access to summary) or
 * a raw content string (legacy callers; no summary lookup possible).
 */
export function extractPersonaDescriptor(
  layerOrContent: IdentityLayer | string,
  opts: ExtractOptions = {},
): string | null {
  const max = opts.maxLength ?? 120;

  // Prefer summary when caller passed a full IdentityLayer with one set.
  if (typeof layerOrContent !== "string" && layerOrContent.summary) {
    const trimmed = layerOrContent.summary.trim();
    if (trimmed) return truncate(trimmed, max, opts.ellipsis);
  }

  const content =
    typeof layerOrContent === "string" ? layerOrContent : layerOrContent.content;
  const line = content.split("\n").find((l) => l.trim() && !l.startsWith("#"));
  if (!line) return null;
  return truncate(line.trim(), max, opts.ellipsis);
}

function truncate(text: string, max: number, ellipsis?: boolean): string {
  if (text.length <= max) return text;
  return ellipsis ? text.slice(0, max) + "…" : text.slice(0, max);
}
