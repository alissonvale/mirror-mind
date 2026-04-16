import { createMiddleware } from "hono/factory";
import { createHash } from "node:crypto";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type Database from "better-sqlite3";
import { getUserByTokenHash, type User } from "../../server/db.js";

export function webAuthMiddleware(db: Database.Database) {
  return createMiddleware<{ Variables: { user: User } }>(async (c, next) => {
    const token = getCookie(c, "mirror_token");
    if (!token) {
      return c.redirect("/login");
    }

    const hash = createHash("sha256").update(token).digest("hex");
    const user = getUserByTokenHash(db, hash);

    if (!user) {
      deleteCookie(c, "mirror_token");
      return c.redirect("/login");
    }

    c.set("user", user);
    await next();
  });
}

export function setTokenCookie(c: any, token: string) {
  setCookie(c, "mirror_token", token, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });
}
