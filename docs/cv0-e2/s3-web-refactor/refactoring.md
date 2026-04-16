[< Docs](../../index.md)

# Refactoring: CV0.E2.S3 — Move web to adapters/

This story *is* a refactoring. Notes on what was done and why.

---

### Web as adapter, not server feature

The web client was inside `server/` — pages, assets, routes all mixed with the API core. But it's a client, like CLI and Telegram. Moving it to `adapters/web/` makes the architecture visible in the folder structure: server is core, adapters are edges.

### setupWeb follows setupTelegram pattern

Both export a function `setup*(app, db)` that registers routes on the hono app. The server imports and calls them. One-directional dependency: adapters → server, never the reverse.

### server/index.tsx reduction

From 360 lines to ~120 lines. What remains: dotenv, db init, API routes (/message, /thread), backwards-compat routes, adapter setup calls, serve(). Everything else moved out.

### Templates stay in server/

Identity templates (`server/templates/*.md`) are used by both `admin.ts` (CLI) and the web adapter (user creation form). Keeping them in `server/` avoids duplication. The web adapter reads them via relative path `../../server/templates/`.

### No URL changes

All routes keep the same paths. Users and bookmarks are unaffected.

---

**See also:** [Plan](plan.md)
