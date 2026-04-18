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
  sessionCount?: number;
  lastSessionAgo?: string | null;
}

interface StructuralCardProps {
  layer: string;
  key: string;
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
    <Layout title="Map" user={currentUser}>
      <div class="map">
        <header class="map-identity">
          <span
            class="map-identity-avatar"
            style={`background-color: ${color}`}
            aria-hidden="true"
          >
            {initials}
          </span>
          <span class="map-identity-name">{targetUser.name}</span>
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
              layer="self"
              key="soul"
              title="Self"
              meta="soul"
              colorClass="map-card--self"
              content={soul}
              href={workshopHref("self", "soul")}
              emptyInvitation="No soul written yet. Open the workshop to set your foundation."
            />

            <StructuralCard
              layer="ego"
              key="identity"
              title="Ego"
              meta="identity"
              colorClass="map-card--ego"
              content={egoIdentity}
              href={workshopHref("ego", "identity")}
              emptyInvitation="Set your operational identity — who you are in the day-to-day."
            />

            <StructuralCard
              layer="ego"
              key="behavior"
              title="Ego"
              meta="behavior"
              colorClass="map-card--ego"
              content={egoBehavior}
              href={workshopHref("ego", "behavior")}
              emptyInvitation="Set your behavior — tone, restrictions, how you act."
            />

            <article
              class="map-card map-card--personas map-card--static"
              data-layer="personas"
            >
              <header class="map-card-header">
                <h2>Personas</h2>
                <span class="map-card-meta">{personas.length}</span>
              </header>
              <div class="map-card-body">
                <p class="map-card-placeholder">
                  badges + inline editor arrive in phase 3
                </p>
              </div>
            </article>

            <article
              class="map-card map-card--skills map-card--static"
              data-layer="skills"
            >
              <header class="map-card-header">
                <h2>Skills</h2>
              </header>
              <div class="map-card-body">
                <p class="map-card-invitation">
                  No skills yet. Skills are what the mirror knows how to do —
                  arriving as a dedicated layer in a future story.
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
