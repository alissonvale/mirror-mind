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
  "ego.behavior": {
    title: "Ego",
    meta: "behavior",
    help: "Tone, restrictions, posture. How you act and refuse to act.",
  },
};

export interface LayerWorkshopPageProps {
  currentUser: User;
  targetUser: User;
  layer: string;
  key: string;
  content: string;
  composedPreview: string;
  error?: string;
}

export const LayerWorkshopPage: FC<LayerWorkshopPageProps> = ({
  currentUser,
  targetUser,
  layer,
  key,
  content,
  composedPreview,
  error,
}) => {
  const metaKey = `${layer}.${key}`;
  const info = LAYER_META[metaKey] ?? {
    title: layer,
    meta: key,
    help: "",
  };
  const isViewingOther = currentUser.id !== targetUser.id;
  const mapHref = isViewingOther ? `/map/${targetUser.name}` : "/map";
  const postAction = isViewingOther
    ? `/map/${targetUser.name}/${layer}/${key}`
    : `/map/${layer}/${key}`;
  const composeEndpoint = isViewingOther
    ? `/map/${targetUser.name}/${layer}/${key}/compose`
    : `/map/${layer}/${key}/compose`;

  return (
    <Layout title={`${info.title} · ${info.meta}`} user={currentUser} wide>
      <div class="workshop">
        <nav class="workshop-breadcrumb">
          <a href={mapHref}>← Map</a>
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

        {error && <p class="flash flash-error">{error}</p>}

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
