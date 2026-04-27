import type { FC } from "hono/jsx";
import { Layout, type SidebarScopes } from "../layout.js";
import type { User, ModelConfig } from "../../../../server/db.js";
import { ts } from "../../i18n.js";

export interface OAuthProviderOption {
  id: string;
  name: string;
  configured: boolean;
}

export interface ModelsPageProps {
  user: User;
  models: ModelConfig[];
  oauthProviders: OAuthProviderOption[];
  saved?: string;
  reverted?: string;
  error?: string;
  sidebarScopes?: SidebarScopes;
}

function findOAuthProvider(
  id: string,
  oauthProviders: OAuthProviderOption[],
): OAuthProviderOption | undefined {
  return oauthProviders.find((p) => p.id === id);
}

function roleHelp(role: string): string {
  if (role === "main") return ts("admin.models.helpMain");
  if (role === "reception") return ts("admin.models.helpReception");
  if (role === "title") return ts("admin.models.helpTitle");
  return "";
}

export const ModelsPage: FC<ModelsPageProps> = ({
  user,
  models,
  oauthProviders,
  saved,
  reverted,
  error,
  sidebarScopes,
}) => (
  <Layout title={ts("admin.models.htmlTitle")} user={user} sidebarScopes={sidebarScopes}>
    <h1>{ts("admin.models.h1")}</h1>
    <p class="admin-lede">
      {ts("admin.models.ledePart1")}{" "}
      <strong>{ts("admin.models.envApiKey")}</strong>{" "}
      {ts("admin.models.ledePart2")}{" "}
      <strong>{ts("admin.models.oauth")}</strong>{" "}
      {ts("admin.models.ledePart3")}{" "}
      <a href="/admin/oauth">/admin/oauth</a>
      {ts("admin.models.ledePart4")}
    </p>

    {saved && <p class="flash flash-success">{ts("admin.models.savedFlash", { what: saved })}</p>}
    {reverted && <p class="flash flash-success">{ts("admin.models.revertedFlash", { what: reverted })}</p>}
    {error && <p class="flash flash-error">{error}</p>}

    <datalist id="providers-options">
      <option value="openrouter" />
      {oauthProviders.map((p) => (
        <option value={p.id}>
          {p.name}
          {p.configured ? "" : ts("admin.models.noCredentialsSuffix")}
        </option>
      ))}
    </datalist>

    <div class="models-list">
      {models.map((m) => {
        const oauthMatch = findOAuthProvider(m.provider, oauthProviders);
        const isOAuth = m.auth_type === "oauth" || !!oauthMatch;
        const needsCreds = isOAuth && oauthMatch && !oauthMatch.configured;
        const help = roleHelp(m.role);
        return (
          <article class="models-card">
            <header class="models-card-header">
              <h2>
                {m.role}
                <span class="models-card-model">{m.provider} · {m.model}</span>
                <span
                  class={
                    isOAuth
                      ? "models-auth-badge models-auth-badge-oauth"
                      : "models-auth-badge models-auth-badge-env"
                  }
                  title={
                    isOAuth
                      ? ts("admin.models.authOauthTitle")
                      : ts("admin.models.authEnvTitle")
                  }
                >
                  {isOAuth ? ts("admin.models.authOauthBadge") : ts("admin.models.authEnvBadge")}
                </span>
              </h2>
              {help && (
                <p class="models-card-help">{help}</p>
              )}
              {needsCreds && (
                <p class="models-card-warning">
                  {ts("admin.models.noCredentialsFor", { provider: m.provider })}{" "}
                  <a href="/admin/oauth">{ts("admin.models.configureOauth")}</a>
                </p>
              )}
            </header>
            <form
              method="POST"
              action={`/admin/models/${m.role}`}
              class="models-form"
            >
              <div class="models-grid">
                <label class="models-field">
                  <span class="models-label">{ts("admin.models.fieldProvider")}</span>
                  <input
                    type="text"
                    name="provider"
                    value={m.provider}
                    list="providers-options"
                    required
                    class="models-input"
                  />
                </label>
                <label class="models-field">
                  <span class="models-label">{ts("admin.models.fieldModelId")}</span>
                  <input
                    type="text"
                    name="model"
                    value={m.model}
                    required
                    class="models-input"
                  />
                </label>
                <label class="models-field">
                  <span class="models-label">{ts("admin.models.fieldTimeout")}</span>
                  <input
                    type="number"
                    name="timeout_ms"
                    value={m.timeout_ms ?? ""}
                    min="0"
                    class="models-input"
                    placeholder={ts("admin.models.fieldNonePlaceholder")}
                  />
                </label>
                <label class="models-field">
                  <span class="models-label">{ts("admin.models.fieldInputPrice")}</span>
                  <input
                    type="number"
                    step="0.0001"
                    name="price_brl_per_1m_input"
                    value={m.price_brl_per_1m_input ?? ""}
                    class="models-input"
                    placeholder={ts("admin.models.fieldNonePlaceholder")}
                  />
                </label>
                <label class="models-field">
                  <span class="models-label">{ts("admin.models.fieldOutputPrice")}</span>
                  <input
                    type="number"
                    step="0.0001"
                    name="price_brl_per_1m_output"
                    value={m.price_brl_per_1m_output ?? ""}
                    class="models-input"
                    placeholder={ts("admin.models.fieldNonePlaceholder")}
                  />
                </label>
              </div>
              <label class="models-field">
                <span class="models-label">{ts("admin.models.fieldPurpose")}</span>
                <textarea name="purpose" class="models-textarea" rows={2}>
                  {m.purpose}
                </textarea>
              </label>
              <div class="models-actions">
                <button type="submit" class="models-save">{ts("common.save")}</button>
                <button
                  type="submit"
                  formaction={`/admin/models/${m.role}/reset`}
                  class="models-revert"
                  onclick={`return confirm('${ts("admin.models.revertConfirm", { role: m.role }).replace(/'/g, "\\'")}')`}
                >
                  {ts("admin.models.revertToDefault")}
                </button>
              </div>
            </form>
          </article>
        );
      })}
    </div>
  </Layout>
);
