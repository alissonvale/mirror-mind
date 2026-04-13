import Database from "better-sqlite3";
import type { User } from "./users.js";

export function linkTelegramUser(
  db: Database.Database,
  telegramId: string,
  userId: string,
): void {
  db.prepare(
    "INSERT OR REPLACE INTO telegram_users (telegram_id, user_id) VALUES (?, ?)",
  ).run(telegramId, userId);
}

export function getUserByTelegramId(
  db: Database.Database,
  telegramId: string,
): User | undefined {
  return db
    .prepare(
      `SELECT u.* FROM users u
       JOIN telegram_users t ON t.user_id = u.id
       WHERE t.telegram_id = ?`,
    )
    .get(telegramId) as User | undefined;
}
