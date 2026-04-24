import type { FC } from "hono/jsx";
import type Database from "better-sqlite3";
import type { User, Journey, Organization } from "../../../server/db.js";
import { getJourneys, getOrganizations } from "../../../server/db.js";
import { avatarInitials, avatarColor } from "./context-rail.js";

export interface SidebarScopes {
  journeys: Journey[];
  organizations: Organization[];
}

/**
 * Loads the active journeys and organizations the sidebar lists as
 * sub-items under their main links. Called once per request by route
 * handlers that render `Layout`.
 *
 * `sidebarOnly` / `show_in_sidebar = 1` respects the per-item
 * visibility flag — an item may exist and be usable while staying out
 * of the sidebar noise.
 *
 * Personas are intentionally absent: the user's decision was to keep
 * the sidebar to scope-like items that have daily navigation value.
 * The "Personas" sub-link points at `/personas`, which carries the
 * full listing.
 */
export function loadSidebarScopes(
  db: Database.Database,
  userId: string,
): SidebarScopes {
  return {
    journeys: getJourneys(db, userId, { sidebarOnly: true }),
    organizations: getOrganizations(db, userId, { sidebarOnly: true }),
  };
}

export const Layout: FC<{
  title: string;
  user: User;
  children: any;
  wide?: boolean;
  sidebarScopes?: SidebarScopes;
}> = ({ title, user, children, wide, sidebarScopes }) => {
  const isAdmin = user.role === "admin";
  const initials = avatarInitials(user.name);
  const color = avatarColor(user.name);
  const journeys = sidebarScopes?.journeys ?? [];
  const organizations = sidebarScopes?.organizations ?? [];

  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title} — Mirror Mind</title>
        <link rel="stylesheet" href="/public/style.css?v=persona-colors-1" />
        <link rel="icon" href="data:," />
      </head>
      <body>
        <button
          class="sidebar-toggle"
          title="Toggle sidebar"
          onclick="document.body.classList.toggle('sidebar-collapsed')"
        >
          &#9776;
        </button>
        {isAdmin && <div id="budget-alert-banner" class="budget-alert-banner"></div>}
        <aside class="sidebar">
          <a href="/" class="sidebar-brand" title="Open Home">Mirror Mind</a>
          <a href="/me" class="sidebar-user" title="About you">
            <span
              class="sidebar-avatar"
              style={`background-color: ${color}`}
              aria-hidden="true"
            >
              {initials}
            </span>
            <span class="sidebar-user-name">{user.name}</span>
          </a>
          <nav class="sidebar-nav">
            <div class="sidebar-section">Conversation</div>
            <a href="/conversation" class="sidebar-link">Current</a>
            <form method="POST" action="/conversation/begin-again" class="sidebar-inline-form">
              <button type="submit" class="sidebar-link sidebar-link-action">New</button>
            </form>
            <a href="/conversations" class="sidebar-link">See All</a>

            <div class="sidebar-section">What I'm Doing</div>
            <div class="sidebar-group" data-group="journeys">
              <a href="/journeys" class="sidebar-link sidebar-link-group">
                Journeys
              </a>
              <button
                type="button"
                class="sidebar-group-toggle"
                data-toggle="journeys"
                aria-expanded="true"
                aria-controls="sidebar-sub-journeys"
                title="Collapse Journeys"
              >
                <span class="sidebar-group-chevron" aria-hidden="true">▾</span>
              </button>
            </div>
            <div class="sidebar-subs" id="sidebar-sub-journeys">
              {journeys.map((j) => (
                <a
                  href={`/journeys/${j.key}`}
                  class="sidebar-link sidebar-link-sub"
                  title={j.name}
                >
                  {j.name}
                </a>
              ))}
            </div>

            <div class="sidebar-section">Where I Work</div>
            <div class="sidebar-group" data-group="organizations">
              <a href="/organizations" class="sidebar-link sidebar-link-group">
                Organizations
              </a>
              <button
                type="button"
                class="sidebar-group-toggle"
                data-toggle="organizations"
                aria-expanded="true"
                aria-controls="sidebar-sub-organizations"
                title="Collapse Organizations"
              >
                <span class="sidebar-group-chevron" aria-hidden="true">▾</span>
              </button>
            </div>
            <div class="sidebar-subs" id="sidebar-sub-organizations">
              {organizations.map((o) => (
                <a
                  href={`/organizations/${o.key}`}
                  class="sidebar-link sidebar-link-sub"
                  title={o.name}
                >
                  {o.name}
                </a>
              ))}
            </div>

            <div class="sidebar-section">Who Am I</div>
            <div class="sidebar-group" data-group="psyche">
              <a href="/map" class="sidebar-link sidebar-link-group">
                Psyche Map
              </a>
              <button
                type="button"
                class="sidebar-group-toggle"
                data-toggle="psyche"
                aria-expanded="true"
                aria-controls="sidebar-sub-psyche"
                title="Collapse Psyche Map"
              >
                <span class="sidebar-group-chevron" aria-hidden="true">▾</span>
              </button>
            </div>
            <div class="sidebar-subs" id="sidebar-sub-psyche">
              <a href="/map/self/soul" class="sidebar-link sidebar-link-sub">Soul</a>
              <a href="/map/ego/identity" class="sidebar-link sidebar-link-sub">Identity</a>
              <a href="/map/ego/expression" class="sidebar-link sidebar-link-sub">Expression</a>
              <a href="/map/ego/behavior" class="sidebar-link sidebar-link-sub">Behavior</a>
              <a href="/personas" class="sidebar-link sidebar-link-sub">Personas</a>
            </div>
          </nav>
          <div class="sidebar-footer">
            {isAdmin && (
              <a href="/admin" class="sidebar-link sidebar-admin-workspace">
                Admin Workspace
              </a>
            )}
            {isAdmin && (
              <a href="/docs" class="sidebar-link sidebar-docs">
                Docs
              </a>
            )}
            <form method="POST" action="/logout">
              <button type="submit" class="sidebar-link sidebar-logout">Logout</button>
            </form>
          </div>
        </aside>
        <main class={`content ${wide ? "content-wide" : ""}`}>{children}</main>
        <script src="/public/layout.js?v=sidebar-groups-1"></script>
      </body>
    </html>
  );
};
