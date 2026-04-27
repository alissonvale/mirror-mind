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
import { hashPersonaColor } from "../../../server/personas/colors.js";
import { ts } from "../i18n.js";

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
  /**
   * Persona-only visual color — the row's stored color, or null when
   * the persona is still inheriting the hash fallback. The color
   * picker section only renders when layer === "persona".
   */
  personaColor?: string | null;
}

function resolveLayerMeta(
  layer: string,
  layerKey: string,
): { title: string; meta: string; help: string } {
  const isPersona = layer === "persona";
  const metaKey = `${layer}.${layerKey}`;
  if (metaKey === "self.soul") {
    return {
      title: ts("layer.title.self"),
      meta: ts("layer.meta.soul"),
      help: ts("layer.help.self.soul"),
    };
  }
  if (metaKey === "ego.identity") {
    return {
      title: ts("layer.title.ego"),
      meta: ts("layer.meta.identity"),
      help: ts("layer.help.ego.identity"),
    };
  }
  if (metaKey === "ego.expression") {
    return {
      title: ts("layer.title.ego"),
      meta: ts("layer.meta.expression"),
      help: ts("layer.help.ego.expression"),
    };
  }
  if (metaKey === "ego.behavior") {
    return {
      title: ts("layer.title.ego"),
      meta: ts("layer.meta.behavior"),
      help: ts("layer.help.ego.behavior"),
    };
  }
  return {
    title: isPersona ? ts("layer.title.persona") : layer,
    meta: layerKey,
    help: isPersona ? ts("layer.help.persona") : "",
  };
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
  personaColor,
}) => {
  const isPersona = layer === "persona";
  const info = resolveLayerMeta(layer, layerKey);
  const isViewingOther = currentUser.id !== targetUser.id;
  const mapRoot = isViewingOther ? `/map/${targetUser.name}` : "/map";
  const selfHref = `${mapRoot}/${layer}/${layerKey}`;
  const postAction = selfHref;
  const editHref = `${selfHref}?edit=1`;
  const regenerateAction = `${selfHref}/regenerate-summary`;
  const composedEndpoint = `${mapRoot}/composed`;
  const colorAction = `${selfHref}/color`;
  const resolvedColor = personaColor ?? hashPersonaColor(layerKey);
  const contentHtml = content.trim()
    ? (marked.parse(content, { async: false }) as string)
    : "";

  return (
    <Layout title={`${info.title} · ${info.meta}`} user={currentUser} wide sidebarScopes={sidebarScopes}>
      <div class="workshop">
        <nav class="workshop-breadcrumb">
          <a href={mapRoot}>{ts("layer.breadcrumbBack")}</a>
          <span class="workshop-breadcrumb-sep">/</span>
          <span>{info.title}</span>
          <span class="workshop-breadcrumb-sep">·</span>
          <span class="workshop-breadcrumb-meta">{info.meta}</span>
          {isViewingOther && (
            <span class="workshop-breadcrumb-viewing">
              · {ts("layer.editingOther")} <strong>{targetUser.name}</strong>
            </span>
          )}
          <a
            href="#"
            class="workshop-breadcrumb-composed"
            data-open-drawer
            title={ts("layer.composedTitle")}
          >
            {ts("layer.composedLink")}
          </a>
        </nav>

        <header class="workshop-header">
          <h1>
            {info.title}
            <span class="workshop-header-meta">· {info.meta}</span>
          </h1>
          {info.help && <p class="workshop-header-help">{info.help}</p>}
        </header>

        {isPersona && (
          <section class="workshop-color">
            <div class="workshop-color-header">
              <span class="workshop-color-label">{ts("layer.color.label")}</span>
              <span class="workshop-color-sub">
                {ts("layer.color.sub")}
              </span>
            </div>
            <form
              method="POST"
              action={colorAction}
              class="workshop-color-form"
            >
              <label class="workshop-color-picker">
                <input
                  type="color"
                  name="color"
                  value={resolvedColor}
                  class="workshop-color-picker-input"
                  aria-label={ts("layer.color.aria")}
                />
                <span class="workshop-color-picker-label">{resolvedColor}</span>
              </label>
              <button type="submit" class="workshop-color-picker-save">
                {ts("common.save")}
              </button>
            </form>
          </section>
        )}

        <section class="workshop-summary">
          <div class="workshop-summary-header">
            <span class="workshop-summary-label">{ts("scope.workshop.summaryLabel")}</span>
            <span class="workshop-summary-sub">
              {ts("layer.summarySub")}
            </span>
          </div>
          {summary ? (
            <p class="workshop-summary-body">{summary}</p>
          ) : (
            <p class="workshop-summary-empty">
              {ts("scope.workshop.summaryEmpty")}
            </p>
          )}
          <form method="POST" action={regenerateAction} class="workshop-summary-form">
            <button type="submit" class="workshop-summary-regenerate">
              {ts("scope.workshop.regenerateSummary")}
            </button>
          </form>
        </section>

        {mode === "read" ? (
          <section class="workshop-read">
            <div class="workshop-read-header">
              <span class="workshop-read-label">{ts("layer.contentLabel")}</span>
              <a href={editHref} class="workshop-edit-link">{ts("layer.editLink")}</a>
            </div>
            {contentHtml ? (
              <div class="workshop-read-body">{raw(contentHtml)}</div>
            ) : (
              <p class="workshop-read-empty">
                {ts("layer.readEmpty")}
              </p>
            )}
          </section>
        ) : (
          <form method="POST" action={postAction} class="workshop-form">
            <label class="workshop-label" for="workshop-content">
              {ts("layer.writingLabel")}
            </label>
            <textarea
              id="workshop-content"
              name="content"
              class="workshop-textarea"
              spellcheck="false"
            >{content}</textarea>
            <div class="workshop-actions">
              <button type="submit" class="workshop-save">{ts("common.save")}</button>
              <a href={selfHref} class="workshop-cancel">{ts("common.cancel")}</a>
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
