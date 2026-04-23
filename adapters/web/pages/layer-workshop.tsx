import type { FC } from "hono/jsx";
import { raw } from "hono/html";
import { marked } from "marked";
import { Layout, type SidebarScopes } from "./layout.js";
import type {
  User,
  IdentityLayer,
  Organization,
  Journey,
} from "../../../server/db.js";
import { ComposedDrawer } from "./composed-drawer.js";

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

export type WorkshopMode = "read" | "edit";

export interface LayerWorkshopPageProps {
  currentUser: User;
  targetUser: User;
  layer: string;
  layerKey: string;
  content: string;
  summary: string | null;
  mode: WorkshopMode;
  personas: IdentityLayer[];
  organizations: Organization[];
  journeys: Journey[];
  sidebarScopes?: SidebarScopes;
}

export const LayerWorkshopPage: FC<LayerWorkshopPageProps> = ({
  currentUser,
  targetUser,
  layer,
  layerKey,
  content,
  summary,
  mode,
  personas,
  organizations,
  journeys,
  sidebarScopes,
}) => {
  const metaKey = `${layer}.${layerKey}`;
  const isPersona = layer === "persona";
  const info = LAYER_META[metaKey] ?? {
    title: isPersona ? "Persona" : layer,
    meta: layerKey,
    help: isPersona
      ? "A specialized lens the mirror activates when reception detects the persona's domain. The content below joins the composed prompt in place of (or alongside) the base voice."
      : "",
  };
  const isViewingOther = currentUser.id !== targetUser.id;
  const mapRoot = isViewingOther ? `/map/${targetUser.name}` : "/map";
  const selfHref = `${mapRoot}/${layer}/${layerKey}`;
  const postAction = selfHref;
  const editHref = `${selfHref}?edit=1`;
  const regenerateAction = `${selfHref}/regenerate-summary`;
  const composedEndpoint = `${mapRoot}/composed`;
  const contentHtml = content.trim()
    ? (marked.parse(content, { async: false }) as string)
    : "";

  return (
    <Layout title={`${info.title} · ${info.meta}`} user={currentUser} wide sidebarScopes={sidebarScopes}>
      <div class="workshop">
        <nav class="workshop-breadcrumb">
          <a href={mapRoot}>← Psyche Map</a>
          <span class="workshop-breadcrumb-sep">/</span>
          <span>{info.title}</span>
          <span class="workshop-breadcrumb-sep">·</span>
          <span class="workshop-breadcrumb-meta">{info.meta}</span>
          {isViewingOther && (
            <span class="workshop-breadcrumb-viewing">
              · editing <strong>{targetUser.name}</strong>
            </span>
          )}
          <a
            href="#"
            class="workshop-breadcrumb-composed"
            data-open-drawer
            title="View the full composed system prompt"
          >
            composed prompt →
          </a>
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
              shown on Psyche Map cards and used by reception routing · regenerated automatically on Save
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

        {mode === "read" ? (
          <section class="workshop-read">
            <div class="workshop-read-header">
              <span class="workshop-read-label">Content</span>
              <a href={editHref} class="workshop-edit-link">Edit →</a>
            </div>
            {contentHtml ? (
              <div class="workshop-read-body">{raw(contentHtml)}</div>
            ) : (
              <p class="workshop-read-empty">
                Nothing written yet. Click Edit to start.
              </p>
            )}
          </section>
        ) : (
          <form method="POST" action={postAction} class="workshop-form">
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
              <a href={selfHref} class="workshop-cancel">Cancel</a>
            </div>
          </form>
        )}
      </div>

      <ComposedDrawer
        endpoint={composedEndpoint}
        personas={personas}
        organizations={organizations}
        journeys={journeys}
      />
    </Layout>
  );
};
