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
          display: grid; gap: 1rem;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          margin-bottom: 1.5rem;
        }
        .inicio-card {
          display: block;
          aspect-ratio: 11 / 12;
          padding: 0.9rem 1rem;
          border-radius: 8px;
          background: var(--bg, #fff);
          border: 1px solid var(--border, #e0e0e0);
          text-decoration: none; color: inherit;
          position: relative; overflow: hidden;
          transition: box-shadow 0.15s, transform 0.15s;
        }
        .inicio-card:hover {
          box-shadow: 0 4px 16px rgba(0,0,0,0.08);
          transform: translateY(-1px);
        }
        .inicio-card-bar {
          position: absolute; left: 0; top: 0; bottom: 0;
          width: 4px;
        }
        .inicio-card-glyph {
          font-size: 1.1rem; margin-bottom: 0.5rem; display: block;
        }
        .inicio-card-title {
          font-weight: 500; font-size: 0.95rem; line-height: 1.3;
          display: -webkit-box; -webkit-line-clamp: 2;
          -webkit-box-orient: vertical; overflow: hidden;
        }
        .inicio-card-temporal {
          margin-top: 0.4rem; font-size: 0.78rem;
          color: var(--muted, #718096);
          display: -webkit-box; -webkit-line-clamp: 1;
          -webkit-box-orient: vertical; overflow: hidden;
        }
        .inicio-card-last {
          position: absolute; bottom: 0.7rem; left: 1rem; right: 1rem;
          font-size: 0.72rem; color: var(--muted, #a0aec0);
        }
        .inicio-card-new {
          border: 1px dashed var(--muted, #a0aec0);
          display: flex; align-items: center; justify-content: center;
          color: var(--muted, #718096); font-size: 0.95rem;
        }
        .inicio-form-card { margin: 0; padding: 0; }
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
        .inicio-recents-list { list-style: none; padding: 0; margin: 0; }
        .inicio-recents-item {
          display: flex; gap: 1rem; padding: 0.5rem 0;
          text-decoration: none; color: inherit;
          font-size: 0.92rem;
          border-bottom: 1px solid var(--border-soft, #f0f0f0);
        }
        .inicio-recents-item:hover { background: var(--hover-bg, #f7f7f7); }
        .inicio-recents-time {
          width: 70px; color: var(--muted, #a0aec0); font-size: 0.85rem;
        }
        .inicio-recents-scene {
          width: 160px; color: var(--muted, #718096); font-size: 0.85rem;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .inicio-recents-scene-empty { color: var(--muted, #a0aec0); font-style: italic; }
        .inicio-recents-title {
          flex: 1;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .inicio-recents-empty {
          color: var(--muted, #a0aec0); font-style: italic;
          padding: 0.5rem 0;
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
            <ul class="inicio-recents-list">
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

const CenaCard: FC<{ scene: Scene }> = ({ scene }) => {
  // Each card is a form so click POSTs (creates a fresh session linked
  // to the cena) — rather than a GET anchor that would imply repeatable
  // navigation. The inner button styles itself like the surrounding
  // card; CSS does the visual work.
  const isAlma = scene.voice === "alma";
  const glyph = isAlma ? "♔" : "◇";
  const colorBar = isAlma ? "#b8956a" : "#2c5282";
  const last =
    Date.now() - (scene.updated_at ?? scene.created_at) < 1000 * 60 * 60 * 24
      ? ts("home.inicio.card.lastToday")
      : formatRelativeTime(scene.updated_at ?? scene.created_at);
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
        <span class="inicio-card-glyph" style={`color: ${colorBar}`}>
          {glyph}
        </span>
        <div class="inicio-card-title">{scene.title}</div>
        {scene.temporal_pattern && (
          <div class="inicio-card-temporal">{scene.temporal_pattern}</div>
        )}
        <div class="inicio-card-last">{last}</div>
      </button>
    </form>
  );
};

const RecentRow: FC<{ row: RecentSessionWithScene }> = ({ row }) => {
  return (
    <li>
      <a href={`/conversation/${row.id}`} class="inicio-recents-item">
        <span class="inicio-recents-time">
          {formatRelativeTime(row.lastActivityAt)}
        </span>
        <span
          class={
            row.sceneTitle
              ? "inicio-recents-scene"
              : "inicio-recents-scene inicio-recents-scene-empty"
          }
        >
          {row.sceneTitle ?? ts("home.inicio.recents.noScene")}
        </span>
        <span class="inicio-recents-title">
          {row.title ?? ts("home.inicio.recents.untitled")}
        </span>
      </a>
    </li>
  );
};
