import { describe, it, expect, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import {
  openDb,
  createUser,
  appendEntry,
  insertDivergentRun,
  loadDivergentRunsByParent,
  loadDivergentRunsBySession,
  deleteDivergentRun,
} from "../server/db.js";
import { createSessionAt } from "../server/db/sessions.js";

describe("divergent_runs persistence (CV1.E7.S8)", () => {
  let db: Database.Database;
  let userId: string;
  let sessionId: string;
  let parentEntryId: string;

  beforeEach(() => {
    db = openDb(":memory:");
    userId = createUser(db, "alice", "hash").id;
    sessionId = createSessionAt(db, userId, "s", 1000);
    parentEntryId = appendEntry(
      db,
      sessionId,
      null,
      "message",
      { role: "assistant", content: [{ type: "text", text: "canonical" }] },
      1001,
    );
  });

  it("inserts and loads a divergent run by parent", () => {
    const id = insertDivergentRun(db, {
      parent_entry_id: parentEntryId,
      override_type: "persona",
      override_key: "maker",
      content: "what maker would say",
      meta: { model: "gpt-4o", tokens: 100 },
      created_at: 2000,
    });

    const list = loadDivergentRunsByParent(db, parentEntryId);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(id);
    expect(list[0].override_type).toBe("persona");
    expect(list[0].override_key).toBe("maker");
    expect(list[0].content).toBe("what maker would say");
    expect(list[0].meta).toEqual({ model: "gpt-4o", tokens: 100 });
    expect(list[0].created_at).toBe(2000);
  });

  it("returns empty array when parent has no divergent runs", () => {
    expect(loadDivergentRunsByParent(db, parentEntryId)).toEqual([]);
  });

  it("orders divergent runs by created_at ascending", () => {
    insertDivergentRun(db, {
      parent_entry_id: parentEntryId,
      override_type: "persona",
      override_key: "second",
      content: "B",
      created_at: 3000,
    });
    insertDivergentRun(db, {
      parent_entry_id: parentEntryId,
      override_type: "persona",
      override_key: "first",
      content: "A",
      created_at: 2000,
    });
    const list = loadDivergentRunsByParent(db, parentEntryId);
    expect(list.map((r) => r.override_key)).toEqual(["first", "second"]);
  });

  it("loadDivergentRunsBySession groups by parent_entry_id", () => {
    const otherEntry = appendEntry(
      db,
      sessionId,
      null,
      "message",
      { role: "assistant", content: [{ type: "text", text: "other" }] },
      1500,
    );
    insertDivergentRun(db, {
      parent_entry_id: parentEntryId,
      override_type: "persona",
      override_key: "a",
      content: "A",
      created_at: 2000,
    });
    insertDivergentRun(db, {
      parent_entry_id: parentEntryId,
      override_type: "journey",
      override_key: "b",
      content: "B",
      created_at: 2100,
    });
    insertDivergentRun(db, {
      parent_entry_id: otherEntry,
      override_type: "organization",
      override_key: "c",
      content: "C",
      created_at: 2200,
    });

    const map = loadDivergentRunsBySession(db, sessionId);
    expect(map.size).toBe(2);
    expect(map.get(parentEntryId)).toHaveLength(2);
    expect(map.get(otherEntry)).toHaveLength(1);
    expect(map.get(otherEntry)![0].override_key).toBe("c");
  });

  it("loadDivergentRunsBySession returns empty map when session has none", () => {
    expect(loadDivergentRunsBySession(db, sessionId).size).toBe(0);
  });

  it("loadDivergentRunsBySession only returns runs for the queried session", () => {
    // A second session with its own divergent run.
    const otherSession = createSessionAt(db, userId, "other", 1100);
    const otherEntry = appendEntry(
      db,
      otherSession,
      null,
      "message",
      { role: "assistant", content: [{ type: "text", text: "other" }] },
      1101,
    );
    insertDivergentRun(db, {
      parent_entry_id: otherEntry,
      override_type: "persona",
      override_key: "leak",
      content: "leak",
      created_at: 2000,
    });
    insertDivergentRun(db, {
      parent_entry_id: parentEntryId,
      override_type: "persona",
      override_key: "ok",
      content: "ok",
      created_at: 2100,
    });

    const map = loadDivergentRunsBySession(db, sessionId);
    expect(map.size).toBe(1);
    expect(map.get(parentEntryId)![0].override_key).toBe("ok");
    expect(map.has(otherEntry)).toBe(false);
  });

  it("cascades on parent entry delete (forget-turn)", () => {
    insertDivergentRun(db, {
      parent_entry_id: parentEntryId,
      override_type: "persona",
      override_key: "doomed",
      content: "doomed",
      created_at: 2000,
    });
    expect(loadDivergentRunsByParent(db, parentEntryId)).toHaveLength(1);

    // Forget the parent entry directly (mimicking what forget-turn does).
    db.prepare("PRAGMA foreign_keys = ON").run();
    db.prepare("DELETE FROM entries WHERE id = ?").run(parentEntryId);

    expect(loadDivergentRunsByParent(db, parentEntryId)).toEqual([]);
  });

  it("deleteDivergentRun removes a single row by id", () => {
    const id = insertDivergentRun(db, {
      parent_entry_id: parentEntryId,
      override_type: "persona",
      override_key: "k",
      content: "x",
      created_at: 2000,
    });
    expect(loadDivergentRunsByParent(db, parentEntryId)).toHaveLength(1);
    deleteDivergentRun(db, id);
    expect(loadDivergentRunsByParent(db, parentEntryId)).toEqual([]);
  });

  it("divergent runs do NOT enter loadMessages output (the agent's history feed)", async () => {
    // The whole point of a separate table: loadMessages — which feeds
    // the next turn's Agent — must never see divergent runs. They are
    // a side branch, not a continuation of the canonical conversation.
    const { loadMessages } = await import("../server/db.js");

    // Add a few canonical messages.
    appendEntry(
      db,
      sessionId,
      null,
      "message",
      { role: "user", content: [{ type: "text", text: "hello" }] },
      1500,
    );
    appendEntry(
      db,
      sessionId,
      null,
      "message",
      { role: "assistant", content: [{ type: "text", text: "hi back" }] },
      1501,
    );

    // Add divergent runs against the original parentEntryId.
    insertDivergentRun(db, {
      parent_entry_id: parentEntryId,
      override_type: "persona",
      override_key: "maker",
      content: "DIVERGENT_CONTENT_THAT_SHOULD_NEVER_APPEAR",
      created_at: 2000,
    });
    insertDivergentRun(db, {
      parent_entry_id: parentEntryId,
      override_type: "journey",
      override_key: "vida",
      content: "ANOTHER_DIVERGENT",
      created_at: 2100,
    });

    const messages = loadMessages(db, sessionId);
    // 3 canonical entries (the original assistant + the user + the new
    // assistant added above), divergent runs absent.
    expect(messages).toHaveLength(3);
    const allText = JSON.stringify(messages);
    expect(allText).not.toContain("DIVERGENT_CONTENT_THAT_SHOULD_NEVER_APPEAR");
    expect(allText).not.toContain("ANOTHER_DIVERGENT");
  });

  it("meta column accepts null", () => {
    insertDivergentRun(db, {
      parent_entry_id: parentEntryId,
      override_type: "persona",
      override_key: "k",
      content: "x",
      meta: null,
      created_at: 2000,
    });
    const list = loadDivergentRunsByParent(db, parentEntryId);
    expect(list[0].meta).toBeNull();
  });
});
