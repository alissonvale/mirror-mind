import type Database from "better-sqlite3";
import { getIdentityLayers } from "./db.js";

export interface ComposedSnapshot {
  layers: string[];
  /**
   * CV1.E7.S5: personas composed into the prompt this turn (0 or more).
   * Order preserved — first is the leading lens used for the bubble
   * color bar.
   */
  personas: string[];
  /**
   * Primary persona — first element of `personas`, or null when empty.
   * Kept as a convenience for consumers that only care about the
   * leading lens (Context Rail's Composed row, for instance).
   */
  persona: string | null;
  organization: string | null;
  journey: string | null;
  /**
   * CV1.E7.S9 phase 2: response mode for this turn. Reception's pick
   * (or the session override). Null means the snapshot consumer
   * doesn't have mode context — typically a turn that pre-dates the
   * stamping work, or a derivation path that didn't pass mode through.
   * The Look inside rail renders a "mode:" row only when this field
   * carries a value.
   */
  mode: string | null;
}

/**
 * A snapshot of what was composed into the system prompt for a turn.
 * Reflects composition (what the LLM actually saw), not reception's
 * raw classification output. Used by the Context Rail in the web
 * adapter — see docs/product/memory-taxonomy.md for the framing.
 *
 * Scope keys reflect what reception returned; the composer's actual
 * injection (active-only, non-empty content) is the final word in the
 * rail's display logic.
 */
export function composedSnapshot(
  db: Database.Database,
  userId: string,
  /**
   * Accepts `string[]` (CV1.E7.S5 canonical), `null`/`undefined`
   * (empty), or a single `string` (legacy path; caller migration is
   * gradual across phases). All three normalize to an array.
   */
  personaKeys: string[] | string | null = [],
  organizationKey: string | null = null,
  journeyKey: string | null = null,
  /**
   * CV1.E7.S9 phase 2: optional mode for the snapshot. Pass the
   * resolved mode (override or reception) so the rail's Composed
   * section can render a "mode:" row. Defaults to null when the
   * caller doesn't have it — historical sessions and any path that
   * predates the mode-stamping work end up null without breaking.
   */
  mode: string | null = null,
): ComposedSnapshot {
  const normalized: string[] = Array.isArray(personaKeys)
    ? personaKeys
    : typeof personaKeys === "string"
    ? [personaKeys]
    : [];

  // Reflects composition truth, not DB inventory. Since CV1.E7.S1,
  // `ego/expression` is no longer a composed prompt layer — it is
  // input to the post-generation expression pass. Excluding it here
  // keeps the rail snapshot honest with what the LLM actually saw.
  // CV1.E7.S4 will further narrow this list (self/soul and
  // ego/identity becoming turn-conditional); when that lands, the
  // filter expands to take the active set as input.
  const layers = getIdentityLayers(db, userId)
    .filter((l) => l.layer === "self" || l.layer === "ego")
    .filter((l) => !(l.layer === "ego" && l.key === "expression"))
    .map((l) => `${l.layer}.${l.key}`);

  return {
    layers,
    personas: normalized,
    persona: normalized[0] ?? null,
    organization: organizationKey,
    journey: journeyKey,
    mode,
  };
}
