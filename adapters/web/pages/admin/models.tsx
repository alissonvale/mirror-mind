import type { FC } from "hono/jsx";
import { Layout, type SidebarScopes } from "../layout.js";
import type { User, ModelConfig } from "../../../../server/db.js";
import type { CatalogEntry } from "../../../../server/db/models-catalog.js";
import { ts } from "../../i18n.js";
import { ModelPicker } from "../components/model-picker.js";

export interface OAuthProviderOption {
  id: string;
  name: string;
  configured: boolean;
}

export interface ModelsPageProps {
  user: User;
  models: ModelConfig[];
  oauthProviders: OAuthProviderOption[];
  /** CV1.E15.S1: model catalog (OpenRouter + curated) for the picker. */
  catalog: CatalogEntry[];
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
  catalog,
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

    <script
      // CV1.E10 follow-up: fetch-pricing handler. Inline because it's
      // small, scoped to this page, and avoids a new public asset.
      // Reads the model id + provider from the same card, calls the
      // admin endpoint, populates the price inputs on success. Status
      // text appears next to the button via the data-models-fetch-
      // status span.
      dangerouslySetInnerHTML={{
        __html: `
document.addEventListener("click", async (ev) => {
  const btn = ev.target.closest("[data-models-fetch-pricing]");
  if (!btn) return;
  const card = btn.closest(".models-card");
  if (!card) return;
  const providerInput = card.querySelector("[data-models-provider]");
  const idInput = card.querySelector("[data-models-id]");
  const inPrice = card.querySelector("[data-models-input-price]");
  const outPrice = card.querySelector("[data-models-output-price]");
  const statusEl = card.querySelector("[data-models-fetch-status]");
  if (!providerInput || !idInput || !inPrice || !outPrice || !statusEl) return;

  const provider = (providerInput.value || "").trim();
  const modelId = (idInput.value || "").trim();
  if (!modelId) {
    statusEl.textContent = ${JSON.stringify(ts("admin.models.fetchPricing.missingId"))};
    statusEl.dataset.state = "error";
    return;
  }
  if (provider !== "openrouter") {
    statusEl.textContent = ${JSON.stringify(ts("admin.models.fetchPricing.notOpenrouter"))};
    statusEl.dataset.state = "error";
    return;
  }

  btn.disabled = true;
  statusEl.textContent = ${JSON.stringify(ts("admin.models.fetchPricing.fetching"))};
  statusEl.dataset.state = "pending";

  try {
    const res = await fetch(
      "/admin/models/openrouter-pricing?model=" + encodeURIComponent(modelId),
    );
    if (res.status === 404) {
      statusEl.textContent = ${JSON.stringify(ts("admin.models.fetchPricing.notFound"))};
      statusEl.dataset.state = "error";
      return;
    }
    if (!res.ok) {
      statusEl.textContent = ${JSON.stringify(ts("admin.models.fetchPricing.unavailable"))};
      statusEl.dataset.state = "error";
      return;
    }
    const data = await res.json();
    inPrice.value = (Math.round(data.input_brl_per_1m * 10000) / 10000).toString();
    outPrice.value = (Math.round(data.output_brl_per_1m * 10000) / 10000).toString();
    statusEl.textContent = ${JSON.stringify(ts("admin.models.fetchPricing.success"))};
    statusEl.dataset.state = "success";
  } catch (err) {
    statusEl.textContent = ${JSON.stringify(ts("admin.models.fetchPricing.unavailable"))} + " (" + (err && err.message ? err.message : err) + ")";
    statusEl.dataset.state = "error";
  } finally {
    btn.disabled = false;
  }
});
`,
      }}
    />

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
                    data-models-provider
                  />
                </label>
                <label class="models-field">
                  <span class="models-label">{ts("admin.models.fieldModelId")}</span>
                  <ModelPicker
                    name="model"
                    value={m.model}
                    catalog={catalog}
                    listId={`model-catalog-${m.role}`}
                    required
                    dataAttr={{ name: "data-models-id", value: "" }}
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
                    data-models-input-price
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
                    data-models-output-price
                  />
                </label>
              </div>
              {/* CV1.E10 follow-up: fetch input/output prices from the
                  provider's catalog (OpenRouter only for now). Reads
                  the model id from the form, hits the admin endpoint,
                  populates the two BRL/1M fields. Status feedback
                  inline. Save button still required to persist. */}
              <div class="models-fetch-row">
                <button
                  type="button"
                  class="models-fetch-pricing"
                  data-models-fetch-pricing
                  title={ts("admin.models.fetchPricingTitle")}
                >
                  {ts("admin.models.fetchPricing")}
                </button>
                <span
                  class="models-fetch-status"
                  data-models-fetch-status
                  aria-live="polite"
                ></span>
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
