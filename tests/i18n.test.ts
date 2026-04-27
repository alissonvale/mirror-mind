import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { t, dictionaries } from "../adapters/web/i18n.js";

describe("i18n — t()", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    delete dictionaries.en["test.hello"];
    delete dictionaries["pt-BR"]["test.hello"];
    delete dictionaries.en["test.only-en"];
  });

  describe("missing keys", () => {
    it("returns the crude key when missing in both files", () => {
      expect(t("nope.key", "en")).toBe("nope.key");
    });

    it("warns once per call when missing", () => {
      t("nope.key", "en");
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Missing translation key: nope.key"),
      );
    });

    it("returns the crude key when missing in both for pt-BR locale", () => {
      expect(t("nope.key", "pt-BR")).toBe("nope.key");
    });
  });

  describe("dictionary lookup", () => {
    beforeEach(() => {
      dictionaries.en["test.hello"] = "Hello, {name}";
      dictionaries["pt-BR"]["test.hello"] = "Olá, {name}";
    });

    it("returns the locale-specific value when present", () => {
      expect(t("test.hello", "pt-BR", { name: "Marina" })).toBe(
        "Olá, Marina",
      );
    });

    it("returns the en value for en locale", () => {
      expect(t("test.hello", "en", { name: "Marina" })).toBe("Hello, Marina");
    });

    it("falls back to en when key missing in target locale", () => {
      dictionaries.en["test.only-en"] = "Only English";
      expect(t("test.only-en", "pt-BR")).toBe("Only English");
      // Fallback path is silent — warn fires only when missing in *both*.
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  describe("interpolation", () => {
    it("interpolates a single param via the crude-key path", () => {
      expect(t("Hello, {name}", "en", { name: "Marina" })).toBe(
        "Hello, Marina",
      );
    });

    it("leaves an unmatched opening brace literal", () => {
      expect(t("half {open", "en")).toBe("half {open");
    });

    it("leaves curlies with unknown names literal", () => {
      expect(t("Hi {who}", "en", { name: "Marina" })).toBe("Hi {who}");
    });

    it("interpolates multiple params independently", () => {
      expect(t("{first} and {second}", "en", { first: "A", second: "B" })).toBe(
        "A and B",
      );
    });

    it("converts numeric params to string", () => {
      expect(t("count: {n}", "en", { n: 42 })).toBe("count: 42");
    });

    it("returns the template unchanged when no params provided", () => {
      expect(t("plain text", "en")).toBe("plain text");
    });
  });
});
