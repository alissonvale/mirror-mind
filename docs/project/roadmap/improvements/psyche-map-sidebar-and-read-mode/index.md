[< Roadmap](../../index.md)

# Psyche Map sidebar + read/edit mode

**Status:** ✅ Shipped 2026-04-23

## Problem

The Psyche Map section of the sidebar was a single link to `/map`
with no way to jump directly to a specific layer. Configuring the
production mirror, the user kept bouncing through the map dashboard
just to edit soul or an ego layer. Worse, the layer workshop was
always in edit mode — opening it to just *read* your own soul prompt
meant staring at a textarea, visually identical to an edit surface.
Skills was a leftover placeholder card on `/map` that no longer
matched the direction; personas had no listing page parallel to
`/journeys` or `/organizations`, and the expandable sidebar groups
did not remember their state across reloads.

## Fix

Shipped in three rounds, each self-contained:

**Round 1 — Sidebar restructure + Skills off**

- Sub-links under Psyche Map: Soul, Identity, Expression, Behavior,
  Personas. Each lands on the corresponding layer workshop or the
  new `/personas` page.
- Collapse/expand toggle with a rotating chevron on the three main
  links (Journeys, Organizations, Psyche Map). State persisted per
  group in `localStorage.sidebar-group-<name>`. Default: expanded.
- Removed the Skills placeholder card from `/map`.

**Round 2 — Personas page with row controls**

- Added `sort_order` and `show_in_sidebar` columns to the `identity`
  table (additive migration; existing personas seeded with
  alphabetical sort_order, all visible by default).
- `/personas` renders a flat list of personas with reorder (↑/↓) and
  sidebar-visibility controls, matching the `/journeys` and
  `/organizations` shape.
- `loadSidebarScopes` now also returns visible personas, which the
  layout renders as sub-items under the "Personas" sub-link.
- New routes: `POST /personas/:key/reorder`, `POST /personas/:key/sidebar`.

**Round 3 — Read/edit mode on layer and persona workshop**

- `GET /map/:layer/:key` now renders a read view by default — the
  content is parsed with `marked` and displayed as rendered markdown.
  An "Edit →" link appends `?edit=1` to swap into the textarea form.
- `GET /map/persona/:key` works too: `isAllowedWorkshop` dynamically
  allows any persona key the user actually has, so personas share
  the same workshop page as self/ego layers.
- `POST` on a layer or persona workshop redirects to the read view
  of the same workshop (previously bounced to `/map`). The user can
  visually confirm the save before moving on.
- Persona save via the inline form on `/map` also redirects to the
  new workshop read view — consistent entry after any edit.

## Commit

`<filled on commit>` — Psyche Map sidebar restructure + read/edit mode

## Tests added

- `tests/web.test.ts`: layout tests for sub-links and persona
  sidebar items; 4 persona-listing tests (route + reorder + sidebar
  toggle + sub-links); 2 persona workshop tests (read view, save
  redirect); read/edit mode coverage on self/ego workshop; updated
  the admin-sidebar "no old sub-links" assertion to match the new
  structure.
- Total: 511 tests passing (was 504).

## Decisions

**Why `:has()` in CSS and not a class toggle on the row.**
The grid column count on `.scope-row` now varies — personas rows
have no last-session column, journeys/orgs do. Using
`:has(.scope-row-controls):not(:has(.scope-last))` lets the grid
adapt by structural inspection rather than requiring the caller to
pass a flag. Modern browser support is sufficient for the mirror's
audience.

**Why save redirects to the workshop read view instead of staying in
edit mode.** Read-as-confirmation matches the new default experience:
you open a layer to read; you edit intentionally; on save you see
the rendered result. Edit-then-redirect-to-read is the gentler loop.

**Why `marked` and not `renderMarkdown` from `server/docs.ts`.** The
docs renderer rewrites relative `.md` links to `/docs/...` routes,
which is the wrong behavior for personal prompt content. Plain
`marked.parse` suffices; no link rewriting needed.

**Why Personas remains a sub-link under Psyche Map (not a peer
group).** The user framed personas as one of the four layers of the
Psyche Map in the request. Individual personas live as deeper
sub-items under that sub-link, which keeps the psyche-map conceptual
tree intact — Personas is a layer, just like Self and Ego are.
