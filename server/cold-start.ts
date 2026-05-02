import type Database from "better-sqlite3";
import type { ReceptionResult } from "./reception.js";
import { findMatchingScene } from "./scenes-match.js";

export interface ColdStartSuggestion {
  key: string;
  title: string;
  glyph: string;       // ❖ for persona cena, ♔ for Alma cena
}

/**
 * CV1.E11.S1 cold-start: when a session has no cena (`scene_id=null`)
 * and we're on its first turn, check whether the receptor's
 * classification matches an existing cena. If yes, the adapter
 * surfaces a suggestion card; user accepts (POST /apply-scene) or
 * dismisses.
 *
 * The match logic itself lives in scenes-match.ts (CV1.E11.S4); this
 * helper is the gate (turn 1, unscoped session, non-trivial).
 *
 * Returns null when:
 *  - session is already scoped to a cena (no cold-start needed)
 *  - this isn't the first turn (cold-start is specifically the
 *    unscoped → scoped *transition*; later turns belong to the
 *    out-of-pool suggestion path from CV1.E7.S8)
 *  - reception flagged the turn trivial (suggesting a cena on a
 *    "boa noite" would be noisy)
 *  - no cena matches the receptor's axes
 */
export function evaluateColdStart(
  db: Database.Database,
  userId: string,
  sessionSceneId: string | null,
  isFirstTurn: boolean,
  reception: ReceptionResult,
): ColdStartSuggestion | null {
  if (sessionSceneId !== null) return null;
  if (!isFirstTurn) return null;
  if (reception.is_trivial) return null;

  const match = findMatchingScene(db, userId, reception);
  if (!match) return null;

  return {
    key: match.key,
    title: match.title,
    glyph: match.voice === "alma" ? "♔" : "❖",
  };
}
