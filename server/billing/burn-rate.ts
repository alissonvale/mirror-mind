import type Database from "better-sqlite3";
import { getUsageByDay } from "../db/usage-log.js";

export interface BurnRate {
  avg_usd_per_day: number;
  days_of_credit_left: number | null;
}

/**
 * Trailing-window burn rate for LLM spend. Consumed by:
 *   - /admin/budget dashboard (CV0.E3.S6) — 7-day rolling average
 *   - /  (home) State of the mirror band (CV0.E4.S1)
 *
 * Returns a zero rate and null days-left when the window has no usage.
 */
export function computeBurnRate(
  db: Database.Database,
  fromMs: number,
  toMs: number,
  limitRemaining: number | null,
): BurnRate {
  const days = getUsageByDay(db, fromMs, toMs);
  if (days.length === 0) {
    return { avg_usd_per_day: 0, days_of_credit_left: null };
  }
  const sum = days.reduce((acc, d) => acc + (d.total_usd ?? 0), 0);
  const avg = sum / days.length;
  const daysLeft =
    limitRemaining !== null && avg > 0 ? limitRemaining / avg : null;
  return { avg_usd_per_day: avg, days_of_credit_left: daysLeft };
}
