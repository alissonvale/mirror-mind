import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type Database from "better-sqlite3";
import {
  openDb,
  updateModel,
  setOAuthCredentials,
  getOAuthCredentials,
} from "../server/db.js";
import {
  resolveApiKey,
  OAuthResolutionError,
} from "../server/model-auth.js";

function freshDb(): Database.Database {
  return openDb(":memory:");
}

describe("resolveApiKey — env auth_type", () => {
  let db: Database.Database;
  const originalKey = process.env.OPENROUTER_API_KEY;

  beforeEach(() => {
    db = freshDb();
    process.env.OPENROUTER_API_KEY = "sk-or-test";
  });

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.OPENROUTER_API_KEY;
    } else {
      process.env.OPENROUTER_API_KEY = originalKey;
    }
  });

  it("returns OPENROUTER_API_KEY for a default-seeded role", async () => {
    const key = await resolveApiKey(db, "reception");
    expect(key).toBe("sk-or-test");
  });

  it("returns undefined for an unknown role", async () => {
    const key = await resolveApiKey(db, "nonexistent");
    expect(key).toBeUndefined();
  });

  it("does not invoke the OAuth resolver when auth_type is env", async () => {
    const fake = vi.fn();
    await resolveApiKey(db, "reception", fake as any);
    expect(fake).not.toHaveBeenCalled();
  });
});

describe("resolveApiKey — oauth auth_type", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = freshDb();
    updateModel(db, "reception", {
      provider: "google-gemini-cli",
      model: "gemini-2.5-flash",
      auth_type: "oauth",
    });
  });

  it("throws OAuthResolutionError when no credentials exist", async () => {
    const fake = vi.fn().mockResolvedValue(null);
    await expect(
      resolveApiKey(db, "reception", fake as any),
    ).rejects.toBeInstanceOf(OAuthResolutionError);
  });

  it("returns the apiKey and does not rewrite unchanged credentials", async () => {
    const creds = {
      refresh: "rt",
      access: "at-original",
      expires: Date.now() + 3_600_000,
      project_id: "p",
    };
    setOAuthCredentials(db, "google-gemini-cli", creds);
    const updatedAtBefore =
      getOAuthCredentials(db, "google-gemini-cli")!.updated_at;

    const fake = vi.fn().mockResolvedValue({
      apiKey: "resolved-key",
      newCredentials: creds,
    });

    const key = await resolveApiKey(db, "reception", fake as any);
    expect(key).toBe("resolved-key");
    expect(fake).toHaveBeenCalledWith(
      "google-gemini-cli",
      expect.objectContaining({ "google-gemini-cli": expect.any(Object) }),
    );
    const after = getOAuthCredentials(db, "google-gemini-cli")!.updated_at;
    expect(after).toBe(updatedAtBefore);
  });

  it("persists refreshed credentials when access token rotates", async () => {
    setOAuthCredentials(db, "google-gemini-cli", {
      refresh: "rt-old",
      access: "at-old",
      expires: 1,
      project_id: "p",
    });

    const refreshed = {
      refresh: "rt-old",
      access: "at-new",
      expires: Date.now() + 3_600_000,
      project_id: "p",
    };

    const fake = vi.fn().mockResolvedValue({
      apiKey: "resolved-key",
      newCredentials: refreshed,
    });

    await resolveApiKey(db, "reception", fake as any);
    const stored = getOAuthCredentials(db, "google-gemini-cli");
    expect(stored?.credentials.access).toBe("at-new");
    expect(stored?.credentials.expires).toBe(refreshed.expires);
  });

  it("wraps refresh failure as OAuthResolutionError", async () => {
    setOAuthCredentials(db, "google-gemini-cli", {
      refresh: "rt",
      access: "at",
      expires: 1,
      project_id: "p",
    });
    const fake = vi.fn().mockRejectedValue(new Error("refresh failed"));
    await expect(
      resolveApiKey(db, "reception", fake as any),
    ).rejects.toBeInstanceOf(OAuthResolutionError);
  });
});
