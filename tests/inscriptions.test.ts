import { describe, it, expect, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import { createHash } from "node:crypto";
import {
  openDb,
  createUser,
  createInscription,
  getInscriptionById,
  listActiveInscriptions,
  listArchivedInscriptions,
  updateInscription,
  pinInscription,
  unpinInscription,
  archiveInscription,
  unarchiveInscription,
} from "../server/db.js";
import {
  pickInscriptionForToday,
  pickRotatingMagnetForToday,
} from "../server/mirror/inscription-picker.js";

const DAY = 24 * 60 * 60 * 1000;

function setup() {
  const db = openDb(":memory:");
  const hash = createHash("sha256").update("ins-test").digest("hex");
  const user = createUser(db, "insuser", hash);
  return { db, userId: user.id };
}

describe("db/inscriptions — CRUD", () => {
  let db: Database.Database;
  let userId: string;
  beforeEach(() => ({ db, userId } = setup()));

  it("creates an inscription with text + optional author", () => {
    const i = createInscription(db, userId, "Festina lente.", "Augustus");
    expect(i.id).toBeTruthy();
    expect(i.text).toBe("Festina lente.");
    expect(i.author).toBe("Augustus");
    expect(i.pinned_at).toBeNull();
    expect(i.archived_at).toBeNull();
  });

  it("creates an inscription without author (null)", () => {
    const i = createInscription(db, userId, "respira.");
    expect(i.author).toBeNull();
  });

  it("listActiveInscriptions returns only non-archived rows, ordered by created_at", () => {
    const a = createInscription(db, userId, "first", null, 1000);
    const b = createInscription(db, userId, "second", null, 2000);
    const c = createInscription(db, userId, "third", null, 3000);
    archiveInscription(db, userId, b.id);

    const active = listActiveInscriptions(db, userId);
    expect(active.map((i) => i.id)).toEqual([a.id, c.id]);
  });

  it("listArchivedInscriptions returns archived rows, most recent first", () => {
    const a = createInscription(db, userId, "first", null, 1000);
    const b = createInscription(db, userId, "second", null, 2000);
    archiveInscription(db, userId, a.id, 5000);
    archiveInscription(db, userId, b.id, 6000);

    const archived = listArchivedInscriptions(db, userId);
    expect(archived.map((i) => i.id)).toEqual([b.id, a.id]);
  });

  it("updateInscription rewrites text and author", () => {
    const i = createInscription(db, userId, "old", "old-author");
    const updated = updateInscription(db, userId, i.id, "new", "new-author");
    expect(updated?.text).toBe("new");
    expect(updated?.author).toBe("new-author");
  });

  it("updateInscription accepts null author (clearing)", () => {
    const i = createInscription(db, userId, "x", "author");
    const updated = updateInscription(db, userId, i.id, "x", null);
    expect(updated?.author).toBeNull();
  });

  it("pin/unpin toggles pinned_at", () => {
    const i = createInscription(db, userId, "x");
    pinInscription(db, userId, i.id, 5000);
    expect(getInscriptionById(db, userId, i.id)?.pinned_at).toBe(5000);
    unpinInscription(db, userId, i.id);
    expect(getInscriptionById(db, userId, i.id)?.pinned_at).toBeNull();
  });

  it("archive clears pinned_at (an archived inscription cannot be the anchor)", () => {
    const i = createInscription(db, userId, "x");
    pinInscription(db, userId, i.id, 5000);
    archiveInscription(db, userId, i.id, 6000);
    const after = getInscriptionById(db, userId, i.id);
    expect(after?.archived_at).toBe(6000);
    expect(after?.pinned_at).toBeNull();
  });

  it("unarchive restores the row to active", () => {
    const i = createInscription(db, userId, "x");
    archiveInscription(db, userId, i.id);
    expect(listActiveInscriptions(db, userId)).toHaveLength(0);
    unarchiveInscription(db, userId, i.id);
    expect(listActiveInscriptions(db, userId)).toHaveLength(1);
  });

  it("operations are scoped by user_id (other users cannot read or mutate)", () => {
    const otherHash = createHash("sha256").update("other").digest("hex");
    const other = createUser(db, "otheruser", otherHash);
    const mine = createInscription(db, userId, "mine");

    // foreign read returns null
    expect(getInscriptionById(db, other.id, mine.id)).toBeNull();
    // foreign update is a no-op
    updateInscription(db, other.id, mine.id, "hijacked", null);
    expect(getInscriptionById(db, userId, mine.id)?.text).toBe("mine");
    // foreign archive is a no-op
    archiveInscription(db, other.id, mine.id);
    expect(getInscriptionById(db, userId, mine.id)?.archived_at).toBeNull();
  });
});

describe("mirror/inscription-picker — pickInscriptionForToday", () => {
  let db: Database.Database;
  let userId: string;
  beforeEach(() => ({ db, userId } = setup()));

  it("returns null when there are no active inscriptions", () => {
    expect(pickInscriptionForToday(db, userId)).toBeNull();
  });

  it("returns null when all inscriptions are archived", () => {
    const i = createInscription(db, userId, "x");
    archiveInscription(db, userId, i.id);
    expect(pickInscriptionForToday(db, userId)).toBeNull();
  });

  it("a single pinned inscription wins over rotation", () => {
    createInscription(db, userId, "rotated A", null, 1000);
    const pinned = createInscription(db, userId, "PINNED", null, 2000);
    createInscription(db, userId, "rotated B", null, 3000);
    pinInscription(db, userId, pinned.id, 4000);

    const picked = pickInscriptionForToday(db, userId);
    expect(picked?.id).toBe(pinned.id);
  });

  it("when multiple pinned exist, the most recently pinned wins", () => {
    const a = createInscription(db, userId, "a");
    const b = createInscription(db, userId, "b");
    pinInscription(db, userId, a.id, 1000);
    pinInscription(db, userId, b.id, 2000);

    expect(pickInscriptionForToday(db, userId)?.id).toBe(b.id);
  });

  it("rotation is stable within the same day for the same user", () => {
    createInscription(db, userId, "a");
    createInscription(db, userId, "b");
    createInscription(db, userId, "c");

    const t1 = Date.UTC(2026, 4, 3, 9, 0, 0);
    const t2 = Date.UTC(2026, 4, 3, 23, 30, 0);
    expect(pickInscriptionForToday(db, userId, t1)?.id).toBe(
      pickInscriptionForToday(db, userId, t2)?.id,
    );
  });

  it("rotation produces (at least sometimes) different picks across consecutive days", () => {
    // With 7 active inscriptions across 14 days, the picker should
    // visit at least 2 distinct ids — otherwise the hash isn't doing
    // its job.
    for (let i = 0; i < 7; i++) {
      createInscription(db, userId, `text-${i}`);
    }
    const seen = new Set<string>();
    for (let day = 0; day < 14; day++) {
      const ts = Date.UTC(2026, 4, 3) + day * DAY;
      const picked = pickInscriptionForToday(db, userId, ts);
      if (picked) seen.add(picked.id);
    }
    expect(seen.size).toBeGreaterThanOrEqual(2);
  });
});

describe("mirror/inscription-picker — pickRotatingMagnetForToday", () => {
  let db: Database.Database;
  let userId: string;
  beforeEach(() => ({ db, userId } = setup()));

  it("returns null when there are no non-pinned inscriptions", () => {
    expect(pickRotatingMagnetForToday(db, userId)).toBeNull();
    const i = createInscription(db, userId, "x");
    pinInscription(db, userId, i.id);
    expect(pickRotatingMagnetForToday(db, userId)).toBeNull();
  });

  it("never returns a pinned inscription", () => {
    const a = createInscription(db, userId, "a");
    const b = createInscription(db, userId, "b");
    pinInscription(db, userId, a.id);
    // Across many days, b should always be picked (a is pinned, excluded)
    for (let day = 0; day < 14; day++) {
      const ts = Date.UTC(2026, 4, 3) + day * DAY;
      expect(pickRotatingMagnetForToday(db, userId, ts)?.id).toBe(b.id);
    }
  });

  it("excludes the given excludeId from the rotation pool", () => {
    const a = createInscription(db, userId, "a");
    const b = createInscription(db, userId, "b");
    // Excluding A → picker can only return B
    for (let day = 0; day < 14; day++) {
      const ts = Date.UTC(2026, 4, 3) + day * DAY;
      expect(pickRotatingMagnetForToday(db, userId, ts, a.id)?.id).toBe(b.id);
    }
  });

  it("returns null when excludeId leaves no candidates", () => {
    const only = createInscription(db, userId, "only");
    expect(pickRotatingMagnetForToday(db, userId, Date.now(), only.id)).toBeNull();
  });

  it("rotation is stable within a day across calls", () => {
    createInscription(db, userId, "a");
    createInscription(db, userId, "b");
    createInscription(db, userId, "c");
    const t1 = Date.UTC(2026, 4, 3, 9, 0, 0);
    const t2 = Date.UTC(2026, 4, 3, 22, 0, 0);
    expect(pickRotatingMagnetForToday(db, userId, t1)?.id).toBe(
      pickRotatingMagnetForToday(db, userId, t2)?.id,
    );
  });
});
