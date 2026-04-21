[< CV0.E4 — Home & Navigation](../index.md)

# S4 — About You

A new authenticated route `/me` absorbs everything clerical about the user's relationship with the mirror: name editing, display preferences, light self-portrait stats, data sovereignty placeholders. Clicking the avatar in the sidebar now opens this page instead of the Psyche Map — the avatar was always a link to "you," the Psyche Map was always a link to "your structure," and the overload is finally undone.

**Four bands:**

1. **Header** — avatar, name (editable inline), member-since date, role badge
2. **Preferences** — admin-only BRL-cost toggle (migrated from `/admin/budget`); placeholder for non-admin users
3. **How the mirror sees you** — contemplative self-portrait: total conversations, total messages, most active persona, last activity
4. **Data** — export placeholder pointing at CV1.E6.S6 (Memory Map — data sovereignty)

**Derived from:** 2026-04-21 modo Espelho conversation, after the sidebar was reorganized by the three questions (S3). With the Psyche Map now a first-class nav link, clicking the avatar had no clear destination. The product-designer persona proposed this page as the "operational you" counterpart to the "structural you" that the map already represents.

- [Plan](plan.md) — scope, bands, migrations, files touched
- [Test guide](test-guide.md) — automated + manual acceptance

## Done criteria

1. `GET /me` renders four bands in order: Header, Preferences, How the mirror sees you, Data.
2. Clicking the avatar in the sidebar navigates to `/me` (was `/map`).
3. Name editing happens inline on `/me` (form posts to `/me/name`); `/map` no longer has name-edit affordance.
4. BRL-cost toggle lives in the Preferences band on `/me`; `/admin/budget` shows a short note pointing to `/me`; the old `/admin/budget/show-brl` endpoint is removed.
5. Non-admin users see an empty-state paragraph in Preferences (no controls yet for them).
6. "How the mirror sees you" computes total sessions, total messages, most frequent persona (from assistant message meta), and last-activity relative time.
7. `npm test` green; zero regressions in existing flows.
