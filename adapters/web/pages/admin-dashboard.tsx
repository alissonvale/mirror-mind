import type { FC } from "hono/jsx";
import { Layout } from "./layout.js";
import type { User } from "../../../server/db.js";
import type {
  UserStats,
  ActivityStats,
  MemoryStats,
  CostEstimate,
  SystemStats,
  LatestRelease,
} from "../../../server/admin-stats.js";

export interface AdminDashboardProps {
  currentUser: User;
  userStats: UserStats;
  activityStats: ActivityStats;
  memoryStats: MemoryStats;
  costEstimate: CostEstimate;
  systemStats: SystemStats;
  latestRelease: LatestRelease | null;
}

function formatBRL(n: number): string {
  return `R$ ${n.toFixed(2).replace(".", ",")}`;
}

function formatBytes(bytes: number | null): string {
  if (bytes === null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatUptime(seconds: number): string {
  const s = Math.floor(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

export const AdminDashboardPage: FC<AdminDashboardProps> = ({
  currentUser,
  userStats,
  activityStats,
  memoryStats,
  costEstimate,
  systemStats,
  latestRelease,
}) => (
  <Layout title="Admin Workspace" user={currentUser} wide>
    <div class="admin-dashboard">
      <header class="admin-dashboard-header">
        <h1>Admin Workspace</h1>
        <p class="admin-dashboard-lede">
          How this mirror is doing. Cards refresh on page reload.
        </p>
      </header>

      <section class="admin-cards">
        {/* USERS */}
        <article class="admin-card admin-card--users">
          <header class="admin-card-header">
            <h2>Users</h2>
          </header>
          <div class="admin-card-body">
            <div class="admin-card-metric">
              {userStats.total}
              <span class="admin-card-unit">
                {userStats.total === 1 ? "user" : "users"}
              </span>
            </div>
            <p class="admin-card-sub">
              {userStats.activeLast7d} active in the last 7 days
            </p>
            <a class="admin-card-link" href="/admin/users">
              Manage users →
            </a>
          </div>
        </article>

        {/* COST */}
        <article class="admin-card admin-card--cost">
          <header class="admin-card-header">
            <h2>Cost · last 30 days</h2>
            <span class="admin-card-badge">estimated</span>
          </header>
          <div class="admin-card-body">
            <div class="admin-card-metric">{formatBRL(costEstimate.totalBRL)}</div>
            <p class="admin-card-sub">
              across {costEstimate.sessionsCounted} session
              {costEstimate.sessionsCounted === 1 ? "" : "s"} · main model only
            </p>
            <p class="admin-card-note">
              Based on the Rail's char/4 token approximation. Per-request
              tracking arrives with the usage-log story.
            </p>
          </div>
        </article>

        {/* ACTIVITY */}
        <article class="admin-card admin-card--activity">
          <header class="admin-card-header">
            <h2>Activity</h2>
          </header>
          <div class="admin-card-body">
            <div class="admin-card-metric">
              {activityStats.sessionsToday}
              <span class="admin-card-unit">
                session{activityStats.sessionsToday === 1 ? "" : "s"} today
              </span>
            </div>
            <p class="admin-card-sub">
              {activityStats.sessionsThisWeek} session
              {activityStats.sessionsThisWeek === 1 ? "" : "s"} this week
            </p>
          </div>
        </article>

        {/* RELEASE */}
        <article class="admin-card admin-card--release">
          <header class="admin-card-header">
            <h2>Latest release</h2>
          </header>
          <div class="admin-card-body">
            {latestRelease ? (
              <>
                <div class="admin-card-metric admin-card-metric--small">
                  {latestRelease.version}
                </div>
                <p class="admin-card-sub">{latestRelease.title}</p>
                {latestRelease.date && (
                  <p class="admin-card-note">{latestRelease.date}</p>
                )}
                <a class="admin-card-link" href={latestRelease.url}>
                  Read the notes →
                </a>
              </>
            ) : (
              <p class="admin-card-note">No release notes found.</p>
            )}
          </div>
        </article>

        {/* MIRROR MEMORY */}
        <article class="admin-card admin-card--memory">
          <header class="admin-card-header">
            <h2>Mirror memory</h2>
          </header>
          <div class="admin-card-body">
            <div class="admin-card-metric">{memoryStats.total}</div>
            <p class="admin-card-sub">
              {memoryStats.selfCount} self · {memoryStats.egoCount} ego ·{" "}
              {memoryStats.personaCount} persona
            </p>
            <p class="admin-card-note">
              Total identity layers written across all users.
            </p>
          </div>
        </article>

        {/* SYSTEM */}
        <article class="admin-card admin-card--system">
          <header class="admin-card-header">
            <h2>System</h2>
          </header>
          <div class="admin-card-body">
            <dl class="admin-card-dl">
              <dt>Uptime</dt>
              <dd>{formatUptime(systemStats.uptimeSeconds)}</dd>
              <dt>DB size</dt>
              <dd>{formatBytes(systemStats.dbSizeBytes)}</dd>
              <dt>Node</dt>
              <dd>{systemStats.nodeVersion}</dd>
            </dl>
          </div>
        </article>
      </section>
    </div>
  </Layout>
);
