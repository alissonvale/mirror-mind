import type { FC } from "hono/jsx";
import { Layout } from "./layout.js";
import type { User, RecentSession } from "../../../server/db.js";
import type { LatestRelease } from "../../../server/admin-stats.js";
import { formatRelativeTime } from "../../../server/formatters/relative-time.js";

export interface HomeProps {
  currentUser: User;
  greeting: string;
  latestRelease: LatestRelease | null;
  recentSessions: RecentSession[];
}

function sessionLabel(session: RecentSession): string {
  if (session.title) return session.title;
  if (!session.hasEntries) return "New conversation";
  return "Untitled conversation";
}

function sessionWhen(session: RecentSession): string {
  if (!session.hasEntries) return "not started yet";
  return formatRelativeTime(session.lastActivityAt) ?? "recently";
}

export const HomePage: FC<HomeProps> = ({
  currentUser,
  greeting,
  latestRelease,
  recentSessions,
}) => {
  const [active, ...earlier] = recentSessions;
  return (
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

        <section class="home-band home-continue">
          <header class="home-band-header">
            <h2>Continue</h2>
          </header>

          {active ? (
            <>
              <article class="home-continue-card">
                <div class="home-continue-title">{sessionLabel(active)}</div>
                <div class="home-continue-when">
                  last exchange {sessionWhen(active)}
                </div>
                <a class="home-continue-resume" href="/mirror">
                  Resume →
                </a>
              </article>

              {earlier.length > 0 && (
                <div class="home-earlier">
                  <h3 class="home-earlier-heading">Earlier threads</h3>
                  <ul class="home-earlier-list">
                    {earlier.map((s) => (
                      <li class="home-earlier-item" key={s.id}>
                        <span class="home-earlier-title">
                          {sessionLabel(s)}
                        </span>
                        <span class="home-earlier-when">
                          {formatRelativeTime(s.lastActivityAt) ?? "earlier"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <article class="home-continue-empty">
              <a href="/mirror">Your first conversation starts here →</a>
            </article>
          )}
        </section>
      </div>
    </Layout>
  );
};
