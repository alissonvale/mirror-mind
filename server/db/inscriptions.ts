import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

export interface Inscription {
  id: string;
  user_id: string;
  text: string;
  author: string | null;
  /** Non-null = manual pin (the inscription is the active anchor). */
  pinned_at: number | null;
  created_at: number;
  /** Non-null = soft-deleted (out of rotation, restorable). */
  archived_at: number | null;
}

const SELECT_COLUMNS =
  "id, user_id, text, author, pinned_at, created_at, archived_at";

export function createInscription(
  db: Database.Database,
  userId: string,
  text: string,
  author: string | null = null,
  now: number = Date.now(),
): Inscription {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO inscriptions (id, user_id, text, author, pinned_at, created_at, archived_at)
     VALUES (?, ?, ?, ?, NULL, ?, NULL)`,
  ).run(id, userId, text, author, now);
  return getInscriptionById(db, userId, id) as Inscription;
}

export function getInscriptionById(
  db: Database.Database,
  userId: string,
  id: string,
): Inscription | null {
  const row = db
    .prepare(
      `SELECT ${SELECT_COLUMNS} FROM inscriptions WHERE id = ? AND user_id = ?`,
    )
    .get(id, userId) as Inscription | undefined;
  return row ?? null;
}

/**
 * Returns active inscriptions (archived_at IS NULL), ordered by creation
 * time ascending so the deterministic rotation picks a stable index.
 */
export function listActiveInscriptions(
  db: Database.Database,
  userId: string,
): Inscription[] {
  return db
    .prepare(
      `SELECT ${SELECT_COLUMNS}
       FROM inscriptions
       WHERE user_id = ? AND archived_at IS NULL
       ORDER BY created_at ASC`,
    )
    .all(userId) as Inscription[];
}

export function listArchivedInscriptions(
  db: Database.Database,
  userId: string,
): Inscription[] {
  return db
    .prepare(
      `SELECT ${SELECT_COLUMNS}
       FROM inscriptions
       WHERE user_id = ? AND archived_at IS NOT NULL
       ORDER BY archived_at DESC`,
    )
    .all(userId) as Inscription[];
}

export function updateInscription(
  db: Database.Database,
  userId: string,
  id: string,
  text: string,
  author: string | null,
): Inscription | null {
  db.prepare(
    `UPDATE inscriptions
     SET text = ?, author = ?
     WHERE id = ? AND user_id = ?`,
  ).run(text, author, id, userId);
  return getInscriptionById(db, userId, id);
}

/**
 * Pin: stamps pinned_at to `now`. Multiple inscriptions can technically
 * carry pinned_at, but the picker resolves to the most recent — so a
 * subsequent pin effectively replaces the previous one's effect.
 */
export function pinInscription(
  db: Database.Database,
  userId: string,
  id: string,
  now: number = Date.now(),
): void {
  db.prepare(
    "UPDATE inscriptions SET pinned_at = ? WHERE id = ? AND user_id = ?",
  ).run(now, id, userId);
}

export function unpinInscription(
  db: Database.Database,
  userId: string,
  id: string,
): void {
  db.prepare(
    "UPDATE inscriptions SET pinned_at = NULL WHERE id = ? AND user_id = ?",
  ).run(id, userId);
}

/**
 * Soft-delete: stamps archived_at and clears pinned_at (an archived
 * inscription cannot be the active anchor).
 */
export function archiveInscription(
  db: Database.Database,
  userId: string,
  id: string,
  now: number = Date.now(),
): void {
  db.prepare(
    `UPDATE inscriptions
     SET archived_at = ?, pinned_at = NULL
     WHERE id = ? AND user_id = ?`,
  ).run(now, id, userId);
}

export function unarchiveInscription(
  db: Database.Database,
  userId: string,
  id: string,
): void {
  db.prepare(
    "UPDATE inscriptions SET archived_at = NULL WHERE id = ? AND user_id = ?",
  ).run(id, userId);
}
