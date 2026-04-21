import type Database from "better-sqlite3";

/**
 * Light stats for the /me page's "How the mirror sees you" band (CV0.E4.S4).
 * Contemplative, not surveillance — a handful of numbers that give the user
 * a reflection of their relationship with the mirror over time.
 */
export interface MeStats {
  sessionsTotal: number;
  messagesTotal: number;
  favoritePersona: string | null; // most frequent persona in assistant replies
  lastActivityAt: number | null; // max timestamp of any entry in user's sessions
  memberSince: number; // users.created_at
}

export function getMeStats(db: Database.Database, userId: string): MeStats {
  const memberSince = (
    db
      .prepare("SELECT created_at as ts FROM users WHERE id = ?")
      .get(userId) as { ts: number }
  ).ts;

  const sessionsTotal = (
    db
      .prepare("SELECT COUNT(*) as c FROM sessions WHERE user_id = ?")
      .get(userId) as { c: number }
  ).c;

  const messagesTotal = (
    db
      .prepare(
        `SELECT COUNT(*) as c FROM entries
         JOIN sessions ON entries.session_id = sessions.id
         WHERE sessions.user_id = ? AND entries.type = 'message'`,
      )
      .get(userId) as { c: number }
  ).c;

  const lastRow = db
    .prepare(
      `SELECT MAX(entries.timestamp) as ts FROM entries
       JOIN sessions ON entries.session_id = sessions.id
       WHERE sessions.user_id = ?`,
    )
    .get(userId) as { ts: number | null };
  const lastActivityAt = lastRow.ts;

  // Favorite persona: scan assistant messages in this user's sessions,
  // count the `_persona` field stored in the JSON data blob.
  const assistantRows = db
    .prepare(
      `SELECT entries.data FROM entries
       JOIN sessions ON entries.session_id = sessions.id
       WHERE sessions.user_id = ? AND entries.type = 'message'`,
    )
    .all(userId) as Array<{ data: string }>;
  const counts = new Map<string, number>();
  for (const r of assistantRows) {
    try {
      const d = JSON.parse(r.data);
      if (d.role === "assistant" && typeof d._persona === "string") {
        counts.set(d._persona, (counts.get(d._persona) ?? 0) + 1);
      }
    } catch {
      // Ignore malformed rows — the stat degrades gracefully.
    }
  }
  let favoritePersona: string | null = null;
  let top = 0;
  for (const [persona, n] of counts) {
    if (n > top) {
      top = n;
      favoritePersona = persona;
    }
  }

  return {
    sessionsTotal,
    messagesTotal,
    favoritePersona,
    lastActivityAt,
    memberSince,
  };
}
