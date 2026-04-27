import type { FC } from "hono/jsx";
import { Layout, type SidebarScopes } from "./layout.js";
import type { User, Organization, Journey } from "../../../server/db.js";
import type {
  LatestScopeSession,
  ScopeSessionRow,
} from "../../../server/scope-sessions.js";
import type { ScopeSummaryResult } from "../../../server/summary.js";
import {
  ScopeRow,
  ScopeSessionsList,
  SummaryStatusBanner,
} from "./organizations.js";
import { ts } from "../i18n.js";

export const JourneysListPage: FC<{
  user: User;
  journeys: Journey[];
  organizations: Organization[];
  allOrganizations: Organization[];
  archivedCount: number;
  showArchived: boolean;
  latestSessions: Map<string, LatestScopeSession>;
  sidebarScopes?: SidebarScopes;
}> = ({
  user,
  journeys,
  organizations,
  allOrganizations,
  archivedCount,
  showArchived,
  latestSessions,
  sidebarScopes,
}) => {
  const active = journeys.filter((j) => j.status === "active");
  const concluded = journeys.filter((j) => j.status === "concluded");
  const archived = journeys.filter((j) => j.status === "archived");
  const orgById = new Map(allOrganizations.map((o) => [o.id, o]));

  return (
    <Layout title={ts("journeys.htmlTitle")} user={user} sidebarScopes={sidebarScopes}>
      <div class="scope-list">
        <header class="scope-list-header">
          <h1>{ts("journeys.h1")}</h1>
          <p class="scope-list-intro">
            {ts("journeys.intro")}
          </p>
        </header>

        {active.length > 0 && (
          <section class="scope-rows">
            {active.map((j, idx) => {
              const org =
                j.organization_id !== null ? orgById.get(j.organization_id) ?? null : null;
              return (
                <ScopeRow
                  href={`/journeys/${j.key}`}
                  name={j.name}
                  scopeKey={j.key}
                  body={j.summary || (j.briefing ? firstLine(j.briefing) : null)}
                  lastSession={latestSessions.get(j.key) ?? null}
                  badge={org ? { name: org.name } : null}
                  controls={{
                    scopeKind: "journey",
                    canMoveUp: idx > 0,
                    canMoveDown: idx < active.length - 1,
                    hiddenFromSidebar: j.show_in_sidebar === 0,
                  }}
                />
              );
            })}
          </section>
        )}

        {concluded.length > 0 && (
          <section class="scope-band scope-band-concluded">
            <h2 class="scope-band-title">{ts("scope.band.concluded")}</h2>
            <p class="scope-band-hint">
              {ts("scope.band.concludedHint")}
            </p>
            <div class="scope-rows">
              {concluded.map((j, idx) => {
                const org =
                  j.organization_id !== null
                    ? orgById.get(j.organization_id) ?? null
                    : null;
                return (
                  <ScopeRow
                    href={`/journeys/${j.key}`}
                    name={j.name}
                    scopeKey={j.key}
                    body={j.summary || (j.briefing ? firstLine(j.briefing) : null)}
                    lastSession={latestSessions.get(j.key) ?? null}
                    badge={org ? { name: org.name } : null}
                    controls={{
                      scopeKind: "journey",
                      canMoveUp: idx > 0,
                      canMoveDown: idx < concluded.length - 1,
                      hiddenFromSidebar: j.show_in_sidebar === 0,
                    }}
                  />
                );
              })}
            </div>
          </section>
        )}

        {archivedCount > 0 && !showArchived && (
          <p class="scope-archive-toggle">
            <a href="/journeys?archived=1">
              {ts(archivedCount === 1 ? "journeys.showArchivedOne" : "journeys.showArchivedMany", { count: archivedCount })}
            </a>
          </p>
        )}

        {showArchived && archived.length > 0 && (
          <section class="scope-archived">
            <h2>{ts("scope.archived.heading")}</h2>
            <ul>
              {archived.map((j) => (
                <li>
                  <a href={`/journeys/${j.key}`}>{j.name}</a>
                  <span class="scope-archived-key">{j.key}</span>
                </li>
              ))}
            </ul>
            <p class="scope-archive-toggle">
              <a href="/journeys">{ts("scope.archived.hide")}</a>
            </p>
          </section>
        )}

        <section class="scope-create">
          <form method="POST" action="/journeys" class="scope-create-form">
            <h2>{ts("journeys.create.heading")}</h2>
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
            <label>
              <span class="scope-label">{ts("journeys.create.organizationLabel")}</span>
              <select name="organization_id">
                <option value="">{ts("journeys.create.organizationPersonal")}</option>
                {organizations.map((o) => (
                  <option value={o.id}>{o.name}</option>
                ))}
              </select>
              <span class="scope-hint">
                {ts("journeys.create.organizationHint")}
              </span>
            </label>
            <button type="submit" class="scope-create-submit">{ts("scope.create.submit")}</button>
          </form>
        </section>
      </div>
    </Layout>
  );
};

export const JourneyWorkshopPage: FC<{
  user: User;
  journey: Journey;
  organizations: Organization[];
  parentOrganization: Organization | null;
  sessions: ScopeSessionRow[];
  sessionsTotal: number;
  summaryStatus?: ScopeSummaryResult;
  sidebarScopes?: SidebarScopes;
}> = ({
  user,
  journey,
  organizations,
  parentOrganization,
  sessions,
  sessionsTotal,
  summaryStatus,
  sidebarScopes,
}) => {
  const isArchived = journey.status === "archived";
  const isConcluded = journey.status === "concluded";
  const isActive = journey.status === "active";

  return (
    <Layout title={`${journey.name} — ${ts("journeys.workshop.titleSuffix")}`} user={user} wide sidebarScopes={sidebarScopes}>
      <div class="scope-workshop">
        <nav class="workshop-breadcrumb">
          <a href="/journeys">{ts("journeys.breadcrumbBack")}</a>
          <span class="workshop-breadcrumb-sep">/</span>
          {parentOrganization && (
            <>
              <a
                href={`/organizations/${parentOrganization.key}`}
                class="workshop-breadcrumb-parent"
              >
                {parentOrganization.name}
              </a>
              <span class="workshop-breadcrumb-sep">/</span>
            </>
          )}
          <span>{journey.name}</span>
          <span class="workshop-breadcrumb-meta">· {journey.key}</span>
          {isArchived && <span class="scope-status-badge">{ts("scope.statusBadge.archived")}</span>}
          {isConcluded && (
            <span class="scope-status-badge scope-status-badge-concluded">
              {ts("scope.statusBadge.concluded")}
            </span>
          )}
        </nav>

        <header class="workshop-header">
          <h1>{journey.name}</h1>
          <p class="workshop-header-help">
            {ts("journeys.workshop.headerHelpPart1")}{" "}
            <strong>{ts("scope.workshop.briefingLabel")}</strong>{" "}
            {ts("journeys.workshop.headerHelpPart2")}{" "}
            <strong>{ts("scope.workshop.situationLabel")}</strong>{" "}
            {ts("journeys.workshop.headerHelpPart3")}
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
          {journey.summary ? (
            <p class="workshop-summary-body">{journey.summary}</p>
          ) : (
            <p class="workshop-summary-empty">
              {ts("scope.workshop.summaryEmpty")}
            </p>
          )}
          <form method="POST" action={`/journeys/${journey.key}/regenerate-summary`}>
            <button type="submit" class="workshop-summary-regenerate">
              {ts("scope.workshop.regenerateSummary")}
            </button>
          </form>
        </section>

        <ScopeSessionsList
          sessions={sessions}
          total={sessionsTotal}
          scopeKind="journey"
          scopeKey={journey.key}
        />

        <form method="POST" action={`/journeys/${journey.key}`} class="workshop-form">
          <label class="workshop-label" for="scope-name">{ts("scope.workshop.nameLabel")}</label>
          <input
            id="scope-name"
            type="text"
            name="name"
            value={journey.name}
            required
            class="scope-input"
          />

          <label class="workshop-label" for="scope-organization">{ts("journeys.workshop.organizationLabel")}</label>
          <span class="scope-field-hint">
            {ts("journeys.workshop.organizationHint")}
          </span>
          <select
            id="scope-organization"
            name="organization_id"
            class="scope-input"
          >
            <option value="" selected={journey.organization_id === null}>
              {ts("journeys.create.organizationPersonal")}
            </option>
            {organizations.map((o) => (
              <option value={o.id} selected={journey.organization_id === o.id}>
                {o.name}
              </option>
            ))}
          </select>

          <label class="workshop-label" for="scope-briefing">{ts("scope.workshop.briefingLabel")}</label>
          <span class="scope-field-hint">
            {ts("journeys.workshop.briefingHint")}
          </span>
          <textarea
            id="scope-briefing"
            name="briefing"
            class="workshop-textarea scope-textarea"
            spellcheck="false"
          >{journey.briefing}</textarea>

          <label class="workshop-label" for="scope-situation">{ts("scope.workshop.situationLabel")}</label>
          <span class="scope-field-hint">
            {ts("journeys.workshop.situationHint")}
          </span>
          <textarea
            id="scope-situation"
            name="situation"
            class="workshop-textarea scope-textarea"
            spellcheck="false"
          >{journey.situation}</textarea>

          <div class="workshop-actions">
            <button type="submit" class="workshop-save">{ts("common.save")}</button>
            <a href="/journeys" class="workshop-cancel">{ts("common.cancel")}</a>
          </div>
        </form>

        <section class="scope-lifecycle">
          <h2>{ts("scope.lifecycle.heading")}</h2>
          {isActive && (
            <>
              <form method="POST" action={`/journeys/${journey.key}/conclude`}>
                <button type="submit" class="scope-lifecycle-primary">
                  {ts("scope.lifecycle.markConcluded")}
                </button>
                <span class="scope-lifecycle-note">
                  {ts("journeys.lifecycle.markConcludedNote")}
                </span>
              </form>
              <form method="POST" action={`/journeys/${journey.key}/archive`}>
                <button type="submit" class="scope-lifecycle-primary">
                  {ts("scope.lifecycle.archive")}
                </button>
                <span class="scope-lifecycle-note">
                  {ts("journeys.lifecycle.archiveActiveNote")}
                </span>
              </form>
            </>
          )}
          {isConcluded && (
            <>
              <form method="POST" action={`/journeys/${journey.key}/reopen`}>
                <button type="submit" class="scope-lifecycle-primary">
                  {ts("scope.lifecycle.reopen")}
                </button>
                <span class="scope-lifecycle-note">
                  {ts("journeys.lifecycle.reopenNote")}
                </span>
              </form>
              <form method="POST" action={`/journeys/${journey.key}/archive`}>
                <button type="submit" class="scope-lifecycle-primary">
                  {ts("scope.lifecycle.archive")}
                </button>
                <span class="scope-lifecycle-note">
                  {ts("journeys.lifecycle.archiveConcludedNote")}
                </span>
              </form>
            </>
          )}
          {isArchived && (
            <form method="POST" action={`/journeys/${journey.key}/unarchive`}>
              <button type="submit" class="scope-lifecycle-primary">
                {ts("scope.lifecycle.unarchive")}
              </button>
              <span class="scope-lifecycle-note">
                {ts("journeys.lifecycle.unarchiveNote")}
              </span>
            </form>
          )}

          <form
            method="POST"
            action={`/journeys/${journey.key}/delete`}
            class="scope-lifecycle-destructive"
          >
            <button
              type="submit"
              class="scope-lifecycle-delete"
              onclick={`return confirm('${ts("journeys.lifecycle.deleteConfirm", { name: journey.name }).replace(/'/g, "\\'")}')`}
            >
              {ts("journeys.lifecycle.delete")}
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
