import type { SessionTags } from "./db/session-tags.js";

/**
 * Inputs from reception that are eligible to graduate into the session's
 * scope junctions on this turn. Just the three keys reception classifies
 * — everything else from ReceptionResult is irrelevant to seeding.
 */
export interface ScopeSeedingInput {
  personas: string[];
  organization: string | null;
  journey: string | null;
}

/**
 * Routing flags that suppress persona seeding for certain turn shapes.
 * Alma turns don't add to the cast (the Alma is not a persona — growing
 * the cast on Alma turns would mis-label the session pool). Trivial turns
 * elide everything. Forced-persona turns surface the user's pick via
 * `_forced_destination` on the entry; reception's auto verdict is kept
 * for calibration but not promoted into the pool.
 *
 * Org and journey gating intentionally ignores these flags — even an
 * Alma turn legitimately scoped to "software-zen" should populate the
 * organization junction.
 */
export interface ScopeSeedingFlags {
  isAlma: boolean;
  isTrivial: boolean;
  forcedPersonaKey: string | null;
}

/**
 * Decision shape returned by {@link decideScopeSeeding}. The caller
 * applies these to the database; the function itself stays pure for
 * unit testability. Fields default to no-op values (empty array / null)
 * when the corresponding gate doesn't open.
 */
export interface ScopeSeedingDecision {
  seedPersonas: string[];
  seedOrganization: string | null;
  seedJourney: string | null;
}

/**
 * Decide which scopes from this turn's reception output should graduate
 * into the session's junction tables (`session_personas`,
 * `session_organizations`, `session_journeys`).
 *
 * **Policy: seed-when-empty (symmetric across the three axes).** A scope
 * graduates only when its pool is empty BEFORE this turn. Once any key
 * is seeded for an axis, reception stops growing that axis automatically;
 * subsequent changes are explicit (header `+` add / `×` remove). This
 * preserves the "scope is stable session context" semantic of CV1.E4.S4
 * + CV1.E7.S3 while opening the seeding window past turn 1.
 *
 * The previous gate for org/journey was `isFirstTurn` — strictly stronger
 * than needed. Prod scenario (28/Apr/2026): turn 1 was a casual greeting
 * that yielded no scope; turn 2 finally surfaced `o-espelho + software-zen`.
 * Under the first-turn gate, the classification stamped the entry meta
 * (badges visible on the bubble) but never reached the header's Scope
 * zone. The empty-before gate symmetric with persona seeding closes the
 * gap without introducing scope creep — once seeded, reception never
 * overrides.
 */
export function decideScopeSeeding(
  before: SessionTags,
  reception: ScopeSeedingInput,
  flags: ScopeSeedingFlags,
): ScopeSeedingDecision {
  const personasEmpty = before.personaKeys.length === 0;
  const orgsEmpty = before.organizationKeys.length === 0;
  const journeysEmpty = before.journeyKeys.length === 0;

  const personaGate =
    personasEmpty &&
    !flags.isAlma &&
    !flags.isTrivial &&
    !flags.forcedPersonaKey;

  return {
    seedPersonas: personaGate ? reception.personas : [],
    seedOrganization: orgsEmpty ? reception.organization : null,
    seedJourney: journeysEmpty ? reception.journey : null,
  };
}
