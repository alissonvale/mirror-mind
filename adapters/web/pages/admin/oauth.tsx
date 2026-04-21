import type { FC } from "hono/jsx";
import { Layout } from "../layout.js";
import type { User } from "../../../../server/db.js";

export interface OAuthProviderEntry {
  id: string;
  name: string;
  /** true if credentials exist in oauth_credentials for this provider */
  configured: boolean;
  /** epoch ms — when the stored access token expires (informational only) */
  expiresAt?: number;
  /** epoch ms — when the row was last written */
  updatedAt?: number;
  /** extra keys present on the credential object (e.g. project_id) */
  extraFields?: string[];
}

export interface OAuthPageProps {
  user: User;
  providers: OAuthProviderEntry[];
  saved?: string;
  deleted?: string;
  error?: string;
}

function formatDate(ms?: number): string {
  if (!ms) return "—";
  const d = new Date(ms);
  return d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

function formatExpiry(ms?: number): { label: string; stale: boolean } {
  if (!ms) return { label: "—", stale: false };
  const now = Date.now();
  const diffMs = ms - now;
  const stale = diffMs <= 0;
  if (stale) return { label: "expired (will refresh on next call)", stale };
  const mins = Math.round(diffMs / 60_000);
  if (mins < 60) return { label: `expires in ${mins}m`, stale };
  const hours = Math.round(mins / 60);
  if (hours < 48) return { label: `expires in ${hours}h`, stale };
  const days = Math.round(hours / 24);
  return { label: `expires in ${days}d`, stale };
}

export const OAuthPage: FC<OAuthPageProps> = ({
  user,
  providers,
  saved,
  deleted,
  error,
}) => (
  <Layout title="OAuth Credentials" user={user}>
    <h1>OAuth Credentials</h1>
    <p class="admin-lede">
      Subscription-backed LLM providers authenticate via OAuth instead of an
      environment-variable API key. Credentials are generated on your laptop
      via <code>npx @mariozechner/pi-ai login &lt;provider&gt;</code>, then
      pasted here. The mirror stores them in the DB, refreshes access tokens
      automatically on each call, and writes the refreshed token back.
      Point a model role at one of these providers on{" "}
      <a href="/admin/models">/admin/models</a> to use the stored credential.
    </p>

    {saved && <p class="flash flash-success">Saved credentials for {saved}.</p>}
    {deleted && <p class="flash flash-success">Deleted credentials for {deleted}.</p>}
    {error && <p class="flash flash-error">{error}</p>}

    <div class="oauth-list">
      {providers.map((p) => {
        const expiry = formatExpiry(p.expiresAt);
        return (
          <article class="oauth-card">
            <header class="oauth-card-header">
              <h2>
                {p.name}
                <span class="oauth-card-id">
                  <code>{p.id}</code>
                </span>
              </h2>
              {p.configured ? (
                <p class="oauth-card-status oauth-card-status-ok">
                  Configured · {expiry.label}
                  {p.extraFields && p.extraFields.length > 0 && (
                    <span class="oauth-card-extras">
                      · fields: {p.extraFields.join(", ")}
                    </span>
                  )}
                </p>
              ) : (
                <p class="oauth-card-status oauth-card-status-empty">
                  No credentials stored
                </p>
              )}
              {p.configured && (
                <p class="oauth-card-meta">
                  Last updated: {formatDate(p.updatedAt)}
                </p>
              )}
            </header>

            <form
              method="POST"
              action={`/admin/oauth/${p.id}`}
              class="oauth-form"
            >
              <label class="oauth-field">
                <span class="oauth-label">
                  Paste credentials JSON
                  <span class="oauth-hint">
                    — the contents of <code>auth.json</code> after running
                    pi-ai's login flow on your laptop. Paste the full file
                    (with the <code>"{p.id}"</code> envelope) or just the
                    inner object; either works. Must include{" "}
                    <code>refresh</code>, <code>access</code>,{" "}
                    <code>expires</code>.
                  </span>
                </span>
                <textarea
                  name="credentials"
                  class="oauth-textarea"
                  rows={6}
                  placeholder={`{"${p.id}": {"refresh": "...", "access": "...", "expires": 1700000000000}}`}
                  required
                />
              </label>
              <div class="oauth-actions">
                <button type="submit" class="oauth-save">
                  {p.configured ? "Replace credentials" : "Save credentials"}
                </button>
                {p.configured && (
                  <button
                    type="submit"
                    formaction={`/admin/oauth/${p.id}/delete`}
                    formmethod="POST"
                    class="oauth-delete"
                    onclick={`return confirm('Delete credentials for ${p.name}? Any role using this provider will stop working until you re-paste.')`}
                  >
                    Delete
                  </button>
                )}
              </div>
            </form>
          </article>
        );
      })}
    </div>
  </Layout>
);
