import type { FC } from "hono/jsx";
import { raw } from "hono/html";
import type { User } from "../../../server/db.js";
import { TopBarLayout } from "./avatar-top-bar.js";
import type { RecentSessionWithScene } from "./home-inicio.js";
import { RecentRow } from "./recent-row.js";
import { ts } from "../i18n.js";

/**
 * Memórias — what the user has lived: conversation history (the
 * record), plus the future Library (attachments / documents that
 * became context). Distinct from Território (orgs/travessias/cenas
 * — present-active world) and Mapa Cognitivo (psyche layers —
 * who I am inside).
 */
export const MemoriaPage: FC<{
  user: User;
  recents: RecentSessionWithScene[];
  totalSessions: number;
}> = ({ user, recents, totalSessions }) => {
  return (
    <TopBarLayout title={ts("memoria.title")} user={user}>
      <style>{raw(`
        .memoria-page {
          max-width: 980px; margin: 2rem auto; padding: 0 1.5rem;
        }
        .memoria-heading {
          font-size: 1.4rem; font-weight: 500;
          color: #2a2a2a;
          margin: 0 0 0.4rem;
        }
        .memoria-subheading {
          color: #718096; font-size: 0.9rem;
          margin: 0 0 1.5rem;
        }
        .memoria-library {
          padding: 1rem 1.2rem;
          border-radius: 8px;
          background: #fff;
          border: 1px solid #e0e0e0;
          margin-bottom: 1.5rem;
          display: flex; flex-direction: column;
        }
        .memoria-library-head {
          display: flex; align-items: baseline; justify-content: space-between;
          margin-bottom: 0.5rem;
        }
        .memoria-library-title {
          font-size: 1rem; font-weight: 500; color: #2a2a2a;
        }
        .memoria-library-soon {
          background: #edf2f7; color: #718096;
          font-size: 0.7rem;
          padding: 0.1rem 0.4rem; border-radius: 3px;
          font-weight: 500;
        }
        .memoria-library-body {
          color: #a0aec0; font-style: italic;
          font-size: 0.9rem;
          padding: 0.8rem 0;
          text-align: center;
        }
        .memoria-history-section { margin-top: 0.5rem; }
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
      `)}</style>

      <div class="memoria-page">
        <h1 class="memoria-heading">{ts("memoria.heading")}</h1>
        <p class="memoria-subheading">{ts("memoria.subheading")}</p>

        <article class="memoria-library">
          <header class="memoria-library-head">
            <span class="memoria-library-title">
              {ts("memoria.library.title")}
            </span>
            <span class="memoria-library-soon">{ts("topbar.badge.soon")}</span>
          </header>
          <div class="memoria-library-body">
            {ts("memoria.library.placeholder")}
          </div>
        </article>

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
                <RecentRow row={r} returnTo="/memorias" />
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
