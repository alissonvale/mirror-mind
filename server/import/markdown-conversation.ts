import matter from "gray-matter";

/**
 * The canonical conversation markdown format. See
 * docs/product/conversation-markdown-format.md for the full specification.
 *
 * Required body shape: alternating blocks led by `**User:**` / `**Assistant:**`
 * heading lines, starting with `**User:**`. Anything between two heading lines
 * (or between the last heading and EOF) is the message content.
 */

export type Role = "user" | "assistant";

export interface ParsedMessage {
  role: Role;
  content: string;
}

export interface ParsedConversation {
  title: string | null;
  source: string | null;
  messages: ParsedMessage[];
}

export class MarkdownConversationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MarkdownConversationError";
  }
}

const HEADING_REGEX = /^\*\*(User|Assistant):\*\*\s*$/;

/**
 * Parses one markdown file into a conversation. Throws
 * MarkdownConversationError on alternation violations or malformed structure.
 *
 * Returns `messages: []` when the file has no recognizable role headings —
 * the caller decides whether to treat that as a skip-with-warning or an error
 * depending on context.
 */
export function parseConversationMarkdown(text: string): ParsedConversation {
  const parsed = matter(text);
  const fm = parsed.data as Record<string, unknown>;

  const title = typeof fm.title === "string" && fm.title.trim().length > 0
    ? fm.title.trim()
    : null;
  const source = typeof fm.source === "string" && fm.source.trim().length > 0
    ? fm.source.trim()
    : null;

  const messages = parseBody(parsed.content);

  return { title, source, messages };
}

function parseBody(body: string): ParsedMessage[] {
  const lines = body.split("\n");

  // Find heading positions and their roles.
  const headings: { index: number; role: Role }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const match = HEADING_REGEX.exec(lines[i]!);
    if (match) {
      const role = match[1]!.toLowerCase() as Role;
      headings.push({ index: i, role });
    }
  }

  if (headings.length === 0) return [];

  // Enforce alternation starting with user.
  for (let i = 0; i < headings.length; i++) {
    const expected: Role = i % 2 === 0 ? "user" : "assistant";
    if (headings[i]!.role !== expected) {
      const lineNumber = headings[i]!.index + 1;
      throw new MarkdownConversationError(
        `Alternation violation at line ${lineNumber}: expected **${cap(expected)}:** but found **${cap(headings[i]!.role)}:**`,
      );
    }
  }

  // Slice content between headings (and from last heading to EOF).
  const messages: ParsedMessage[] = [];
  for (let i = 0; i < headings.length; i++) {
    const start = headings[i]!.index + 1;
    const end = i + 1 < headings.length ? headings[i + 1]!.index : lines.length;
    const content = lines.slice(start, end).join("\n").replace(/\s+$/, "");
    messages.push({ role: headings[i]!.role, content });
  }

  return messages;
}

function cap(role: Role): string {
  return role === "user" ? "User" : "Assistant";
}
