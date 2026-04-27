import { readFileSync } from "node:fs";
import { join } from "node:path";

export type Locale = "en" | "pt-BR";

export const SUPPORTED_LOCALES: Locale[] = ["en", "pt-BR"];
export const DEFAULT_LOCALE: Locale = "en";

const localesDir = join(import.meta.dirname, "locales");

// Exported so tests can seed/inject keys without re-architecting the loader.
// Not part of the public API — page code should call `t()`.
export const dictionaries: Record<Locale, Record<string, string>> = {
  en: JSON.parse(
    readFileSync(join(localesDir, "en.json"), "utf-8"),
  ) as Record<string, string>,
  "pt-BR": JSON.parse(
    readFileSync(join(localesDir, "pt-BR.json"), "utf-8"),
  ) as Record<string, string>,
};

export function t(
  key: string,
  locale: Locale,
  params?: Record<string, string | number>,
): string {
  const value =
    dictionaries[locale]?.[key] ?? dictionaries[DEFAULT_LOCALE][key];
  if (value === undefined) {
    console.warn(`[i18n] Missing translation key: ${key}`);
    return interpolate(key, params);
  }
  return interpolate(value, params);
}

function interpolate(
  template: string,
  params?: Record<string, string | number>,
): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name) => {
    if (Object.prototype.hasOwnProperty.call(params, name)) {
      return String(params[name]);
    }
    return match;
  });
}
