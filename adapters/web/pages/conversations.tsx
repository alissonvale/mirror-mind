import type { FC } from "hono/jsx";
import { Layout, type SidebarScopes } from "./layout.js";
import type { User, Organization, Journey } from "../../../server/db.js";
import type { ConversationListRow } from "../../../server/conversation-list.js";
import { formatRelativeTime } from "../../../server/formatters/relative-time.js";

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
    <Layout title="Conversations" user={user} sidebarScopes={sidebarScopes}>
      <div class="conversations-list">
        <header class="conversations-header">
          <h1>Conversations</h1>
          <p class="conversations-intro">
            Every conversation you've had, across personas and scopes. Filter
            to narrow. Click any row to continue from where it stopped.
          </p>
        </header>

        <form
          method="GET"
          action="/conversations"
          class="conversations-filters"
          data-testid="conversations-filters"
        >
          <label class="conversations-filter">
            <span class="conversations-filter-label">Persona</span>
            <select name="persona" class="conversations-filter-select">
              <option value="" selected={filters.persona === null}>
                All
              </option>
              {personaKeys.map((k) => (
                <option value={k} selected={filters.persona === k}>
                  {k}
                </option>
              ))}
            </select>
          </label>

          <label class="conversations-filter">
            <span class="conversations-filter-label">Organization</span>
            <select name="organization" class="conversations-filter-select">
              <option value="" selected={filters.organization === null}>
                All
              </option>
              {organizations.map((o) => (
                <option value={o.key} selected={filters.organization === o.key}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>

          <label class="conversations-filter">
            <span class="conversations-filter-label">Journey</span>
            <select name="journey" class="conversations-filter-select">
              <option value="" selected={filters.journey === null}>
                All
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
              Apply
            </button>
            {hasFilters && (
              <a href="/conversations" class="conversations-filter-clear">
                Clear
              </a>
            )}
          </div>
        </form>

        <div class="conversations-meta" data-testid="conversations-meta">
          {total === 0
            ? hasFilters
              ? "No conversations match these filters."
              : "No conversations yet."
            : `Showing ${offset + 1}–${showingTo} of ${total}`}
        </div>

        {rows.length > 0 && (
          <ul class="conversations-rows">
            {rows.map((r) => (
              <ConversationRow
                row={r}
                isActive={r.sessionId === activeSessionId}
                returnTo={currentUrl(filters, offset)}
              />
            ))}
          </ul>
        )}

        {hasMore && (
          <p class="conversations-more">
            <a href={moreHref}>Show {Math.min(limit, total - showingTo)} more →</a>
          </p>
        )}

        {total === 0 && hasFilters && (
          <p class="conversations-empty-action">
            <a href="/conversations">Clear filters and see all</a>
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
}> = ({ row, isActive, returnTo }) => (
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
          {row.title ?? "Untitled conversation"}
        </span>
        {isActive && <span class="conversations-row-current">current</span>}
        <span class="conversations-row-when">
          {formatRelativeTime(row.lastActivityAt) ?? ""}
        </span>
      </div>
      <div class="conversations-row-tags">
        {row.personaKey && (
          <span class="conversations-row-tag conversations-row-persona">
            ◇ {row.personaKey}
          </span>
        )}
        {row.organizationKey && (
          <span class="conversations-row-tag conversations-row-org">
            ◈ {row.organizationKey}
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
        aria-label="Regenerate title for this conversation"
        title="Regenerate title"
      >
        ↻
      </button>
    </form>
  </li>
);
