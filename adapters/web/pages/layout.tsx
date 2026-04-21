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
        <link rel="stylesheet" href="/public/style.css?v=workshop-focus-1" />
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
        <aside class="sidebar">
          <a href="/mirror" class="sidebar-brand" title="Open My Mirror">Mirror Mind</a>
          <a href="/map" class="sidebar-user" title="Open your Cognitive Map">
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
            <a href="/mirror" class="sidebar-link">My Mirror</a>
            <a href="/organizations" class="sidebar-link">Organizations</a>
            <a href="/journeys" class="sidebar-link">Journeys</a>
            {isAdmin && (
              <>
                <div class="sidebar-section">This Mirror</div>
                <a href="/admin" class="sidebar-link sidebar-link-sub">Dashboard</a>
                <a href="/admin/users" class="sidebar-link sidebar-link-sub">Users</a>
                <a href="/admin/models" class="sidebar-link sidebar-link-sub">Models</a>
                <a href="/admin/oauth" class="sidebar-link sidebar-link-sub">OAuth</a>
                <a href="/admin/budget" class="sidebar-link sidebar-link-sub">Budget</a>
                <a href="/docs" class="sidebar-link sidebar-link-sub">Docs</a>
              </>
            )}
          </nav>
          <div class="sidebar-footer">
            <form method="POST" action="/logout">
              <button type="submit" class="sidebar-link sidebar-logout">Logout</button>
            </form>
          </div>
        </aside>
        <main class={`content ${wide ? "content-wide" : ""}`}>{children}</main>
        <script src="/public/layout.js?v=composed-drawer-1"></script>
      </body>
    </html>
  );
};
