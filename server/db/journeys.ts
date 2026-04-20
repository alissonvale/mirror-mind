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

  const sql = `SELECT * FROM journeys WHERE ${conditions.join(" AND ")} ORDER BY ${
    options.includeArchived ? "status, name" : "name"
  }`;
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
