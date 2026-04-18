/**
 * Shared persona helpers. Keeps the extraction logic in one place so
 * reception (which feeds the classifier) and the Context Rail (which
 * shows it to the user) can't drift apart.
 */

export interface ExtractOptions {
  /** Append "…" when the line is truncated at 120 chars. */
  ellipsis?: boolean;
  /** Max length in characters before truncation. Default 120. */
  maxLength?: number;
}

/**
 * Extract a short descriptor from a persona's content — the first
 * non-heading non-empty line, trimmed. Returns null if the content
 * has no usable line.
 */
export function extractPersonaDescriptor(
  content: string,
  opts: ExtractOptions = {},
): string | null {
  const max = opts.maxLength ?? 120;
  const line = content
    .split("\n")
    .find((l) => l.trim() && !l.startsWith("#"));
  if (!line) return null;
  const trimmed = line.trim();
  if (trimmed.length <= max) return trimmed;
  return opts.ellipsis ? trimmed.slice(0, max) + "…" : trimmed.slice(0, max);
}
