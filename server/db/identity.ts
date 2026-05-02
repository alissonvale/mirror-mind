import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { hashPersonaColor, normalizeHexColor } from "../personas/colors.js";

export interface IdentityLayer {
  id: string;
  user_id: string;
  layer: string;
  key: string;
  content: string;
  summary: string | null;
  /**
   * Persona-only visual identity. NULL on non-persona layers and on
   * personas that haven't been colored yet; consumers fall back to
   * hashPersonaColor(key). Backfilled on migration so upgrades don't
   * shift colors visually.
   */
  color: string | null;
  sort_order: number | null;
  show_in_sidebar: number;
  /**
   * Persona-only stub flag (CV1.E11.S7). Set to 1 by the cena form's
   * inline sub-creation; flipped back to 0 by the workshop's save
   * handler (promote-on-edit). Other layers (self/ego) carry 0 and
   * the flag is meaningless for them.
   */
  is_draft: number;
  updated_at: number;
}

export function setIdentityLayer(
  db: Database.Database,
  userId: string,
  layer: string,
  key: string,
  content: string,
): IdentityLayer {
  const id = randomUUID();
  const now = Date.now();
  // New personas get a hash-derived color on first insert so the
  // visual is stable from turn one. Existing rows keep whatever color
  // they already carry (the ON CONFLICT clause doesn't touch color).
  const seedColor = layer === "persona" ? hashPersonaColor(key) : null;
  db.prepare(`
    INSERT INTO identity (id, user_id, layer, key, content, color, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (user_id, layer, key)
    DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at
  `).run(id, userId, layer, key, content, seedColor, now);

  return db
    .prepare("SELECT * FROM identity WHERE user_id = ? AND layer = ? AND key = ?")
    .get(userId, layer, key) as IdentityLayer;
}

/**
 * Writes the persona's color. Accepts any valid hex string (#rgb,
 * #rrggbb, #rrggbbaa) — invalid input returns false without touching
 * the row. Passing `null` clears the override, so consumers fall back
 * to hashPersonaColor(key).
 */
export function setPersonaColor(
  db: Database.Database,
  userId: string,
  key: string,
  color: string | null,
): boolean {
  let normalized: string | null;
  if (color === null) {
    normalized = null;
  } else {
    normalized = normalizeHexColor(color);
    if (normalized === null) return false;
  }
  const result = db
    .prepare(
      "UPDATE identity SET color = ? WHERE user_id = ? AND layer = 'persona' AND key = ?",
    )
    .run(normalized, userId, key);
  return result.changes > 0;
}

export function setIdentitySummary(
  db: Database.Database,
  userId: string,
  layer: string,
  key: string,
  summary: string,
): void {
  db.prepare(
    "UPDATE identity SET summary = ? WHERE user_id = ? AND layer = ? AND key = ?",
  ).run(summary, userId, layer, key);
}

export function deleteIdentityLayer(
  db: Database.Database,
  userId: string,
  layer: string,
  key: string,
): boolean {
  const result = db
    .prepare("DELETE FROM identity WHERE user_id = ? AND layer = ? AND key = ?")
    .run(userId, layer, key);
  return result.changes > 0;
}

export function getIdentityLayers(
  db: Database.Database,
  userId: string,
): IdentityLayer[] {
  // Ordered by psychic depth (self → ego → persona), then by semantic
  // order within each layer. Within self: soul (essence) → doctrine
  // (adopted framework, CV1.E9.S1). Within ego: identity → expression →
  // behavior. Within persona: user-defined sort_order (NULLs fall to
  // the end), then name alphabetical. Other keys fall back to
  // alphabetical.
  return db
    .prepare(
      `SELECT * FROM identity
       WHERE user_id = ?
       ORDER BY
         CASE layer
           WHEN 'self' THEN 1
           WHEN 'ego' THEN 2
           WHEN 'persona' THEN 3
           ELSE 4
         END,
         CASE
           WHEN layer = 'self' AND key = 'soul' THEN 1
           WHEN layer = 'self' AND key = 'doctrine' THEN 2
           WHEN layer = 'ego' AND key = 'identity' THEN 1
           WHEN layer = 'ego' AND key = 'expression' THEN 2
           WHEN layer = 'ego' AND key = 'behavior' THEN 3
           ELSE 99
         END,
         sort_order IS NULL,
         sort_order ASC,
         key`,
    )
    .all(userId) as IdentityLayer[];
}

export function setPersonaShowInSidebar(
  db: Database.Database,
  userId: string,
  key: string,
  visible: boolean,
): boolean {
  const result = db
    .prepare(
      "UPDATE identity SET show_in_sidebar = ? WHERE user_id = ? AND layer = 'persona' AND key = ?",
    )
    .run(visible ? 1 : 0, userId, key);
  return result.changes > 0;
}

/**
 * Create a persona as a draft (CV1.E11.S7 stub-first). Used by the
 * cena form's inline sub-creation. The persona row carries
 * is_draft=1 until the user opens the workshop and saves
 * (promote-on-edit). Description (optional) becomes the initial
 * content; if empty, the name is used so reception has *something*
 * to read. Throws on (user_id, layer, key) collision.
 */
export function createDraftPersona(
  db: Database.Database,
  userId: string,
  key: string,
  name: string,
  description: string,
): IdentityLayer {
  const id = randomUUID();
  const now = Date.now();
  const seedColor = hashPersonaColor(key);
  const content = description.trim() || name;
  db.prepare(
    `INSERT INTO identity (id, user_id, layer, key, content, summary, color, is_draft, updated_at)
     VALUES (?, ?, 'persona', ?, ?, ?, ?, 1, ?)`,
  ).run(id, userId, key, content, name, seedColor, now);
  return db
    .prepare(
      "SELECT * FROM identity WHERE user_id = ? AND layer = 'persona' AND key = ?",
    )
    .get(userId, key) as IdentityLayer;
}

/**
 * Flip the is_draft flag on a persona row. Returns true on success,
 * false when the persona doesn't exist or belongs to another user.
 * Workshop save handlers call setPersonaIsDraft(false) to promote
 * the entity (CV1.E11.S7 promote-on-edit).
 */
export function setPersonaIsDraft(
  db: Database.Database,
  userId: string,
  key: string,
  isDraft: boolean,
): boolean {
  const result = db
    .prepare(
      "UPDATE identity SET is_draft = ? WHERE user_id = ? AND layer = 'persona' AND key = ?",
    )
    .run(isDraft ? 1 : 0, userId, key);
  return result.changes > 0;
}

/**
 * Move a persona up or down by swapping sort_order with the adjacent
 * persona in the same user. Returns true on a successful swap, false
 * when the persona is already at the edge or missing. Same mental
 * model as moveJourney / moveOrganization.
 */
export function movePersona(
  db: Database.Database,
  userId: string,
  key: string,
  direction: "up" | "down",
): boolean {
  const current = db
    .prepare(
      "SELECT * FROM identity WHERE user_id = ? AND layer = 'persona' AND key = ?",
    )
    .get(userId, key) as IdentityLayer | undefined;
  if (!current) return false;

  const params = {
    userId,
    currentOrder: current.sort_order,
    currentKey: current.key,
  };

  const neighborSql =
    direction === "up"
      ? `SELECT * FROM identity
         WHERE user_id = @userId AND layer = 'persona'
           AND (
             (sort_order IS NOT NULL AND @currentOrder IS NOT NULL AND sort_order < @currentOrder)
             OR (sort_order IS NULL AND @currentOrder IS NULL AND key < @currentKey)
             OR (sort_order IS NOT NULL AND @currentOrder IS NULL)
           )
         ORDER BY sort_order IS NULL, sort_order DESC, key DESC
         LIMIT 1`
      : `SELECT * FROM identity
         WHERE user_id = @userId AND layer = 'persona'
           AND (
             (sort_order IS NOT NULL AND @currentOrder IS NOT NULL AND sort_order > @currentOrder)
             OR (sort_order IS NULL AND @currentOrder IS NULL AND key > @currentKey)
             OR (sort_order IS NULL AND @currentOrder IS NOT NULL)
           )
         ORDER BY sort_order IS NULL, sort_order ASC, key ASC
         LIMIT 1`;

  const neighbor = db.prepare(neighborSql).get(params) as IdentityLayer | undefined;
  if (!neighbor) return false;

  let aOrder = current.sort_order;
  let bOrder = neighbor.sort_order;
  if (aOrder === null || bOrder === null) {
    const max = db
      .prepare(
        "SELECT COALESCE(MAX(sort_order), -1) AS max FROM identity WHERE user_id = ? AND layer = 'persona'",
      )
      .get(userId) as { max: number };
    if (aOrder === null) aOrder = max.max + 1;
    if (bOrder === null) bOrder = Math.max(max.max + 2, aOrder + 1);
  }

  const tx = db.transaction(() => {
    db.prepare("UPDATE identity SET sort_order = ? WHERE id = ?").run(bOrder, current.id);
    db.prepare("UPDATE identity SET sort_order = ? WHERE id = ?").run(aOrder, neighbor.id);
  });
  tx();
  return true;
}
