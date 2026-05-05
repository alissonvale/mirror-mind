import type { FC } from "hono/jsx";
import { raw } from "hono/html";
import type { User, Journey } from "../../../server/db.js";
import { TopBarLayout } from "./avatar-top-bar.js";
import { ts } from "../i18n.js";

/**
 * Journey portrait — read view that replaces the CRUD form as the default
 * landing for `/journeys/<key>` (CV1.E13.S1). The form moves to
 * `/journeys/<key>/editar` (locale-aware: `/edit` for `en`).
 *
 * S1 ships the URL migration + skeleton page. Subsequent rounds wire the
 * synthesis pipeline (lede, tiles, "onde ela mora", structural section,
 * "a pergunta viva", conversations that shaped it, close).
 *
 * Editorial reference (acceptance criteria) lives at
 * `docs/design/entity-profiles.md` — three reference drafts must be
 * reproducible from the underlying data.
 */
export const JourneyPortraitPage: FC<{
  user: User;
  journey: Journey;
  /** Locale-aware path to the form (`/journeys/<key>/editar` | `/edit`). */
  editPath: string;
}> = ({ user, journey, editPath }) => {
  return (
    <TopBarLayout title={journey.name} user={user}>
      <style>{raw(PORTRAIT_STYLES)}</style>

      <div class="portrait-shell" data-entity="journey">
        <header class="portrait-header">
          <h1 class="portrait-title">{journey.name}</h1>
        </header>

        <p class="portrait-skeleton">{ts("portrait.skeleton")}</p>

        <footer class="portrait-footer">
          <a href={editPath} class="portrait-edit-link">
            {ts("portrait.editLink.journey")}
          </a>
        </footer>
      </div>
    </TopBarLayout>
  );
};

/**
 * Locale-aware path to the form for an entity.
 *  `pt-BR` → `/<entity>/<key>/editar`
 *  everything else → `/<entity>/<key>/edit`
 *
 * Both paths are accepted by the route handler; the locale only decides
 * which one is rendered as the canonical URL inside the page.
 */
export function editPathFor(
  entity: "journeys" | "organizations" | "cenas",
  key: string,
  locale: string,
): string {
  const slug = locale === "pt-BR" ? "editar" : "edit";
  return `/${entity}/${key}/${slug}`;
}

const PORTRAIT_STYLES = `
  .portrait-shell {
    max-width: 640px;
    margin: 2rem auto;
    padding: 0 1.5rem;
    color: var(--text, #2d3748);
  }
  .portrait-title {
    font-family: "EB Garamond", Georgia, serif;
    font-weight: 500;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    font-size: 1.4rem;
    margin: 0 0 1.5rem 0;
  }
  .portrait-skeleton {
    font-family: "EB Garamond", Georgia, serif;
    font-style: italic;
    color: var(--muted, #718096);
    margin: 2rem 0;
    line-height: 1.7;
  }
  .portrait-footer {
    margin-top: 3rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border, #edf2f7);
    text-align: right;
  }
  .portrait-edit-link {
    font-size: 0.85rem;
    color: var(--muted, #a0aec0);
    text-decoration: none;
  }
  .portrait-edit-link:hover {
    color: var(--text, #2d3748);
  }
`;
