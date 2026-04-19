import type { FC } from "hono/jsx";
import { Layout } from "./layout.js";
import type { User } from "../../../server/db.js";

const LAYER_META: Record<string, { title: string; meta: string; help: string }> = {
  "self.soul": {
    title: "Self",
    meta: "soul",
    help: "Deep identity, frequency, nature. What you are before you are anything specific.",
  },
  "ego.identity": {
    title: "Ego",
    meta: "identity",
    help: "Operational identity — who you are in the day-to-day, what you do, how you introduce yourself.",
  },
  "ego.expression": {
    title: "Ego",
    meta: "expression",
    help: "How you speak. Format, vocabulary, punctuation, style. Separated from behavior so problems of form and problems of method can be diagnosed independently.",
  },
  "ego.behavior": {
    title: "Ego",
    meta: "behavior",
    help: "Conduct, posture, method. What you do and how you position yourself when you act.",
  },
};

export interface LayerWorkshopPageProps {
  currentUser: User;
  targetUser: User;
  layer: string;
  layerKey: string;
  content: string;
  summary: string | null;
  composedPreview: string;
}

export const LayerWorkshopPage: FC<LayerWorkshopPageProps> = ({
  currentUser,
  targetUser,
  layer,
  layerKey,
  content,
  summary,
  composedPreview,
}) => {
  const metaKey = `${layer}.${layerKey}`;
  const info = LAYER_META[metaKey] ?? {
    title: layer,
    meta: layerKey,
    help: "",
  };
  const isViewingOther = currentUser.id !== targetUser.id;
  const mapHref = isViewingOther ? `/map/${targetUser.name}` : "/map";
  const postAction = isViewingOther
    ? `/map/${targetUser.name}/${layer}/${layerKey}`
    : `/map/${layer}/${layerKey}`;
  const composeEndpoint = isViewingOther
    ? `/map/${targetUser.name}/${layer}/${layerKey}/compose`
    : `/map/${layer}/${layerKey}/compose`;
  const regenerateAction = isViewingOther
    ? `/map/${targetUser.name}/${layer}/${layerKey}/regenerate-summary`
    : `/map/${layer}/${layerKey}/regenerate-summary`;

  return (
    <Layout title={`${info.title} · ${info.meta}`} user={currentUser} wide>
      <div class="workshop">
        <nav class="workshop-breadcrumb">
          <a href={mapHref}>← Cognitive Map</a>
          <span class="workshop-breadcrumb-sep">/</span>
          <span>{info.title}</span>
          <span class="workshop-breadcrumb-sep">·</span>
          <span class="workshop-breadcrumb-meta">{info.meta}</span>
          {isViewingOther && (
            <span class="workshop-breadcrumb-viewing">
              · editing <strong>{targetUser.name}</strong>
            </span>
          )}
        </nav>

        <header class="workshop-header">
          <h1>
            {info.title}
            <span class="workshop-header-meta">· {info.meta}</span>
          </h1>
          {info.help && <p class="workshop-header-help">{info.help}</p>}
        </header>

        <section class="workshop-summary">
          <div class="workshop-summary-header">
            <span class="workshop-summary-label">Summary</span>
            <span class="workshop-summary-sub">
              shown on Cognitive Map cards and used by reception routing · regenerated automatically on Save
            </span>
          </div>
          {summary ? (
            <p class="workshop-summary-body">{summary}</p>
          ) : (
            <p class="workshop-summary-empty">
              No summary yet. It will be generated on the next Save, or you can regenerate manually below.
            </p>
          )}
          <form method="POST" action={regenerateAction} class="workshop-summary-form">
            <button type="submit" class="workshop-summary-regenerate">
              Regenerate summary
            </button>
          </form>
        </section>

        <form
          method="POST"
          action={postAction}
          class="workshop-form"
          data-compose-endpoint={composeEndpoint}
        >
          <div class="workshop-split">
            <div class="workshop-editor">
              <label class="workshop-label" for="workshop-content">
                Your writing
              </label>
              <textarea
                id="workshop-content"
                name="content"
                class="workshop-textarea"
                spellcheck="false"
              >{content}</textarea>
              <div class="workshop-actions">
                <button type="submit" class="workshop-save">Save</button>
                <a href={mapHref} class="workshop-cancel">Cancel</a>
              </div>
            </div>

            <aside class="workshop-preview" aria-live="polite">
              <div class="workshop-preview-header">
                <span class="workshop-preview-title">Composed prompt</span>
                <span class="workshop-preview-sub">
                  preview with your draft · no LLM call
                </span>
              </div>
              <pre class="workshop-preview-body" id="workshop-preview-body">{composedPreview}</pre>
            </aside>
          </div>
        </form>

        <script src="/public/workshop.js?v=s8-6"></script>
      </div>
    </Layout>
  );
};
