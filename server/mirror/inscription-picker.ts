import type Database from "better-sqlite3";
import {
  listActiveInscriptions,
  type Inscription,
} from "../db/inscriptions.js";

/**
 * Picks the inscription /espelho should render today (CV1.E12.S3).
 *
 * Resolution order (decision (c) — daily rotation + manual pin):
 *   1. Pinned. The most recently pinned active inscription wins.
 *      Multiple inscriptions can carry pinned_at; the most recent
 *      effectively replaces the previous one's effect.
 *   2. Daily rotation. Deterministic across the user's day —
 *      `hash(userId + ymd) mod count`. Same inscription all day,
 *      stable across glances; rotates at the day boundary.
 *   3. No active inscriptions → null. The page renders nothing
 *      (silent space, no "+ add your first" placeholder).
 *
 * The day boundary uses UTC for now. A user-locale-aware variant
 * could come later; for the household phase the timezone delta is
 * not material to the experience.
 */
export function pickInscriptionForToday(
  db: Database.Database,
  userId: string,
  now: number = Date.now(),
): Inscription | null {
  const active = listActiveInscriptions(db, userId);
  if (active.length === 0) return null;

  // 1. Pinned wins
  const pinned = active
    .filter((i) => i.pinned_at !== null)
    .sort((a, b) => (b.pinned_at ?? 0) - (a.pinned_at ?? 0));
  if (pinned.length > 0) return pinned[0];

  // 2. Daily rotation
  const dayKey = ymdUtc(now);
  const seed = strHash(`${userId}:${dayKey}`);
  const index = seed % active.length;
  return active[index];
}

function ymdUtc(ts: number): string {
  const d = new Date(ts);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function strHash(s: string): number {
  // djb2-ish — non-cryptographic, deterministic, good enough for
  // rotating across a small list. We Math.abs at the end so the
  // mod arithmetic is always positive.
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}
