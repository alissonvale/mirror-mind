import type { MiddlewareHandler } from "hono";
import { t, runWithLocale, type Locale, DEFAULT_LOCALE } from "./i18n.js";

export const localeMiddleware: MiddlewareHandler = async (c, next) => {
  const user = c.get("user") as { locale?: string } | undefined;
  const fromUser = isLocale(user?.locale) ? user.locale : undefined;
  const fromHeader = parseAcceptLanguage(c.req.header("accept-language"));
  const locale: Locale = fromUser ?? fromHeader ?? DEFAULT_LOCALE;

  c.set("locale", locale);
  c.set(
    "t",
    (key: string, params?: Record<string, string | number>) =>
      t(key, locale, params),
  );

  // Wrap downstream in ALS scope so JSX components can call `ts(key)`.
  await runWithLocale(locale, async () => {
    await next();
  });
};

function parseAcceptLanguage(header: string | undefined): Locale | undefined {
  if (!header) return undefined;
  const wanted = header.split(",")[0]?.trim().toLowerCase();
  if (!wanted) return undefined;
  if (wanted.startsWith("pt")) return "pt-BR";
  if (wanted.startsWith("en")) return "en";
  return undefined;
}

function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "pt-BR";
}

declare module "hono" {
  interface ContextVariableMap {
    locale: Locale;
    t: (key: string, params?: Record<string, string | number>) => string;
  }
}
