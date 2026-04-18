[< Story](index.md)

# Test Guide: CV0.E3.S3 — In-app docs reader

## Automated

```bash
npx vitest run
```

New coverage in `tests/web.test.ts`:

- **Regular user gets 403** on `/docs` and `/docs/<path>` — docs are admin-only in v1.
- **Admin GET /docs** renders the index with the nav tree and prose container.
- **Admin GET /docs/process/worklog** renders the worklog page.
- **Admin GET /docs/this/does/not/exist** returns 404.
- **Relative `.md` links rewrite** — rendered HTML contains no `.md"` or `.md#` artifacts.

Total: **132 passing**.

## Manual (browser)

### Navigation

1. Log in as admin. Sidebar → Admin section → click **Docs**.
2. `/docs` opens with the nav collapsed by default (default-for-focus). A `→ Show navigation` button sits at the top of the content.
3. Click **Show navigation**. The nav tree appears on the left with folders and files. Preference saves to `localStorage["mirror.docs.navCollapsed"] = "false"`.
4. Click **Hide navigation** to return to reading mode. Preference saves as `"true"`.
5. Refresh the page — the preferred state persists.

### Link rewriting

Open `/docs`. Click:
- **Roadmap** (directory-style link `project/roadmap/`) — should land on `/docs/project/roadmap`.
- **CV0.E3 — Install Administration** (nested directory link) — should resolve to the correct deep path without 404.
- **Prompt Composition** (`product/prompt-composition/`) — should land on the prompt-composition index.

Open `/docs/project/roadmap`. Click any **code link** in the stories table (e.g., `CV0.E2.S7`) — should navigate to the story folder, not 404. This was the folder-index resolution bug fixed during S3: the URL `/docs/project/roadmap` resolves to `roadmap/index.md`; relative links inside that file now resolve against `/docs/project/roadmap/` (the folder), not `/docs/project/` (the parent).

Open any deep doc. Click `../something.md` relative links — should navigate in-app. Non-docs absolute links like `/map` or `/mirror` are left alone.

### Auth boundary

1. Log out. Log in as a non-admin user (create one via `/admin/users` first).
2. The sidebar has no "Docs" link.
3. Hit `/docs` directly in the URL bar — `403 Forbidden`.
4. Hit `/docs/project/roadmap` directly — `403 Forbidden`.

### Path safety

- `/docs/../package.json` or similar traversal attempts return 404 (`resolveDocPath` returns null for anything that escapes `DOCS_ROOT`).

### Not here by design

- **No search.** Register a separate story if the frustration shows up.
- **No syntax highlighting.** Code blocks render as plain monospace. Add `highlight.js` or `shiki` later if code-heavy pages become a pain point.
- **No inline edit.** Docs are edited via filesystem + git; the reader is read-only.
- **No user manual surface.** Regular users can't reach docs. A product-level user manual with its own voice is a future story.
