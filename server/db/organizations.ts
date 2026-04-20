import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

export type OrganizationStatus = "active" | "archived";

export interface Organization {
  id: string;
  user_id: string;
  key: string;
  name: string;
  briefing: string;
  situation: string;
  summary: string | null;
  status: OrganizationStatus;
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
    created_at: now,
    updated_at: now,
  };
  db.prepare(
    `INSERT INTO organizations (id, user_id, key, name, briefing, situation, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
  ).run(org.id, org.user_id, org.key, org.name, org.briefing, org.situation, org.created_at, org.updated_at);
  return org;
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
      "UPDATE organizations SET status = 'archived', updated_at = ? WHERE user_id = ? AND key = ? AND status = 'active'",
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
}

export function getOrganizations(
  db: Database.Database,
  userId: string,
  options: GetOrganizationsOptions = {},
): Organization[] {
  const sql = options.includeArchived
    ? "SELECT * FROM organizations WHERE user_id = ? ORDER BY status, name"
    : "SELECT * FROM organizations WHERE user_id = ? AND status = 'active' ORDER BY name";
  return db.prepare(sql).all(userId) as Organization[];
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
