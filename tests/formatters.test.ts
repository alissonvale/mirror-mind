import { describe, it, expect } from "vitest";
import { formatForAdapter } from "../server/formatters.js";

describe("formatForAdapter", () => {
  it("returns text as-is for web", () => {
    const md = "# Hello\n\n**bold** and `code`";
    expect(formatForAdapter(md, "web")).toBe(md);
  });

  it("returns text as-is for cli", () => {
    const md = "## Title\n- item 1\n- item 2";
    expect(formatForAdapter(md, "cli")).toBe(md);
  });

  it("returns text as-is for unknown adapter", () => {
    expect(formatForAdapter("hello", "unknown")).toBe("hello");
  });
});

describe("formatForAdapter — telegram", () => {
  it("converts headers to bold", () => {
    expect(formatForAdapter("# Hello World", "telegram")).toContain(
      "*Hello World*",
    );
  });

  it("converts list items to bullets", () => {
    const result = formatForAdapter("- item one\n- item two", "telegram");
    expect(result).toContain("• item one");
    expect(result).toContain("• item two");
  });

  it("preserves bold", () => {
    const result = formatForAdapter("this is **bold** text", "telegram");
    expect(result).toContain("*bold*");
  });

  it("preserves inline code", () => {
    const result = formatForAdapter("use `npm install`", "telegram");
    expect(result).toContain("`npm install`");
  });

  it("preserves links", () => {
    const result = formatForAdapter(
      "check [this](https://example.com)",
      "telegram",
    );
    expect(result).toContain("[this](https://example.com)");
  });

  it("escapes special chars in plain text", () => {
    const result = formatForAdapter("price is 10.99 (USD)", "telegram");
    expect(result).toContain("10\\.99");
    expect(result).toContain("\\(USD\\)");
  });

  it("handles plain text without errors", () => {
    expect(formatForAdapter("just plain text", "telegram")).toBe(
      "just plain text",
    );
  });

  it("falls back to original on error", () => {
    // Null coercion — formatForAdapter should not throw
    expect(formatForAdapter("", "telegram")).toBe("");
  });
});
