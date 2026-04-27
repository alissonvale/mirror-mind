import type { FC } from "hono/jsx";
import { Layout, type SidebarScopes } from "./layout.js";
import type { User, RecentSession } from "../../../server/db.js";
import type { LatestRelease } from "../../../server/admin-stats.js";
import { formatRelativeTime } from "../../../server/formatters/relative-time.js";
import { ts } from "../i18n.js";

export interface AdminState {
  usersTotal: number;
  usersActive7d: number;
  creditRemainingUsd: number | null;
  daysOfCreditLeft: number | null;
  usdToBrlRate: number;
  preferBrl: boolean;
}

export interface HomeProps {
  currentUser: User;
  greeting: string;
  latestRelease: LatestRelease | null;
  recentSessions: RecentSession[];
  adminState: AdminState | null;
  sidebarScopes?: SidebarScopes;
}

function sessionLabel(session: RecentSession): string {
  if (session.title) return session.title;
  if (!session.hasEntries) return ts("home.continue.newConversation");
  return ts("home.continue.untitled");
}

function sessionWhen(session: RecentSession): string {
  if (!session.hasEntries) return ts("home.continue.notStarted");
  return formatRelativeTime(session.lastActivityAt) ?? ts("home.continue.recently");
}

function formatCredit(
  usd: number | null,
  rate: number,
  preferBrl: boolean,
): string {
  if (usd === null) return ts("common.dash");
  if (preferBrl) {
    const brl = usd * rate;
    return `R$${brl.toFixed(brl < 10 ? 2 : 0)}`;
  }
  return `$${usd.toFixed(2)}`;
}

function formatDaysLeft(days: number | null): string {
  if (days === null) return ts("common.dash");
  if (days < 1) return ts("home.format.daysLeftSub1");
  return ts("home.format.daysLeft", { n: Math.round(days) });
}

export const HomePage: FC<HomeProps> = ({
  currentUser,
  greeting,
  latestRelease,
  recentSessions,
  adminState,
  sidebarScopes,
}) => {
  const [active, ...earlier] = recentSessions;
  return (
    <Layout title={ts("home.htmlTitle")} user={currentUser} sidebarScopes={sidebarScopes}>
      <div class="home">
        <header class="home-greeting">
          <h1>{greeting}</h1>
        </header>

        {adminState && (
          <section class="home-band home-state" data-testid="home-admin-state">
            <header class="home-band-header">
              <h2>{ts("home.state.title")}</h2>
            </header>
            <div class="home-state-row">
              <div class="home-state-item">
                <span class="home-state-label">{ts("home.state.users")}</span>
                <span class="home-state-value">
                  {adminState.usersTotal} ·{" "}
                  <span class="home-state-muted">
                    {ts("home.state.usersActive", { count: adminState.usersActive7d })}
                  </span>
                </span>
              </div>
              <div class="home-state-item">
                <span class="home-state-label">{ts("home.state.budget")}</span>
                <span class="home-state-value">
                  {formatCredit(
                    adminState.creditRemainingUsd,
                    adminState.usdToBrlRate,
                    adminState.preferBrl,
                  )} ·{" "}
                  <span class="home-state-muted">
                    {formatDaysLeft(adminState.daysOfCreditLeft)}
                  </span>
                </span>
              </div>
              {latestRelease && (
                <div class="home-state-item">
                  <span class="home-state-label">{ts("home.state.release")}</span>
                  <span class="home-state-value">
                    {latestRelease.version}
                    {latestRelease.date && (
                      <>
                        {" · "}
                        <span class="home-state-muted">
                          {latestRelease.date}
                        </span>
                      </>
                    )}
                  </span>
                </div>
              )}
            </div>
          </section>
        )}

        {latestRelease && (
          <section class="home-band home-release">
            <header class="home-band-header">
              <h2>{ts("home.release.title")}</h2>
            </header>
            <article class="home-release-card">
              <div class="home-release-title">
                {latestRelease.version} — {latestRelease.title}
              </div>
              {latestRelease.digest && (
                <p class="home-release-digest">{latestRelease.digest}</p>
              )}
              <a class="home-release-link" href={latestRelease.url}>
                {ts("home.release.readMore")}
              </a>
            </article>
          </section>
        )}

        <section class="home-band home-continue">
          <header class="home-band-header">
            <h2>{ts("home.continue.title")}</h2>
          </header>

          {active ? (
            <>
              <article class="home-continue-card">
                <div class="home-continue-title">{sessionLabel(active)}</div>
                <div class="home-continue-when">
                  {ts("home.continue.lastExchange", { when: sessionWhen(active) })}
                </div>
                <a class="home-continue-resume" href="/conversation">
                  {ts("home.continue.resume")}
                </a>
              </article>

              {earlier.length > 0 && (
                <div class="home-earlier">
                  <h3 class="home-earlier-heading">{ts("home.continue.earlierThreads")}</h3>
                  <ul class="home-earlier-list">
                    {earlier.map((s) => (
                      <li class="home-earlier-item" key={s.id}>
                        <span class="home-earlier-title">
                          {sessionLabel(s)}
                        </span>
                        <span class="home-earlier-when">
                          {formatRelativeTime(s.lastActivityAt) ?? ts("home.continue.earlier")}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <article class="home-continue-empty">
              <a href="/conversation">{ts("home.continue.empty")}</a>
            </article>
          )}
        </section>
      </div>
    </Layout>
  );
};
