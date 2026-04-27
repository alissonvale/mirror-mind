import type { FC } from "hono/jsx";
import { Layout, type SidebarScopes } from "../layout.js";
import type { User } from "../../../../server/db.js";
import { ts } from "../../i18n.js";

export interface BudgetKeyInfo {
  usage: number;
  limit: number | null;
  limit_remaining: number | null;
  label: string | null;
  is_free_tier: boolean;
}

export interface BudgetBreakdownRow {
  key: string;
  total_usd: number;
  calls: number;
}

export interface BudgetPageProps {
  user: User;
  keyInfo?: BudgetKeyInfo;
  monthTotal: { total_usd: number; total_calls: number; resolved_calls: number };
  byRole: BudgetBreakdownRow[];
  byEnv: BudgetBreakdownRow[];
  byModel: BudgetBreakdownRow[];
  burnRate: {
    avg_usd_per_day: number;
    days_of_credit_left: number | null;
  };
  usdToBrlRate: number;
  saved?: string;
  error?: string;
  sidebarScopes?: SidebarScopes;
}

function formatUsd(n: number): string {
  return `$${n.toFixed(n < 1 ? 4 : 2)}`;
}

function formatBrl(usd: number, rate: number): string {
  const brl = usd * rate;
  return `R$${brl.toFixed(brl < 10 ? 2 : 0)}`;
}

function formatCost(
  usd: number,
  rate: number,
  preferBrl: boolean,
): string {
  return preferBrl ? formatBrl(usd, rate) : formatUsd(usd);
}

function progressPercent(remaining: number | null, cap: number | null): number {
  if (remaining === null || cap === null || cap === 0) return 100;
  return Math.max(0, Math.min(100, (remaining / cap) * 100));
}

export const BudgetPage: FC<BudgetPageProps> = ({
  user,
  keyInfo,
  monthTotal,
  byRole,
  byEnv,
  byModel,
  burnRate,
  usdToBrlRate,
  saved,
  error,
  sidebarScopes,
}) => {
  const preferBrl = user.show_brl_conversion === 1;
  const remaining = keyInfo?.limit_remaining ?? null;
  const cap = keyInfo?.limit ?? null;
  const pct = progressPercent(remaining, cap);

  return (
    <Layout title={ts("admin.budget.htmlTitle")} user={user} sidebarScopes={sidebarScopes}>
      <h1>{ts("admin.budget.h1")}</h1>
      <p class="admin-lede">
        {ts("admin.budget.lede")}
      </p>

      {saved && <p class="flash flash-success">{saved}</p>}
      {error && <p class="flash flash-error">{error}</p>}

      <section class="budget-hero">
        {keyInfo ? (
          <>
            <div class="budget-hero-label">{ts("admin.budget.creditRemaining")}</div>
            {remaining !== null ? (
              <div class="budget-hero-value">
                {formatCost(remaining, usdToBrlRate, preferBrl)}
              </div>
            ) : (
              <div class="budget-hero-value budget-hero-uncapped">
                {ts("admin.budget.uncapped")}
              </div>
            )}
            {cap !== null && remaining !== null && (
              <>
                <div class="budget-progress">
                  <div
                    class="budget-progress-fill"
                    style={`width: ${pct}%`}
                  ></div>
                </div>
                <div class="budget-hero-meta">
                  {ts("admin.budget.heroMeta", {
                    pct: pct.toFixed(0),
                    cap: formatCost(cap, usdToBrlRate, preferBrl),
                    spent: formatCost(keyInfo.usage, usdToBrlRate, preferBrl),
                  })}
                  {keyInfo.label && ts("admin.budget.heroLabel", { label: keyInfo.label })}
                </div>
              </>
            )}
          </>
        ) : (
          <div class="budget-hero-unavailable">
            {ts("admin.budget.unavailable")}
          </div>
        )}
      </section>

      <section class="budget-section">
        <h2>{ts("admin.budget.thisMonth")}</h2>
        <div class="budget-cards">
          <div class="budget-card">
            <div class="budget-card-label">{ts("admin.budget.totalSpent")}</div>
            <div class="budget-card-value">
              {formatCost(monthTotal.total_usd, usdToBrlRate, preferBrl)}
            </div>
            <div class="budget-card-meta">
              {ts(monthTotal.total_calls === 1 ? "admin.budget.callOne" : "admin.budget.callMany", { n: monthTotal.total_calls })}
              {monthTotal.total_calls !== monthTotal.resolved_calls && (
                <> · {ts("admin.budget.awaitingReconciliation", { n: monthTotal.total_calls - monthTotal.resolved_calls })}</>
              )}
            </div>
          </div>
          <div class="budget-card">
            <div class="budget-card-label">{ts("admin.budget.burnRate")}</div>
            <div class="budget-card-value">
              {ts("admin.budget.perDay", { cost: formatCost(burnRate.avg_usd_per_day, usdToBrlRate, preferBrl) })}
            </div>
            <div class="budget-card-meta">
              {burnRate.days_of_credit_left !== null
                ? ts("admin.budget.creditsLast", { days: Math.round(burnRate.days_of_credit_left) })
                : ts("admin.budget.cantProject")}
            </div>
          </div>
        </div>
      </section>

      <section class="budget-section">
        <h2>{ts("admin.budget.byRole")}</h2>
        <BudgetTable
          rows={byRole}
          preferBrl={preferBrl}
          rate={usdToBrlRate}
        />
      </section>

      <section class="budget-section">
        <h2>{ts("admin.budget.byEnv")}</h2>
        <BudgetTable
          rows={byEnv}
          preferBrl={preferBrl}
          rate={usdToBrlRate}
        />
      </section>

      <section class="budget-section">
        <h2>{ts("admin.budget.byModel")}</h2>
        <BudgetTable
          rows={byModel}
          preferBrl={preferBrl}
          rate={usdToBrlRate}
        />
      </section>

      <section class="budget-section">
        <h2>{ts("admin.budget.preferences")}</h2>
        <div class="budget-prefs">
          <form
            method="POST"
            action="/admin/budget/rate"
            class="budget-pref-form"
          >
            <label class="budget-pref-label">
              {ts("admin.budget.rateLabel")}
              <span class="budget-pref-hint">
                {ts("admin.budget.rateHint")}
              </span>
            </label>
            <div class="budget-pref-row">
              <input
                type="number"
                name="rate"
                value={String(usdToBrlRate)}
                step="0.01"
                min="0.01"
                class="budget-pref-input"
                required
              />
              <button type="submit" class="budget-pref-save">{ts("admin.budget.saveRate")}</button>
            </div>
          </form>

          <p class="budget-pref-note">
            {ts("admin.budget.brlPrefPart1")}{" "}
            <a href="/me">{ts("me.htmlTitle")}</a>.
          </p>
        </div>
      </section>

      <p class="budget-topup">
        {ts("admin.budget.lowOnCredits")}{" "}
        <a
          href="https://openrouter.ai/settings/credits"
          target="_blank"
          rel="noopener noreferrer"
        >
          {ts("admin.budget.topupLink")}
        </a>
      </p>
    </Layout>
  );
};

const BudgetTable: FC<{
  rows: BudgetBreakdownRow[];
  preferBrl: boolean;
  rate: number;
}> = ({ rows, preferBrl, rate }) => {
  if (rows.length === 0) {
    return <p class="budget-empty">{ts("admin.budget.tableEmpty")}</p>;
  }
  return (
    <table class="budget-table">
      <thead>
        <tr>
          <th>{ts("admin.budget.tableKey")}</th>
          <th class="budget-table-right">{ts("admin.budget.tableCalls")}</th>
          <th class="budget-table-right">{ts("admin.budget.tableCost")}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr>
            <td>
              <code>{r.key}</code>
            </td>
            <td class="budget-table-right">{r.calls}</td>
            <td class="budget-table-right">
              {formatCost(r.total_usd, rate, preferBrl)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
