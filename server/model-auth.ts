import type Database from "better-sqlite3";
import { getOAuthApiKey as piGetOAuthApiKey } from "@mariozechner/pi-ai/oauth";
import { getModels } from "./db/models.js";
import {
  getAllOAuthCredentials,
  setOAuthCredentials,
} from "./db/oauth-credentials.js";

type GetOAuthApiKeyFn = typeof piGetOAuthApiKey;

/**
 * Typed error thrown when OAuth credential resolution fails — missing
 * credentials, refresh failure, revoked token. Callers that catch this
 * should surface a clear message or fall back (reception falls back to
 * all-nulls; main surfaces to the user).
 */
export class OAuthResolutionError extends Error {
  constructor(
    public readonly provider: string,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "OAuthResolutionError";
  }
}

/**
 * Resolve the API key for a given model role, honoring the role's
 * auth_type column. This is the single seam every LLM call site uses
 * in place of a raw `process.env.OPENROUTER_API_KEY` read.
 *
 * Behavior:
 *  - `auth_type === 'env'` (default): returns OPENROUTER_API_KEY. Same
 *    as the pre-S8 code path.
 *  - `auth_type === 'oauth'`: loads all stored OAuth credentials,
 *    calls pi-ai's `getOAuthApiKey(provider, credentialsMap)`, persists
 *    refreshed credentials back to the DB if the access token was
 *    renewed, and returns the access token to use as `apiKey` in
 *    pi-ai's `complete()` / `stream()` options.
 *
 * `getOAuthApiKey` throws on refresh failure; this wrapper re-throws as
 * `OAuthResolutionError` so call sites can branch on it. Missing
 * credentials for an OAuth-configured role throw the same error —
 * there is no silent fallback to env (which would mask a misconfigured
 * setup and point traffic at the wrong account).
 */
export async function resolveApiKey(
  db: Database.Database,
  role: string,
  getOAuthApiKeyFn: GetOAuthApiKeyFn = piGetOAuthApiKey,
): Promise<string | undefined> {
  const config = getModels(db)[role];
  if (!config) return undefined;

  if (config.auth_type === "oauth") {
    const provider = config.provider;
    const credentialsMap = getAllOAuthCredentials(db);
    let result;
    try {
      result = await getOAuthApiKeyFn(provider, credentialsMap);
    } catch (err) {
      throw new OAuthResolutionError(
        provider,
        `Failed to resolve OAuth key for ${role} (${provider}): ${(err as Error).message}`,
        err,
      );
    }
    if (!result) {
      throw new OAuthResolutionError(
        provider,
        `No OAuth credentials stored for ${provider}. Configure at /admin/oauth.`,
      );
    }
    // Persist refreshed credentials so the next call starts from a valid
    // access token. The comparison avoids an unnecessary write when the
    // access token is unchanged (common fast path).
    const prev = credentialsMap[provider];
    if (
      !prev ||
      prev.access !== result.newCredentials.access ||
      prev.expires !== result.newCredentials.expires
    ) {
      setOAuthCredentials(db, provider, result.newCredentials);
    }
    return result.apiKey;
  }

  return process.env.OPENROUTER_API_KEY;
}
