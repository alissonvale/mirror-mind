import type { FC } from "hono/jsx";
import type Database from "better-sqlite3";
import type { User, Journey, Organization } from "../../../server/db.js";
import { getJourneys, getOrganizations } from "../../../server/db.js";
import { avatarInitials, avatarColor } from "./context-rail.js";
import { ts, currentLocale } from "../i18n.js";

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
    <html lang={currentLocale()}>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title} — Mirror Mind</title>
        <link rel="stylesheet" href="/public/style.css?v=alma-cast-2" />
        <link rel="icon" href="data:," />
      </head>
      <body>
        <button
          class="sidebar-toggle"
          title={ts("sidebar.toggle.title")}
          onclick="toggleSidebar()"
        >
          &#9776;
        </button>
        {isAdmin && <div id="budget-alert-banner" class="budget-alert-banner"></div>}
        <aside class="sidebar">
          <a href="/" class="sidebar-brand" title={ts("sidebar.brand.title")}>Mirror Mind</a>
          <a href="/me" class="sidebar-user" title={ts("sidebar.user.title")}>
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
            <div class="sidebar-section">{ts("sidebar.section.conversation")}</div>
            <a href="/conversation" class="sidebar-link">{ts("sidebar.link.current")}</a>
            <form method="POST" action="/conversation/begin-again" class="sidebar-inline-form">
              <button type="submit" class="sidebar-link sidebar-link-action">{ts("sidebar.link.new")}</button>
            </form>
            <a href="/conversations" class="sidebar-link">{ts("sidebar.link.seeAll")}</a>

            <div class="sidebar-section">{ts("sidebar.section.doing")}</div>
            <div class="sidebar-group" data-group="journeys">
              <a href="/journeys" class="sidebar-link sidebar-link-group">
                {ts("sidebar.link.journeys")}
              </a>
              <button
                type="button"
                class="sidebar-group-toggle"
                data-toggle="journeys"
                aria-expanded="false"
                aria-controls="sidebar-sub-journeys"
                title={ts("sidebar.collapse.journeys")}
              >
                <span class="sidebar-group-chevron" aria-hidden="true">▾</span>
              </button>
            </div>
            <div class="sidebar-subs" id="sidebar-sub-journeys" hidden>
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

            <div class="sidebar-section">{ts("sidebar.section.work")}</div>
            <div class="sidebar-group" data-group="organizations">
              <a href="/organizations" class="sidebar-link sidebar-link-group">
                {ts("sidebar.link.organizations")}
              </a>
              <button
                type="button"
                class="sidebar-group-toggle"
                data-toggle="organizations"
                aria-expanded="false"
                aria-controls="sidebar-sub-organizations"
                title={ts("sidebar.collapse.organizations")}
              >
                <span class="sidebar-group-chevron" aria-hidden="true">▾</span>
              </button>
            </div>
            <div class="sidebar-subs" id="sidebar-sub-organizations" hidden>
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

            <div class="sidebar-section">{ts("sidebar.section.identity")}</div>
            <div class="sidebar-group" data-group="psyche">
              <a href="/map" class="sidebar-link sidebar-link-group">
                {ts("sidebar.link.psyche")}
              </a>
              <button
                type="button"
                class="sidebar-group-toggle"
                data-toggle="psyche"
                aria-expanded="false"
                aria-controls="sidebar-sub-psyche"
                title={ts("sidebar.collapse.psyche")}
              >
                <span class="sidebar-group-chevron" aria-hidden="true">▾</span>
              </button>
            </div>
            <div class="sidebar-subs" id="sidebar-sub-psyche" hidden>
              <a href="/map/self/soul" class="sidebar-link sidebar-link-sub">{ts("sidebar.link.soul")}</a>
              <a href="/map/ego/identity" class="sidebar-link sidebar-link-sub">{ts("sidebar.link.identity")}</a>
              <a href="/map/ego/expression" class="sidebar-link sidebar-link-sub">{ts("sidebar.link.expression")}</a>
              <a href="/map/ego/behavior" class="sidebar-link sidebar-link-sub">{ts("sidebar.link.behavior")}</a>
              <a href="/personas" class="sidebar-link sidebar-link-sub">{ts("sidebar.link.personas")}</a>
            </div>

            {/* CV1.E10 follow-up: "Ambiente" section — admin tooling
                grouped under one expand/collapse parent (Admin) with
                Docs, Logs, and Budget as subs. Mirrors the "What I'm
                doing / Where I work / Who am I" pattern. Admin only. */}
            {isAdmin && (
              <>
                <div class="sidebar-section">{ts("sidebar.section.environment")}</div>
                <div class="sidebar-group" data-group="environment">
                  <a href="/admin" class="sidebar-link sidebar-link-group">
                    {ts("sidebar.link.admin")}
                  </a>
                  <button
                    type="button"
                    class="sidebar-group-toggle"
                    data-toggle="environment"
                    aria-expanded="false"
                    aria-controls="sidebar-sub-environment"
                    title={ts("sidebar.collapse.environment")}
                  >
                    <span class="sidebar-group-chevron" aria-hidden="true">▾</span>
                  </button>
                </div>
                <div class="sidebar-subs" id="sidebar-sub-environment" hidden>
                  <a href="/admin/llm-logs" class="sidebar-link sidebar-link-sub">
                    {ts("sidebar.link.logs")}
                  </a>
                  <a href="/admin/budget" class="sidebar-link sidebar-link-sub">
                    {ts("sidebar.link.budget")}
                  </a>
                  <a href="/docs" class="sidebar-link sidebar-link-sub">
                    {ts("sidebar.link.docs")}
                  </a>
                </div>
              </>
            )}
          </nav>
          <div class="sidebar-footer">
            <form method="POST" action="/logout">
              <button type="submit" class="sidebar-link sidebar-logout">{ts("sidebar.link.logout")}</button>
            </form>
          </div>
        </aside>
        <main class={`content ${wide ? "content-wide" : ""}`}>{children}</main>
        <script src="/public/layout.js?v=sidebar-default-collapsed-1"></script>
      </body>
    </html>
  );
};
