import type { FC } from "hono/jsx";
import type { User } from "../../../server/db.js";
import { avatarInitials, avatarColor } from "./context-rail.js";

export const Layout: FC<{
  title: string;
  user: User;
  children: any;
  wide?: boolean;
}> = ({ title, user, children, wide }) => {
  const isAdmin = user.role === "admin";
  const initials = avatarInitials(user.name);
  const color = avatarColor(user.name);

  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title} — Mirror Mind</title>
        <link rel="stylesheet" href="/public/style.css?v=scope-atelier-1" />
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
            <a href="/conversation" class="sidebar-link">Conversation</a>

            <div class="sidebar-section">What I'm Doing</div>
            <a href="/journeys" class="sidebar-link">Journeys</a>

            <div class="sidebar-section">Where I Work</div>
            <a href="/organizations" class="sidebar-link">Organizations</a>

            <div class="sidebar-section">Who Am I</div>
            <a href="/map" class="sidebar-link">Psyche Map</a>
          </nav>
          <div class="sidebar-footer">
            {isAdmin && (
              <a href="/admin" class="sidebar-link sidebar-admin-workspace">
                Admin Workspace
              </a>
            )}
            <form method="POST" action="/logout">
              <button type="submit" class="sidebar-link sidebar-logout">Logout</button>
            </form>
          </div>
        </aside>
        <main class={`content ${wide ? "content-wide" : ""}`}>{children}</main>
        <script src="/public/layout.js?v=s6-budget-1"></script>
      </body>
    </html>
  );
};
