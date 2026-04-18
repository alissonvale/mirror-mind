import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

export type UserRole = "admin" | "user";

export interface User {
  id: string;
  name: string;
  token_hash: string;
  role: UserRole;
  created_at: number;
}

export function createUser(
  db: Database.Database,
  name: string,
  tokenHash: string,
  role?: UserRole,
): User {
  let resolvedRole: UserRole;
  if (role !== undefined) {
    resolvedRole = role;
  } else {
    const { c } = db.prepare("SELECT COUNT(*) as c FROM users").get() as {
      c: number;
    };
    resolvedRole = c === 0 ? "admin" : "user";
  }

  const user: User = {
    id: randomUUID(),
    name,
    token_hash: tokenHash,
    role: resolvedRole,
    created_at: Date.now(),
  };
  db.prepare(
    "INSERT INTO users (id, name, token_hash, role, created_at) VALUES (?, ?, ?, ?, ?)",
  ).run(user.id, user.name, user.token_hash, user.role, user.created_at);
  return user;
}

export function getUserByTokenHash(
  db: Database.Database,
  tokenHash: string,
): User | undefined {
  return db
    .prepare("SELECT * FROM users WHERE token_hash = ?")
    .get(tokenHash) as User | undefined;
}

export function getUserByName(
  db: Database.Database,
  name: string,
): User | undefined {
  return db
    .prepare("SELECT * FROM users WHERE name = ?")
    .get(name) as User | undefined;
}
