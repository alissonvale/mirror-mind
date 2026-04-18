[< Story](index.md)

# Plan: CV0.E3.S3 — In-app docs reader

**Roadmap:** [CV0.E3.S3](../index.md)
**Framing:** the mirror's own story is navigable inside the mirror. An admin opens `/docs` and reads roadmap, decisions, worklog, and design specs without leaving the app or switching to a rendering tool that loses the interconnections.

---

## Goal

A `/docs` route that serves the `docs/` folder as a navigable website:

- **`/docs`** renders `docs/index.md`.
- **`/docs/<path>`** renders `docs/<path>.md` if it exists, else `docs/<path>/index.md` if it exists, else 404.
- **Three-column layout**: main app sidebar on the left, docs navigation tree in the middle, rendered content on the right.
- **Relative markdown links rewrite** to in-app routes (`../product/memory-taxonomy.md` → `/docs/product/memory-taxonomy`).
- **Path traversal blocked** — every resolved path is checked under the docs root.
- **Admin-only.** The content is project-internal (roadmap, decisions, specs). A user manual for regular users is a future story (radar).

## Non-goals

- **Search.** If the frustration shows up, register a separate story. Scope v1 is navigation + rendering.
- **Syntax highlighting.** `<pre><code>` renders as plain monospace. Radar: add `highlight.js` or `shiki` if code-heavy pages become a pain point.
- **Edit-in-app.** Docs are edited via the filesystem + git. The reader is read-only.
- **Cross-references / backlinks.** Nice to have; out of scope.
- **Per-page TOC.** Nice to have; out of scope.
- **User manual surface for non-admins.** Different audience, different voice, different route — future.

## Decisions

### D1 — Layout: three columns

Main app sidebar (far left) + docs nav tree (middle) + content (right). Patterns familiar from Read the Docs, GitBook, and Hono's own docs. The nav tree stays visible the whole time — the mirror's docs are densely interconnected (roadmap ↔ decisions ↔ worklog ↔ story folders), and orientation matters more than horizontal breathing room.

### D2 — Access: admin-only

`/docs/*` routes pass through `adminOnlyMiddleware()` (same as `/admin/*`). Regular users never see the docs link in the sidebar. Rationale: the current `docs/` is project-internal documentation — admin-interest content. A product-level user manual is a future story with its own voice; merging the two would force either technical noise on end users or translation friction on admins.

### D3 — Rendering: `marked` at runtime

`marked` (MIT, small, zero deps) parses markdown to HTML on each request. Runtime over build-time because the docs change often during development; always-current beats the build-step lag.

Performance: the docs folder is small (<100 files). No caching needed for v1. If a page becomes hot, add a tiny LRU.

### D4 — Link rewriting

Every relative `.md` link in a markdown file gets rewritten to its `/docs/` route:

- `[plan](plan.md)` inside `docs/foo/bar/index.md` → `/docs/foo/bar/plan`
- `[taxonomy](../../product/memory-taxonomy.md)` → `/docs/product/memory-taxonomy`

Implemented via a custom `marked` renderer override. Non-`.md` links (external URLs, images, anchors) pass through untouched.

### D5 — Assets

Images referenced by markdown (`![alt](diagram.png)`) are served by a static file handler rooted at `docs/` and mounted at `/docs/static/`. The link renderer rewrites image paths to go through that mount. (None today; listed in case.)

### D6 — Sidebar placement

The **Docs** link lives inside the `{isAdmin && ...}` block in the layout, below **Users**. Grouped with other admin-only affordances so the sidebar reads honestly about who sees what.

## Steps

1. **Install `marked`** and verify it works with ES modules.
2. **`server/docs.ts`** — helpers:
   - `DOCS_ROOT` constant.
   - `resolveDocPath(urlPath): string | null` — URL → filesystem path, returns null on traversal or missing files.
   - `buildNavTree(): NavNode[]` — recursive walk of the docs folder, returns a tree of `{ name, url, children? }`.
   - `renderMarkdown(md, currentUrlPath): string` — marked parse with link renderer override.
3. **`adapters/web/pages/docs.tsx`** — `<DocsPage>` component: three-column layout, nav tree on the left, content on the right.
4. **`adapters/web/index.tsx`** — routes:
   - `GET /docs` → render `docs/index.md`
   - `GET /docs/*` → resolve path, render or 404
   - Static serve `/docs/static/*` → filesystem under `docs/` (for assets)
   - All wrapped in `adminOnlyMiddleware()`
5. **Sidebar link** in `adapters/web/pages/layout.tsx` — "Docs" inside the admin block, below "Users".
6. **CSS** — typography for prose (headings, paragraphs, lists, tables, blockquotes, code); nav-tree styling (expand/collapse for folders, current-page highlight).
7. **Tests** — a small set covering: unauthorized returns 403, admin GET renders index, admin GET a valid page renders its content, invalid path 404s, traversal attempt 404s.
8. **Docs** — test-guide, worklog, mark ✅.

## Files likely touched

- `server/docs.ts` — new
- `adapters/web/pages/docs.tsx` — new
- `adapters/web/index.tsx` — new routes + adminOnly wrapping
- `adapters/web/pages/layout.tsx` — sidebar link
- `adapters/web/public/style.css` — docs layout + prose styling
- `tests/web.test.ts` — coverage
- `package.json` — `marked` dependency
