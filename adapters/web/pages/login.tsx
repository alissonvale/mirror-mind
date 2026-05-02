import type { FC } from "hono/jsx";
import { ts, currentLocale } from "../i18n.js";

export const LoginPage: FC<{ error?: string }> = ({ error }) => (
  <html lang={currentLocale()}>
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>{ts("login.htmlTitle")} — Mirror Mind</title>
      <link rel="stylesheet" href="/public/style.css?v=map-cards-neutral-1" />
    </head>
    <body class="login-body">
      <main class="login">
        <h1>Mirror Mind</h1>
        {error && <p class="error">{error}</p>}
        <form method="POST" action="/login">
          <label for="token">{ts("login.tokenLabel")}</label>
          <input
            type="password"
            id="token"
            name="token"
            placeholder={ts("login.tokenPlaceholder")}
            required
            autofocus
          />
          <button type="submit">{ts("login.submit")}</button>
        </form>
      </main>
    </body>
  </html>
);
