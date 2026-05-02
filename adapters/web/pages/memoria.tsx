import type { FC } from "hono/jsx";
import type {
  User,
  Scene,
  Organization,
  Journey,
} from "../../../server/db.js";
import { TopBarLayout } from "./avatar-top-bar.js";
import type { RecentSessionWithScene } from "./home-inicio.js";
import { ts } from "../i18n.js";
import { formatRelativeTime } from "../../../server/formatters/relative-time.js";

/**
 * CV1.E11.S3 — Memória dashboard at /memoria. The world-as-experienced
 * (orgs, travessias, library, history, scenes) lives here, distinct
 * from the Mapa Cognitivo (psyche layers — self/ego/personas).
 */
export const MemoriaPage: FC<{
  user: User;
  scenes: Scene[];
  journeys: Journey[];
  organizations: Organization[];
  recents: RecentSessionWithScene[];
  totalSessions: number;
}> = ({ user, scenes, journeys, organizations, recents, totalSessions }) => {
  return (
    <TopBarLayout title={ts("memoria.title")} user={user}>
      <style>{`
        .memoria-page {
          max-width: 980px; margin: 2rem auto; padding: 0 1.5rem;
        }
        .memoria-heading {
          font-size: 1.4rem; font-weight: 500;
          color: #2a2a2a;
          margin: 0 0 1.5rem;
        }
        .memoria-grid {
          display: grid; gap: 1rem;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          margin-bottom: 2rem;
        }
        .memoria-card {
          padding: 1rem 1.2rem;
          border-radius: 8px;
          background: #fff;
          border: 1px solid #e0e0e0;
          display: flex; flex-direction: column;
          min-height: 180px;
        }
        .memoria-card-head {
          display: flex; align-items: baseline; justify-content: space-between;
          margin-bottom: 0.6rem;
        }
        .memoria-card-title {
          font-size: 1rem; font-weight: 500; color: #2a2a2a;
        }
        .memoria-card-count {
          font-size: 0.78rem; color: #718096;
        }
        .memoria-card-items {
          display: flex; flex-direction: column; gap: 0.3rem;
          margin: 0; padding: 0; list-style: none;
          flex: 1;
        }
        .memoria-card-item {
          font-size: 0.88rem;
        }
        .memoria-card-item a {
          color: #2a2a2a; text-decoration: none;
          display: inline-flex; align-items: baseline; gap: 0.35rem;
        }
        .memoria-card-item a:hover {
          color: #2c5282; text-decoration: underline;
        }
        .memoria-card-glyph {
          color: #718096; font-size: 0.85rem;
        }
        .memoria-card-glyph--alma {
          color: #b8956a; font-size: 1.05rem;
        }
        .memoria-card-empty {
          color: #a0aec0; font-style: italic;
          font-size: 0.85rem; flex: 1;
          display: flex; align-items: center; justify-content: center;
          text-align: center;
          padding: 0.5rem 0;
        }
        .memoria-card-foot {
          margin-top: 0.75rem;
          font-size: 0.82rem;
          text-align: right;
        }
        .memoria-card-foot a {
          color: #2c5282; text-decoration: none;
        }
        .memoria-card-foot a:hover { text-decoration: underline; }
        .memoria-card-create {
          color: #2c5282; text-decoration: none;
          font-size: 0.85rem;
        }
        .memoria-card-create:hover { text-decoration: underline; }
        .memoria-card-soon-badge {
          background: #edf2f7; color: #718096;
          font-size: 0.7rem;
          padding: 0.1rem 0.4rem; border-radius: 3px;
          font-weight: 500;
        }
        .memoria-card-library-body {
          color: #a0aec0; font-style: italic;
          font-size: 0.85rem;
          flex: 1;
          display: flex; align-items: center; justify-content: center;
          text-align: center;
          padding: 0 0.5rem;
        }
        .memoria-history-section {
          margin-top: 2rem;
        }
        .memoria-history-head {
          display: flex; align-items: baseline; justify-content: space-between;
          margin: 0 0 0.6rem; padding-bottom: 0.4rem;
          border-bottom: 1px solid #e0e0e0;
        }
        .memoria-history-title {
          font-size: 1rem; font-weight: 500; color: #2a2a2a; margin: 0;
        }
        .memoria-history-count {
          font-size: 0.82rem; color: #718096;
        }
        .memoria-history-foot {
          margin-top: 0.8rem;
          font-size: 0.85rem;
          text-align: right;
        }
        .memoria-history-foot a {
          color: #2c5282; text-decoration: none;
        }
        .memoria-history-foot a:hover { text-decoration: underline; }
        .memoria-history-empty {
          color: #a0aec0; font-style: italic;
          padding: 1rem 0;
        }
        .memoria-recents .conversations-row-tag-scene {
          background: #f0f4f8; color: #2c5282;
        }
        .memoria-recents .conversations-row-tag-no-scene {
          background: transparent; color: #a0aec0; font-style: italic;
        }
      `}</style>

      <div class="memoria-page">
        <h1 class="memoria-heading">{ts("memoria.heading")}</h1>

        <div class="memoria-grid">
          <ScenesCard scenes={scenes} />
          <JourneysCard journeys={journeys} />
          <OrgsCard organizations={organizations} />
          <LibraryCard />
        </div>

        <section class="memoria-history-section memoria-recents">
          <div class="memoria-history-head">
            <h2 class="memoria-history-title">{ts("memoria.history.title")}</h2>
            <span class="memoria-history-count">
              {ts("memoria.history.count", { n: totalSessions })}
            </span>
          </div>
          {recents.length === 0 ? (
            <p class="memoria-history-empty">
              {ts("memoria.history.empty")}
            </p>
          ) : (
            <ul class="conversations-rows">
              {recents.map((r) => (
                <RecentRow row={r} />
              ))}
            </ul>
          )}
          {recents.length > 0 && (
            <p class="memoria-history-foot">
              <a href="/conversations">{ts("memoria.history.seeAll")}</a>
            </p>
          )}
        </section>
      </div>
    </TopBarLayout>
  );
};

const ScenesCard: FC<{ scenes: Scene[] }> = ({ scenes }) => {
  const top = scenes.slice(0, 3);
  return (
    <article class="memoria-card">
      <header class="memoria-card-head">
        <span class="memoria-card-title">{ts("memoria.cards.scenes.title")}</span>
        <span class="memoria-card-count">
          {ts("memoria.cards.count", { n: scenes.length })}
        </span>
      </header>
      {scenes.length === 0 ? (
        <div class="memoria-card-empty">
          {ts("memoria.cards.scenes.empty")}{" "}
          <a href="/cenas/nova" class="memoria-card-create">
            {ts("memoria.cards.scenes.create")}
          </a>
        </div>
      ) : (
        <ul class="memoria-card-items">
          {top.map((s) => (
            <li class="memoria-card-item">
              <a href={`/cenas/${s.key}/editar`} title={s.title}>
                <span
                  class={
                    s.voice === "alma"
                      ? "memoria-card-glyph memoria-card-glyph--alma"
                      : "memoria-card-glyph"
                  }
                >
                  {s.voice === "alma" ? "♔" : "◇"}
                </span>
                {s.title}
              </a>
            </li>
          ))}
        </ul>
      )}
      {scenes.length > 0 && (
        <footer class="memoria-card-foot">
          <a href="/cenas">{ts("memoria.cards.seeAll")}</a>
        </footer>
      )}
    </article>
  );
};

const JourneysCard: FC<{ journeys: Journey[] }> = ({ journeys }) => {
  const top = journeys.slice(0, 3);
  return (
    <article class="memoria-card">
      <header class="memoria-card-head">
        <span class="memoria-card-title">
          {ts("memoria.cards.journeys.title")}
        </span>
        <span class="memoria-card-count">
          {ts("memoria.cards.count", { n: journeys.length })}
        </span>
      </header>
      {journeys.length === 0 ? (
        <div class="memoria-card-empty">
          {ts("memoria.cards.journeys.empty")}{" "}
          <a href="/journeys" class="memoria-card-create">
            {ts("memoria.cards.journeys.create")}
          </a>
        </div>
      ) : (
        <ul class="memoria-card-items">
          {top.map((j) => (
            <li class="memoria-card-item">
              <a href={`/journeys/${j.key}`} title={j.name}>
                <span class="memoria-card-glyph">↝</span>
                {j.name}
              </a>
            </li>
          ))}
        </ul>
      )}
      {journeys.length > 0 && (
        <footer class="memoria-card-foot">
          <a href="/journeys">{ts("memoria.cards.seeAll")}</a>
        </footer>
      )}
    </article>
  );
};

const OrgsCard: FC<{ organizations: Organization[] }> = ({ organizations }) => {
  const top = organizations.slice(0, 3);
  return (
    <article class="memoria-card">
      <header class="memoria-card-head">
        <span class="memoria-card-title">{ts("memoria.cards.orgs.title")}</span>
        <span class="memoria-card-count">
          {ts("memoria.cards.count", { n: organizations.length })}
        </span>
      </header>
      {organizations.length === 0 ? (
        <div class="memoria-card-empty">
          {ts("memoria.cards.orgs.empty")}{" "}
          <a href="/organizations" class="memoria-card-create">
            {ts("memoria.cards.orgs.create")}
          </a>
        </div>
      ) : (
        <ul class="memoria-card-items">
          {top.map((o) => (
            <li class="memoria-card-item">
              <a href={`/organizations/${o.key}`} title={o.name}>
                <span class="memoria-card-glyph">⌂</span>
                {o.name}
              </a>
            </li>
          ))}
        </ul>
      )}
      {organizations.length > 0 && (
        <footer class="memoria-card-foot">
          <a href="/organizations">{ts("memoria.cards.seeAll")}</a>
        </footer>
      )}
    </article>
  );
};

const LibraryCard: FC = () => {
  return (
    <article class="memoria-card">
      <header class="memoria-card-head">
        <span class="memoria-card-title">
          {ts("memoria.cards.library.title")}
        </span>
        <span class="memoria-card-soon-badge">{ts("topbar.badge.soon")}</span>
      </header>
      <div class="memoria-card-library-body">
        {ts("memoria.cards.library.placeholder")}
      </div>
    </article>
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
