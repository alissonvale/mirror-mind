import { describe, it, expect, beforeEach, vi } from "vitest";
import { Hono } from "hono";
import { createHash } from "node:crypto";
import type Database from "better-sqlite3";
import { openDb, createUser, type User } from "../server/db.js";
import { localeMiddleware } from "../adapters/web/i18n-middleware.js";
import { webAuthMiddleware } from "../adapters/web/auth.js";

function setupApp(db: Database.Database) {
  const app = new Hono<{ Variables: { user: User } }>();

  // Anonymous probe — locale resolves from header or default.
  app.use("/anon/*", localeMiddleware);
  app.get("/anon/locale", (c) => {
    return c.json({
      locale: c.get("locale"),
      hello: c.get("t")("Hello, {name}", { name: "Marina" }),
    });
  });

  // Authenticated probe — auth first, then locale (so user.locale is visible).
  app.use("/auth/*", webAuthMiddleware(db));
  app.use("/auth/*", localeMiddleware);
  app.get("/auth/locale", (c) => {
    return c.json({ locale: c.get("locale") });
  });

  return app;
}

describe("i18n middleware", () => {
  let db: Database.Database;
  let token: string;

  beforeEach(() => {
    db = openDb(":memory:");
    // S1 ships before S3's schema migration. Add the column inline so the
    // middleware can read user.locale during this test scope.
    db.exec("ALTER TABLE users ADD COLUMN locale TEXT NOT NULL DEFAULT 'en'");
    token = "test-token-i18n";
    const hash = createHash("sha256").update(token).digest("hex");
    createUser(db, "i18nuser", hash);
    // Suppress the missing-key warn from the t() probe in /anon/locale.
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("anonymous request with no Accept-Language → en", async () => {
    const app = setupApp(db);
    const res = await app.request("/anon/locale");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { locale: string };
    expect(body.locale).toBe("en");
  });

  it("anonymous request with Accept-Language pt-BR → pt-BR", async () => {
    const app = setupApp(db);
    const res = await app.request("/anon/locale", {
      headers: { "Accept-Language": "pt-BR,en;q=0.9" },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { locale: string };
    expect(body.locale).toBe("pt-BR");
  });

  it("anonymous request with unsupported Accept-Language → en", async () => {
    const app = setupApp(db);
    const res = await app.request("/anon/locale", {
      headers: { "Accept-Language": "fr-FR,fr;q=0.9" },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { locale: string };
    expect(body.locale).toBe("en");
  });

  it("authenticated user with locale=pt-BR → pt-BR", async () => {
    db.prepare("UPDATE users SET locale = 'pt-BR' WHERE name = ?").run(
      "i18nuser",
    );
    const app = setupApp(db);
    const res = await app.request("/auth/locale", {
      headers: { Cookie: `mirror_token=${token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { locale: string };
    expect(body.locale).toBe("pt-BR");
  });

  it("user pref overrides Accept-Language", async () => {
    db.prepare("UPDATE users SET locale = 'en' WHERE name = ?").run(
      "i18nuser",
    );
    const app = setupApp(db);
    const res = await app.request("/auth/locale", {
      headers: {
        Cookie: `mirror_token=${token}`,
        "Accept-Language": "pt-BR",
      },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { locale: string };
    expect(body.locale).toBe("en");
  });

  it("c.get('t') is callable and falls back to crude key for missing translations", async () => {
    const app = setupApp(db);
    const res = await app.request("/anon/locale");
    const body = (await res.json()) as { hello: string };
    expect(body.hello).toBe("Hello, Marina");
  });
});
