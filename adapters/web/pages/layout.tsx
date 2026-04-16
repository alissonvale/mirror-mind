import type { FC } from "hono/jsx";

export const Layout: FC<{ title: string; children: any }> = ({
  title,
  children,
}) => (
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>{title} — Mirror Mind</title>
      <link rel="stylesheet" href="/public/style.css" />
    </head>
    <body>
      <button class="sidebar-toggle" onclick="document.body.classList.toggle('sidebar-open')">
        &#9776;
      </button>
      <aside class="sidebar">
        <div class="sidebar-brand">Mirror Mind</div>
        <nav class="sidebar-nav">
          <a href="/chat" class="sidebar-link">Chat</a>
          <div class="sidebar-section">Admin</div>
          <a href="/admin/users" class="sidebar-link sidebar-link-sub">Users</a>
        </nav>
        <div class="sidebar-footer">
          <form method="POST" action="/logout">
            <button type="submit" class="sidebar-link sidebar-logout">Logout</button>
          </form>
        </div>
      </aside>
      <main class="content">{children}</main>
    </body>
  </html>
);
