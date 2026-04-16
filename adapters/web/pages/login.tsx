import type { FC } from "hono/jsx";

export const LoginPage: FC<{ error?: string }> = ({ error }) => (
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Login — Mirror Mind</title>
      <link rel="stylesheet" href="/public/style.css" />
    </head>
    <body>
      <main class="login">
        <h1>Mirror Mind</h1>
        {error && <p class="error">{error}</p>}
        <form method="POST" action="/login">
          <label for="token">Token</label>
          <input
            type="password"
            id="token"
            name="token"
            placeholder="Paste your token"
            required
            autofocus
          />
          <button type="submit">Enter</button>
        </form>
      </main>
    </body>
  </html>
);
