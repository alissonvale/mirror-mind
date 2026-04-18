import type { FC } from "hono/jsx";
import { Layout } from "../layout.js";
import type { User, ModelConfig } from "../../../../server/db.js";

export interface ModelsPageProps {
  user: User;
  models: ModelConfig[];
  saved?: string;
  reverted?: string;
  error?: string;
}

const ROLE_HELP: Record<string, string> = {
  main: "Primary response model — answers every user message across web, CLI, and Telegram.",
  reception: "Fast classifier — routes each incoming message to a persona. Cheap, bounded timeout.",
  title: "Background summarizer — labels sessions when the user clicks 'Begin again'. Fire-and-forget.",
};

export const ModelsPage: FC<ModelsPageProps> = ({
  user,
  models,
  saved,
  reverted,
  error,
}) => (
  <Layout title="Models" user={user}>
    <h1>Models</h1>
    <p class="admin-lede">
      Tune which LLM answers for each role. Edits take effect on the next
      request — no restart required. The shipped JSON (<code>config/models.json</code>)
      is the seed; revert per row restores its values.
    </p>

    {saved && <p class="flash flash-success">Saved {saved}.</p>}
    {reverted && <p class="flash flash-success">{reverted} reverted to default.</p>}
    {error && <p class="flash flash-error">{error}</p>}

    <div class="models-list">
      {models.map((m) => (
        <article class="models-card">
          <header class="models-card-header">
            <h2>
              {m.role}
              <span class="models-card-model">{m.provider} · {m.model}</span>
            </h2>
            {ROLE_HELP[m.role] && (
              <p class="models-card-help">{ROLE_HELP[m.role]}</p>
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
      ))}
    </div>
  </Layout>
);
