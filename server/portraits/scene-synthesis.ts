import type Database from "better-sqlite3";
import type { Scene, SceneVoice } from "../db.js";
import { getScenePersonas } from "../db/scenes.js";
import { getCached, computeSourceHash } from "./cache.js";
import { getCitableLineForSession } from "./conversation-citable-line.js";
import type {
  ConversationItem,
  CloseBlock,
  NumericTile,
} from "../../adapters/web/pages/portrait-shared.js";

/**
 * Synthesizes the state behind a scene portrait (CV1.E13.S3).
 *
 * Cenas are **declarative** — they describe a kind of moment, not a
 * story unfolding. The portrait reflects that:
 *   - Lede is the briefing (no diagnosis-extraction heuristic — the
 *     briefing IS the lede). Empty briefing renders a stub block with
 *     the scene's voice glyph in display position.
 *   - "A pergunta viva" and structural section don't apply.
 *   - Tiles cap at 2 (conversation count + recency) — cenas don't
 *     have a "tempo desde início" that matters editorially.
 *   - Voice bifurcates the cast: persona-voiced cenas list cast
 *     personas with descriptors; alma-voiced cenas render a single
 *     ♔ Voz da Alma indicator.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const SILENCE_THRESHOLD_DAYS = 30;

// --- Public types -----------------------------------------------------

export interface ScenePortrait {
  key: string;
  title: string;
  voice: SceneVoice | null;
  status: "active" | "archived";

  /** The briefing as the lede. Null when empty (page renders a stub). */
  lede: string | null;

  tiles: NumericTile[];

  /** `temporal_pattern` rendered in italic. Null when the scene
   *  doesn't declare a temporal pattern. */
  temporalPattern: string | null;

  /** Cast — bifurcates by voice. */
  cast: SceneCast;

  /** Org and journey adjacencies (both optional). */
  territory: SceneTerritory;

  /** Conversations started from this scene (sessions.scene_id). */
  conversations: ConversationItem[];
  conversationsEmpty: boolean;

  /** Last sentence of briefing. Null when briefing too short. */
  close: CloseBlock | null;

  startedAt: number;
  lastUpdatedAt: number;
  daysSinceUpdate: number;
  silenceMonths: number | null;
}

export type SceneCast =
  | { kind: "alma" }
  | { kind: "personas"; personas: ScenePersonaItem[] };

export interface ScenePersonaItem {
  key: string;
  descriptor: string | null;
}

export interface SceneTerritory {
  org: { key: string; name: string } | null;
  journey: { key: string; name: string } | null;
}

// --- Orchestrator -----------------------------------------------------

export function composeScenePortrait(
  db: Database.Database,
  userId: string,
  scene: Scene,
  now: number = Date.now(),
): ScenePortrait {
  const lede = composeSceneLede(scene);
  const tiles = composeSceneTiles(db, scene, now);
  const cast = composeSceneCast(db, userId, scene);
  const territory = composeSceneTerritory(db, userId, scene);
  const conversations = composeSceneConversations(db, scene.id);
  const close = composeSceneClose(scene);

  const lastUpdatedAt = scene.updated_at;
  const daysSinceUpdate = Math.floor((now - lastUpdatedAt) / DAY_MS);
  const silenceMonths =
    daysSinceUpdate > SILENCE_THRESHOLD_DAYS
      ? Math.max(1, Math.floor(daysSinceUpdate / 30))
      : null;

  return {
    key: scene.key,
    title: scene.title,
    voice: scene.voice,
    status: scene.status,
    lede,
    tiles,
    temporalPattern:
      scene.temporal_pattern && scene.temporal_pattern.trim().length > 0
        ? scene.temporal_pattern.trim()
        : null,
    cast,
    territory,
    conversations,
    conversationsEmpty: conversations.length === 0,
    close,
    startedAt: scene.created_at,
    lastUpdatedAt,
    daysSinceUpdate,
    silenceMonths,
  };
}

// --- Lede -------------------------------------------------------------

/**
 * For cenas the lede IS the briefing — no heuristic, no extraction.
 * Cenas are short and declarative; the whole briefing reads as the
 * opening. Returns null when briefing is empty (page renders a stub
 * block instead, with the voice glyph in display position).
 */
export function composeSceneLede(scene: Scene): string | null {
  const briefing = (scene.briefing ?? "").trim();
  if (briefing.length === 0) return null;
  return briefing;
}

// --- Tiles ------------------------------------------------------------

function composeSceneTiles(
  db: Database.Database,
  scene: Scene,
  now: number,
): NumericTile[] {
  const tiles: NumericTile[] = [];

  // Tile 1 — conversation count
  const countRow = db
    .prepare(
      "SELECT COUNT(*) as c FROM sessions WHERE scene_id = ?",
    )
    .get(scene.id) as { c: number };
  if (countRow.c > 0) {
    tiles.push({
      number: countRow.c === 1 ? "1 conversa" : `${countRow.c} conversas`,
      label: countRow.c === 1 ? "desta cena" : "desta cena",
    });
  }

  // Tile 2 — recency (days since most recent session from this scene)
  const recencyRow = db
    .prepare(
      "SELECT MAX(created_at) as ts FROM sessions WHERE scene_id = ?",
    )
    .get(scene.id) as { ts: number | null };
  if (recencyRow.ts !== null) {
    const days = Math.floor((now - recencyRow.ts) / DAY_MS);
    tiles.push({
      number: `${days} dias`,
      label: "desde a última",
    });
  }

  return tiles;
}

// --- Cast (voice bifurcation) -----------------------------------------

function composeSceneCast(
  db: Database.Database,
  userId: string,
  scene: Scene,
): SceneCast {
  if (scene.voice === "alma") {
    return { kind: "alma" };
  }
  const personaKeys = getScenePersonas(db, scene.id);
  const personas: ScenePersonaItem[] = personaKeys.map((key) => {
    const row = db
      .prepare(
        "SELECT summary FROM identity WHERE user_id = ? AND layer = 'persona' AND key = ?",
      )
      .get(userId, key) as { summary: string | null } | undefined;
    return { key, descriptor: row?.summary ?? null };
  });
  return { kind: "personas", personas };
}

// --- Territory --------------------------------------------------------

function composeSceneTerritory(
  db: Database.Database,
  userId: string,
  scene: Scene,
): SceneTerritory {
  let org: SceneTerritory["org"] = null;
  if (scene.organization_key) {
    const row = db
      .prepare(
        "SELECT key, name FROM organizations WHERE user_id = ? AND key = ?",
      )
      .get(userId, scene.organization_key) as
      | { key: string; name: string }
      | undefined;
    if (row) org = { key: row.key, name: row.name };
  }

  let journey: SceneTerritory["journey"] = null;
  if (scene.journey_key) {
    const row = db
      .prepare(
        "SELECT key, name FROM journeys WHERE user_id = ? AND key = ?",
      )
      .get(userId, scene.journey_key) as
      | { key: string; name: string }
      | undefined;
    if (row) journey = { key: row.key, name: row.name };
  }

  return { org, journey };
}

// --- Conversations ----------------------------------------------------

function composeSceneConversations(
  db: Database.Database,
  sceneId: string,
): ConversationItem[] {
  // Sessions started from this cena via sessions.scene_id (CV1.E11.S4).
  // Title joined from sessions.title; date from session created_at OR
  // last entry timestamp (whichever exists).
  const rows = db
    .prepare(
      `SELECT s.id as sessionId, s.title, s.created_at,
              (SELECT MAX(timestamp) FROM entries
                WHERE session_id = s.id AND type = 'message') as lastTs
       FROM sessions s
       WHERE s.scene_id = ?
       ORDER BY COALESCE(
         (SELECT MAX(timestamp) FROM entries
            WHERE session_id = s.id AND type = 'message'),
         s.created_at
       ) DESC
       LIMIT 5`,
    )
    .all(sceneId) as {
    sessionId: string;
    title: string | null;
    created_at: number;
    lastTs: number | null;
  }[];

  return rows.map((row) => {
    const sourceHash = lastEntryTimestampHash(db, row.sessionId);
    const citableLine =
      sourceHash !== null
        ? getCached(
            db,
            "journey", // shared namespace with journey/org portraits
            row.sessionId,
            `citable_line:${row.sessionId}`,
            sourceHash,
          )
        : null;
    return {
      sessionId: row.sessionId,
      title: row.title ?? "(sem título)",
      date: row.lastTs ?? row.created_at,
      citableLine,
    };
  });
}

/**
 * Background warmup of the citable-line cache for sessions started
 * from this cena. Mirrors `warmJourneyPortraitCache` /
 * `warmOrganizationPortraitCache`.
 */
export async function warmScenePortraitCache(
  db: Database.Database,
  sceneId: string,
): Promise<void> {
  const rows = db
    .prepare("SELECT id FROM sessions WHERE scene_id = ? LIMIT 5")
    .all(sceneId) as { id: string }[];

  await Promise.allSettled(
    rows.map((row) =>
      getCitableLineForSession(db, row.id).catch((err) => {
        console.log(
          `[scene-portrait] citable-line warmup failed for ${row.id}:`,
          (err as Error).message,
        );
        return null;
      }),
    ),
  );
}

// --- Close ------------------------------------------------------------

/**
 * Cena briefings often end with a "the mirror here is X" sentence
 * that reads as a natural close. Picker takes the last sentence of
 * the briefing when it's at least 30 chars; otherwise null (no
 * close — the page reads complete without one).
 */
export function composeSceneClose(scene: Scene): CloseBlock | null {
  const briefing = (scene.briefing ?? "").trim();
  if (briefing.length === 0) return null;
  const sentences = briefing
    .split(/(?<=[.!?])\s+(?=[A-ZÀ-Ý"“])/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (sentences.length === 0) return null;
  const last = sentences[sentences.length - 1]!;
  if (last.length < 30) return null;
  const trimmed = last.length > 200 ? last.slice(0, 197) + "…" : last;
  return { text: trimmed, source: "briefing" };
}

// --- Helpers ----------------------------------------------------------

function lastEntryTimestampHash(
  db: Database.Database,
  sessionId: string,
): string | null {
  const row = db
    .prepare(
      `SELECT MAX(timestamp) as ts FROM entries
       WHERE session_id = ? AND type = 'message'
         AND json_extract(data, '$.role') = 'assistant'`,
    )
    .get(sessionId) as { ts: number | null } | undefined;
  if (!row || row.ts === null) return null;
  return computeSourceHash([sessionId, row.ts]);
}
