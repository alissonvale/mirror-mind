import type { FC } from "hono/jsx";
import { Layout, type SidebarScopes } from "./layout.js";
import type { User, Organization } from "../../../server/db.js";
import type {
  LatestScopeSession,
  ScopeSessionRow,
} from "../../../server/scope-sessions.js";
import type { ScopeSummaryResult } from "../../../server/summary.js";
import { formatRelativeTime } from "../../../server/formatters/relative-time.js";
import { ts } from "../i18n.js";

/**
 * Small banner shown above the Summary block after the Regenerate button
 * runs. Without it, the form-POST redirect hides the status of the
 * awaited call — silent timeouts look identical to "nothing happened".
 */
export const SummaryStatusBanner: FC<{ status: ScopeSummaryResult }> = ({ status }) => {
  if (status === "ok") {
    return (
      <div class="summary-status summary-status-ok" role="status">
        {ts("scope.summary.ok")}
      </div>
    );
  }
  if (status === "empty") {
    return (
      <div class="summary-status summary-status-warn" role="status">
        {ts("scope.summary.empty")}
      </div>
    );
  }
  if (status === "timeout") {
    return (
      <div class="summary-status summary-status-warn" role="status">
        {ts("scope.summary.timeout")}
      </div>
    );
  }
  return (
    <div class="summary-status summary-status-warn" role="status">
      {ts("scope.summary.failed")}
    </div>
  );
};

export interface ScopeRowControls {
  scopeKind: "organization" | "journey";
  canMoveUp: boolean;
  canMoveDown: boolean;
  hiddenFromSidebar: boolean;
}

export interface ScopeRowBadge {
  name: string;
}

export const ScopeRow: FC<{
  href: string;
  name: string;
  scopeKey: string;
  body: string | null;
  lastSession: LatestScopeSession | null;
  badge?: ScopeRowBadge | null;
  controls?: ScopeRowControls;
}> = ({ href, name, scopeKey, body, lastSession, badge, controls }) => {
  const basePath = controls
    ? controls.scopeKind === "organization"
      ? "/organizations"
      : "/journeys"
    : null;
  const hidden = controls?.hiddenFromSidebar ?? false;

  return (
    <div class={`scope-row ${hidden ? "scope-row-hidden" : ""}`}>
      {controls && basePath && (
        <div class="scope-row-controls" aria-label={ts("scope.row.controlsAria")}>
          <form method="post" action={`${basePath}/${scopeKey}/reorder`} class="scope-row-control-form">
            <input type="hidden" name="direction" value="up" />
            <button
              type="submit"
              class="scope-row-control"
              title={ts("scope.row.moveUp")}
              aria-label={ts("scope.row.moveUp")}
              disabled={!controls.canMoveUp}
            >
              ↑
            </button>
          </form>
          <form method="post" action={`${basePath}/${scopeKey}/reorder`} class="scope-row-control-form">
            <input type="hidden" name="direction" value="down" />
            <button
              type="submit"
              class="scope-row-control"
              title={ts("scope.row.moveDown")}
              aria-label={ts("scope.row.moveDown")}
              disabled={!controls.canMoveDown}
            >
              ↓
            </button>
          </form>
          <form method="post" action={`${basePath}/${scopeKey}/sidebar`} class="scope-row-control-form">
            <input type="hidden" name="visible" value={hidden ? "1" : "0"} />
            <button
              type="submit"
              class={`scope-row-control ${hidden ? "scope-row-control-off" : ""}`}
              title={hidden ? ts("scope.row.show") : ts("scope.row.hide")}
              aria-label={hidden ? ts("scope.row.show") : ts("scope.row.hide")}
            >
              {hidden ? "◎" : "●"}
            </button>
          </form>
        </div>
      )}
      <a href={href} class="scope-card">
        <div class="scope-card-name-row">
          <span class="scope-card-name">{name}</span>
          {badge && (
            <span class="scope-card-badge" title={ts("scope.row.partOf", { name: badge.name })}>
              {badge.name}
            </span>
          )}
        </div>
        <div class="scope-card-key">{scopeKey}</div>
        {body && <p class="scope-card-body">{body}</p>}
      </a>
      {lastSession ? (
        <a
          href={`/conversation/${lastSession.sessionId}`}
          class="scope-last scope-last--link"
          data-testid={`scope-last-${scopeKey}`}
        >
          <div class="scope-last-label">{ts("scope.row.lastConversation")}</div>
          <div class="scope-last-title">
            {lastSession.title ?? ts("scope.row.untitled")}
          </div>
          <div class="scope-last-when">
            {formatRelativeTime(lastSession.lastActivityAt) ?? ts("common.dash")}
          </div>
        </a>
      ) : (
        <div
          class="scope-last scope-last--empty"
          data-testid={`scope-last-${scopeKey}`}
        >
          <div class="scope-last-label">{ts("scope.row.lastConversation")}</div>
          <div class="scope-last-empty">{ts("scope.row.noConversations")}</div>
        </div>
      )}
    </div>
  );
};

export const ScopeSessionsList: FC<{
  sessions: ScopeSessionRow[];
  total: number;
  scopeKind: "organization" | "journey";
  scopeKey: string;
}> = ({ sessions, total, scopeKind, scopeKey }) => {
  const filterParam = scopeKind === "organization" ? "organization" : "journey";
  const viewAllHref = `/conversations?${filterParam}=${encodeURIComponent(scopeKey)}`;
  const hasMore = total > sessions.length;
  const emptyKey =
    scopeKind === "organization"
      ? "scope.sessions.emptyOrg"
      : "scope.sessions.emptyJourney";

  return (
    <section class="scope-sessions" data-testid="scope-sessions">
      <div class="scope-sessions-header">
        <h2 class="scope-sessions-title">{ts("scope.sessions.title")}</h2>
        <span class="scope-sessions-count">
          {total === 0
            ? ""
            : total === 1
              ? ts("scope.sessions.countOne")
              : hasMore
                ? ts("scope.sessions.countOf", { visible: sessions.length, total })
                : ts("scope.sessions.countTotal", { total })}
        </span>
      </div>
      {total === 0 ? (
        <p class="scope-sessions-empty">
          {ts(emptyKey)}
        </p>
      ) : (
        <>
          <ul class="scope-sessions-list">
            {sessions.map((s) => (
              <li class="scope-sessions-row" data-testid={`scope-session-${s.sessionId}`}>
                <a class="scope-sessions-link" href={`/conversation/${s.sessionId}`}>
                  <div class="scope-sessions-row-head">
                    <span class="scope-sessions-row-title">
                      {s.title ?? ts("scope.row.untitled")}
                    </span>
                    {s.personaKey && (
                      <span class="scope-sessions-row-persona">◇ {s.personaKey}</span>
                    )}
                    <span class="scope-sessions-row-when">
                      {formatRelativeTime(s.lastActivityAt) ?? ""}
                    </span>
                  </div>
                  {s.firstUserPreview && (
                    <p class="scope-sessions-row-preview">{s.firstUserPreview}</p>
                  )}
                </a>
              </li>
            ))}
          </ul>
          {hasMore && (
            <p class="scope-sessions-more">
              <a href={viewAllHref}>{ts("scope.sessions.viewAll", { total })}</a>
            </p>
          )}
        </>
      )}
    </section>
  );
};

export const OrganizationsListPage: FC<{
  user: User;
  organizations: Organization[];
  archivedCount: number;
  showArchived: boolean;
  latestSessions: Map<string, LatestScopeSession>;
  sidebarScopes?: SidebarScopes;
}> = ({
  user,
  organizations,
  archivedCount,
  showArchived,
  latestSessions,
  sidebarScopes,
}) => {
  const active = organizations.filter((o) => o.status === "active");
  const concluded = organizations.filter((o) => o.status === "concluded");
  const archived = organizations.filter((o) => o.status === "archived");

  return (
    <Layout title={ts("organizations.htmlTitle")} user={user} sidebarScopes={sidebarScopes}>
      <div class="scope-list">
        <header class="scope-list-header">
          <h1>{ts("organizations.h1")}</h1>
          <p class="scope-list-intro">
            {ts("organizations.intro")}
          </p>
        </header>

        {active.length > 0 && (
          <section class="scope-rows">
            {active.map((org, idx) => (
              <ScopeRow
                href={`/organizations/${org.key}`}
                name={org.name}
                scopeKey={org.key}
                body={org.summary || (org.briefing ? firstLine(org.briefing) : null)}
                lastSession={latestSessions.get(org.key) ?? null}
                controls={{
                  scopeKind: "organization",
                  canMoveUp: idx > 0,
                  canMoveDown: idx < active.length - 1,
                  hiddenFromSidebar: org.show_in_sidebar === 0,
                }}
              />
            ))}
          </section>
        )}

        {concluded.length > 0 && (
          <section class="scope-band scope-band-concluded">
            <h2 class="scope-band-title">{ts("scope.band.concluded")}</h2>
            <p class="scope-band-hint">
              {ts("scope.band.concludedHint")}
            </p>
            <div class="scope-rows">
              {concluded.map((org, idx) => (
                <ScopeRow
                  href={`/organizations/${org.key}`}
                  name={org.name}
                  scopeKey={org.key}
                  body={org.summary || (org.briefing ? firstLine(org.briefing) : null)}
                  lastSession={latestSessions.get(org.key) ?? null}
                  controls={{
                    scopeKind: "organization",
                    canMoveUp: idx > 0,
                    canMoveDown: idx < concluded.length - 1,
                    hiddenFromSidebar: org.show_in_sidebar === 0,
                  }}
                />
              ))}
            </div>
          </section>
        )}

        {archivedCount > 0 && !showArchived && (
          <p class="scope-archive-toggle">
            <a href="/organizations?archived=1">
              {ts(archivedCount === 1 ? "organizations.showArchivedOne" : "organizations.showArchivedMany", { count: archivedCount })}
            </a>
          </p>
        )}

        {showArchived && archived.length > 0 && (
          <section class="scope-archived">
            <h2>{ts("scope.archived.heading")}</h2>
            <ul>
              {archived.map((org) => (
                <li>
                  <a href={`/organizations/${org.key}`}>{org.name}</a>
                  <span class="scope-archived-key">{org.key}</span>
                </li>
              ))}
            </ul>
            <p class="scope-archive-toggle">
              <a href="/organizations">{ts("scope.archived.hide")}</a>
            </p>
          </section>
        )}

        <section class="scope-create">
          <form method="POST" action="/organizations" class="scope-create-form">
            <h2>{ts("organizations.create.heading")}</h2>
            <label>
              <span class="scope-label">{ts("scope.create.nameLabel")}</span>
              <input type="text" name="name" required placeholder={ts("scope.create.namePlaceholder")} />
            </label>
            <label>
              <span class="scope-label">{ts("scope.create.keyLabel")}</span>
              <input
                type="text"
                name="key"
                required
                placeholder={ts("scope.create.keyPlaceholder")}
                pattern="[a-z0-9-]+"
                title={ts("scope.create.keyTitle")}
              />
              <span class="scope-hint">
                {ts("scope.create.keyHint")}
              </span>
            </label>
            <button type="submit" class="scope-create-submit">{ts("scope.create.submit")}</button>
          </form>
        </section>
      </div>
    </Layout>
  );
};

export const OrganizationWorkshopPage: FC<{
  user: User;
  organization: Organization;
  sessions: ScopeSessionRow[];
  sessionsTotal: number;
  summaryStatus?: ScopeSummaryResult;
  sidebarScopes?: SidebarScopes;
}> = ({
  user,
  organization: org,
  sessions,
  sessionsTotal,
  summaryStatus,
  sidebarScopes,
}) => {
  const isArchived = org.status === "archived";
  const isConcluded = org.status === "concluded";
  const isActive = org.status === "active";

  return (
    <Layout title={`${org.name} — ${ts("organizations.workshop.titleSuffix")}`} user={user} wide sidebarScopes={sidebarScopes}>
      <div class="scope-workshop">
        <nav class="workshop-breadcrumb">
          <a href="/organizations">{ts("organizations.breadcrumbBack")}</a>
          <span class="workshop-breadcrumb-sep">/</span>
          <span>{org.name}</span>
          <span class="workshop-breadcrumb-meta">· {org.key}</span>
          {isArchived && <span class="scope-status-badge">{ts("scope.statusBadge.archived")}</span>}
          {isConcluded && (
            <span class="scope-status-badge scope-status-badge-concluded">
              {ts("scope.statusBadge.concluded")}
            </span>
          )}
        </nav>

        <header class="workshop-header">
          <h1>{org.name}</h1>
          <p class="workshop-header-help">
            {ts("organizations.workshop.headerHelpPart1")}{" "}
            <strong>{ts("scope.workshop.briefingLabel")}</strong>{" "}
            {ts("organizations.workshop.headerHelpPart2")}{" "}
            <strong>{ts("scope.workshop.situationLabel")}</strong>{" "}
            {ts("organizations.workshop.headerHelpPart3")}
          </p>
        </header>

        <section class="workshop-summary">
          <div class="workshop-summary-header">
            <span class="workshop-summary-label">{ts("scope.workshop.summaryLabel")}</span>
            <span class="workshop-summary-sub">
              {ts("scope.workshop.summarySub")}
            </span>
          </div>
          {summaryStatus && <SummaryStatusBanner status={summaryStatus} />}
          {org.summary ? (
            <p class="workshop-summary-body">{org.summary}</p>
          ) : (
            <p class="workshop-summary-empty">
              {ts("scope.workshop.summaryEmpty")}
            </p>
          )}
          <form method="POST" action={`/organizations/${org.key}/regenerate-summary`}>
            <button type="submit" class="workshop-summary-regenerate">
              {ts("scope.workshop.regenerateSummary")}
            </button>
          </form>
        </section>

        <ScopeSessionsList
          sessions={sessions}
          total={sessionsTotal}
          scopeKind="organization"
          scopeKey={org.key}
        />

        <form method="POST" action={`/organizations/${org.key}`} class="workshop-form">
          <label class="workshop-label" for="scope-name">{ts("scope.workshop.nameLabel")}</label>
          <input
            id="scope-name"
            type="text"
            name="name"
            value={org.name}
            required
            class="scope-input"
          />

          <label class="workshop-label" for="scope-briefing">{ts("scope.workshop.briefingLabel")}</label>
          <span class="scope-field-hint">
            {ts("organizations.workshop.briefingHint")}
          </span>
          <textarea
            id="scope-briefing"
            name="briefing"
            class="workshop-textarea scope-textarea"
            spellcheck="false"
          >{org.briefing}</textarea>

          <label class="workshop-label" for="scope-situation">{ts("scope.workshop.situationLabel")}</label>
          <span class="scope-field-hint">
            {ts("organizations.workshop.situationHint")}
          </span>
          <textarea
            id="scope-situation"
            name="situation"
            class="workshop-textarea scope-textarea"
            spellcheck="false"
          >{org.situation}</textarea>

          <div class="workshop-actions">
            <button type="submit" class="workshop-save">{ts("common.save")}</button>
            <a href="/organizations" class="workshop-cancel">{ts("common.cancel")}</a>
          </div>
        </form>

        <section class="scope-lifecycle">
          <h2>{ts("scope.lifecycle.heading")}</h2>
          {isActive && (
            <>
              <form method="POST" action={`/organizations/${org.key}/conclude`}>
                <button type="submit" class="scope-lifecycle-primary">
                  {ts("scope.lifecycle.markConcluded")}
                </button>
                <span class="scope-lifecycle-note">
                  {ts("organizations.lifecycle.markConcludedNote")}
                </span>
              </form>
              <form method="POST" action={`/organizations/${org.key}/archive`}>
                <button type="submit" class="scope-lifecycle-primary">
                  {ts("scope.lifecycle.archive")}
                </button>
                <span class="scope-lifecycle-note">
                  {ts("organizations.lifecycle.archiveActiveNote")}
                </span>
              </form>
            </>
          )}
          {isConcluded && (
            <>
              <form method="POST" action={`/organizations/${org.key}/reopen`}>
                <button type="submit" class="scope-lifecycle-primary">
                  {ts("scope.lifecycle.reopen")}
                </button>
                <span class="scope-lifecycle-note">
                  {ts("organizations.lifecycle.reopenNote")}
                </span>
              </form>
              <form method="POST" action={`/organizations/${org.key}/archive`}>
                <button type="submit" class="scope-lifecycle-primary">
                  {ts("scope.lifecycle.archive")}
                </button>
                <span class="scope-lifecycle-note">
                  {ts("organizations.lifecycle.archiveConcludedNote")}
                </span>
              </form>
            </>
          )}
          {isArchived && (
            <form method="POST" action={`/organizations/${org.key}/unarchive`}>
              <button type="submit" class="scope-lifecycle-primary">
                {ts("scope.lifecycle.unarchive")}
              </button>
              <span class="scope-lifecycle-note">
                {ts("organizations.lifecycle.unarchiveNote")}
              </span>
            </form>
          )}

          <form
            method="POST"
            action={`/organizations/${org.key}/delete`}
            class="scope-lifecycle-destructive"
          >
            <button
              type="submit"
              class="scope-lifecycle-delete"
              onclick={`return confirm('${ts("organizations.lifecycle.deleteConfirm", { name: org.name }).replace(/'/g, "\\'")}')`}
            >
              {ts("organizations.lifecycle.delete")}
            </button>
          </form>
        </section>
      </div>
    </Layout>
  );
};

function firstLine(text: string): string {
  const line = text.split("\n").find((l) => l.trim() && !l.startsWith("#"));
  if (!line) return "";
  const trimmed = line.trim();
  return trimmed.length > 140 ? trimmed.slice(0, 140) + "…" : trimmed;
}
