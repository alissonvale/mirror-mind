import { createMiddleware } from "hono/factory";
import { createHash } from "node:crypto";
import type Database from "better-sqlite3";
import { getUserByTokenHash, type User } from "./db.js";

export function authMiddleware(db: Database.Database) {
  return createMiddleware<{ Variables: { user: User } }>(async (c, next) => {
    const header = c.req.header("Authorization");
    if (!header?.startsWith("Bearer ")) {
      return c.json({ error: "Missing token" }, 401);
    }

    const token = header.slice(7);
    const hash = createHash("sha256").update(token).digest("hex");
    const user = getUserByTokenHash(db, hash);

    if (!user) {
      return c.json({ error: "Invalid token" }, 401);
    }

    c.set("user", user);
    await next();
  });
}
