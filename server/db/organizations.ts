import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

export type OrganizationStatus = "active" | "concluded" | "archived";

export interface Organization {
  id: string;
  user_id: string;
  key: string;
  name: string;
  briefing: string;
  situation: string;
  summary: string | null;
  status: OrganizationStatus;
  sort_order: number | null;
  show_in_sidebar: number;
  /**
   * Stub flag (CV1.E11.S7). Set to 1 by the cena form's inline
   * sub-creation; flipped back to 0 by the workshop's save handler
   * (promote-on-edit).
   */
  is_draft: number;
  created_at: number;
  updated_at: number;
}

export interface OrganizationFields {
  name?: string;
  briefing?: string;
  situation?: string;
}

export function createOrganization(
  db: Database.Database,
  userId: string,
  key: string,
  name: string,
  briefing: string = "",
  situation: string = "",
  isDraft: boolean = false,
): Organization {
  const now = Date.now();
  const org: Organization = {
    id: randomUUID(),
    user_id: userId,
    key,
    name,
    briefing,
    situation,
    summary: null,
    status: "active",
    sort_order: null,
    show_in_sidebar: 1,
    is_draft: isDraft ? 1 : 0,
    created_at: now,
    updated_at: now,
  };
  db.prepare(
    `INSERT INTO organizations (id, user_id, key, name, briefing, situation, status, is_draft, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
  ).run(
    org.id,
    org.user_id,
    org.key,
    org.name,
    org.briefing,
    org.situation,
    org.is_draft,
    org.created_at,
    org.updated_at,
  );
  return org;
}

/**
 * Flip the is_draft flag on an organization. Returns true on success,
 * false on miss. Workshop save handlers call this with `false` to
 * promote a stub created via cena form (CV1.E11.S7).
 */
export function setOrganizationIsDraft(
  db: Database.Database,
  userId: string,
  key: string,
  isDraft: boolean,
): boolean {
  const result = db
    .prepare(
      "UPDATE organizations SET is_draft = ? WHERE user_id = ? AND key = ?",
    )
    .run(isDraft ? 1 : 0, userId, key);
  return result.changes > 0;
}

export function updateOrganization(
  db: Database.Database,
  userId: string,
  key: string,
  fields: OrganizationFields,
): Organization | undefined {
  const current = getOrganizationByKey(db, userId, key);
  if (!current) return undefined;

  const next = {
    name: fields.name ?? current.name,
    briefing: fields.briefing ?? current.briefing,
    situation: fields.situation ?? current.situation,
    updated_at: Date.now(),
  };

  db.prepare(
    `UPDATE organizations
     SET name = ?, briefing = ?, situation = ?, updated_at = ?
     WHERE user_id = ? AND key = ?`,
  ).run(next.name, next.briefing, next.situation, next.updated_at, userId, key);

  return getOrganizationByKey(db, userId, key);
}

export function setOrganizationSummary(
  db: Database.Database,
  userId: string,
  key: string,
  summary: string,
): void {
  db.prepare(
    "UPDATE organizations SET summary = ?, updated_at = ? WHERE user_id = ? AND key = ?",
  ).run(summary, Date.now(), userId, key);
}

export function archiveOrganization(
  db: Database.Database,
  userId: string,
  key: string,
): boolean {
  const result = db
    .prepare(
      "UPDATE organizations SET status = 'archived', updated_at = ? WHERE user_id = ? AND key = ? AND status != 'archived'",
    )
    .run(Date.now(), userId, key);
  return result.changes > 0;
}

export function unarchiveOrganization(
  db: Database.Database,
  userId: string,
  key: string,
): boolean {
  const result = db
    .prepare(
      "UPDATE organizations SET status = 'active', updated_at = ? WHERE user_id = ? AND key = ? AND status = 'archived'",
    )
    .run(Date.now(), userId, key);
  return result.changes > 0;
}

/**
 * Mark an organization as concluded — its activity is complete.
 * Concluded orgs leave the sidebar but remain available to reception
 * routing, visible on /organizations in their own band. Only succeeds
 * if the organization is currently active.
 */
export function concludeOrganization(
  db: Database.Database,
  userId: string,
  key: string,
): boolean {
  const result = db
    .prepare(
      "UPDATE organizations SET status = 'concluded', updated_at = ? WHERE user_id = ? AND key = ? AND status = 'active'",
    )
    .run(Date.now(), userId, key);
  return result.changes > 0;
}

/**
 * Reopen a concluded organization back to active. See `reopenJourney`
 * for why this is a separate verb from `unarchive`.
 */
export function reopenOrganization(
  db: Database.Database,
  userId: string,
  key: string,
): boolean {
  const result = db
    .prepare(
      "UPDATE organizations SET status = 'active', updated_at = ? WHERE user_id = ? AND key = ? AND status = 'concluded'",
    )
    .run(Date.now(), userId, key);
  return result.changes > 0;
}

/**
 * Delete an organization. Journeys linked to it survive with
 * organization_id = NULL (they become personal). Runs in a transaction
 * so the unlink and the delete either both land or neither does.
 */
export function deleteOrganization(
  db: Database.Database,
  userId: string,
  key: string,
): boolean {
  const org = getOrganizationByKey(db, userId, key);
  if (!org) return false;

  const tx = db.transaction(() => {
    db.prepare(
      "UPDATE journeys SET organization_id = NULL, updated_at = ? WHERE organization_id = ?",
    ).run(Date.now(), org.id);
    db.prepare("DELETE FROM organizations WHERE id = ?").run(org.id);
  });
  tx();
  return true;
}

export interface GetOrganizationsOptions {
  includeArchived?: boolean;
  includeConcluded?: boolean;
  sidebarOnly?: boolean;
}

export function getOrganizations(
  db: Database.Database,
  userId: string,
  options: GetOrganizationsOptions = {},
): Organization[] {
  const conditions: string[] = ["user_id = ?"];
  const params: unknown[] = [userId];

  const statuses: string[] = ["active"];
  if (options.includeConcluded) statuses.push("concluded");
  if (options.includeArchived) statuses.push("archived");
  if (statuses.length === 1) {
    conditions.push("status = ?");
    params.push(statuses[0]);
  } else {
    const placeholders = statuses.map(() => "?").join(", ");
    conditions.push(`status IN (${placeholders})`);
    params.push(...statuses);
  }

  if (options.sidebarOnly) {
    conditions.push("show_in_sidebar = 1");
  }

  const prefix = statuses.length > 1 ? "status, " : "";
  const sql = `SELECT * FROM organizations WHERE ${conditions.join(" AND ")} ORDER BY ${prefix}sort_order IS NULL, sort_order ASC, name ASC`;
  return db.prepare(sql).all(...params) as Organization[];
}

export function getOrganizationByKey(
  db: Database.Database,
  userId: string,
  key: string,
): Organization | undefined {
  return db
    .prepare("SELECT * FROM organizations WHERE user_id = ? AND key = ?")
    .get(userId, key) as Organization | undefined;
}

export function setOrganizationShowInSidebar(
  db: Database.Database,
  userId: string,
  key: string,
  visible: boolean,
): boolean {
  const result = db
    .prepare(
      "UPDATE organizations SET show_in_sidebar = ?, updated_at = ? WHERE user_id = ? AND key = ?",
    )
    .run(visible ? 1 : 0, Date.now(), userId, key);
  return result.changes > 0;
}

/**
 * Move an organization up or down by swapping sort_order with the adjacent
 * visible sibling (same user, same active status). Returns true if a swap
 * happened, false if the org was already at the edge or the key wasn't
 * found.
 */
export function moveOrganization(
  db: Database.Database,
  userId: string,
  key: string,
  direction: "up" | "down",
): boolean {
  const current = getOrganizationByKey(db, userId, key);
  if (!current) return false;

  const params = {
    userId,
    status: current.status,
    currentOrder: current.sort_order,
    currentName: current.name,
  };

  const neighborSql =
    direction === "up"
      ? `SELECT * FROM organizations
         WHERE user_id = @userId AND status = @status
           AND (
             (sort_order IS NOT NULL AND @currentOrder IS NOT NULL AND sort_order < @currentOrder)
             OR (sort_order IS NULL AND @currentOrder IS NULL AND name < @currentName)
             OR (sort_order IS NOT NULL AND @currentOrder IS NULL)
           )
         ORDER BY sort_order IS NULL, sort_order DESC, name DESC
         LIMIT 1`
      : `SELECT * FROM organizations
         WHERE user_id = @userId AND status = @status
           AND (
             (sort_order IS NOT NULL AND @currentOrder IS NOT NULL AND sort_order > @currentOrder)
             OR (sort_order IS NULL AND @currentOrder IS NULL AND name > @currentName)
             OR (sort_order IS NULL AND @currentOrder IS NOT NULL)
           )
         ORDER BY sort_order IS NULL, sort_order ASC, name ASC
         LIMIT 1`;

  const neighbor = db.prepare(neighborSql).get(params) as Organization | undefined;
  if (!neighbor) return false;

  swapOrganizationOrder(db, current, neighbor);
  return true;
}

function swapOrganizationOrder(
  db: Database.Database,
  a: Organization,
  b: Organization,
): void {
  const now = Date.now();
  let aOrder = a.sort_order;
  let bOrder = b.sort_order;
  if (aOrder === null || bOrder === null) {
    const max = db
      .prepare(
        "SELECT COALESCE(MAX(sort_order), -1) AS max FROM organizations WHERE user_id = ?",
      )
      .get(a.user_id) as { max: number };
    if (aOrder === null) aOrder = max.max + 1;
    if (bOrder === null) bOrder = Math.max(max.max + 2, aOrder + 1);
  }

  const tx = db.transaction(() => {
    db.prepare(
      "UPDATE organizations SET sort_order = ?, updated_at = ? WHERE id = ?",
    ).run(bOrder, now, a.id);
    db.prepare(
      "UPDATE organizations SET sort_order = ?, updated_at = ? WHERE id = ?",
    ).run(aOrder, now, b.id);
  });
  tx();
}
