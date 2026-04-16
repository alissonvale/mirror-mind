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
      <nav>
        <a href="/chat">Chat</a>
        <a href="/admin/users">Users</a>
        <form method="POST" action="/logout" style="display:inline">
          <button type="submit" class="nav-link">Logout</button>
        </form>
      </nav>
      <main>{children}</main>
    </body>
  </html>
);
