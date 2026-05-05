import { describe, it, expect, beforeEach } from "vitest";
import { createHash } from "node:crypto";
import type Database from "better-sqlite3";
import {
  openDb,
  createUser,
  setIdentityLayer,
  getOrCreateSession,
  setSessionModel,
  setSessionScene,
  createScene,
  type User,
} from "../server/db.js";
import { resolveMainModel } from "../server/main-model-resolver.js";

/**
 * CV1.E15.S4: precedence chain — session → scene → global.
 * Each tier requires BOTH provider and id; partial values fall through.
 */
function freshDb(): { db: Database.Database; user: User } {
  const db = openDb(":memory:");
  const hash = createHash("sha256").update("resolver-token").digest("hex");
  const user = createUser(db, "resolveruser", hash);
  setIdentityLayer(db, user.id, "self", "soul", "soul");
  setIdentityLayer(db, user.id, "ego", "identity", "id");
  setIdentityLayer(db, user.id, "ego", "behavior", "behavior");
  return { db, user };
}

describe("resolveMainModel — CV1.E15.S4 precedence", () => {
  let db: Database.Database;
  let user: User;
  let sessionId: string;

  beforeEach(() => {
    ({ db, user } = freshDb());
    sessionId = getOrCreateSession(db, user.id);
  });

  it("returns global when no override is set", () => {
    const r = resolveMainModel(db, sessionId, user.id);
    expect(r.source).toBe("global");
    // openrouter is the default provider in the seed.
    expect(r.provider).toBe("openrouter");
    expect(typeof r.model).toBe("string");
    expect(r.model.length).toBeGreaterThan(0);
  });

  it("session override wins over global", () => {
    setSessionModel(db, sessionId, user.id, {
      provider: "openrouter",
      id: "anthropic/claude-sonnet-4-6",
    });
    const r = resolveMainModel(db, sessionId, user.id);
    expect(r.source).toBe("session");
    expect(r.provider).toBe("openrouter");
    expect(r.model).toBe("anthropic/claude-sonnet-4-6");
  });

  it("session partial override (only id) falls through to next tier", () => {
    setSessionModel(db, sessionId, user.id, {
      provider: null,
      id: "anthropic/claude-sonnet-4-6",
    });
    const r = resolveMainModel(db, sessionId, user.id);
    expect(r.source).toBe("global");
  });

  it("scene override wins when session has no override", () => {
    const scene = createScene(db, user.id, "essay", {
      title: "Essay",
      model_provider: "openrouter",
      model_id: "google/gemini-2.5-pro",
    });
    setSessionScene(db, sessionId, user.id, scene.id);
    const r = resolveMainModel(db, sessionId, user.id);
    expect(r.source).toBe("scene");
    expect(r.provider).toBe("openrouter");
    expect(r.model).toBe("google/gemini-2.5-pro");
  });

  it("session override wins over scene override", () => {
    const scene = createScene(db, user.id, "essay", {
      title: "Essay",
      model_provider: "openrouter",
      model_id: "google/gemini-2.5-pro",
    });
    setSessionScene(db, sessionId, user.id, scene.id);
    setSessionModel(db, sessionId, user.id, {
      provider: "openrouter",
      id: "anthropic/claude-opus-4",
    });
    const r = resolveMainModel(db, sessionId, user.id);
    expect(r.source).toBe("session");
    expect(r.model).toBe("anthropic/claude-opus-4");
  });

  it("scene partial override falls through to global", () => {
    const scene = createScene(db, user.id, "essay", {
      title: "Essay",
      model_provider: "openrouter",
      model_id: null,
    });
    setSessionScene(db, sessionId, user.id, scene.id);
    const r = resolveMainModel(db, sessionId, user.id);
    expect(r.source).toBe("global");
  });

  it("globalConfig is always populated regardless of source", () => {
    setSessionModel(db, sessionId, user.id, {
      provider: "openrouter",
      id: "anthropic/claude-sonnet-4-6",
    });
    const r = resolveMainModel(db, sessionId, user.id);
    expect(r.globalConfig).toBeDefined();
    expect(r.globalConfig.role).toBe("main");
  });
});
