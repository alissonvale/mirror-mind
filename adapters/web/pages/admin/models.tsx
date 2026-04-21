import type { FC } from "hono/jsx";
import { Layout } from "../layout.js";
import type { User, ModelConfig } from "../../../../server/db.js";

export interface OAuthProviderOption {
  id: string;
  name: string;
  /** true if credentials are currently stored for this provider */
  configured: boolean;
}

export interface ModelsPageProps {
  user: User;
  models: ModelConfig[];
  oauthProviders: OAuthProviderOption[];
  saved?: string;
  reverted?: string;
  error?: string;
}

const ROLE_HELP: Record<string, string> = {
  main: "Primary response model — answers every user message across web, CLI, and Telegram.",
  reception: "Fast classifier — routes each incoming message to a persona. Cheap, bounded timeout.",
  title: "Background summarizer — labels sessions when the user clicks 'Begin again'. Fire-and-forget.",
};

function findOAuthProvider(
  id: string,
  oauthProviders: OAuthProviderOption[],
): OAuthProviderOption | undefined {
  return oauthProviders.find((p) => p.id === id);
}

export const ModelsPage: FC<ModelsPageProps> = ({
  user,
  models,
  oauthProviders,
  saved,
  reverted,
  error,
}) => (
  <Layout title="Models" user={user}>
    <h1>Models</h1>
    <p class="admin-lede">
      Tune which LLM answers for each role. Edits take effect on the next
      request — no restart required. Providers come in two flavors:{" "}
      <strong>env API key</strong> (reads <code>OPENROUTER_API_KEY</code>{" "}
      from the environment, today's default) and <strong>OAuth</strong>{" "}
      (reads credentials you uploaded at{" "}
      <a href="/admin/oauth">/admin/oauth</a>, refreshes access tokens
      automatically). Pick an OAuth provider here to point the role at a
      subscription-backed account.
    </p>

    {saved && <p class="flash flash-success">Saved {saved}.</p>}
    {reverted && <p class="flash flash-success">{reverted} reverted to default.</p>}
    {error && <p class="flash flash-error">{error}</p>}

    <datalist id="providers-options">
      <option value="openrouter" />
      {oauthProviders.map((p) => (
        <option value={p.id}>
          {p.name}
          {p.configured ? "" : " (no credentials stored)"}
        </option>
      ))}
    </datalist>

    <div class="models-list">
      {models.map((m) => {
        const oauthMatch = findOAuthProvider(m.provider, oauthProviders);
        const isOAuth = m.auth_type === "oauth" || !!oauthMatch;
        const needsCreds = isOAuth && oauthMatch && !oauthMatch.configured;
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
                      ? "API key resolved via OAuth at call time."
                      : "API key read from OPENROUTER_API_KEY."
                  }
                >
                  {isOAuth ? "OAuth" : "env"}
                </span>
              </h2>
              {ROLE_HELP[m.role] && (
                <p class="models-card-help">{ROLE_HELP[m.role]}</p>
              )}
              {needsCreds && (
                <p class="models-card-warning">
                  No credentials stored for <code>{m.provider}</code>.{" "}
                  <a href="/admin/oauth">Configure OAuth →</a>
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
                  <span class="models-label">Provider</span>
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
                  <span class="models-label">Model ID</span>
                  <input
                    type="text"
                    name="model"
                    value={m.model}
                    required
                    class="models-input"
                  />
                </label>
                <label class="models-field">
                  <span class="models-label">Timeout (ms)</span>
                  <input
                    type="number"
                    name="timeout_ms"
                    value={m.timeout_ms ?? ""}
                    min="0"
                    class="models-input"
                    placeholder="(none)"
                  />
                </label>
                <label class="models-field">
                  <span class="models-label">Input · BRL / 1M tokens</span>
                  <input
                    type="number"
                    step="0.0001"
                    name="price_brl_per_1m_input"
                    value={m.price_brl_per_1m_input ?? ""}
                    class="models-input"
                    placeholder="(none)"
                  />
                </label>
                <label class="models-field">
                  <span class="models-label">Output · BRL / 1M tokens</span>
                  <input
                    type="number"
                    step="0.0001"
                    name="price_brl_per_1m_output"
                    value={m.price_brl_per_1m_output ?? ""}
                    class="models-input"
                    placeholder="(none)"
                  />
                </label>
              </div>
              <label class="models-field">
                <span class="models-label">Purpose</span>
                <textarea name="purpose" class="models-textarea" rows={2}>
                  {m.purpose}
                </textarea>
              </label>
              <div class="models-actions">
                <button type="submit" class="models-save">Save</button>
                <button
                  type="submit"
                  formaction={`/admin/models/${m.role}/reset`}
                  class="models-revert"
                  onclick={`return confirm('Revert ${m.role} to the shipped default?')`}
                >
                  Revert to default
                </button>
              </div>
            </form>
          </article>
        );
      })}
    </div>
  </Layout>
);
