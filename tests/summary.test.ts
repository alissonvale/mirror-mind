import { describe, it, expect, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import type { complete } from "@mariozechner/pi-ai";
import {
  openDb,
  createUser,
  createOrganization,
  updateOrganization,
  createJourney,
  updateJourney,
  getOrganizationByKey,
  getJourneyByKey,
} from "../server/db.js";
import { generateScopeSummary } from "../server/summary.js";

type CompleteFn = typeof complete;

function mockComplete(text: string): CompleteFn {
  return (async () => ({
    content: [{ type: "text", text }],
    provider: "mock",
    model: "mock",
    usage: { inputTokens: 0, outputTokens: 0 },
  })) as unknown as CompleteFn;
}

function failingComplete(message: string): CompleteFn {
  return (async () => {
    throw new Error(message);
  }) as unknown as CompleteFn;
}

describe("generateScopeSummary", () => {
  let db: Database.Database;
  let userId: string;

  beforeEach(() => {
    db = openDb(":memory:");
    userId = createUser(db, "alice", "hash").id;
  });

  it("returns 'empty' when both briefing and situation are blank", async () => {
    createOrganization(db, userId, "sz", "Software Zen");
    const result = await generateScopeSummary(
      db,
      userId,
      "organization",
      "sz",
      mockComplete("this should never be called"),
    );
    expect(result).toBe("empty");
    // Summary stays NULL because the generator short-circuits before LLM.
    expect(getOrganizationByKey(db, userId, "sz")?.summary).toBeNull();
  });

  it("returns 'error' when the scope does not exist", async () => {
    const result = await generateScopeSummary(
      db,
      userId,
      "organization",
      "ghost",
      mockComplete("unused"),
    );
    expect(result).toBe("error");
  });

  it("returns 'ok' and writes the summary on a successful response", async () => {
    createOrganization(db, userId, "sz", "Software Zen");
    updateOrganization(db, userId, "sz", {
      briefing: "Training software professionals guided by consciousness.",
    });

    const result = await generateScopeSummary(
      db,
      userId,
      "organization",
      "sz",
      mockComplete("Software Zen: training professionals. Transitioning to new model."),
    );

    expect(result).toBe("ok");
    const saved = getOrganizationByKey(db, userId, "sz")?.summary;
    expect(saved).toContain("Software Zen");
  });

  it("returns 'timeout' when the LLM rejects with a timeout-shaped error", async () => {
    createJourney(db, userId, "j", "J");
    updateJourney(db, userId, "j", { briefing: "b" });

    const result = await generateScopeSummary(
      db,
      userId,
      "journey",
      "j",
      failingComplete("Summary generation timeout"),
    );
    expect(result).toBe("timeout");
    // Existing summary (NULL) is preserved — failure does not wipe it.
    expect(getJourneyByKey(db, userId, "j")?.summary).toBeNull();
  });

  it("returns 'error' on any non-timeout failure", async () => {
    createOrganization(db, userId, "sz", "Software Zen");
    updateOrganization(db, userId, "sz", { briefing: "b" });

    const result = await generateScopeSummary(
      db,
      userId,
      "organization",
      "sz",
      failingComplete("Upstream 503 from provider"),
    );
    expect(result).toBe("error");
  });

  it("returns 'error' when the LLM responds with empty text", async () => {
    createOrganization(db, userId, "sz", "Software Zen");
    updateOrganization(db, userId, "sz", { briefing: "b" });

    const result = await generateScopeSummary(
      db,
      userId,
      "organization",
      "sz",
      mockComplete("   "),
    );
    expect(result).toBe("error");
  });
});
