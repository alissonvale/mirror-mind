import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AsyncLocalStorage } from "node:async_hooks";

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

// Per-request locale store. The middleware wraps `next()` in this scope so
// JSX components rendered downstream can call `ts(key)` without receiving
// the locale through props.
const localeStore = new AsyncLocalStorage<Locale>();

export function runWithLocale<T>(locale: Locale, fn: () => T): T {
  return localeStore.run(locale, fn);
}

// Scoped translate — reads locale from AsyncLocalStorage. Use this in JSX
// components. If called outside a request scope, falls back to DEFAULT_LOCALE
// (so unit tests of pure components still render in English).
export function ts(
  key: string,
  params?: Record<string, string | number>,
): string {
  const locale = localeStore.getStore() ?? DEFAULT_LOCALE;
  return t(key, locale, params);
}

// Current locale from the ALS store, for cases where we need the locale
// itself and not a translation (e.g., `<html lang={currentLocale()}>`).
export function currentLocale(): Locale {
  return localeStore.getStore() ?? DEFAULT_LOCALE;
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
