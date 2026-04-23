import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

export type JourneyStatus = "active" | "archived";

export interface Journey {
  id: string;
  user_id: string;
  organization_id: string | null;
  key: string;
  name: string;
  briefing: string;
  situation: string;
  summary: string | null;
  status: JourneyStatus;
  sort_order: number | null;
  show_in_sidebar: number;
  created_at: number;
  updated_at: number;
}

export interface JourneyFields {
  name?: string;
  briefing?: string;
  situation?: string;
}

export function createJourney(
  db: Database.Database,
  userId: string,
  key: string,
  name: string,
  briefing: string = "",
  situation: string = "",
  organizationId: string | null = null,
): Journey {
  const now = Date.now();
  const journey: Journey = {
    id: randomUUID(),
    user_id: userId,
    organization_id: organizationId,
    key,
    name,
    briefing,
    situation,
    summary: null,
    status: "active",
    sort_order: null,
    show_in_sidebar: 1,
    created_at: now,
    updated_at: now,
  };
  db.prepare(
    `INSERT INTO journeys (id, user_id, organization_id, key, name, briefing, situation, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
  ).run(
    journey.id,
    journey.user_id,
    journey.organization_id,
    journey.key,
    journey.name,
    journey.briefing,
    journey.situation,
    journey.created_at,
    journey.updated_at,
  );
  return journey;
}

export function updateJourney(
  db: Database.Database,
  userId: string,
  key: string,
  fields: JourneyFields,
): Journey | undefined {
  const current = getJourneyByKey(db, userId, key);
  if (!current) return undefined;

  const next = {
    name: fields.name ?? current.name,
    briefing: fields.briefing ?? current.briefing,
    situation: fields.situation ?? current.situation,
    updated_at: Date.now(),
  };

  db.prepare(
    `UPDATE journeys
     SET name = ?, briefing = ?, situation = ?, updated_at = ?
     WHERE user_id = ? AND key = ?`,
  ).run(next.name, next.briefing, next.situation, next.updated_at, userId, key);

  return getJourneyByKey(db, userId, key);
}

export function setJourneySummary(
  db: Database.Database,
  userId: string,
  key: string,
  summary: string,
): void {
  db.prepare(
    "UPDATE journeys SET summary = ?, updated_at = ? WHERE user_id = ? AND key = ?",
  ).run(summary, Date.now(), userId, key);
}

/**
 * Link or unlink a journey's organization. Pass `null` to unlink.
 * The caller is responsible for ensuring the organization belongs to the
 * same user — this helper does not cross-check ownership.
 */
export function linkJourneyOrganization(
  db: Database.Database,
  userId: string,
  journeyKey: string,
  organizationId: string | null,
): boolean {
  const result = db
    .prepare(
      "UPDATE journeys SET organization_id = ?, updated_at = ? WHERE user_id = ? AND key = ?",
    )
    .run(organizationId, Date.now(), userId, journeyKey);
  return result.changes > 0;
}

export function archiveJourney(
  db: Database.Database,
  userId: string,
  key: string,
): boolean {
  const result = db
    .prepare(
      "UPDATE journeys SET status = 'archived', updated_at = ? WHERE user_id = ? AND key = ? AND status = 'active'",
    )
    .run(Date.now(), userId, key);
  return result.changes > 0;
}

export function unarchiveJourney(
  db: Database.Database,
  userId: string,
  key: string,
): boolean {
  const result = db
    .prepare(
      "UPDATE journeys SET status = 'active', updated_at = ? WHERE user_id = ? AND key = ? AND status = 'archived'",
    )
    .run(Date.now(), userId, key);
  return result.changes > 0;
}

export function deleteJourney(
  db: Database.Database,
  userId: string,
  key: string,
): boolean {
  const result = db
    .prepare("DELETE FROM journeys WHERE user_id = ? AND key = ?")
    .run(userId, key);
  return result.changes > 0;
}

export interface GetJourneysOptions {
  includeArchived?: boolean;
  organizationId?: string | null;
  sidebarOnly?: boolean;
}

export function getJourneys(
  db: Database.Database,
  userId: string,
  options: GetJourneysOptions = {},
): Journey[] {
  const conditions: string[] = ["user_id = ?"];
  const params: unknown[] = [userId];

  if (!options.includeArchived) {
    conditions.push("status = 'active'");
  }

  if (options.organizationId !== undefined) {
    if (options.organizationId === null) {
      conditions.push("organization_id IS NULL");
    } else {
      conditions.push("organization_id = ?");
      params.push(options.organizationId);
    }
  }

  if (options.sidebarOnly) {
    conditions.push("show_in_sidebar = 1");
  }

  // `sort_order IS NULL` pushes NULL rows (freshly created, not yet placed)
  // to the end of the list; ties within NULL fall back to name alphabetically.
  // When including archived items, status leads so archived cluster at the
  // bottom, preserving prior behavior.
  const prefix = options.includeArchived ? "status, " : "";
  const sql = `SELECT * FROM journeys WHERE ${conditions.join(" AND ")} ORDER BY ${prefix}sort_order IS NULL, sort_order ASC, name ASC`;
  return db.prepare(sql).all(...params) as Journey[];
}

export function getJourneyByKey(
  db: Database.Database,
  userId: string,
  key: string,
): Journey | undefined {
  return db
    .prepare("SELECT * FROM journeys WHERE user_id = ? AND key = ?")
    .get(userId, key) as Journey | undefined;
}

export function setJourneyShowInSidebar(
  db: Database.Database,
  userId: string,
  key: string,
  visible: boolean,
): boolean {
  const result = db
    .prepare(
      "UPDATE journeys SET show_in_sidebar = ?, updated_at = ? WHERE user_id = ? AND key = ?",
    )
    .run(visible ? 1 : 0, Date.now(), userId, key);
  return result.changes > 0;
}

/**
 * Move a journey up or down by swapping sort_order with the adjacent
 * visible sibling. Sibling = same user, same active status — the swap
 * is now flat across all journeys, not per-organization. Returns true
 * if a swap happened, false if the journey was already at the edge or
 * the key wasn't found.
 *
 * This used to filter by organization_id to keep swaps within a rendered
 * group on `/journeys`, but the page was restructured into a flat list
 * with an org badge per row — so the group-local constraint no longer
 * matches what the user sees and just prevented legitimate cross-org
 * ordering.
 */
export function moveJourney(
  db: Database.Database,
  userId: string,
  key: string,
  direction: "up" | "down",
): boolean {
  const current = getJourneyByKey(db, userId, key);
  if (!current) return false;

  const params: Record<string, unknown> = {
    userId,
    status: current.status,
    currentOrder: current.sort_order,
    currentName: current.name,
  };

  // Siblings share user and status. We resolve an order vector by name
  // when sort_order is still NULL for some rows (rare after the migration
  // seed, but possible for freshly created journeys).
  const neighborSql =
    direction === "up"
      ? `SELECT * FROM journeys
         WHERE user_id = @userId AND status = @status
           AND (
             (sort_order IS NOT NULL AND @currentOrder IS NOT NULL AND sort_order < @currentOrder)
             OR (sort_order IS NULL AND @currentOrder IS NULL AND name < @currentName)
             OR (sort_order IS NOT NULL AND @currentOrder IS NULL)
           )
         ORDER BY sort_order IS NULL, sort_order DESC, name DESC
         LIMIT 1`
      : `SELECT * FROM journeys
         WHERE user_id = @userId AND status = @status
           AND (
             (sort_order IS NOT NULL AND @currentOrder IS NOT NULL AND sort_order > @currentOrder)
             OR (sort_order IS NULL AND @currentOrder IS NULL AND name > @currentName)
             OR (sort_order IS NULL AND @currentOrder IS NOT NULL)
           )
         ORDER BY sort_order IS NULL, sort_order ASC, name ASC
         LIMIT 1`;

  const neighbor = db.prepare(neighborSql).get(params) as Journey | undefined;
  if (!neighbor) return false;

  swapJourneyOrder(db, current, neighbor);
  return true;
}

/**
 * Swap the sort_order of two journeys. Assigns fresh sequential values
 * when either side is NULL so the swap always produces two comparable
 * integers (otherwise a swap that kept one NULL would not move the row
 * relative to a third sibling).
 */
function swapJourneyOrder(
  db: Database.Database,
  a: Journey,
  b: Journey,
): void {
  const now = Date.now();
  // If either side is NULL, resolve to a concrete pair of integers based
  // on current name order so the swap is meaningful.
  let aOrder = a.sort_order;
  let bOrder = b.sort_order;
  if (aOrder === null || bOrder === null) {
    const max = db
      .prepare(
        "SELECT COALESCE(MAX(sort_order), -1) AS max FROM journeys WHERE user_id = ?",
      )
      .get(a.user_id) as { max: number };
    if (aOrder === null) aOrder = max.max + 1;
    if (bOrder === null) bOrder = Math.max(max.max + 2, aOrder + 1);
  }

  const tx = db.transaction(() => {
    db.prepare(
      "UPDATE journeys SET sort_order = ?, updated_at = ? WHERE id = ?",
    ).run(bOrder, now, a.id);
    db.prepare(
      "UPDATE journeys SET sort_order = ?, updated_at = ? WHERE id = ?",
    ).run(aOrder, now, b.id);
  });
  tx();
}
