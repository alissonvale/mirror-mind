import type Database from "better-sqlite3";
import { getModels, type ModelConfig } from "./db/models.js";
import {
  getSessionModel,
  getSessionScene,
} from "./db/sessions.js";
import { getSceneById } from "./db/scenes.js";

/**
 * CV1.E15.S4: resolve the main model for a turn.
 *
 * Precedence:
 *   1. session  — sessions.{model_provider, model_id} (S3)
 *   2. scene    — scenes.{model_provider, model_id}   (S2)
 *   3. global   — models[role='main']                 (CV0.E3.S1)
 *
 * Each tier requires BOTH provider and id to be set; partial values
 * fall through to the next tier. NULL on either column at any tier
 * means "inherit" — which is why both columns travel as a pair through
 * the form, the helpers, and the resolver.
 *
 * The returned `source` lets callers (badge logic in S7, logging, etc.)
 * tell the user where the resolved model came from without re-querying.
 *
 * **Auth handling.** The pi-ai API key resolution still happens via
 * `resolveApiKey(db, "main")` in callers. When a session/scene override
 * stays inside the same provider as the global main (the common case
 * — admin pinning a different OpenRouter model), env-based auth keeps
 * working unchanged. Cross-provider overrides (e.g. main=openrouter
 * but session=google-direct) would need a richer auth resolver — out
 * of scope for S4, recorded as a follow-up.
 */
export type MainModelSource = "session" | "scene" | "global";

export interface ResolvedMainModel {
  /** Provider id — e.g. "openrouter", "anthropic", a pi-ai provider key. */
  provider: string;
  /** Model id within that provider — e.g. "anthropic/claude-sonnet-4-6". */
  model: string;
  /** Where in the chain the resolution landed. */
  source: MainModelSource;
  /** The full ModelConfig from the `models` table (always the global
   *  main row). Carries pricing + auth_type + timeout that callers
   *  reference for cost logging and pi-ai's getModel() call. When
   *  source !== "global", price/auth/timeout still come from this row
   *  — see auth-handling note above. */
  globalConfig: ModelConfig;
}

export function resolveMainModel(
  db: Database.Database,
  sessionId: string,
  userId: string,
): ResolvedMainModel {
  const globalConfig = getModels(db).main;
  if (!globalConfig) {
    throw new Error(
      "main model not configured — seed config/models.json or visit /admin/models",
    );
  }

  // Tier 1: session-level override.
  const sessionModel = getSessionModel(db, sessionId, userId);
  if (sessionModel.provider && sessionModel.id) {
    return {
      provider: sessionModel.provider,
      model: sessionModel.id,
      source: "session",
      globalConfig,
    };
  }

  // Tier 2: scene-level override (only when the session is anchored).
  const sceneId = getSessionScene(db, sessionId, userId);
  if (sceneId) {
    const scene = getSceneById(db, sceneId, userId);
    if (scene && scene.model_provider && scene.model_id) {
      return {
        provider: scene.model_provider,
        model: scene.model_id,
        source: "scene",
        globalConfig,
      };
    }
  }

  // Tier 3: global main.
  return {
    provider: globalConfig.provider,
    model: globalConfig.model,
    source: "global",
    globalConfig,
  };
}
