import type { FC } from "hono/jsx";
import type {
  User,
  Scene,
  Organization,
  Journey,
} from "../../../server/db.js";
import { TopBarLayout } from "./avatar-top-bar.js";
import { ts } from "../i18n.js";

/**
 * Território — the world the user is currently operating in:
 * cenas (recurring conversation patterns), travessias (active life
 * chapters), organizações (where they work). Distinct from:
 *   - Mapa Cognitivo: who they are inside (psyche layers)
 *   - Memórias: what they lived (conversation history, library)
 *
 * The split: Território is present-active (configurable, alive
 * now); Memórias is past-record (accumulated, factual). Both are
 * "outside the user", but Território is the world they move in
 * and Memórias is what that movement left behind.
 */
export const TerritorioPage: FC<{
  user: User;
  scenes: Scene[];
  journeys: Journey[];
  organizations: Organization[];
}> = ({ user, scenes, journeys, organizations }) => {
  return (
    <TopBarLayout title={ts("territorio.title")} user={user}>
      <style>{`
        .territorio-page {
          max-width: 980px; margin: 2rem auto; padding: 0 1.5rem;
        }
        .territorio-heading {
          font-size: 1.4rem; font-weight: 500;
          color: #2a2a2a;
          margin: 0 0 0.4rem;
        }
        .territorio-subheading {
          color: #718096; font-size: 0.9rem;
          margin: 0 0 1.5rem;
        }
        .territorio-grid {
          display: grid; gap: 1rem;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        }
        .territorio-card {
          padding: 1rem 1.2rem;
          border-radius: 8px;
          background: #fff;
          border: 1px solid #e0e0e0;
          display: flex; flex-direction: column;
          min-height: 180px;
        }
        .territorio-card-head {
          display: flex; align-items: baseline; justify-content: space-between;
          margin-bottom: 0.6rem;
        }
        .territorio-card-title {
          font-size: 1rem; font-weight: 500; color: #2a2a2a;
        }
        .territorio-card-count {
          font-size: 0.78rem; color: #718096;
        }
        .territorio-card-items {
          display: flex; flex-direction: column; gap: 0.3rem;
          margin: 0; padding: 0; list-style: none;
          flex: 1;
        }
        .territorio-card-item { font-size: 0.88rem; }
        .territorio-card-item a {
          color: #2a2a2a; text-decoration: none;
          display: inline-flex; align-items: baseline; gap: 0.35rem;
        }
        .territorio-card-item a:hover {
          color: #2c5282; text-decoration: underline;
        }
        .territorio-card-glyph {
          color: #718096; font-size: 0.85rem;
        }
        .territorio-card-glyph--alma {
          color: #b8956a; font-size: 1.05rem;
        }
        .territorio-card-empty {
          color: #a0aec0; font-style: italic;
          font-size: 0.85rem; flex: 1;
          display: flex; align-items: center; justify-content: center;
          text-align: center;
          padding: 0.5rem 0;
        }
        .territorio-card-foot {
          margin-top: 0.75rem;
          font-size: 0.82rem;
          text-align: right;
        }
        .territorio-card-foot a {
          color: #2c5282; text-decoration: none;
        }
        .territorio-card-foot a:hover { text-decoration: underline; }
        .territorio-card-create {
          color: #2c5282; text-decoration: none;
          font-size: 0.85rem;
        }
        .territorio-card-create:hover { text-decoration: underline; }
      `}</style>

      <div class="territorio-page">
        <h1 class="territorio-heading">{ts("territorio.heading")}</h1>
        <p class="territorio-subheading">{ts("territorio.subheading")}</p>

        <div class="territorio-grid">
          <ScenesCard scenes={scenes} />
          <JourneysCard journeys={journeys} />
          <OrgsCard organizations={organizations} />
        </div>
      </div>
    </TopBarLayout>
  );
};

const ScenesCard: FC<{ scenes: Scene[] }> = ({ scenes }) => {
  const top = scenes.slice(0, 3);
  return (
    <article class="territorio-card">
      <header class="territorio-card-head">
        <span class="territorio-card-title">{ts("territorio.cards.scenes.title")}</span>
        <span class="territorio-card-count">
          {ts("territorio.cards.count", { n: scenes.length })}
        </span>
      </header>
      {scenes.length === 0 ? (
        <div class="territorio-card-empty">
          {ts("territorio.cards.scenes.empty")}{" "}
          <a href="/cenas/nova" class="territorio-card-create">
            {ts("territorio.cards.scenes.create")}
          </a>
        </div>
      ) : (
        <ul class="territorio-card-items">
          {top.map((s) => (
            <li class="territorio-card-item">
              <a href={`/cenas/${s.key}/editar`} title={s.title}>
                <span
                  class={
                    s.voice === "alma"
                      ? "territorio-card-glyph territorio-card-glyph--alma"
                      : "territorio-card-glyph"
                  }
                >
                  {s.voice === "alma" ? "♔" : "❖"}
                </span>
                {s.title}
              </a>
            </li>
          ))}
        </ul>
      )}
      {scenes.length > 0 && (
        <footer class="territorio-card-foot">
          <a href="/cenas">{ts("territorio.cards.seeAll")}</a>
        </footer>
      )}
    </article>
  );
};

const JourneysCard: FC<{ journeys: Journey[] }> = ({ journeys }) => {
  const top = journeys.slice(0, 3);
  return (
    <article class="territorio-card">
      <header class="territorio-card-head">
        <span class="territorio-card-title">
          {ts("territorio.cards.journeys.title")}
        </span>
        <span class="territorio-card-count">
          {ts("territorio.cards.count", { n: journeys.length })}
        </span>
      </header>
      {journeys.length === 0 ? (
        <div class="territorio-card-empty">
          {ts("territorio.cards.journeys.empty")}{" "}
          <a href="/journeys" class="territorio-card-create">
            {ts("territorio.cards.journeys.create")}
          </a>
        </div>
      ) : (
        <ul class="territorio-card-items">
          {top.map((j) => (
            <li class="territorio-card-item">
              <a href={`/journeys/${j.key}`} title={j.name}>
                <span class="territorio-card-glyph">↝</span>
                {j.name}
              </a>
            </li>
          ))}
        </ul>
      )}
      {journeys.length > 0 && (
        <footer class="territorio-card-foot">
          <a href="/journeys">{ts("territorio.cards.seeAll")}</a>
        </footer>
      )}
    </article>
  );
};

const OrgsCard: FC<{ organizations: Organization[] }> = ({ organizations }) => {
  const top = organizations.slice(0, 3);
  return (
    <article class="territorio-card">
      <header class="territorio-card-head">
        <span class="territorio-card-title">{ts("territorio.cards.orgs.title")}</span>
        <span class="territorio-card-count">
          {ts("territorio.cards.count", { n: organizations.length })}
        </span>
      </header>
      {organizations.length === 0 ? (
        <div class="territorio-card-empty">
          {ts("territorio.cards.orgs.empty")}{" "}
          <a href="/organizations" class="territorio-card-create">
            {ts("territorio.cards.orgs.create")}
          </a>
        </div>
      ) : (
        <ul class="territorio-card-items">
          {top.map((o) => (
            <li class="territorio-card-item">
              <a href={`/organizations/${o.key}`} title={o.name}>
                <span class="territorio-card-glyph">⌂</span>
                {o.name}
              </a>
            </li>
          ))}
        </ul>
      )}
      {organizations.length > 0 && (
        <footer class="territorio-card-foot">
          <a href="/organizations">{ts("territorio.cards.seeAll")}</a>
        </footer>
      )}
    </article>
  );
};
