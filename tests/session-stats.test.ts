import { describe, it, expect, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import {
  openDb,
  createUser,
  getOrCreateSession,
  appendEntry,
} from "../server/db.js";
import { computeSessionStats } from "../server/session-stats.js";

function userMsg(text: string) {
  return { role: "user", content: text };
}

function assistantMsg(text: string) {
  return { role: "assistant", content: [{ type: "text", text }] };
}

describe("computeSessionStats", () => {
  let db: Database.Database;
  let sessionId: string;

  beforeEach(() => {
    db = openDb(":memory:");
    const user = createUser(db, "tester", "hash");
    sessionId = getOrCreateSession(db, user.id);
  });

  it("returns zeros on an empty session", () => {
    const stats = computeSessionStats(db, sessionId);
    expect(stats.messages).toBe(0);
    expect(stats.tokensIn).toBe(0);
    expect(stats.tokensOut).toBe(0);
    expect(stats.costBRL).not.toBeNull();
    expect(stats.costBRL).toBe(0);
    expect(stats.model).toBeTruthy();
  });

  it("counts user and assistant messages separately", () => {
    appendEntry(db, sessionId, null, "message", userMsg("hello"));
    appendEntry(db, sessionId, null, "message", assistantMsg("hi there"));
    appendEntry(db, sessionId, null, "message", userMsg("how are you"));
    const stats = computeSessionStats(db, sessionId);
    expect(stats.messages).toBe(3);
    expect(stats.tokensIn).toBeGreaterThan(0);
    expect(stats.tokensOut).toBeGreaterThan(0);
  });

  it("approximates tokens as chars/4 per role", () => {
    const userText = "a".repeat(40); // ~10 tokens
    const assistantText = "b".repeat(80); // ~20 tokens
    appendEntry(db, sessionId, null, "message", userMsg(userText));
    appendEntry(db, sessionId, null, "message", assistantMsg(assistantText));
    const stats = computeSessionStats(db, sessionId);
    expect(stats.tokensIn).toBe(10);
    expect(stats.tokensOut).toBe(20);
  });

  it("derives cost from configured BRL rates when tokens are non-zero", () => {
    const text = "x".repeat(4_000_000); // 1M tokens of user input
    appendEntry(db, sessionId, null, "message", userMsg(text));
    const stats = computeSessionStats(db, sessionId);
    expect(stats.tokensIn).toBe(1_000_000);
    expect(stats.costBRL).not.toBeNull();
    expect(stats.costBRL!).toBeGreaterThan(0);
  });

  it("strips internal _fields when counting text length", () => {
    const messageWithMeta = {
      role: "assistant",
      content: [{ type: "text", text: "visible" }],
      _persona: "mentora",
    };
    appendEntry(db, sessionId, null, "message", messageWithMeta);
    const stats = computeSessionStats(db, sessionId);
    // Only the visible text counts, not the meta field
    expect(stats.tokensOut).toBe(Math.ceil("visible".length / 4));
  });

  it("ignores non-message entry types", () => {
    appendEntry(db, sessionId, null, "message", userMsg("count me"));
    appendEntry(db, sessionId, null, "compaction", { summary: "ignored" });
    const stats = computeSessionStats(db, sessionId);
    expect(stats.messages).toBe(1);
  });
});
