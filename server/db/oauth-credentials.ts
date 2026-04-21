import type Database from "better-sqlite3";
import type { OAuthCredentials } from "@mariozechner/pi-ai";

export type { OAuthCredentials };

/**
 * OAuth credential storage for subscription-backed providers (CV0.E3.S8).
 *
 * One row per provider — the blob stores pi-ai's OAuth credentials shape
 * (`refresh`, `access`, `expires`, plus provider-specific fields like
 * `project_id` for Google Cloud Code Assist). The whole object is
 * JSON-serialized into `credentials` to keep the schema flat.
 *
 * Credentials are written by:
 *  - Admin paste-save at /admin/oauth.
 *  - The runtime resolver (server/model-auth.ts), after `getOAuthApiKey`
 *    refreshes an expired access token — the new credentials replace
 *    the old so the next call starts from a valid token.
 */

interface OAuthCredentialsRow {
  provider: string;
  credentials: string;
  updated_at: number;
}

export interface StoredOAuthCredentials {
  provider: string;
  credentials: OAuthCredentials;
  updated_at: number;
}

export function setOAuthCredentials(
  db: Database.Database,
  provider: string,
  credentials: OAuthCredentials,
): void {
  db.prepare(
    `INSERT INTO oauth_credentials (provider, credentials, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT (provider) DO UPDATE SET
       credentials = excluded.credentials,
       updated_at = excluded.updated_at`,
  ).run(provider, JSON.stringify(credentials), Date.now());
}

export function getOAuthCredentials(
  db: Database.Database,
  provider: string,
): StoredOAuthCredentials | undefined {
  const row = db
    .prepare("SELECT provider, credentials, updated_at FROM oauth_credentials WHERE provider = ?")
    .get(provider) as OAuthCredentialsRow | undefined;
  if (!row) return undefined;
  return {
    provider: row.provider,
    credentials: JSON.parse(row.credentials) as OAuthCredentials,
    updated_at: row.updated_at,
  };
}

/**
 * Returns every stored credential as a map keyed by provider — the shape
 * pi-ai's `getOAuthApiKey(providerId, credentialsMap)` expects.
 */
export function getAllOAuthCredentials(
  db: Database.Database,
): Record<string, OAuthCredentials> {
  const rows = db
    .prepare("SELECT provider, credentials, updated_at FROM oauth_credentials")
    .all() as OAuthCredentialsRow[];
  const out: Record<string, OAuthCredentials> = {};
  for (const r of rows) {
    out[r.provider] = JSON.parse(r.credentials) as OAuthCredentials;
  }
  return out;
}

export function listOAuthCredentials(
  db: Database.Database,
): StoredOAuthCredentials[] {
  const rows = db
    .prepare("SELECT provider, credentials, updated_at FROM oauth_credentials ORDER BY provider")
    .all() as OAuthCredentialsRow[];
  return rows.map((r) => ({
    provider: r.provider,
    credentials: JSON.parse(r.credentials) as OAuthCredentials,
    updated_at: r.updated_at,
  }));
}

export function deleteOAuthCredentials(
  db: Database.Database,
  provider: string,
): void {
  db.prepare("DELETE FROM oauth_credentials WHERE provider = ?").run(provider);
}
