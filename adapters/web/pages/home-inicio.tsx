import type { FC } from "hono/jsx";
import type { User, Scene, RecentSession } from "../../../server/db.js";
import { TopBarLayout } from "./avatar-top-bar.js";
import { ts } from "../i18n.js";
import { formatRelativeTime } from "../../../server/formatters/relative-time.js";

export interface RecentSessionWithScene extends RecentSession {
  sceneTitle: string | null;
}

/**
 * Variant C: cards above (model), free input below (improvisation),
 * recents at the bottom (resume). The shape locked in the design
 * session 2026-05-01b.
 */
export const InicioPage: FC<{
  user: User;
  scenes: Scene[];
  recents: RecentSessionWithScene[];
}> = ({ user, scenes, recents }) => {
  return (
    <TopBarLayout title={ts("home.inicio.title")} user={user}>
      <style>{`
        .inicio-page {
          max-width: 980px; margin: 2rem auto; padding: 0 1.5rem;
        }
        .inicio-cards-row {
          display: grid; gap: 0.8rem;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          margin-bottom: 1.5rem;
        }
        /* .inicio-card* + .inicio-form-card live in style.css —
           shared with /cenas list page. */
        .inicio-card-last {
          font-size: 0.7rem; color: var(--muted, #a0aec0);
        }
        .inicio-or {
          text-align: center; color: var(--muted, #a0aec0);
          font-size: 0.85rem; margin: 1.5rem 0;
        }
        .inicio-input-form {
          display: flex; gap: 0.5rem;
          max-width: 720px; margin: 0 auto 2rem;
        }
        .inicio-input {
          flex: 1; padding: 0.75rem 1rem;
          border: 1px solid var(--border, #e0e0e0);
          border-radius: 6px; font-size: 1rem;
          background: var(--bg, #fff);
        }
        .inicio-input-submit {
          padding: 0.75rem 1.4rem;
          background: var(--accent, #2c5282);
          color: white; border: 0; border-radius: 6px;
          cursor: pointer; font-size: 1rem;
        }
        .inicio-recents { max-width: 980px; margin: 0 auto; }
        .inicio-recents-heading {
          font-size: 0.95rem; font-weight: 500;
          color: var(--muted, #4a5568);
          margin: 1.5rem 0 0.6rem; padding-bottom: 0.4rem;
          border-bottom: 1px solid var(--border, #e0e0e0);
        }
        .inicio-recents-empty {
          color: var(--muted, #a0aec0); font-style: italic;
          padding: 0.5rem 0;
        }
        /* Recents reuse the .conversations-rows styling from style.css
           so the visual matches /conversations exactly — only data
           differences (no preview, no persona/org/journey tags; we show
           the cena tag instead). */
        .inicio-recents .conversations-row-tag-scene {
          background: #f0f4f8; color: #2c5282;
        }
        .inicio-recents .conversations-row-tag-no-scene {
          background: transparent; color: var(--muted, #a0aec0);
          font-style: italic;
        }
      `}</style>

      <div class="inicio-page">
        <div class="inicio-cards-row">
          {scenes.map((scene) => (
            <CenaCard scene={scene} />
          ))}
          <a href="/cenas/nova" class="inicio-card inicio-card-new">
            <span aria-hidden="true">✚&nbsp;</span>
            {ts("home.inicio.newScene")}
          </a>
        </div>

        <div class="inicio-or">─── {ts("home.inicio.or")} ───</div>

        <form
          method="POST"
          action="/inicio"
          class="inicio-input-form"
          autocomplete="off"
        >
          <input
            type="text"
            name="text"
            class="inicio-input"
            placeholder={ts("home.inicio.input.placeholder")}
            autofocus
            required
          />
          <button type="submit" class="inicio-input-submit">
            {ts("home.inicio.input.submit")}
          </button>
        </form>

        <div class="inicio-recents">
          <h2 class="inicio-recents-heading">{ts("home.inicio.recents")}</h2>
          {recents.length === 0 ? (
            <p class="inicio-recents-empty">{ts("home.inicio.recents.empty")}</p>
          ) : (
            <ul class="conversations-rows">
              {recents.map((r) => (
                <RecentRow row={r} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </TopBarLayout>
  );
};

export const CenaCard: FC<{ scene: Scene }> = ({ scene }) => {
  // Each card is a form so click POSTs (creates a fresh session linked
  // to the cena) — rather than a GET anchor that would imply repeatable
  // navigation. The inner button styles itself like the surrounding
  // card; CSS does the visual work.
  const isAlma = scene.voice === "alma";
  const glyph = isAlma ? "♔" : "◇";
  const colorBar = isAlma ? "#b8956a" : "#2c5282";
  const hasTemporal =
    !!scene.temporal_pattern && scene.temporal_pattern.trim().length > 0;
  const temporalText = hasTemporal
    ? scene.temporal_pattern
    : ts("home.inicio.card.anyTime");
  return (
    <form
      method="POST"
      action={`/cenas/${scene.key}/start`}
      class="inicio-form-card"
    >
      <button
        type="submit"
        class="inicio-card"
        style={`width:100%; text-align:left; background: var(--bg, #fff); cursor: pointer; font: inherit;`}
        title={scene.title}
      >
        <span class="inicio-card-bar" style={`background: ${colorBar}`}></span>
        <div class="inicio-card-head">
          <span
            class={
              isAlma
                ? "inicio-card-glyph inicio-card-glyph--alma"
                : "inicio-card-glyph"
            }
            style={`color: ${colorBar}`}
          >
            {glyph}
          </span>
          <span class="inicio-card-title">{scene.title}</span>
        </div>
        <div
          class={
            hasTemporal
              ? "inicio-card-temporal"
              : "inicio-card-temporal inicio-card-temporal--default"
          }
        >
          {temporalText}
        </div>
      </button>
    </form>
  );
};

const RecentRow: FC<{ row: RecentSessionWithScene }> = ({ row }) => {
  return (
    <li class="conversations-row">
      <a class="conversations-row-link" href={`/conversation/${row.id}`}>
        <div class="conversations-row-head">
          <span class="conversations-row-title">
            {row.title ?? ts("home.inicio.recents.untitled")}
          </span>
          <span class="conversations-row-when">
            {formatRelativeTime(row.lastActivityAt) ?? ""}
          </span>
        </div>
        <div class="conversations-row-tags">
          {row.sceneTitle ? (
            <span class="conversations-row-tag conversations-row-tag-scene">
              ◇ {row.sceneTitle}
            </span>
          ) : (
            <span class="conversations-row-tag conversations-row-tag-no-scene">
              {ts("home.inicio.recents.noScene")}
            </span>
          )}
        </div>
      </a>
    </li>
  );
};
