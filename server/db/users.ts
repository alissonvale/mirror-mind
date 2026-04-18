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

export function updateUserName(
  db: Database.Database,
  userId: string,
  newName: string,
): void {
  db.prepare("UPDATE users SET name = ? WHERE id = ?").run(newName, userId);
}

export function updateUserRole(
  db: Database.Database,
  userId: string,
  role: UserRole,
): void {
  db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, userId);
}

/**
 * Destructively remove a user and every row that belongs to them. Runs as a
 * single transaction: if any step fails, nothing commits.
 *
 * Order matters — entries are children of sessions, and telegram_users
 * references users. We delete from the leaves toward the root.
 */
export function deleteUser(db: Database.Database, userId: string): void {
  const tx = db.transaction(() => {
    db.prepare(
      "DELETE FROM entries WHERE session_id IN (SELECT id FROM sessions WHERE user_id = ?)",
    ).run(userId);
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM identity WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM telegram_users WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM users WHERE id = ?").run(userId);
  });
  tx();
}
