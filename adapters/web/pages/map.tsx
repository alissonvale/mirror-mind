import type { FC } from "hono/jsx";
import { Layout } from "./layout.js";
import type { User, IdentityLayer } from "../../../server/db.js";
import { avatarInitials, avatarColor } from "./context-rail.js";

export interface MapPageProps {
  currentUser: User;
  targetUser: User;
  baseLayers: IdentityLayer[];
  personas: IdentityLayer[];
  saved?: string;
  deleted?: string;
  nameError?: string;
  personaError?: string;
  editingPersona?: string;
  addingPersona?: boolean;
  sessionCount?: number;
  lastSessionAgo?: string | null;
}

interface StructuralCardProps {
  title: string;
  meta?: string;
  colorClass: string;
  content?: string;
  href: string;
  emptyInvitation: string;
}

function firstLine(text: string): string {
  const line = text.split(/\r?\n/).find((l) => l.trim().length > 0);
  if (!line) return "";
  const trimmed = line.trim();
  return trimmed.length > 120 ? trimmed.slice(0, 117) + "…" : trimmed;
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

const PersonaBadges: FC<{ personas: IdentityLayer[] }> = ({ personas }) => (
  <div class="persona-badges">
    {personas.map((p) => (
      <a
        href={`/map?editPersona=${encodeURIComponent(p.key)}`}
        class="persona-badge-link"
        title={p.key}
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
    <a href="/map?addPersona=1" class="persona-badge-link persona-badge-add">
      <span class="persona-badge-avatar persona-badge-avatar--add" aria-hidden="true">
        +
      </span>
      <span class="persona-badge-name">add persona</span>
    </a>
  </div>
);

const PersonaForm: FC<{
  mode: "add" | "edit";
  personaKey?: string;
  content?: string;
  personaError?: string;
}> = ({ mode, personaKey, content, personaError }) => {
  const isEdit = mode === "edit";
  const action = isEdit ? `/map/persona/${personaKey}` : "/map/persona";
  return (
    <div class="persona-form">
      <div class="persona-form-header">
        <strong>{isEdit ? `Edit · ${personaKey}` : "Add a new persona"}</strong>
        <a href="/map" class="persona-form-cancel">cancel</a>
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
          >{content ?? ""}</textarea>
        </label>
        <div class="persona-form-actions">
          <button type="submit" class="persona-form-save">
            {isEdit ? "Save" : "Create"}
          </button>
          {isEdit && (
            <button
              type="submit"
              formaction={`/map/persona/${personaKey}/delete`}
              class="persona-form-delete"
              onclick="return confirm('Delete this persona? This cannot be undone.')"
            >
              Delete
            </button>
          )}
          <a href="/map" class="persona-form-cancel">Cancel</a>
        </div>
      </form>
    </div>
  );
};

const StructuralCard: FC<StructuralCardProps> = ({
  title,
  meta,
  colorClass,
  content,
  href,
  emptyInvitation,
}) => {
  const hasContent = content && content.trim().length > 0;
  const preview = hasContent ? firstLine(content!) : "";
  const words = hasContent ? wordCount(content!) : 0;

  return (
    <a
      class={`map-card map-card--link ${colorClass}`}
      href={href}
    >
      <header class="map-card-header">
        <h2>{title}</h2>
        {meta && <span class="map-card-meta">{meta}</span>}
      </header>
      <div class="map-card-body">
        {hasContent ? (
          <>
            <p class="map-card-preview">{preview}</p>
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
  saved,
  deleted,
  nameError,
  personaError,
  editingPersona,
  addingPersona,
  sessionCount,
  lastSessionAgo,
}) => {
  const isViewingOther = currentUser.id !== targetUser.id;
  const initials = avatarInitials(targetUser.name);
  const color = avatarColor(targetUser.name);

  const find = (layer: string, key: string) =>
    baseLayers.find((l) => l.layer === layer && l.key === key)?.content;

  const soul = find("self", "soul");
  const egoIdentity = find("ego", "identity");
  const egoBehavior = find("ego", "behavior");

  const mapRoot = isViewingOther ? `/map/${targetUser.name}` : "/map";
  const workshopHref = (layer: string, key: string) =>
    isViewingOther
      ? `/map/${targetUser.name}/${layer}/${key}`
      : `/map/${layer}/${key}`;

  return (
    <Layout title="Cognitive Map" user={currentUser}>
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
            <span class="map-identity-prefix">Cognitive Map of</span>
            <span class="map-identity-name">{targetUser.name}</span>
          </h1>
          {!isViewingOther && (
            <span class="map-identity-edit-placeholder" title="editing lands in phase 6">
              edit
            </span>
          )}
          {isViewingOther && (
            <span class="map-identity-viewing">
              · viewing as admin · <a href="/map">back to mine</a>
            </span>
          )}
        </header>

        {saved && <p class="flash flash-success">{saved} saved.</p>}
        {deleted && <p class="flash flash-success">{deleted} deleted.</p>}
        {nameError && <p class="flash flash-error">{nameError}</p>}

        <div class="map-content">
          <section class="map-structure">
            <StructuralCard
              title="Self"
              meta="soul"
              colorClass="map-card--self"
              content={soul}
              href={workshopHref("self", "soul")}
              emptyInvitation="No soul written yet. Open the workshop to set your foundation."
            />

            <StructuralCard
              title="Ego"
              meta="identity"
              colorClass="map-card--ego"
              content={egoIdentity}
              href={workshopHref("ego", "identity")}
              emptyInvitation="Set your operational identity — who you are in the day-to-day."
            />

            <StructuralCard
              title="Ego"
              meta="behavior"
              colorClass="map-card--ego"
              content={egoBehavior}
              href={workshopHref("ego", "behavior")}
              emptyInvitation="Set your behavior — tone, restrictions, how you act."
            />

            <article
              class="map-card map-card--personas"
              data-layer="personas"
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
                  />
                ) : editingPersona ? (
                  <PersonaForm
                    mode="edit"
                    personaKey={editingPersona}
                    content={
                      personas.find((p) => p.key === editingPersona)?.content ?? ""
                    }
                    personaError={personaError}
                  />
                ) : (
                  <PersonaBadges personas={personas} />
                )}
              </div>
            </article>

            <article
              class="map-card map-card--skills map-card--static"
              data-layer="skills"
            >
              <header class="map-card-header">
                <h2>Skills</h2>
                <span class="map-card-meta">not yet</span>
              </header>
              <div class="map-card-body">
                <p class="map-card-invitation">
                  Skills are what the mirror knows how to do in the world —
                  memory queries, reaches into external systems, coordinating
                  its own voices. Where the psyche meets action.
                </p>
                <p class="map-card-invitation-meta">
                  The layer doesn't exist yet. When it takes shape, each skill
                  will have its own workshop here, alongside self, ego, and
                  personas.
                </p>
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
                  <a class="map-memory-link" href="/mirror">open the rail →</a>
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
    </Layout>
  );
};
