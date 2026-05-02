import type Database from "better-sqlite3";
import type { ReceptionResult } from "./reception.js";
import {
  listScenesForUser,
  getScenePersonas,
  type Scene,
} from "./db/scenes.js";

/**
 * Receptor cold-start match (CV1.E11.S4). Given a session that started
 * unscoped (no `scene_id`), the receptor's classification of turn 1 is
 * checked against the user's existing cenas. If a strict match is found,
 * the caller renders the suggestion card from CV1.E11.S1; the user can
 * accept (apply the cena from turn 2 onward) or dismiss.
 *
 * Strict matrix (from `docs/design/scenes-home-design.md`):
 *
 *   - **Alma cena:** `is_self_moment=true` AND `scene.voice='alma'`
 *   - **Persona cena:** `receptor.personas[0] ∈ scene.cast`
 *                       AND `scene.organization_key === receptor.organization` (or both null)
 *                       AND `scene.journey_key === receptor.journey` (or both null)
 *   - **Multiple matches:** most-recent activity wins (driven by
 *     `listScenesForUser`'s ordering)
 *   - **Trivial turn:** never matches (returns null up front)
 *
 * Alma takes precedence over persona — when both could match, the
 * self-moment is the dominant signal.
 *
 * Looser matching ("org alone matches", semantic similarity over
 * briefing) is intentionally out of scope for v1; the strict matrix
 * keeps suggestions credible while calibration data accrues.
 */
export function findMatchingScene(
  db: Database.Database,
  userId: string,
  receptor: ReceptionResult,
): Scene | null {
  if (receptor.is_trivial) return null;

  const scenes = listScenesForUser(db, userId);
  if (scenes.length === 0) return null;

  if (receptor.is_self_moment) {
    const alma = scenes.find((s) => s.voice === "alma");
    if (alma) return alma;
  }

  const lead = receptor.personas[0];
  if (!lead) return null;

  for (const scene of scenes) {
    if (scene.voice === "alma") continue;
    const cast = getScenePersonas(db, scene.id);
    if (!cast.includes(lead)) continue;
    if (!scopesMatch(scene.organization_key, receptor.organization)) continue;
    if (!scopesMatch(scene.journey_key, receptor.journey)) continue;
    return scene;
  }

  return null;
}

function scopesMatch(
  sceneScope: string | null,
  receptorScope: string | null,
): boolean {
  if (sceneScope === null && receptorScope === null) return true;
  return sceneScope === receptorScope;
}
