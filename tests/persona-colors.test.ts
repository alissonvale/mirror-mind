import { describe, it, expect } from "vitest";
import {
  hashPersonaColor,
  normalizeHexColor,
  resolvePersonaColor,
  PERSONA_COLORS,
} from "../server/personas/colors.js";

describe("hashPersonaColor", () => {
  it("is deterministic for the same key", () => {
    expect(hashPersonaColor("mentora")).toBe(hashPersonaColor("mentora"));
  });

  it("returns a value from the PERSONA_COLORS palette", () => {
    for (const key of ["mentora", "tecnica", "estrategista", "x", "abcdef"]) {
      expect(PERSONA_COLORS).toContain(hashPersonaColor(key));
    }
  });

  it("different keys generally map to different colors across the palette", () => {
    const seen = new Set<string>();
    const keys = [
      "mentora",
      "tecnica",
      "estrategista",
      "divulgadora",
      "terapeuta",
      "medica",
      "professora",
      "pensadora",
    ];
    for (const k of keys) seen.add(hashPersonaColor(k));
    // Eight distinct keys land on at least 3 distinct colors — a low
    // bar to confirm the hash isn't collapsing everything to one slot.
    expect(seen.size).toBeGreaterThanOrEqual(3);
  });

  it("returns a neutral gray for empty key", () => {
    expect(hashPersonaColor("")).toBe("#c9c4bd");
  });
});

describe("normalizeHexColor", () => {
  it("accepts 3-digit hex", () => {
    expect(normalizeHexColor("#abc")).toBe("#abc");
    expect(normalizeHexColor("#ABC")).toBe("#abc");
  });

  it("accepts 6-digit hex", () => {
    expect(normalizeHexColor("#b88a6b")).toBe("#b88a6b");
    expect(normalizeHexColor("#B88A6B")).toBe("#b88a6b");
  });

  it("accepts 8-digit hex (rgba)", () => {
    expect(normalizeHexColor("#b88a6bff")).toBe("#b88a6bff");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeHexColor("  #abc  ")).toBe("#abc");
  });

  it("rejects missing leading hash", () => {
    expect(normalizeHexColor("abc")).toBeNull();
    expect(normalizeHexColor("b88a6b")).toBeNull();
  });

  it("rejects non-hex characters", () => {
    expect(normalizeHexColor("#ghijkl")).toBeNull();
    expect(normalizeHexColor("#zzz")).toBeNull();
  });

  it("rejects wrong length", () => {
    expect(normalizeHexColor("#ab")).toBeNull();
    expect(normalizeHexColor("#abcd")).toBeNull();
    expect(normalizeHexColor("#abcde")).toBeNull();
    expect(normalizeHexColor("#abcdefg")).toBeNull();
  });

  it("rejects non-string input", () => {
    expect(normalizeHexColor(null)).toBeNull();
    expect(normalizeHexColor(undefined)).toBeNull();
    expect(normalizeHexColor(123)).toBeNull();
    expect(normalizeHexColor({})).toBeNull();
  });
});

describe("resolvePersonaColor", () => {
  it("returns the stored color when set", () => {
    expect(resolvePersonaColor("#abcdef", "mentora")).toBe("#abcdef");
  });

  it("falls back to the hash when null", () => {
    expect(resolvePersonaColor(null, "mentora")).toBe(
      hashPersonaColor("mentora"),
    );
  });

  it("falls back to the hash when undefined", () => {
    expect(resolvePersonaColor(undefined, "tecnica")).toBe(
      hashPersonaColor("tecnica"),
    );
  });
});
