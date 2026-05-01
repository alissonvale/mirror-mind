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
  // Cookie is Secure only when the request actually came over HTTPS.
  // Browsers accept Secure cookies on HTTP-localhost as a special case
  // but NOT on HTTP-LAN-IP (`192.168.x.y`, `*.local`) — without this
  // detection, mobile-via-LAN-IP submits the login but the cookie is
  // silently dropped on the response, so the next request lands at
  // /login again with no other signal. Production sits behind a TLS
  // reverse proxy (Caddy) that forwards X-Forwarded-Proto: https on
  // top of an upstream HTTP connection, so honor that header when
  // present. Pure dynamic detection — no env var, works in localhost
  // dev, LAN-IP dev, and proxied prod with zero config.
  const proto =
    c.req.header("x-forwarded-proto") ??
    new URL(c.req.url).protocol.replace(":", "");
  const isSecure = proto === "https";
  setCookie(c, "mirror_token", token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "Lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });
}

export function adminOnlyMiddleware() {
  return createMiddleware<{ Variables: { user: User } }>(async (c, next) => {
    const user = c.get("user");
    if (user.role !== "admin") {
      return c.text("Forbidden", 403);
    }
    await next();
  });
}
