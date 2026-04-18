import type Database from "better-sqlite3";
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { computeSessionStats } from "./session-stats.js";

/**
 * Helpers that back the Admin Workspace dashboard (CV0.E3.S4). Each returns
 * a small data shape the dashboard card renders. All queries are read-only
 * and run on every dashboard render — the surface is server-rendered with
 * manual refresh, so caching isn't needed in v1.
 */

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// ---- Users ----------------------------------------------------------------

export interface UserStats {
  total: number;
  activeLast7d: number;
}

export function getUserStats(db: Database.Database): UserStats {
  const total = (
    db.prepare("SELECT COUNT(*) as c FROM users").get() as { c: number }
  ).c;
  const since = Date.now() - WEEK_MS;
  const activeLast7d = (
    db
      .prepare(
        "SELECT COUNT(DISTINCT user_id) as c FROM sessions WHERE created_at > ?",
      )
      .get(since) as { c: number }
  ).c;
  return { total, activeLast7d };
}

// ---- Activity -------------------------------------------------------------

export interface ActivityStats {
  sessionsToday: number;
  sessionsThisWeek: number;
}

export function getActivityStats(db: Database.Database): ActivityStats {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const sessionsToday = (
    db
      .prepare("SELECT COUNT(*) as c FROM sessions WHERE created_at >= ?")
      .get(startOfToday.getTime()) as { c: number }
  ).c;
  const sessionsThisWeek = (
    db
      .prepare("SELECT COUNT(*) as c FROM sessions WHERE created_at >= ?")
      .get(Date.now() - WEEK_MS) as { c: number }
  ).c;
  return { sessionsToday, sessionsThisWeek };
}

// ---- Mirror memory (identity layers by type) ------------------------------

export interface MemoryStats {
  selfCount: number;
  egoCount: number;
  personaCount: number;
  total: number;
}

export function getMemoryStats(db: Database.Database): MemoryStats {
  const rows = db
    .prepare("SELECT layer, COUNT(*) as c FROM identity GROUP BY layer")
    .all() as Array<{ layer: string; c: number }>;
  const byLayer = Object.fromEntries(rows.map((r) => [r.layer, r.c]));
  const selfCount = byLayer.self ?? 0;
  const egoCount = byLayer.ego ?? 0;
  const personaCount = byLayer.persona ?? 0;
  return {
    selfCount,
    egoCount,
    personaCount,
    total: selfCount + egoCount + personaCount,
  };
}

// ---- Cost estimate --------------------------------------------------------

export interface CostEstimate {
  totalBRL: number;
  sessionsCounted: number;
  windowDays: number;
  since: number; // ms timestamp; start of the 30-day window
}

/**
 * Sum the per-session cost estimate from `computeSessionStats` across all
 * sessions whose `created_at` falls within the last 30 days. The numbers
 * are approximate (the Rail's char/4 heuristic) and reflect the main model
 * only — the reception and title model calls aren't tracked per-request
 * and can't be accurately attributed without S6's usage_log.
 */
export function getCostEstimate(db: Database.Database): CostEstimate {
  const windowDays = 30;
  const since = Date.now() - windowDays * DAY_MS;
  const rows = db
    .prepare(
      "SELECT id FROM sessions WHERE created_at >= ? ORDER BY created_at DESC",
    )
    .all(since) as Array<{ id: string }>;

  let totalBRL = 0;
  for (const r of rows) {
    const stats = computeSessionStats(db, r.id);
    if (typeof stats.costBRL === "number") {
      totalBRL += stats.costBRL;
    }
  }
  return { totalBRL, sessionsCounted: rows.length, windowDays, since };
}

// ---- System ---------------------------------------------------------------

export interface SystemStats {
  uptimeSeconds: number;
  dbSizeBytes: number | null;
  nodeVersion: string;
}

export function getSystemStats(dbPath?: string): SystemStats {
  const resolvedDb =
    dbPath ??
    process.env.MIRROR_DB_PATH ??
    path.join(process.cwd(), "data", "mirror.db");
  let dbSizeBytes: number | null = null;
  try {
    if (existsSync(resolvedDb)) {
      dbSizeBytes = statSync(resolvedDb).size;
    }
  } catch {
    // fall through; card will show a dash.
  }
  return {
    uptimeSeconds: process.uptime(),
    dbSizeBytes,
    nodeVersion: process.version,
  };
}

// ---- Latest release -------------------------------------------------------

export interface LatestRelease {
  version: string; // e.g. "v0.5.0"
  title: string; // the release's "# heading"
  date: string | null; // e.g. "18 April 2026"
  url: string; // /docs/releases/v0.5.0
}

export function getLatestRelease(): LatestRelease | null {
  const dir = path.resolve(process.cwd(), "docs", "releases");
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir).filter((f) => /^v\d+\.\d+\.\d+\.md$/.test(f));
  if (files.length === 0) return null;
  // Sort by semver descending. Safe because the pattern is strict.
  files.sort((a, b) => compareSemver(b, a));
  const latest = files[0];
  const version = latest.replace(/\.md$/, "");
  const content = readFileSync(path.join(dir, latest), "utf-8");
  const headingMatch = content.match(/^#\s+(.+?)\s*$/m);
  const dateMatch = content.match(/^\*([^*]+)\*\s*$/m);
  const title = headingMatch
    ? headingMatch[1].replace(/^v\d+\.\d+\.\d+\s*—\s*/, "").trim()
    : version;
  return {
    version,
    title,
    date: dateMatch ? dateMatch[1].trim() : null,
    url: `/docs/releases/${version}`,
  };
}

function compareSemver(a: string, b: string): number {
  const pa = a.replace(/^v|\.md$/g, "").split(".").map(Number);
  const pb = b.replace(/^v|\.md$/g, "").split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da !== db) return da - db;
  }
  return 0;
}
