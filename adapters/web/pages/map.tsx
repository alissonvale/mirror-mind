import type { FC } from "hono/jsx";
import { Layout, type SidebarScopes } from "./layout.js";
import type {
  User,
  IdentityLayer,
  Organization,
  Journey,
} from "../../../server/db.js";
import { avatarInitials, avatarColor } from "./context-rail.js";
import { resolvePersonaColor } from "../../../server/personas/colors.js";
import { ComposedDrawer } from "./composed-drawer.js";
import { ts } from "../i18n.js";

export interface MapPageProps {
  currentUser: User;
  targetUser: User;
  baseLayers: IdentityLayer[];
  personas: IdentityLayer[];
  organizations: Organization[];
  journeys: Journey[];
  personaError?: string;
  editingPersona?: string;
  addingPersona?: boolean;
  sessionCount?: number;
  lastSessionAgo?: string | null;
  sidebarScopes?: SidebarScopes;
}

interface StructuralCardProps {
  title: string;
  meta?: string;
  colorClass: string;
  content?: string;
  summary?: string | null;
  href: string;
  emptyInvitation: string;
}

function firstLine(text: string): string {
  const line = text.split(/\r?\n/).find((l) => l.trim().length > 0);
  if (!line) return "";
  const trimmed = line.trim();
  return trimmed.length > 120 ? trimmed.slice(0, 117) + "…" : trimmed;
}

function cardPreview(content: string, summary?: string | null): string {
  if (summary && summary.trim()) {
    const trimmed = summary.trim();
    return trimmed.length > 240 ? trimmed.slice(0, 237) + "…" : trimmed;
  }
  return firstLine(content);
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

const PersonaBadges: FC<{
  personas: IdentityLayer[];
  mapRoot: string;
}> = ({ personas, mapRoot }) => (
  <>
    {personas.length === 0 && (
      <p class="map-card-invitation persona-invitation">
        {ts("map.invitation.personasPart1")}{" "}
        <strong>{ts("map.invitation.personasAdd")}</strong>{" "}
        {ts("map.invitation.personasPart2")}
      </p>
    )}
    <div class="persona-badges">
      {personas.map((p) => (
        <a
          href={`${mapRoot}?editPersona=${encodeURIComponent(p.key)}#personas-card`}
          class="persona-badge-link"
          data-summary={p.summary ?? ""}
        >
          <span
            class="persona-badge-avatar"
            style={`background-color: ${resolvePersonaColor(p.color, p.key)}`}
            aria-hidden="true"
          >
            {avatarInitials(p.key)}
          </span>
          <span class="persona-badge-name">{p.key}</span>
        </a>
      ))}
      <a
        href={`${mapRoot}?addPersona=1#personas-card`}
        class="persona-badge-link persona-badge-add"
      >
        <span class="persona-badge-avatar persona-badge-avatar--add" aria-hidden="true">
          +
        </span>
        <span class="persona-badge-name">{ts("map.persona.addLink")}</span>
      </a>
    </div>
    {personas.length > 0 && (
      <form
        method="POST"
        action={`${mapRoot}/personas/regenerate-summaries`}
        class="persona-regenerate-form"
        onsubmit={`this.querySelector('button').disabled = true; this.querySelector('button').textContent = '${ts("map.persona.regeneratingAll").replace(/'/g, "\\'")}';`}
      >
        <button type="submit" class="persona-regenerate-btn">
          {ts("map.persona.regenerateAll")}
        </button>
      </form>
    )}
  </>
);

const PersonaForm: FC<{
  mode: "add" | "edit";
  personaKey?: string;
  content?: string;
  personaError?: string;
  mapRoot: string;
}> = ({ mode, personaKey, content, personaError, mapRoot }) => {
  const isEdit = mode === "edit";
  const action = isEdit
    ? `${mapRoot}/persona/${personaKey}`
    : `${mapRoot}/persona`;
  return (
    <div class="persona-form">
      <div class="persona-form-header">
        <strong>{isEdit ? `${ts("map.persona.editPrefix")} · ${personaKey}` : ts("map.persona.addNew")}</strong>
        <a href={mapRoot} class="persona-form-cancel">{ts("map.persona.cancel")}</a>
      </div>
      {personaError && <p class="flash flash-error">{personaError}</p>}
      <form method="POST" action={action} class="persona-form-body">
        {!isEdit && (
          <label class="persona-form-field">
            <span class="persona-form-label">{ts("map.persona.nameLabel")}</span>
            <input
              type="text"
              name="name"
              required
              pattern="[a-z0-9\-]+"
              placeholder={ts("map.persona.namePlaceholder")}
              class="persona-form-input"
              autofocus
            />
            <span class="persona-form-hint">
              {ts("map.persona.nameHint")}
            </span>
          </label>
        )}
        <label class="persona-form-field">
          <span class="persona-form-label">{ts("map.persona.promptLabel")}</span>
          <textarea
            name="content"
            class="persona-form-textarea"
            spellcheck="false"
            required
            autofocus={isEdit ? true : undefined}
          >{content ?? ""}</textarea>
        </label>
        <div class="persona-form-actions">
          <button type="submit" class="persona-form-save">
            {isEdit ? ts("common.save") : ts("scope.create.submit")}
          </button>
          {isEdit && (
            <button
              type="submit"
              formaction={`${mapRoot}/persona/${personaKey}/delete`}
              class="persona-form-delete"
              onclick={`return confirm('${ts("map.persona.deleteConfirm").replace(/'/g, "\\'")}')`}
            >
              {ts("map.persona.delete")}
            </button>
          )}
          <a href={mapRoot} class="persona-form-cancel">{ts("common.cancel")}</a>
        </div>
      </form>
    </div>
  );
};

const StructuralCard: FC<
  StructuralCardProps & { dataLayer: string }
> = ({ title, meta, colorClass, content, summary, href, emptyInvitation, dataLayer }) => {
  const hasContent = content && content.trim().length > 0;
  const preview = hasContent ? cardPreview(content!, summary) : "";
  const words = hasContent ? wordCount(content!) : 0;

  return (
    <a
      class={`map-card map-card--link ${colorClass}`}
      href={href}
      data-layer={dataLayer}
    >
      <header class="map-card-header">
        <h2>{title}</h2>
        {meta && <span class="map-card-meta">{meta}</span>}
      </header>
      <div class="map-card-body">
        {hasContent ? (
          <>
            <p class="map-card-preview">{preview}</p>
            <span class="map-card-readmore">{ts("map.card.readMore")}</span>
            <p class="map-card-stats">
              {ts(words === 1 ? "map.card.wordOne" : "map.card.wordMany", { n: words })}
            </p>
          </>
        ) : (
          <p class="map-card-invitation">{emptyInvitation}</p>
        )}
      </div>
    </a>
  );
};

export const MapPage: FC<MapPageProps> = ({
  currentUser,
  targetUser,
  baseLayers,
  personas,
  organizations,
  journeys,
  personaError,
  editingPersona,
  addingPersona,
  sessionCount,
  lastSessionAgo,
  sidebarScopes,
}) => {
  const isViewingOther = currentUser.id !== targetUser.id;
  const initials = avatarInitials(targetUser.name);
  const color = avatarColor(targetUser.name);

  const findLayer = (layer: string, key: string) =>
    baseLayers.find((l) => l.layer === layer && l.key === key);

  const soulLayer = findLayer("self", "soul");
  const egoIdentityLayer = findLayer("ego", "identity");
  const egoExpressionLayer = findLayer("ego", "expression");
  const egoBehaviorLayer = findLayer("ego", "behavior");

  const soul = soulLayer?.content;
  const egoIdentity = egoIdentityLayer?.content;
  const egoExpression = egoExpressionLayer?.content;
  const egoBehavior = egoBehaviorLayer?.content;

  const mapRoot = isViewingOther ? `/map/${targetUser.name}` : "/map";
  const workshopHref = (layer: string, key: string) =>
    isViewingOther
      ? `/map/${targetUser.name}/${layer}/${key}`
      : `/map/${layer}/${key}`;

  return (
    <Layout title={ts("map.htmlTitle")} user={currentUser} sidebarScopes={sidebarScopes}>
      <div class="map">
        <header class="map-identity">
          <span
            class="map-identity-avatar"
            style={`background-color: ${color}`}
            aria-hidden="true"
          >
            {initials}
          </span>
          <h1 class="map-identity-title">
            <span class="map-identity-prefix">{ts("map.identityPrefix")}</span>
            <span class="map-identity-name">{targetUser.name}</span>
          </h1>
          {isViewingOther && (
            <span class="map-identity-viewing">
              · {ts("map.viewingAdmin")} · <a href="/map">{ts("map.backToMine")}</a>
            </span>
          )}
          <a
            href="#"
            class="map-identity-composed"
            data-open-drawer
            title={ts("layer.composedTitle")}
          >
            {ts("layer.composedLink")}
          </a>
        </header>


        <div class="map-content">
          <section class="map-structure">
            <StructuralCard
              dataLayer="self-soul"
              title={ts("layer.title.self")}
              meta={ts("layer.meta.soul")}
              colorClass="map-card--self"
              content={soul}
              summary={soulLayer?.summary}
              href={workshopHref("self", "soul")}
              emptyInvitation={ts("map.invitation.soul")}
            />

            <StructuralCard
              dataLayer="ego-identity"
              title={ts("layer.title.ego")}
              meta={ts("layer.meta.identity")}
              colorClass="map-card--ego"
              content={egoIdentity}
              summary={egoIdentityLayer?.summary}
              href={workshopHref("ego", "identity")}
              emptyInvitation={ts("map.invitation.identity")}
            />

            <StructuralCard
              dataLayer="ego-expression"
              title={ts("layer.title.ego")}
              meta={ts("layer.meta.expression")}
              colorClass="map-card--ego"
              content={egoExpression}
              summary={egoExpressionLayer?.summary}
              href={workshopHref("ego", "expression")}
              emptyInvitation={ts("map.invitation.expression")}
            />

            <StructuralCard
              dataLayer="ego-behavior"
              title={ts("layer.title.ego")}
              meta={ts("layer.meta.behavior")}
              colorClass="map-card--ego"
              content={egoBehavior}
              summary={egoBehaviorLayer?.summary}
              href={workshopHref("ego", "behavior")}
              emptyInvitation={ts("map.invitation.behavior")}
            />

            <article
              class="map-card map-card--personas"
              data-layer="personas"
              id="personas-card"
            >
              <header class="map-card-header">
                <h2>{ts("map.personasHeading")}</h2>
                <span class="map-card-meta">{personas.length}</span>
              </header>
              <div class="map-card-body">
                {addingPersona ? (
                  <PersonaForm
                    mode="add"
                    personaError={personaError}
                    mapRoot={mapRoot}
                  />
                ) : editingPersona ? (
                  <PersonaForm
                    mode="edit"
                    personaKey={editingPersona}
                    content={
                      personas.find((p) => p.key === editingPersona)?.content ?? ""
                    }
                    personaError={personaError}
                    mapRoot={mapRoot}
                  />
                ) : (
                  <PersonaBadges personas={personas} mapRoot={mapRoot} />
                )}
              </div>
            </article>

          </section>

          <aside class="map-memory" data-layer="memory">
            <header class="map-memory-header">
              <h2>{ts("map.memory.heading")}</h2>
              <span class="map-memory-subtitle">{ts("map.memory.subtitle")}</span>
            </header>
            <ul class="map-memory-list">
              <li class="map-memory-item">
                <span class="map-memory-glyph">🌀</span>
                <div class="map-memory-body">
                  <span class="map-memory-label">{ts("map.memory.attention.label")}</span>
                  <span class="map-memory-desc">{ts("map.memory.attention.desc")}</span>
                  <a class="map-memory-link" href="/conversation">{ts("map.memory.attention.link")}</a>
                </div>
              </li>
              <li class="map-memory-item">
                <span class="map-memory-glyph">📚</span>
                <div class="map-memory-body">
                  <span class="map-memory-label">{ts("map.memory.conversations.label")}</span>
                  <span class="map-memory-desc">
                    {typeof sessionCount === "number"
                      ? ts(sessionCount === 1 ? "map.memory.sessionOne" : "map.memory.sessionMany", { count: sessionCount })
                      : ts("map.memory.episodic")}
                    {lastSessionAgo && <> · {ts("map.memory.last", { ago: lastSessionAgo })}</>}
                  </span>
                  <span class="map-memory-link map-memory-link--pending">
                    {ts("map.memory.conversations.pending")}
                  </span>
                </div>
              </li>
              <li class="map-memory-item">
                <span class="map-memory-glyph">✨</span>
                <div class="map-memory-body">
                  <span class="map-memory-label">{ts("map.memory.insights.label")}</span>
                  <span class="map-memory-desc">{ts("map.memory.insights.desc")}</span>
                  <span class="map-memory-link map-memory-link--pending">
                    {ts("map.memory.insights.pending")}
                  </span>
                </div>
              </li>
            </ul>
          </aside>
        </div>
      </div>
      <ComposedDrawer
        endpoint={`${mapRoot}/composed`}
        personas={personas}
        organizations={organizations}
        journeys={journeys}
      />
    </Layout>
  );
};
