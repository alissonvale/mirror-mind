import type { FC } from "hono/jsx";
import { Layout, type SidebarScopes } from "./layout.js";
import type {
  User,
  IdentityLayer,
  Organization,
  Journey,
} from "../../../server/db.js";
import { avatarInitials, avatarColor } from "./context-rail.js";
import { ComposedDrawer } from "./composed-drawer.js";

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
        Personas are the specialized voices the mirror speaks in — a mentor
        who listens with care, a strategist who cuts through noise, a writer
        who crafts with precision. Each persona is a lens the ego activates
        when a particular kind of depth is needed. Click <strong>+ add
        persona</strong> to create your first.
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
            style={`background-color: ${avatarColor(p.key)}`}
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
        <span class="persona-badge-name">add persona</span>
      </a>
    </div>
    {personas.length > 0 && (
      <form
        method="POST"
        action={`${mapRoot}/personas/regenerate-summaries`}
        class="persona-regenerate-form"
        onsubmit="this.querySelector('button').disabled = true; this.querySelector('button').textContent = 'regenerating...';"
      >
        <button type="submit" class="persona-regenerate-btn">
          regenerate all summaries
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
        <strong>{isEdit ? `Edit · ${personaKey}` : "Add a new persona"}</strong>
        <a href={mapRoot} class="persona-form-cancel">cancel</a>
      </div>
      {personaError && <p class="flash flash-error">{personaError}</p>}
      <form method="POST" action={action} class="persona-form-body">
        {!isEdit && (
          <label class="persona-form-field">
            <span class="persona-form-label">Name</span>
            <input
              type="text"
              name="name"
              required
              pattern="[a-z0-9\-]+"
              placeholder="e.g. mentora, product-designer"
              class="persona-form-input"
              autofocus
            />
            <span class="persona-form-hint">
              lowercase, hyphens allowed — used as the persona's key
            </span>
          </label>
        )}
        <label class="persona-form-field">
          <span class="persona-form-label">Prompt</span>
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
            {isEdit ? "Save" : "Create"}
          </button>
          {isEdit && (
            <button
              type="submit"
              formaction={`${mapRoot}/persona/${personaKey}/delete`}
              class="persona-form-delete"
              onclick="return confirm('Delete this persona? This cannot be undone.')"
            >
              Delete
            </button>
          )}
          <a href={mapRoot} class="persona-form-cancel">Cancel</a>
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
            <span class="map-card-readmore">read more →</span>
            <p class="map-card-stats">
              {words} word{words === 1 ? "" : "s"}
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
    <Layout title="Psyche Map" user={currentUser} sidebarScopes={sidebarScopes}>
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
            <span class="map-identity-prefix">Psyche Map of</span>
            <span class="map-identity-name">{targetUser.name}</span>
          </h1>
          {isViewingOther && (
            <span class="map-identity-viewing">
              · viewing as admin · <a href="/map">back to mine</a>
            </span>
          )}
          <a
            href="#"
            class="map-identity-composed"
            data-open-drawer
            title="View the full composed system prompt"
          >
            composed prompt →
          </a>
        </header>


        <div class="map-content">
          <section class="map-structure">
            <StructuralCard
              dataLayer="self-soul"
              title="Self"
              meta="soul"
              colorClass="map-card--self"
              content={soul}
              summary={soulLayer?.summary}
              href={workshopHref("self", "soul")}
              emptyInvitation="Your soul is the deepest voice — what you are before you are anything specific. Frequency, nature, origin. Open the workshop to write your foundation."
            />

            <StructuralCard
              dataLayer="ego-identity"
              title="Ego"
              meta="identity"
              colorClass="map-card--ego"
              content={egoIdentity}
              summary={egoIdentityLayer?.summary}
              href={workshopHref("ego", "identity")}
              emptyInvitation="Your operational identity — how you show up in the day-to-day. What you do, what you're known for, how you introduce yourself. Open the workshop to set it."
            />

            <StructuralCard
              dataLayer="ego-expression"
              title="Ego"
              meta="expression"
              colorClass="map-card--ego"
              content={egoExpression}
              summary={egoExpressionLayer?.summary}
              href={workshopHref("ego", "expression")}
              emptyInvitation="How you speak — format, vocabulary, punctuation, style. Separated from behavior so problems of form and problems of method can be diagnosed independently. Open the workshop to define your expression."
            />

            <StructuralCard
              dataLayer="ego-behavior"
              title="Ego"
              meta="behavior"
              colorClass="map-card--ego"
              content={egoBehavior}
              summary={egoBehaviorLayer?.summary}
              href={workshopHref("ego", "behavior")}
              emptyInvitation="Your behavior — conduct, posture, method. What you do and how you position yourself when you act. Open the workshop to define them."
            />

            <article
              class="map-card map-card--personas"
              data-layer="personas"
              id="personas-card"
            >
              <header class="map-card-header">
                <h2>Personas</h2>
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
              <h2>Memory</h2>
              <span class="map-memory-subtitle">what flows through</span>
            </header>
            <ul class="map-memory-list">
              <li class="map-memory-item">
                <span class="map-memory-glyph">🌀</span>
                <div class="map-memory-body">
                  <span class="map-memory-label">Attention</span>
                  <span class="map-memory-desc">composed this turn</span>
                  <a class="map-memory-link" href="/conversation">open the rail →</a>
                </div>
              </li>
              <li class="map-memory-item">
                <span class="map-memory-glyph">📚</span>
                <div class="map-memory-body">
                  <span class="map-memory-label">Conversations</span>
                  <span class="map-memory-desc">
                    {typeof sessionCount === "number"
                      ? `${sessionCount} session${sessionCount === 1 ? "" : "s"}`
                      : "episodic memory"}
                    {lastSessionAgo && <> · last {lastSessionAgo}</>}
                  </span>
                  <span class="map-memory-link map-memory-link--pending">
                    browse history · coming in CV1.E3
                  </span>
                </div>
              </li>
              <li class="map-memory-item">
                <span class="map-memory-glyph">✨</span>
                <div class="map-memory-body">
                  <span class="map-memory-label">Insights</span>
                  <span class="map-memory-desc">extracted knowledge</span>
                  <span class="map-memory-link map-memory-link--pending">
                    coming with long-term memory
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
