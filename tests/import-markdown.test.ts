import { describe, it, expect } from "vitest";
import {
  parseConversationMarkdown,
  MarkdownConversationError,
} from "../server/import/markdown-conversation.js";

describe("parseConversationMarkdown", () => {
  it("parses a canonical file with frontmatter", () => {
    const md = `---
title: "Positioning conversation"
source: "gemini-export-2026-02-28"
---

**User:**
Hi, I want to think through positioning.

**Assistant:**
Sure — what's the current framing?
`;
    const parsed = parseConversationMarkdown(md);
    expect(parsed.title).toBe("Positioning conversation");
    expect(parsed.source).toBe("gemini-export-2026-02-28");
    expect(parsed.messages).toEqual([
      { role: "user", content: "Hi, I want to think through positioning." },
      { role: "assistant", content: "Sure — what's the current framing?" },
    ]);
  });

  it("parses a file without frontmatter", () => {
    const md = `**User:**
First message.

**Assistant:**
First reply.

**User:**
Follow-up.
`;
    const parsed = parseConversationMarkdown(md);
    expect(parsed.title).toBeNull();
    expect(parsed.source).toBeNull();
    expect(parsed.messages).toHaveLength(3);
    expect(parsed.messages[0]).toEqual({ role: "user", content: "First message." });
    expect(parsed.messages[2]).toEqual({ role: "user", content: "Follow-up." });
  });

  it("preserves multi-paragraph bodies verbatim", () => {
    const md = `**User:**
First paragraph.

Second paragraph.

- list item
- another

**Assistant:**
Code:

\`\`\`
x = 1
\`\`\`
`;
    const parsed = parseConversationMarkdown(md);
    expect(parsed.messages[0]!.content).toBe(
      "First paragraph.\n\nSecond paragraph.\n\n- list item\n- another",
    );
    expect(parsed.messages[1]!.content).toBe("Code:\n\n```\nx = 1\n```");
  });

  it("throws on alternation violation (two user headings in a row)", () => {
    const md = `**User:**
first

**User:**
second
`;
    expect(() => parseConversationMarkdown(md)).toThrow(MarkdownConversationError);
    expect(() => parseConversationMarkdown(md)).toThrow(/Alternation violation/);
  });

  it("throws when body starts with assistant", () => {
    const md = `**Assistant:**
orphan reply
`;
    expect(() => parseConversationMarkdown(md)).toThrow(/expected \*\*User:\*\*/);
  });

  it("returns messages: [] when there are no recognizable headings", () => {
    const md = `---
title: "Empty"
---

Just some markdown without role headings.
`;
    const parsed = parseConversationMarkdown(md);
    expect(parsed.title).toBe("Empty");
    expect(parsed.messages).toEqual([]);
  });

  it("ignores empty title in frontmatter", () => {
    const md = `---
title: ""
---

**User:**
hi
`;
    const parsed = parseConversationMarkdown(md);
    expect(parsed.title).toBeNull();
  });

  it("trims trailing whitespace but preserves leading indentation", () => {
    const md = `**User:**
    indented line

**Assistant:**
reply with trailing spaces
`;
    const parsed = parseConversationMarkdown(md);
    expect(parsed.messages[0]!.content).toBe("    indented line");
    expect(parsed.messages[1]!.content).toBe("reply with trailing spaces");
  });
});
