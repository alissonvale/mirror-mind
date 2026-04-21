import type { FC } from "hono/jsx";
import { Layout } from "./layout.js";
import type { User, RecentSession } from "../../../server/db.js";
import type { LatestRelease } from "../../../server/admin-stats.js";
import { formatRelativeTime } from "../../../server/formatters/relative-time.js";

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

function formatCredit(
  usd: number | null,
  rate: number,
  preferBrl: boolean,
): string {
  if (usd === null) return "—";
  if (preferBrl) {
    const brl = usd * rate;
    return `R$${brl.toFixed(brl < 10 ? 2 : 0)}`;
  }
  return `$${usd.toFixed(2)}`;
}

function formatDaysLeft(days: number | null): string {
  if (days === null) return "—";
  if (days < 1) return "<1 day";
  return `~${Math.round(days)} days`;
}

export const HomePage: FC<HomeProps> = ({
  currentUser,
  greeting,
  latestRelease,
  recentSessions,
  adminState,
}) => {
  const [active, ...earlier] = recentSessions;
  return (
    <Layout title="Home" user={currentUser}>
      <div class="home">
        <header class="home-greeting">
          <h1>{greeting}</h1>
        </header>

        {adminState && (
          <section class="home-band home-state" data-testid="home-admin-state">
            <header class="home-band-header">
              <h2>State of the mirror</h2>
            </header>
            <div class="home-state-row">
              <div class="home-state-item">
                <span class="home-state-label">Users</span>
                <span class="home-state-value">
                  {adminState.usersTotal} ·{" "}
                  <span class="home-state-muted">
                    {adminState.usersActive7d} active 7d
                  </span>
                </span>
              </div>
              <div class="home-state-item">
                <span class="home-state-label">Budget</span>
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
                  <span class="home-state-label">Release</span>
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
                <a class="home-continue-resume" href="/conversation">
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
              <a href="/conversation">Your first conversation starts here →</a>
            </article>
          )}
        </section>
      </div>
    </Layout>
  );
};
