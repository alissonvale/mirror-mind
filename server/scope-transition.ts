/**
 * Scope (org/journey) badge visibility — transition rule.
 *
 * The bubble badge for `⌂ org` and `↝ journey` shows on the turn whose
 * scope DIFFERS from the previous assistant turn's scope (or the first
 * scoped turn after a scope-less stretch). Subsequent turns continuing
 * the same scope produce no badge — the header's Scope zone carries the
 * session-level state, so per-turn repetition is visual noise.
 *
 * Symmetric with persona's `newPersonasThisTurn`. The previous rule was
 * pool-based ("suppress when in pool"), which masked this behavior while
 * the org/journey junctions were under-seeded; now that scope-seed is
 * symmetric across axes (decideScopeSeeding, 2026-04-30), the pool-based
 * rule would suppress the badge on every reload after the seed turn —
 * including the seed turn itself — leaving no visual marker of which
 * turn introduced the scope. The transition rule restores the marker
 * exactly where it belongs: the moment scope changes.
 */
export interface ScopeTransitionInput {
  /** Org on the previous assistant turn (`null` for none / first turn / scope-less previous). */
  previousOrg: string | null;
  /** Journey on the previous assistant turn (same null semantics as previousOrg). */
  previousJourney: string | null;
  /** Org on the current turn (from reception or stamped meta). */
  currentOrg: string | null;
  /** Journey on the current turn. */
  currentJourney: string | null;
}

export interface ScopeTransitionDecision {
  /** When the current turn introduces a different (non-null) org, this carries that org; otherwise null. */
  newOrgThisTurn: string | null;
  /** Same shape as newOrgThisTurn for journey. */
  newJourneyThisTurn: string | null;
}

/**
 * Decide whether the current turn's scope counts as a transition that
 * should render the bubble badge. A transition is any non-null current
 * scope that differs from the previous assistant turn's scope. Same
 * scope across consecutive turns produces no badge.
 *
 * Includes the case where previous was null (turn 1, post-trivial,
 * post-Alma-without-scope) — any non-null current is a transition from
 * the null-state and the badge shows.
 */
export function decideScopeTransition(
  input: ScopeTransitionInput,
): ScopeTransitionDecision {
  return {
    newOrgThisTurn:
      input.currentOrg !== null && input.currentOrg !== input.previousOrg
        ? input.currentOrg
        : null,
    newJourneyThisTurn:
      input.currentJourney !== null &&
      input.currentJourney !== input.previousJourney
        ? input.currentJourney
        : null,
  };
}
