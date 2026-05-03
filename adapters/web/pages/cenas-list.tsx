import type { FC } from "hono/jsx";
import { raw } from "hono/html";
import type { User, Scene } from "../../../server/db.js";
import { TopBarLayout } from "./avatar-top-bar.js";
import { CenaCard } from "./home-inicio.js";
import { ts } from "../i18n.js";

/**
 * CV1.E11.S3 — Simple list of cenas. Created here so the "ver →"
 * link on the Memória > Cenas card has a destination. Uses TopBarLayout
 * (new chrome) and reuses CenaCard from home-inicio.tsx so the cards
 * look identical to those on /inicio.
 */
export const CenasListPage: FC<{
  user: User;
  scenes: Scene[];
}> = ({ user, scenes }) => {
  return (
    <TopBarLayout title={ts("cenas.list.title")} user={user}>
      <style>{raw(`
        .cenas-list-page {
          max-width: 980px; margin: 2rem auto; padding: 0 1.5rem;
        }
        .cenas-list-heading {
          display: flex; align-items: baseline; justify-content: space-between;
          margin: 0 0 1.5rem;
        }
        .cenas-list-heading h1 {
          font-size: 1.4rem; font-weight: 500; color: #2a2a2a; margin: 0;
        }
        .cenas-list-new {
          color: #2c5282; text-decoration: none; font-size: 0.9rem;
        }
        .cenas-list-new:hover { text-decoration: underline; }
        .cenas-list-grid {
          display: grid; gap: 0.8rem;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        }
        .cenas-list-empty {
          padding: 3rem 1rem;
          text-align: center;
          color: #a0aec0; font-style: italic;
        }
        .cenas-list-empty a {
          color: #2c5282; text-decoration: none; font-style: normal;
        }
        .cenas-list-empty a:hover { text-decoration: underline; }
      `)}</style>

      <div class="cenas-list-page">
        <header class="cenas-list-heading">
          <h1>{ts("cenas.list.h1")}</h1>
          <a href="/cenas/nova" class="cenas-list-new">
            + {ts("home.inicio.newScene")}
          </a>
        </header>

        {scenes.length === 0 ? (
          <p class="cenas-list-empty">
            {ts("cenas.list.empty")}{" "}
            <a href="/cenas/nova">{ts("cenas.list.empty.create")}</a>
          </p>
        ) : (
          <div class="cenas-list-grid">
            {scenes.map((s) => (
              <CenaCard scene={s} />
            ))}
          </div>
        )}
      </div>
    </TopBarLayout>
  );
};
