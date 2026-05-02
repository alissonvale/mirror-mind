import type { FC } from "hono/jsx";
import { Layout, type SidebarScopes } from "./layout.js";
import type { User, Organization, Journey } from "../../../server/db.js";
import type { ConversationListRow } from "../../../server/conversation-list.js";
import { formatRelativeTime } from "../../../server/formatters/relative-time.js";
import { ts } from "../i18n.js";

export interface ConversationsListPageProps {
  user: User;
  rows: ConversationListRow[];
  total: number;
  limit: number;
  offset: number;
  filters: {
    persona: string | null;
    organization: string | null;
    journey: string | null;
  };
  personaKeys: string[];
  organizations: Organization[];
  journeys: Journey[];
  activeSessionId: string | null;
  sidebarScopes?: SidebarScopes;
  /** persona-colors improvement: map persona key → resolved color. */
  personaColors: Record<string, string>;
}

export const ConversationsListPage: FC<ConversationsListPageProps> = ({
  user,
  rows,
  total,
  limit,
  offset,
  filters,
  personaKeys,
  organizations,
  journeys,
  activeSessionId,
  sidebarScopes,
  personaColors,
}) => {
  const hasFilters =
    filters.persona !== null ||
    filters.organization !== null ||
    filters.journey !== null;
  const showingTo = Math.min(offset + rows.length, total);
  const hasMore = offset + rows.length < total;
  const nextOffset = offset + limit;

  // Preserve filters in the "Show more" link.
  const moreParams = new URLSearchParams();
  if (filters.persona) moreParams.set("persona", filters.persona);
  if (filters.organization)
    moreParams.set("organization", filters.organization);
  if (filters.journey) moreParams.set("journey", filters.journey);
  moreParams.set("offset", String(nextOffset));
  const moreHref = `/conversations?${moreParams.toString()}`;

  return (
    <Layout title={ts("conversations.htmlTitle")} user={user} sidebarScopes={sidebarScopes}>
      <div class="conversations-list">
        <header class="conversations-header">
          <h1>{ts("conversations.h1")}</h1>
          <p class="conversations-intro">
            {ts("conversations.intro")}
          </p>
        </header>

        <form
          method="GET"
          action="/conversations"
          class="conversations-filters"
          data-testid="conversations-filters"
        >
          <label class="conversations-filter">
            <span class="conversations-filter-label">{ts("conversations.filter.persona")}</span>
            <select name="persona" class="conversations-filter-select">
              <option value="" selected={filters.persona === null}>
                {ts("conversations.filter.all")}
              </option>
              {personaKeys.map((k) => (
                <option value={k} selected={filters.persona === k}>
                  {k}
                </option>
              ))}
            </select>
          </label>

          <label class="conversations-filter">
            <span class="conversations-filter-label">{ts("conversations.filter.organization")}</span>
            <select name="organization" class="conversations-filter-select">
              <option value="" selected={filters.organization === null}>
                {ts("conversations.filter.all")}
              </option>
              {organizations.map((o) => (
                <option value={o.key} selected={filters.organization === o.key}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>

          <label class="conversations-filter">
            <span class="conversations-filter-label">{ts("conversations.filter.journey")}</span>
            <select name="journey" class="conversations-filter-select">
              <option value="" selected={filters.journey === null}>
                {ts("conversations.filter.all")}
              </option>
              {journeys.map((j) => (
                <option value={j.key} selected={filters.journey === j.key}>
                  {j.name}
                </option>
              ))}
            </select>
          </label>

          <div class="conversations-filter-actions">
            <button type="submit" class="conversations-filter-apply">
              {ts("conversations.filter.apply")}
            </button>
            {hasFilters && (
              <a href="/conversations" class="conversations-filter-clear">
                {ts("conversations.filter.clear")}
              </a>
            )}
          </div>
        </form>

        <div class="conversations-meta" data-testid="conversations-meta">
          {total === 0
            ? hasFilters
              ? ts("conversations.empty.filtered")
              : ts("conversations.empty")
            : ts("conversations.showing", {
                start: offset + 1,
                end: showingTo,
                total,
              })}
        </div>

        {rows.length > 0 && (
          <ul class="conversations-rows">
            {rows.map((r) => (
              <ConversationRow
                row={r}
                isActive={r.sessionId === activeSessionId}
                returnTo={currentUrl(filters, offset)}
                personaColor={
                  r.personaKey ? personaColors[r.personaKey] ?? null : null
                }
              />
            ))}
          </ul>
        )}

        {hasMore && (
          <p class="conversations-more">
            <a href={moreHref}>
              {ts("conversations.showMore", { n: Math.min(limit, total - showingTo) })}
            </a>
          </p>
        )}

        {total === 0 && hasFilters && (
          <p class="conversations-empty-action">
            <a href="/conversations">{ts("conversations.clearFilters")}</a>
          </p>
        )}
      </div>
    </Layout>
  );
};

/**
 * Reconstruct the URL of the current /conversations view so the
 * title-regenerate form can redirect the user back to the same
 * filtered/paginated state instead of dropping them at the unfiltered
 * root. Preserves persona/organization/journey filters and offset.
 */
function currentUrl(
  filters: ConversationsListPageProps["filters"],
  offset: number,
): string {
  const params = new URLSearchParams();
  if (filters.persona) params.set("persona", filters.persona);
  if (filters.organization) params.set("organization", filters.organization);
  if (filters.journey) params.set("journey", filters.journey);
  if (offset > 0) params.set("offset", String(offset));
  const qs = params.toString();
  return qs ? `/conversations?${qs}` : "/conversations";
}

const ConversationRow: FC<{
  row: ConversationListRow;
  isActive: boolean;
  returnTo: string;
  personaColor: string | null;
}> = ({ row, isActive, returnTo, personaColor }) => (
  <li
    class={`conversations-row ${isActive ? "conversations-row--active" : ""}`}
    data-testid={`conversation-row-${row.sessionId}`}
  >
    <a
      class="conversations-row-link"
      href={`/conversation/${row.sessionId}`}
    >
      <div class="conversations-row-head">
        <span class="conversations-row-title">
          {row.title ?? ts("conversations.row.untitled")}
        </span>
        {isActive && <span class="conversations-row-current">{ts("conversations.row.current")}</span>}
        <span class="conversations-row-when">
          {formatRelativeTime(row.lastActivityAt) ?? ""}
        </span>
      </div>
      <div class="conversations-row-tags">
        {row.personaKey && (
          <span
            class="conversations-row-tag conversations-row-persona"
            style={personaColor ? `color: ${personaColor};` : undefined}
          >
            ❖ {row.personaKey}
          </span>
        )}
        {row.organizationKey && (
          <span class="conversations-row-tag conversations-row-org">
            ⌂ {row.organizationKey}
          </span>
        )}
        {row.journeyKey && (
          <span class="conversations-row-tag conversations-row-journey">
            ↝ {row.journeyKey}
          </span>
        )}
      </div>
      {row.firstUserPreview && (
        <p class="conversations-row-preview">{row.firstUserPreview}</p>
      )}
    </a>
    {/* Quiet-luxury title regenerate: visible only on row hover.
        Form sits OUTSIDE the <a> so clicking the button doesn't
        trigger the row's link navigation. */}
    <form
      method="POST"
      action="/conversation/title/regenerate"
      class="conversations-row-title-regen"
    >
      <input type="hidden" name="sessionId" value={row.sessionId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <button
        type="submit"
        aria-label={ts("conversations.row.regenerateAria")}
        title={ts("conversations.row.regenerateTitle")}
      >
        ↻
      </button>
    </form>
  </li>
);
