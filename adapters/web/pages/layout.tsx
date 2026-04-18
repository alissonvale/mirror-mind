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
        <link rel="stylesheet" href="/public/style.css?v=s7-2" />
      </head>
      <body>
        <button class="sidebar-toggle" onclick="document.body.classList.toggle('sidebar-open')">
          &#9776;
        </button>
        <aside class="sidebar">
          <div class="sidebar-brand">Mirror Mind</div>
          <div class="sidebar-user">
            <span
              class="sidebar-avatar"
              style={`background-color: ${color}`}
              aria-hidden="true"
            >
              {initials}
            </span>
            <span class="sidebar-user-name">{user.name}</span>
          </div>
          <nav class="sidebar-nav">
            <a href="/mirror" class="sidebar-link">Mirror</a>
            {isAdmin && (
              <>
                <div class="sidebar-section">Admin</div>
                <a href="/admin/users" class="sidebar-link sidebar-link-sub">Users</a>
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
      </body>
    </html>
  );
};
