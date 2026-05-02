import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import {
  isResponseMode,
  isResponseLength,
  type ResponseMode,
  type ResponseLength,
} from "../expression.js";

/**
 * Scene-level voice override (CV1.E11.S4). Mirrors `SessionVoice` from
 * sessions.ts. Currently only "alma" — extensible to other named voices
 * later. NULL means "persona-driven" (the cast pool drives composition).
 */
export type SceneVoice = "alma";

export type SceneStatus = "active" | "archived";

export function isSceneVoice(value: unknown): value is SceneVoice {
  return value === "alma";
}

export interface Scene {
  id: string;
  user_id: string;
  key: string;
  title: string;
  temporal_pattern: string | null;
  briefing: string;
  voice: SceneVoice | null;
  response_mode: ResponseMode | null;
  response_length: ResponseLength | null;
  organization_key: string | null;
  journey_key: string | null;
  status: SceneStatus;
  created_at: number;
  updated_at: number;
}

interface SceneRow {
  id: string;
  user_id: string;
  key: string;
  title: string;
  temporal_pattern: string | null;
  briefing: string;
  voice: string | null;
  response_mode: string | null;
  response_length: string | null;
  organization_key: string | null;
  journey_key: string | null;
  status: string;
  created_at: number;
  updated_at: number;
}

function rowToScene(row: SceneRow): Scene {
  return {
    id: row.id,
    user_id: row.user_id,
    key: row.key,
    title: row.title,
    temporal_pattern: row.temporal_pattern,
    briefing: row.briefing,
    voice: isSceneVoice(row.voice) ? row.voice : null,
    response_mode: isResponseMode(row.response_mode)
      ? row.response_mode
      : null,
    response_length: isResponseLength(row.response_length)
      ? row.response_length
      : null,
    organization_key: row.organization_key,
    journey_key: row.journey_key,
    status: row.status === "archived" ? "archived" : "active",
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export interface CreateSceneFields {
  title: string;
  temporal_pattern?: string | null;
  briefing?: string;
  voice?: SceneVoice | null;
  response_mode?: ResponseMode | null;
  response_length?: ResponseLength | null;
  organization_key?: string | null;
  journey_key?: string | null;
}

export interface UpdateSceneFields {
  title?: string;
  temporal_pattern?: string | null;
  briefing?: string;
  voice?: SceneVoice | null;
  response_mode?: ResponseMode | null;
  response_length?: ResponseLength | null;
  organization_key?: string | null;
  journey_key?: string | null;
}

export interface ListScenesOptions {
  status?: SceneStatus;
}

const SELECT_COLUMNS =
  "id, user_id, key, title, temporal_pattern, briefing, voice, response_mode, response_length, organization_key, journey_key, status, created_at, updated_at";

/**
 * Creates a scene. Title is required; other fields default to NULL or
 * empty. When voice='alma' is set at creation, no personas are inserted
 * (mutex with cast — symmetric with `setSessionVoice` in sessions.ts).
 * Throws on UNIQUE(user_id, key) collision (caller surfaces the error).
 */
export function createScene(
  db: Database.Database,
  userId: string,
  key: string,
  fields: CreateSceneFields,
): Scene {
  const now = Date.now();
  const id = randomUUID();
  db.prepare(
    `INSERT INTO scenes (
       id, user_id, key, title, temporal_pattern, briefing, voice,
       response_mode, response_length, organization_key, journey_key,
       status, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
  ).run(
    id,
    userId,
    key,
    fields.title,
    fields.temporal_pattern ?? null,
    fields.briefing ?? "",
    fields.voice ?? null,
    fields.response_mode ?? null,
    fields.response_length ?? null,
    fields.organization_key ?? null,
    fields.journey_key ?? null,
    now,
    now,
  );
  const scene = getSceneById(db, id, userId);
  if (!scene) throw new Error(`Scene ${id} disappeared after insert`);
  return scene;
}

export function getSceneById(
  db: Database.Database,
  sceneId: string,
  userId: string,
): Scene | undefined {
  const row = db
    .prepare(
      `SELECT ${SELECT_COLUMNS} FROM scenes WHERE id = ? AND user_id = ?`,
    )
    .get(sceneId, userId) as SceneRow | undefined;
  return row ? rowToScene(row) : undefined;
}

export function getSceneByKey(
  db: Database.Database,
  userId: string,
  key: string,
): Scene | undefined {
  const row = db
    .prepare(
      `SELECT ${SELECT_COLUMNS} FROM scenes WHERE user_id = ? AND key = ?`,
    )
    .get(userId, key) as SceneRow | undefined;
  return row ? rowToScene(row) : undefined;
}

/**
 * Lists the user's scenes ordered by most recent activity. Activity is
 * the latest `sessions.created_at` for sessions linked to the cena;
 * cenas never used fall back to their own `created_at`. Default filter
 * is `status='active'`; pass `{status: 'archived'}` to list archived.
 */
export function listScenesForUser(
  db: Database.Database,
  userId: string,
  opts: ListScenesOptions = {},
): Scene[] {
  const status = opts.status ?? "active";
  const rows = db
    .prepare(
      `SELECT ${SELECT_COLUMNS.split(", ")
        .map((c) => `s.${c}`)
        .join(", ")},
              COALESCE(MAX(sess.created_at), s.created_at) AS last_activity
       FROM scenes s
       LEFT JOIN sessions sess ON sess.scene_id = s.id
       WHERE s.user_id = ? AND s.status = ?
       GROUP BY s.id
       ORDER BY last_activity DESC, s.created_at DESC`,
    )
    .all(userId, status) as Array<SceneRow & { last_activity: number }>;
  return rows.map(rowToScene);
}

/**
 * Partial update. Only fields present in `fields` are written.
 * `updated_at` is bumped on every call. When voice is set to 'alma',
 * any existing scene_personas rows are cleared in the same transaction
 * (mutex with cast — symmetric with `setSessionVoice`).
 * Returns the updated scene, or undefined if the (user_id, key) pair
 * doesn't resolve to a row.
 */
export function updateScene(
  db: Database.Database,
  userId: string,
  key: string,
  fields: UpdateSceneFields,
): Scene | undefined {
  const current = getSceneByKey(db, userId, key);
  if (!current) return undefined;

  const next = {
    title: fields.title ?? current.title,
    temporal_pattern:
      fields.temporal_pattern !== undefined
        ? fields.temporal_pattern
        : current.temporal_pattern,
    briefing: fields.briefing ?? current.briefing,
    voice: fields.voice !== undefined ? fields.voice : current.voice,
    response_mode:
      fields.response_mode !== undefined
        ? fields.response_mode
        : current.response_mode,
    response_length:
      fields.response_length !== undefined
        ? fields.response_length
        : current.response_length,
    organization_key:
      fields.organization_key !== undefined
        ? fields.organization_key
        : current.organization_key,
    journey_key:
      fields.journey_key !== undefined
        ? fields.journey_key
        : current.journey_key,
  };

  const txn = db.transaction(() => {
    db.prepare(
      `UPDATE scenes
       SET title = ?, temporal_pattern = ?, briefing = ?, voice = ?,
           response_mode = ?, response_length = ?,
           organization_key = ?, journey_key = ?, updated_at = ?
       WHERE user_id = ? AND key = ?`,
    ).run(
      next.title,
      next.temporal_pattern,
      next.briefing,
      next.voice,
      next.response_mode,
      next.response_length,
      next.organization_key,
      next.journey_key,
      Date.now(),
      userId,
      key,
    );
    if (next.voice === "alma") {
      db.prepare("DELETE FROM scene_personas WHERE scene_id = ?").run(
        current.id,
      );
    }
  });
  txn();

  return getSceneByKey(db, userId, key);
}

export function archiveScene(
  db: Database.Database,
  userId: string,
  key: string,
): boolean {
  const result = db
    .prepare(
      "UPDATE scenes SET status = 'archived', updated_at = ? WHERE user_id = ? AND key = ? AND status != 'archived'",
    )
    .run(Date.now(), userId, key);
  return result.changes > 0;
}

export function unarchiveScene(
  db: Database.Database,
  userId: string,
  key: string,
): boolean {
  const result = db
    .prepare(
      "UPDATE scenes SET status = 'active', updated_at = ? WHERE user_id = ? AND key = ? AND status = 'archived'",
    )
    .run(Date.now(), userId, key);
  return result.changes > 0;
}

/**
 * Hard delete. Linked sessions are unscoped (scene_id → NULL) rather
 * than destroyed — the conversations live on without their cena. The
 * cena's persona junction is wiped. Ownership-checked via the WHERE
 * on the user_id; foreign callers see `false` and no rows touched.
 */
export function deleteScene(
  db: Database.Database,
  userId: string,
  key: string,
): boolean {
  const scene = getSceneByKey(db, userId, key);
  if (!scene) return false;

  const txn = db.transaction(() => {
    db.prepare(
      "UPDATE sessions SET scene_id = NULL WHERE scene_id = ?",
    ).run(scene.id);
    db.prepare("DELETE FROM scene_personas WHERE scene_id = ?").run(scene.id);
    db.prepare("DELETE FROM scenes WHERE id = ?").run(scene.id);
  });
  txn();
  return true;
}

/**
 * Transactional rewrite of a cena's cast. Replaces existing rows with
 * the given list, preserving order via `sort_order`. Forbidden when
 * voice='alma' — throws Error('Cannot set personas on an Alma cena')
 * (caller toggles voice off first if they want to add personas).
 */
export function setScenePersonas(
  db: Database.Database,
  sceneId: string,
  personaKeys: string[],
): void {
  const row = db
    .prepare("SELECT voice FROM scenes WHERE id = ?")
    .get(sceneId) as { voice: string | null } | undefined;
  if (!row) {
    throw new Error(`Scene ${sceneId} not found`);
  }
  if (row.voice === "alma") {
    throw new Error("Cannot set personas on an Alma cena");
  }

  const txn = db.transaction(() => {
    db.prepare("DELETE FROM scene_personas WHERE scene_id = ?").run(sceneId);
    const insert = db.prepare(
      "INSERT INTO scene_personas (scene_id, persona_key, sort_order) VALUES (?, ?, ?)",
    );
    personaKeys.forEach((key, idx) => insert.run(sceneId, key, idx));
  });
  txn();
}

export function getScenePersonas(
  db: Database.Database,
  sceneId: string,
): string[] {
  const rows = db
    .prepare(
      "SELECT persona_key FROM scene_personas WHERE scene_id = ? ORDER BY sort_order ASC, persona_key ASC",
    )
    .all(sceneId) as { persona_key: string }[];
  return rows.map((r) => r.persona_key);
}
