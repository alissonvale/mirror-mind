import type { FC } from "hono/jsx";
import { Layout } from "../layout.js";
import type { User } from "../../../../server/db.js";

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
}

function formatUsd(n: number): string {
  return `$${n.toFixed(n < 1 ? 4 : 2)}`;
}

function formatBrl(usd: number, rate: number): string {
  const brl = usd * rate;
  return `R$${brl.toFixed(brl < 10 ? 2 : 0)}`;
}

function formatUsdAndMaybeBrl(
  usd: number,
  rate: number,
  showBrl: boolean,
): string {
  return showBrl ? `${formatUsd(usd)} · ${formatBrl(usd, rate)}` : formatUsd(usd);
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
}) => {
  const showBrl = user.show_brl_conversion === 1;
  const remaining = keyInfo?.limit_remaining ?? null;
  const cap = keyInfo?.limit ?? null;
  const pct = progressPercent(remaining, cap);

  return (
    <Layout title="Budget" user={user}>
      <h1>Budget</h1>
      <p class="admin-lede">
        This mirror runs on OpenRouter pay-per-token, framed as a prepaid
        subscription. Top up at OpenRouter; the numbers below come from
        the dedicated account's API in real time, and from the mirror's
        own call log for per-role breakdowns.
      </p>

      {saved && <p class="flash flash-success">{saved}</p>}
      {error && <p class="flash flash-error">{error}</p>}

      {/* Credit remaining — the big number */}
      <section class="budget-hero">
        {keyInfo ? (
          <>
            <div class="budget-hero-label">Credit remaining</div>
            {remaining !== null ? (
              <div class="budget-hero-value">
                {formatUsdAndMaybeBrl(remaining, usdToBrlRate, showBrl)}
              </div>
            ) : (
              <div class="budget-hero-value budget-hero-uncapped">
                Uncapped account — set a spending limit at OpenRouter to use the budget UI fully
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
                  {pct.toFixed(0)}% of {formatUsdAndMaybeBrl(cap, usdToBrlRate, showBrl)} remaining
                  · {formatUsdAndMaybeBrl(keyInfo.usage, usdToBrlRate, showBrl)} spent lifetime
                  {keyInfo.label && ` · key: ${keyInfo.label}`}
                </div>
              </>
            )}
          </>
        ) : (
          <div class="budget-hero-unavailable">
            Billing data unavailable. Check OPENROUTER_API_KEY and try again in a moment.
          </div>
        )}
      </section>

      {/* Month totals */}
      <section class="budget-section">
        <h2>This month</h2>
        <div class="budget-cards">
          <div class="budget-card">
            <div class="budget-card-label">Total spent</div>
            <div class="budget-card-value">
              {formatUsdAndMaybeBrl(monthTotal.total_usd, usdToBrlRate, showBrl)}
            </div>
            <div class="budget-card-meta">
              {monthTotal.total_calls} calls
              {monthTotal.total_calls !== monthTotal.resolved_calls && (
                <> · {monthTotal.total_calls - monthTotal.resolved_calls} awaiting reconciliation</>
              )}
            </div>
          </div>
          <div class="budget-card">
            <div class="budget-card-label">Burn rate (7d avg)</div>
            <div class="budget-card-value">
              {formatUsdAndMaybeBrl(burnRate.avg_usd_per_day, usdToBrlRate, showBrl)}/day
            </div>
            <div class="budget-card-meta">
              {burnRate.days_of_credit_left !== null
                ? `At this rate, credits last ~${Math.round(burnRate.days_of_credit_left)} days`
                : "Can't project without a spending cap"}
            </div>
          </div>
        </div>
      </section>

      {/* Breakdowns */}
      <section class="budget-section">
        <h2>By role</h2>
        <BudgetTable
          rows={byRole}
          showBrl={showBrl}
          rate={usdToBrlRate}
          emptyLabel="No calls logged this month."
        />
      </section>

      <section class="budget-section">
        <h2>By environment</h2>
        <BudgetTable
          rows={byEnv}
          showBrl={showBrl}
          rate={usdToBrlRate}
          emptyLabel="No calls logged this month."
        />
      </section>

      <section class="budget-section">
        <h2>By model</h2>
        <BudgetTable
          rows={byModel}
          showBrl={showBrl}
          rate={usdToBrlRate}
          emptyLabel="No calls logged this month."
        />
      </section>

      {/* Preferences */}
      <section class="budget-section">
        <h2>Preferences</h2>
        <div class="budget-prefs">
          <form
            method="POST"
            action="/admin/budget/rate"
            class="budget-pref-form"
          >
            <label class="budget-pref-label">
              Exchange rate (USD → BRL) · global
              <span class="budget-pref-hint">
                Applied when displaying BRL. Edit when the rate shifts.
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
              <button type="submit" class="budget-pref-save">Save rate</button>
            </div>
          </form>

          <p class="budget-pref-note">
            BRL display is a personal preference — set it on{" "}
            <a href="/me">About You</a>.
          </p>
        </div>
      </section>

      <p class="budget-topup">
        Low on credits?{" "}
        <a
          href="https://openrouter.ai/settings/credits"
          target="_blank"
          rel="noopener noreferrer"
        >
          Top up at OpenRouter →
        </a>
      </p>
    </Layout>
  );
};

const BudgetTable: FC<{
  rows: BudgetBreakdownRow[];
  showBrl: boolean;
  rate: number;
  emptyLabel: string;
}> = ({ rows, showBrl, rate, emptyLabel }) => {
  if (rows.length === 0) {
    return <p class="budget-empty">{emptyLabel}</p>;
  }
  return (
    <table class="budget-table">
      <thead>
        <tr>
          <th>Key</th>
          <th class="budget-table-right">Calls</th>
          <th class="budget-table-right">Cost</th>
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
              {formatUsdAndMaybeBrl(r.total_usd, rate, showBrl)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
