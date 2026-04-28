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
import { ts } from "../i18n.js";

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

function formatPrice(n: number): string {
  // Compact BRL: 1.4 → "1,40", 5.7 → "5,70", 0.0001 → "0,0001"
  return n.toFixed(n < 1 ? 4 : 2).replace(".", ",");
}

function roleLabel(role: string): string {
  if (role === "main") return ts("admin.dashboard.roleMain");
  if (role === "reception") return ts("admin.dashboard.roleReception");
  if (role === "title") return ts("admin.dashboard.roleTitle");
  return role;
}

function formatBytes(bytes: number | null): string {
  if (bytes === null) return ts("common.dash");
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
  <Layout title={ts("admin.dashboard.htmlTitle")} user={currentUser} wide sidebarScopes={sidebarScopes}>
    <div class="admin-dashboard">
      <header class="admin-dashboard-header">
        <h1>{ts("admin.dashboard.h1")}</h1>
        <p class="admin-dashboard-lede">
          {ts("admin.dashboard.lede")}
        </p>
      </header>

      <section class="admin-cards">
        {/* USERS — shortcut */}
        <article class="admin-card admin-card--users">
          <header class="admin-card-header">
            <h2>{ts("admin.dashboard.users")}</h2>
          </header>
          <div class="admin-card-body">
            <div class="admin-card-metric">
              {userStats.total}
              <span class="admin-card-unit">
                {ts(userStats.total === 1 ? "admin.dashboard.userOne" : "admin.dashboard.userMany")}
              </span>
            </div>
            <p class="admin-card-sub">
              {ts("admin.dashboard.usersActiveLast7d", { count: userStats.activeLast7d })}
            </p>
            <a class="admin-card-link" href="/admin/users">
              {ts("admin.dashboard.linkUsers")}
            </a>
          </div>
        </article>

        {/* BUDGET — shortcut */}
        <article class="admin-card admin-card--budget">
          <header class="admin-card-header">
            <h2>{ts("admin.dashboard.budget")}</h2>
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
              {ts("admin.dashboard.budgetSub", { days: formatDaysLeft(budget.daysOfCreditLeft) })}
            </p>
            <a class="admin-card-link" href="/admin/budget">
              {ts("admin.dashboard.linkBudget")}
            </a>
          </div>
        </article>

        {/* MODELS — shortcut */}
        <article class="admin-card admin-card--models">
          <header class="admin-card-header">
            <h2>{ts("admin.dashboard.models")}</h2>
            <a class="admin-card-link admin-card-link--inline" href="/admin/models">
              {ts("admin.dashboard.linkModelsInline")}
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
                      {ts("admin.dashboard.modelsNoPrice")}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <p class="admin-card-note">
              {ts("admin.dashboard.modelsNote")}
            </p>
          </div>
        </article>

        {/* OAUTH — shortcut */}
        <article class="admin-card admin-card--oauth">
          <header class="admin-card-header">
            <h2>{ts("admin.dashboard.oauth")}</h2>
          </header>
          <div class="admin-card-body">
            <div class="admin-card-metric">
              {oauth.configured}
              <span class="admin-card-unit">
                {ts("admin.dashboard.oauthOf", { total: oauth.total })}
              </span>
            </div>
            <p class="admin-card-sub">
              {ts("admin.dashboard.oauthSub")}
            </p>
            <a class="admin-card-link" href="/admin/oauth">
              {ts("admin.dashboard.linkOauth")}
            </a>
          </div>
        </article>

        {/* LLM LOGS — CV1.E8.S1 shortcut */}
        <article class="admin-card admin-card--llm-logs">
          <header class="admin-card-header">
            <h2>{ts("admin.dashboard.llmLogs")}</h2>
          </header>
          <div class="admin-card-body">
            <p class="admin-card-sub">{ts("admin.dashboard.llmLogsSub")}</p>
            <a class="admin-card-link" href="/admin/llm-logs">
              {ts("admin.dashboard.linkLlmLogs")}
            </a>
          </div>
        </article>

        {/* DOCS — shortcut */}
        <article class="admin-card admin-card--docs">
          <header class="admin-card-header">
            <h2>{ts("admin.dashboard.docs")}</h2>
          </header>
          <div class="admin-card-body">
            <p class="admin-card-sub">
              {ts("admin.dashboard.docsSub")}
            </p>
            <a class="admin-card-link" href="/docs">
              {ts("admin.dashboard.linkDocs")}
            </a>
          </div>
        </article>

        {/* RELEASE — shortcut */}
        <article class="admin-card admin-card--release">
          <header class="admin-card-header">
            <h2>{ts("admin.dashboard.latestRelease")}</h2>
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
                  {ts("admin.dashboard.linkReleaseNotes")}
                </a>
              </>
            ) : (
              <p class="admin-card-note">{ts("admin.dashboard.releaseEmpty")}</p>
            )}
          </div>
        </article>

        {/* ACTIVITY — glance */}
        <article class="admin-card admin-card--activity">
          <header class="admin-card-header">
            <h2>{ts("admin.dashboard.activity")}</h2>
          </header>
          <div class="admin-card-body">
            <div class="admin-card-metric">
              {activityStats.sessionsToday}
              <span class="admin-card-unit">
                {ts(activityStats.sessionsToday === 1 ? "admin.dashboard.sessionOneToday" : "admin.dashboard.sessionManyToday")}
              </span>
            </div>
            <p class="admin-card-sub">
              {ts(activityStats.sessionsThisWeek === 1 ? "admin.dashboard.sessionOneWeek" : "admin.dashboard.sessionManyWeek", { count: activityStats.sessionsThisWeek })}
            </p>
          </div>
        </article>

        {/* MIRROR MEMORY — glance */}
        <article class="admin-card admin-card--memory">
          <header class="admin-card-header">
            <h2>{ts("admin.dashboard.mirrorMemory")}</h2>
          </header>
          <div class="admin-card-body">
            <div class="admin-card-metric">{memoryStats.total}</div>
            <p class="admin-card-sub">
              {ts("admin.dashboard.memoryBreakdown", {
                self: memoryStats.selfCount,
                ego: memoryStats.egoCount,
                persona: memoryStats.personaCount,
              })}
            </p>
            <p class="admin-card-note">
              {ts("admin.dashboard.memoryNote")}
            </p>
          </div>
        </article>

        {/* SYSTEM — glance */}
        <article class="admin-card admin-card--system">
          <header class="admin-card-header">
            <h2>{ts("admin.dashboard.system")}</h2>
          </header>
          <div class="admin-card-body">
            <dl class="admin-card-dl">
              <dt>{ts("admin.dashboard.systemUptime")}</dt>
              <dd>{formatUptime(systemStats.uptimeSeconds)}</dd>
              <dt>{ts("admin.dashboard.systemDbSize")}</dt>
              <dd>{formatBytes(systemStats.dbSizeBytes)}</dd>
              <dt>{ts("admin.dashboard.systemNode")}</dt>
              <dd>{systemStats.nodeVersion}</dd>
            </dl>
          </div>
        </article>
      </section>
    </div>
  </Layout>
);
