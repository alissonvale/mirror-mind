[< Docs](../../index.md)

# Plan: CV1.E2.S2 — Formatter per adapter

**Roadmap:** [CV1.E2.S2](../../project/roadmap.md)

## Goal

LLM output converted to the native format of each channel before sending.

## Deliverables

- `server/formatters.ts` — `formatForAdapter(text, adapter)` function
- Telegram: headers→bold, lists→bullets, escape MarkdownV2 special chars, protect code/links/bold/italic. Falls back to plain text on parse error.
- Web/CLI/API: pass through unchanged
- Telegram adapter sends with `parse_mode: "MarkdownV2"`, with plain text fallback on error

## Design notes

Telegram MarkdownV2 is strict — many special chars must be escaped. The formatter protects formatted elements (code, bold, links) using null-byte placeholders, escapes remaining text, then restores. This avoids double-escaping.

---

**See also:** [Test Guide](test-guide.md)
