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
            <span class="map-identity-edit-placeholder" title="editing lands in phase 5">
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
            <article class="map-card map-card--self" data-layer="self-soul">
              <header class="map-card-header">
                <h2>Self</h2>
                <span class="map-card-meta">soul</span>
              </header>
              <div class="map-card-body">
                <p class="map-card-placeholder">self/soul content goes here</p>
              </div>
            </article>

            <article class="map-card map-card--ego" data-layer="ego-identity">
              <header class="map-card-header">
                <h2>Ego</h2>
                <span class="map-card-meta">identity</span>
              </header>
              <div class="map-card-body">
                <p class="map-card-placeholder">ego/identity content goes here</p>
              </div>
            </article>

            <article class="map-card map-card--ego" data-layer="ego-behavior">
              <header class="map-card-header">
                <h2>Ego</h2>
                <span class="map-card-meta">behavior</span>
              </header>
              <div class="map-card-body">
                <p class="map-card-placeholder">ego/behavior content goes here</p>
              </div>
            </article>

            <article class="map-card map-card--personas" data-layer="personas">
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

            <article class="map-card map-card--skills" data-layer="skills">
              <header class="map-card-header">
                <h2>Skills</h2>
              </header>
              <div class="map-card-body">
                <p class="map-card-placeholder">
                  empty state with invitation lands in S10
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
