[< Docs](../index.md)

# Conversation Markdown Format

The canonical format for conversation history that the mirror imports. One file = one session. The contract is small on purpose — anyone writing a converter from another AI tool's export (Gemini, ChatGPT, Claude, custom logs) only needs to produce files in this shape.

**Status:** Active — used by [CV0.E3.S9 — Import conversation history from markdown](../project/roadmap/cv0-foundation/cv0-e3-admin-workspace/cv0-e3-s9-import-conversation/).

---

## Shape

```markdown
---
title: "string — optional, becomes the session title"
source: "string — optional, free-form provenance label"
---

**User:**
Hi, I want to think through a positioning question.

**Assistant:**
Sure — what's the current framing you're working with?

**User:**
We're calling it "calm software". The team thinks it's too vague.

**Assistant:**
"Calm software" gestures at a feeling without naming the user's gain.
A few sharper variants worth testing:

- ...
- ...

**User:**
...
```

---

## Rules

### Frontmatter (optional)

YAML between `---` fences at the top of the file. All fields are optional:

| Field | Type | Behavior |
|-------|------|----------|
| `title` | string | Becomes the session title. If absent, the filename (without extension) is used. |
| `source` | string | Free-form label of where this conversation originated (e.g., `gemini-export-2026-02-28`). Stored as session metadata when that mechanism lands; ignored in v1. |

A file without frontmatter is valid — body parsing starts at line 1.

### Body

Alternating role blocks separated by heading lines. Two requirements:

1. **Heading lines:** exactly `**User:**` or `**Assistant:**`, each on its own line, nothing else on the line.
2. **Alternation:** the first block must be `**User:**`. Each block alternates with the other role. Two consecutive `**User:**` headings are a parse error.

The content between two heading lines is the message body. It is preserved verbatim — multiple paragraphs, lists, code blocks, blockquotes, anything that's valid markdown is passed through.

Trailing whitespace at the end of each block is trimmed. Leading whitespace is preserved (matters for code blocks).

### Edge cases

- **Empty file:** skipped with a warning. Not an error.
- **Frontmatter without body:** skipped with a warning. The session would be empty; no value in creating it.
- **Body with zero blocks (no `**User:**` heading found):** skipped with a warning.
- **Alternation violation:** the file is rejected; the importer continues with the next file and reports the failure in its summary.
- **Non-`.md` files in the directory:** ignored.

---

## What the mirror does with it

When the importer processes a file:

1. Parses frontmatter + body into `{ title?, source?, messages: [{role, content}, ...] }`.
2. Creates a new `session` for the user, with the resolved title and `created_at = importStartedAt`.
3. Writes one `entry` per message, in order, with monotonically incrementing timestamps (so sort order survives).
4. Tags the session with the persona / organization / journey passed to the importer.

The session shows up immediately in the user's surfaces (`/conversation` history, `/organizations/<org>`, `/journeys/<journey>`).

---

## Producing files in this format

### From an existing source

If your tool produces markdown in another shape (different role labels, different frontmatter keys), normalize before importing. A one-line `sed` is usually enough:

```bash
# Example: szen_mind output uses **Zenith:** for assistant and topico: for title
sed -i '' 's/\*\*Zenith:\*\*/**Assistant:**/g; s/^topico:/title:/' *.md
```

The principle: the canonical format is the canonical format. Per-source variations are normalized at the source, not absorbed by the importer.

### Writing a converter from scratch

For a custom export (e.g., your own JSON logs), the contract is:

- Frontmatter is optional, but `title:` improves readability of session lists.
- Body must alternate, starting with `**User:**`.
- Don't worry about timestamps — the mirror manufactures them at import time, since most tool exports don't carry usable per-message timestamps either.

---

## Why this format

A few constraints shaped it:

- **Diff-friendly.** Plain markdown means the user can edit a file by hand before importing — fix a misattributed message, merge two over-segmented conversations, drop a tangent.
- **Tool-friendly.** Heading-based role separation is what most existing exports already produce or can produce trivially. Frontmatter is YAML, which every language reads.
- **Lossless for the mirror's purposes.** The mirror only needs role + content + ordering. Token counts, original timestamps, model names, and other metadata that some exports carry don't influence the imported session's behavior; carrying them would be ceremony without payoff.

---

**See also:**
- [CV0.E3.S9 — Import conversation history from markdown](../project/roadmap/cv0-foundation/cv0-e3-admin-workspace/cv0-e3-s9-import-conversation/)
- [Briefing](../project/briefing.md) — D5 (identity in markdown), D7 (English as internal language)
