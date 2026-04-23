import type { FC } from "hono/jsx";
import { Layout, type SidebarScopes } from "./layout.js";
import type { User, ModelConfig } from "../../../server/db.js";
import type {
  UserStats,
  ActivityStats,
  MemoryStats,
  SystemStats,
  LatestRelease,
} from "../../../server/admin-stats.js";

export interface BudgetSummary {
  creditRemainingUsd: number | null;
  daysOfCreditLeft: number | null;
  usdToBrlRate: number;
  preferBrl: boolean;
}

export interface OAuthSummary {
  configured: number;
  total: number;
}

export interface AdminDashboardProps {
  currentUser: User;
  userStats: UserStats;
  activityStats: ActivityStats;
  memoryStats: MemoryStats;
  budget: BudgetSummary;
  oauth: OAuthSummary;
  systemStats: SystemStats;
  latestRelease: LatestRelease | null;
  models: ModelConfig[];
  sidebarScopes?: SidebarScopes;
}

function formatCost(
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

function formatPrice(n: number): string {
  // Compact BRL: 1.4 → "1,40", 5.7 → "5,70", 0.0001 → "0,0001"
  return n.toFixed(n < 1 ? 4 : 2).replace(".", ",");
}

const MODEL_ROLE_LABEL: Record<string, string> = {
  main: "Primary response",
  reception: "Reception",
  title: "Titles",
};

function roleLabel(role: string): string {
  return MODEL_ROLE_LABEL[role] ?? role;
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
  budget,
  oauth,
  systemStats,
  latestRelease,
  models,
  sidebarScopes,
}) => (
  <Layout title="Admin Workspace" user={currentUser} wide sidebarScopes={sidebarScopes}>
    <div class="admin-dashboard">
      <header class="admin-dashboard-header">
        <h1>Admin Workspace</h1>
        <p class="admin-dashboard-lede">
          How this mirror is doing. Cards refresh on page reload.
        </p>
      </header>

      <section class="admin-cards">
        {/* USERS — shortcut */}
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

        {/* BUDGET — shortcut */}
        <article class="admin-card admin-card--budget">
          <header class="admin-card-header">
            <h2>Budget</h2>
          </header>
          <div class="admin-card-body">
            <div class="admin-card-metric">
              {formatCost(
                budget.creditRemainingUsd,
                budget.usdToBrlRate,
                budget.preferBrl,
              )}
            </div>
            <p class="admin-card-sub">
              {formatDaysLeft(budget.daysOfCreditLeft)} at current burn
            </p>
            <a class="admin-card-link" href="/admin/budget">
              Manage budget →
            </a>
          </div>
        </article>

        {/* MODELS — shortcut */}
        <article class="admin-card admin-card--models">
          <header class="admin-card-header">
            <h2>Models</h2>
            <a class="admin-card-link admin-card-link--inline" href="/admin/models">
              tune →
            </a>
          </header>
          <div class="admin-card-body">
            <ul class="admin-card-models">
              {models.map((m) => (
                <li class="admin-card-models-row">
                  <span class="admin-card-models-role">{roleLabel(m.role)}</span>
                  <span class="admin-card-models-model">{m.model}</span>
                  {typeof m.price_brl_per_1m_input === "number" &&
                  typeof m.price_brl_per_1m_output === "number" ? (
                    <span class="admin-card-models-price">
                      R$ {formatPrice(m.price_brl_per_1m_input)} ·
                      R$ {formatPrice(m.price_brl_per_1m_output)}
                    </span>
                  ) : (
                    <span class="admin-card-models-price admin-card-models-price--none">
                      no price set
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <p class="admin-card-note">
              BRL per 1M tokens · input · output
            </p>
          </div>
        </article>

        {/* OAUTH — shortcut */}
        <article class="admin-card admin-card--oauth">
          <header class="admin-card-header">
            <h2>OAuth</h2>
          </header>
          <div class="admin-card-body">
            <div class="admin-card-metric">
              {oauth.configured}
              <span class="admin-card-unit">
                of {oauth.total} configured
              </span>
            </div>
            <p class="admin-card-sub">
              Subscription-backed provider credentials
            </p>
            <a class="admin-card-link" href="/admin/oauth">
              Configure OAuth →
            </a>
          </div>
        </article>

        {/* DOCS — shortcut */}
        <article class="admin-card admin-card--docs">
          <header class="admin-card-header">
            <h2>Docs</h2>
          </header>
          <div class="admin-card-body">
            <p class="admin-card-sub">
              Project briefing, decisions, roadmap, releases — all navigable
              inside the app.
            </p>
            <a class="admin-card-link" href="/docs">
              Open documentation →
            </a>
          </div>
        </article>

        {/* RELEASE — shortcut */}
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

        {/* ACTIVITY — glance */}
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

        {/* MIRROR MEMORY — glance */}
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

        {/* SYSTEM — glance */}
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
