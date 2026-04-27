import type { FC } from "hono/jsx";
import { Layout, type SidebarScopes } from "../layout.js";
import type { User } from "../../../../server/db.js";
import { ts, currentLocale } from "../../i18n.js";

export interface OAuthProviderEntry {
  id: string;
  name: string;
  configured: boolean;
  expiresAt?: number;
  updatedAt?: number;
  extraFields?: string[];
}

export interface OAuthPageProps {
  user: User;
  providers: OAuthProviderEntry[];
  saved?: string;
  deleted?: string;
  error?: string;
  sidebarScopes?: SidebarScopes;
}

function formatDate(ms: number | undefined, locale: string): string {
  if (!ms) return "—";
  const tag = locale === "pt-BR" ? "pt-BR" : "en-US";
  const d = new Date(ms);
  return d.toLocaleString(tag, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatExpiry(ms: number | undefined): { label: string; stale: boolean } {
  if (!ms) return { label: ts("common.dash"), stale: false };
  const now = Date.now();
  const diffMs = ms - now;
  const stale = diffMs <= 0;
  if (stale) return { label: ts("admin.oauth.expiredWillRefresh"), stale };
  const mins = Math.round(diffMs / 60_000);
  if (mins < 60) return { label: ts("admin.oauth.expiresInMinutes", { n: mins }), stale };
  const hours = Math.round(mins / 60);
  if (hours < 48) return { label: ts("admin.oauth.expiresInHours", { n: hours }), stale };
  const days = Math.round(hours / 24);
  return { label: ts("admin.oauth.expiresInDays", { n: days }), stale };
}

export const OAuthPage: FC<OAuthPageProps> = ({
  user,
  providers,
  saved,
  deleted,
  error,
  sidebarScopes,
}) => {
  const locale = currentLocale();
  return (
  <Layout title={ts("admin.oauth.htmlTitle")} user={user} sidebarScopes={sidebarScopes}>
    <h1>{ts("admin.oauth.h1")}</h1>
    <p class="admin-lede">
      {ts("admin.oauth.ledePart1")}{" "}
      <code>{ts("admin.oauth.loginCommand")}</code>
      {ts("admin.oauth.ledePart2")}{" "}
      <a href="/admin/models">/admin/models</a>
      {ts("admin.oauth.ledePart3")}
    </p>

    {saved && <p class="flash flash-success">{ts("admin.oauth.savedFlash", { provider: saved })}</p>}
    {deleted && <p class="flash flash-success">{ts("admin.oauth.deletedFlash", { provider: deleted })}</p>}
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
                  {ts("admin.oauth.configuredPrefix")} · {expiry.label}
                  {p.extraFields && p.extraFields.length > 0 && (
                    <span class="oauth-card-extras">
                      · {ts("admin.oauth.fieldsLine", { fields: p.extraFields.join(", ") })}
                    </span>
                  )}
                </p>
              ) : (
                <p class="oauth-card-status oauth-card-status-empty">
                  {ts("admin.oauth.noCredentials")}
                </p>
              )}
              {p.configured && (
                <p class="oauth-card-meta">
                  {ts("admin.oauth.lastUpdated", { date: formatDate(p.updatedAt, locale) })}
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
                  {ts("admin.oauth.pasteLabel")}
                  <span class="oauth-hint">
                    {ts("admin.oauth.hintPart1")}{" "}
                    <code>auth.json</code>
                    {ts("admin.oauth.hintPart2")}{" "}
                    <code>"{p.id}"</code>
                    {ts("admin.oauth.hintPart3")}{" "}
                    <code>refresh</code>, <code>access</code>, <code>expires</code>.
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
                  {p.configured ? ts("admin.oauth.replace") : ts("admin.oauth.save")}
                </button>
                {p.configured && (
                  <button
                    type="submit"
                    formaction={`/admin/oauth/${p.id}/delete`}
                    formmethod="POST"
                    class="oauth-delete"
                    onclick={`return confirm('${ts("admin.oauth.deleteConfirm", { provider: p.name }).replace(/'/g, "\\'")}')`}
                  >
                    {ts("admin.oauth.delete")}
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
};
