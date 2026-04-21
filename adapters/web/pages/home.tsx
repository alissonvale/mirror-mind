import type { FC } from "hono/jsx";
import { Layout } from "./layout.js";
import type { User } from "../../../server/db.js";
import type { LatestRelease } from "../../../server/admin-stats.js";

export interface HomeProps {
  currentUser: User;
  greeting: string;
  latestRelease: LatestRelease | null;
}

export const HomePage: FC<HomeProps> = ({
  currentUser,
  greeting,
  latestRelease,
}) => (
  <Layout title="Home" user={currentUser}>
    <div class="home">
      <header class="home-greeting">
        <h1>{greeting}</h1>
      </header>

      {latestRelease && (
        <section class="home-band home-release">
          <header class="home-band-header">
            <h2>Latest from the mirror</h2>
          </header>
          <article class="home-release-card">
            <div class="home-release-title">
              {latestRelease.version} — {latestRelease.title}
            </div>
            {latestRelease.digest && (
              <p class="home-release-digest">{latestRelease.digest}</p>
            )}
            <a class="home-release-link" href={latestRelease.url}>
              Read the full note →
            </a>
          </article>
        </section>
      )}
    </div>
  </Layout>
);
