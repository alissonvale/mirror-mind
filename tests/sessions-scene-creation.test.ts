import { describe, it, expect, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import {
  openDb,
  createUser,
  createFreshSession,
  createScene,
} from "../server/db.js";

describe("createFreshSession with sceneId (CV1.E11.S7)", () => {
  let db: Database.Database;
  let userId: string;

  beforeEach(() => {
    db = openDb(":memory:");
    const user = createUser(db, "u", "h");
    userId = user.id;
  });

  it("createFreshSession() with no sceneId keeps backward-compat (NULL)", () => {
    const sessId = createFreshSession(db, userId);
    const row = db
      .prepare("SELECT scene_id FROM sessions WHERE id = ?")
      .get(sessId) as { scene_id: string | null };
    expect(row.scene_id).toBeNull();
  });

  it("createFreshSession() with explicit null is identical to no arg", () => {
    const sessId = createFreshSession(db, userId, null);
    const row = db
      .prepare("SELECT scene_id FROM sessions WHERE id = ?")
      .get(sessId) as { scene_id: string | null };
    expect(row.scene_id).toBeNull();
  });

  it("createFreshSession() with sceneId stamps it on the new session row", () => {
    const cena = createScene(db, userId, "k", { title: "T" });
    const sessId = createFreshSession(db, userId, cena.id);
    const row = db
      .prepare("SELECT scene_id FROM sessions WHERE id = ?")
      .get(sessId) as { scene_id: string | null };
    expect(row.scene_id).toBe(cena.id);
  });
});
