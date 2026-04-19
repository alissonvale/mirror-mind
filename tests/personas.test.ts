import { describe, it, expect } from "vitest";
import { extractPersonaDescriptor } from "../server/personas.js";
import type { IdentityLayer } from "../server/db.js";

function buildLayer(overrides: Partial<IdentityLayer> = {}): IdentityLayer {
  return {
    id: "id-1",
    user_id: "user-1",
    layer: "persona",
    key: "tecnica",
    content: "# Técnica\n\nSou o ângulo técnico do espelho.",
    summary: null,
    updated_at: 0,
    ...overrides,
  };
}

describe("extractPersonaDescriptor", () => {
  it("falls back to first non-header line when summary is null", () => {
    const layer = buildLayer({ summary: null });
    expect(extractPersonaDescriptor(layer)).toBe("Sou o ângulo técnico do espelho.");
  });

  it("falls back to first non-header line when summary is empty whitespace", () => {
    const layer = buildLayer({ summary: "   " });
    expect(extractPersonaDescriptor(layer)).toBe("Sou o ângulo técnico do espelho.");
  });

  it("prefers summary when one is set", () => {
    const layer = buildLayer({
      summary: "Persona técnica que cuida de ferramentas, código e infraestrutura.",
    });
    expect(extractPersonaDescriptor(layer)).toBe(
      "Persona técnica que cuida de ferramentas, código e infraestrutura.",
    );
  });

  it("truncates summary at maxLength with ellipsis when requested", () => {
    const longSummary = "a".repeat(200);
    const layer = buildLayer({ summary: longSummary });
    const result = extractPersonaDescriptor(layer, { maxLength: 50, ellipsis: true });
    expect(result).toHaveLength(51); // 50 chars + "…"
    expect(result?.endsWith("…")).toBe(true);
  });

  it("accepts a raw content string (legacy callers, no summary lookup)", () => {
    const result = extractPersonaDescriptor("# Title\n\nFirst real line.\nSecond line.");
    expect(result).toBe("First real line.");
  });

  it("returns null when content has no usable line and no summary", () => {
    const layer = buildLayer({ content: "# Only header", summary: null });
    expect(extractPersonaDescriptor(layer)).toBeNull();
  });

  it("disambiguates two personas with identical first content lines via summary", () => {
    // The motivating bug: tecnica and dba both start with the same independence
    // declaration and produce indistinguishable descriptors from content alone.
    // Once summary is generated, the two become distinguishable.
    const sharedFirstLine = "Esta persona opera em registro técnico.";
    const tecnica = buildLayer({
      key: "tecnica",
      content: `# Técnica\n\n${sharedFirstLine}\n\nMore tecnica content.`,
      summary: null,
    });
    const dba = buildLayer({
      key: "dba",
      content: `# DBA\n\n${sharedFirstLine}\n\nMore dba content.`,
      summary: null,
    });

    // Without summary: indistinguishable
    expect(extractPersonaDescriptor(tecnica)).toBe(extractPersonaDescriptor(dba));

    // With summary: distinguishable
    tecnica.summary = "Helps with general technical questions: code, infra, tooling.";
    dba.summary = "Helps with SQL, schemas, query optimization, database tasks.";

    expect(extractPersonaDescriptor(tecnica)).not.toBe(extractPersonaDescriptor(dba));
    expect(extractPersonaDescriptor(tecnica)).toContain("technical");
    expect(extractPersonaDescriptor(dba)).toContain("SQL");
  });
});
