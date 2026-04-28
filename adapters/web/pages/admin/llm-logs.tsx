import type { FC } from "hono/jsx";
import { Layout, type SidebarScopes } from "../layout.js";
import type { User, LlmCallRow, LlmRole } from "../../../../server/db.js";
import { ts } from "../../i18n.js";

export interface LlmLogsListPageProps {
  user: User;
  rows: LlmCallRow[];
  total: number;
  limit: number;
  offset: number;
  enabled: boolean;
  filters: {
    role: LlmRole | null;
    session_id: string | null;
    model: string | null;
    search: string | null;
  };
  models: string[];
  saved?: string | null;
  error?: string | null;
  sidebarScopes?: SidebarScopes;
}

const ROLE_OPTIONS: LlmRole[] = [
  "reception",
  "main",
  "expression",
  "title",
  "summary",
];

function formatTimestamp(ms: number): string {
  const d = new Date(ms);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const sec = String(d.getSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${sec}`;
}

function formatTokens(input: number | null, output: number | null): string {
  const i = input ?? 0;
  const o = output ?? 0;
  if (i === 0 && o === 0) return "—";
  return `${i}/${o}`;
}

function formatCost(usd: number | null): string {
  if (usd === null || usd === undefined) return "—";
  if (usd === 0) return "$0";
  if (usd < 0.0001) return "<$0.0001";
  if (usd < 1) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

function formatLatency(ms: number | null): string {
  if (ms === null || ms === undefined) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function buildQueryString(
  filters: LlmLogsListPageProps["filters"],
  offset: number,
): string {
  const params = new URLSearchParams();
  if (filters.role) params.set("role", filters.role);
  if (filters.session_id) params.set("session_id", filters.session_id);
  if (filters.model) params.set("model", filters.model);
  if (filters.search) params.set("search", filters.search);
  if (offset > 0) params.set("offset", String(offset));
  const s = params.toString();
  return s ? `?${s}` : "";
}

export const LlmLogsListPage: FC<LlmLogsListPageProps> = ({
  user,
  rows,
  total,
  limit,
  offset,
  enabled,
  filters,
  models,
  saved,
  error,
  sidebarScopes,
}) => {
  const prevOffset = Math.max(0, offset - limit);
  const nextOffset = offset + limit;
  const hasPrev = offset > 0;
  const hasNext = nextOffset < total;
  const pageNum = Math.floor(offset / limit) + 1;
  const pageCount = Math.max(1, Math.ceil(total / limit));

  return (
    <Layout
      title={ts("admin.llmLogs.htmlTitle")}
      user={user}
      sidebarScopes={sidebarScopes}
    >
      <div class="llm-logs-header">
        <h1>{ts("admin.llmLogs.h1")}</h1>
        <p class="admin-lede">{ts("admin.llmLogs.lede")}</p>
      </div>

      {saved && <div class="flash flash-saved">{saved}</div>}
      {error && <div class="flash flash-error">{error}</div>}

      {/* Toggle + cleanup actions strip */}
      <div class="llm-logs-toolbar">
        <form method="POST" action="/admin/llm-logs/toggle" class="llm-logs-toggle-form">
          <span class="llm-logs-toggle-label">
            {ts("admin.llmLogs.toggle.label")}:{" "}
            <strong
              data-state={enabled ? "on" : "off"}
              class={`llm-logs-toggle-state ${enabled ? "on" : "off"}`}
            >
              {enabled
                ? ts("admin.llmLogs.toggle.on")
                : ts("admin.llmLogs.toggle.off")}
            </strong>
          </span>
          <button type="submit" class="llm-logs-toggle-btn">
            {enabled
              ? ts("admin.llmLogs.toggle.turnOff")
              : ts("admin.llmLogs.toggle.turnOn")}
          </button>
        </form>

        <div class="llm-logs-cleanup">
          <form
            method="POST"
            action="/admin/llm-logs/clear-older"
            class="llm-logs-cleanup-form"
            onsubmit={`return confirm('${ts("admin.llmLogs.cleanup.confirmOlder").replace(/'/g, "\\'")}')`}
          >
            <label>
              {ts("admin.llmLogs.cleanup.olderThan")}{" "}
              <input type="number" name="days" min="0" value="30" /> {ts("admin.llmLogs.cleanup.days")}
            </label>
            <button type="submit">{ts("admin.llmLogs.cleanup.purge")}</button>
          </form>

          <form
            method="POST"
            action="/admin/llm-logs/clear"
            class="llm-logs-cleanup-form"
            onsubmit={`return confirm('${ts("admin.llmLogs.cleanup.confirmAll").replace(/'/g, "\\'")}')`}
          >
            <button type="submit" class="llm-logs-clear-all">
              {ts("admin.llmLogs.cleanup.clearAll")}
            </button>
          </form>

          <a
            href={`/admin/llm-logs/export${buildQueryString(filters, 0)}${
              buildQueryString(filters, 0).includes("?") ? "&" : "?"
            }format=json`}
            class="llm-logs-export-link"
          >
            {ts("admin.llmLogs.export.json")}
          </a>
          <a
            href={`/admin/llm-logs/export${buildQueryString(filters, 0)}${
              buildQueryString(filters, 0).includes("?") ? "&" : "?"
            }format=csv`}
            class="llm-logs-export-link"
          >
            {ts("admin.llmLogs.export.csv")}
          </a>
        </div>
      </div>

      {/* Filter form */}
      <form method="GET" action="/admin/llm-logs" class="llm-logs-filters">
        <label>
          {ts("admin.llmLogs.filters.role")}
          <select name="role">
            <option value="">{ts("admin.llmLogs.filters.allRoles")}</option>
            {ROLE_OPTIONS.map((r) => (
              <option value={r} selected={filters.role === r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label>
          {ts("admin.llmLogs.filters.session")}
          <input
            type="text"
            name="session_id"
            value={filters.session_id ?? ""}
            placeholder={ts("admin.llmLogs.filters.sessionPlaceholder")}
          />
        </label>
        <label>
          {ts("admin.llmLogs.filters.model")}
          <select name="model">
            <option value="">{ts("admin.llmLogs.filters.allModels")}</option>
            {models.map((m) => (
              <option value={m} selected={filters.model === m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label class="llm-logs-search">
          {ts("admin.llmLogs.filters.search")}
          <input
            type="text"
            name="search"
            value={filters.search ?? ""}
            placeholder={ts("admin.llmLogs.filters.searchPlaceholder")}
          />
        </label>
        <button type="submit">{ts("admin.llmLogs.filters.apply")}</button>
        <a href="/admin/llm-logs" class="llm-logs-clear-filters">
          {ts("admin.llmLogs.filters.clear")}
        </a>
      </form>

      {/* Total count */}
      <p class="llm-logs-summary">
        {total === 0
          ? ts("admin.llmLogs.summary.empty")
          : ts("admin.llmLogs.summary.count", { count: total })}
      </p>

      {/* Rows */}
      {rows.length === 0 ? (
        <div class="llm-logs-empty">
          {enabled
            ? ts("admin.llmLogs.emptyEnabled")
            : ts("admin.llmLogs.emptyDisabled")}
        </div>
      ) : (
        <table class="llm-logs-table">
          <thead>
            <tr>
              <th>{ts("admin.llmLogs.col.time")}</th>
              <th>{ts("admin.llmLogs.col.role")}</th>
              <th>{ts("admin.llmLogs.col.model")}</th>
              <th>{ts("admin.llmLogs.col.tokens")}</th>
              <th>{ts("admin.llmLogs.col.cost")}</th>
              <th>{ts("admin.llmLogs.col.latency")}</th>
              <th>{ts("admin.llmLogs.col.session")}</th>
              <th>{ts("admin.llmLogs.col.error")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr>
                <td>
                  <a href={`/admin/llm-logs/${row.id}`}>
                    {formatTimestamp(row.created_at)}
                  </a>
                </td>
                <td>
                  <span class={`llm-logs-role llm-logs-role-${row.role}`}>
                    {row.role}
                  </span>
                </td>
                <td class="llm-logs-model">{row.model}</td>
                <td>{formatTokens(row.tokens_in, row.tokens_out)}</td>
                <td>{formatCost(row.cost_usd)}</td>
                <td>{formatLatency(row.latency_ms)}</td>
                <td class="llm-logs-session">
                  {row.session_id ? row.session_id.slice(0, 8) : "—"}
                </td>
                <td>
                  {row.error ? (
                    <span class="llm-logs-error-badge" title={row.error}>
                      ⚠
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Pagination */}
      {total > limit && (
        <nav class="llm-logs-pagination">
          {hasPrev ? (
            <a href={`/admin/llm-logs${buildQueryString(filters, prevOffset)}`}>
              ← {ts("admin.llmLogs.pagination.prev")}
            </a>
          ) : (
            <span class="llm-logs-pagination-disabled">
              ← {ts("admin.llmLogs.pagination.prev")}
            </span>
          )}
          <span class="llm-logs-pagination-info">
            {ts("admin.llmLogs.pagination.page", {
              page: pageNum,
              total: pageCount,
            })}
          </span>
          {hasNext ? (
            <a href={`/admin/llm-logs${buildQueryString(filters, nextOffset)}`}>
              {ts("admin.llmLogs.pagination.next")} →
            </a>
          ) : (
            <span class="llm-logs-pagination-disabled">
              {ts("admin.llmLogs.pagination.next")} →
            </span>
          )}
        </nav>
      )}
    </Layout>
  );
};

export interface LlmLogsDetailPageProps {
  user: User;
  row: LlmCallRow;
  sidebarScopes?: SidebarScopes;
}

export const LlmLogsDetailPage: FC<LlmLogsDetailPageProps> = ({
  user,
  row,
  sidebarScopes,
}) => {
  return (
    <Layout
      title={ts("admin.llmLogs.detail.htmlTitle")}
      user={user}
      sidebarScopes={sidebarScopes}
    >
      <p class="llm-logs-back">
        <a href="/admin/llm-logs">← {ts("admin.llmLogs.detail.back")}</a>
      </p>

      <h1>
        {ts("admin.llmLogs.detail.h1")}{" "}
        <span class="llm-logs-detail-id">{row.id}</span>
      </h1>

      <table class="llm-logs-detail-meta">
        <tr>
          <th>{ts("admin.llmLogs.detail.role")}</th>
          <td>{row.role}</td>
          <th>{ts("admin.llmLogs.detail.model")}</th>
          <td>{row.model}</td>
        </tr>
        <tr>
          <th>{ts("admin.llmLogs.detail.provider")}</th>
          <td>{row.provider}</td>
          <th>{ts("admin.llmLogs.detail.env")}</th>
          <td>{row.env}</td>
        </tr>
        <tr>
          <th>{ts("admin.llmLogs.detail.tokens")}</th>
          <td>{formatTokens(row.tokens_in, row.tokens_out)}</td>
          <th>{ts("admin.llmLogs.detail.cost")}</th>
          <td>{formatCost(row.cost_usd)}</td>
        </tr>
        <tr>
          <th>{ts("admin.llmLogs.detail.latency")}</th>
          <td>{formatLatency(row.latency_ms)}</td>
          <th>{ts("admin.llmLogs.detail.created")}</th>
          <td>{formatTimestamp(row.created_at)}</td>
        </tr>
        <tr>
          <th>{ts("admin.llmLogs.detail.session")}</th>
          <td colspan={3}>{row.session_id ?? "—"}</td>
        </tr>
        <tr>
          <th>{ts("admin.llmLogs.detail.entry")}</th>
          <td colspan={3}>{row.entry_id ?? "—"}</td>
        </tr>
        {row.error && (
          <tr>
            <th>{ts("admin.llmLogs.detail.error")}</th>
            <td colspan={3} class="llm-logs-detail-error">
              {row.error}
            </td>
          </tr>
        )}
      </table>

      {/* The three preserve-whitespace blocks. Admin needs to read what
          was actually sent and received — no markdown render, no
          collapse, monospace + scroll-y for long content. */}
      <section class="llm-logs-block">
        <h2>{ts("admin.llmLogs.detail.systemPrompt")}</h2>
        <pre class="llm-logs-pre">{row.system_prompt}</pre>
      </section>

      <section class="llm-logs-block">
        <h2>{ts("admin.llmLogs.detail.userMessage")}</h2>
        <pre class="llm-logs-pre">{row.user_message}</pre>
      </section>

      <section class="llm-logs-block">
        <h2>{ts("admin.llmLogs.detail.response")}</h2>
        {row.response ? (
          <pre class="llm-logs-pre">{row.response}</pre>
        ) : (
          <p class="llm-logs-detail-empty">
            {ts("admin.llmLogs.detail.responseEmpty")}
          </p>
        )}
      </section>
    </Layout>
  );
};
