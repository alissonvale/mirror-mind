import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

export interface User {
  id: string;
  name: string;
  token_hash: string;
  created_at: number;
}

export function createUser(
  db: Database.Database,
  name: string,
  tokenHash: string,
): User {
  const user: User = {
    id: randomUUID(),
    name,
    token_hash: tokenHash,
    created_at: Date.now(),
  };
  db.prepare(
    "INSERT INTO users (id, name, token_hash, created_at) VALUES (?, ?, ?, ?)",
  ).run(user.id, user.name, user.token_hash, user.created_at);
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
