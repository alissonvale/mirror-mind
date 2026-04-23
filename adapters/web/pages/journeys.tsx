import type { FC } from "hono/jsx";
import { Layout, type SidebarScopes } from "./layout.js";
import type { User, Organization, Journey } from "../../../server/db.js";
import type {
  LatestScopeSession,
  ScopeSessionRow,
} from "../../../server/scope-sessions.js";
import { ScopeRow, ScopeSessionsList } from "./organizations.js";

interface JourneyGroup {
  organization: Organization | null;
  journeys: Journey[];
}

export const JourneysListPage: FC<{
  user: User;
  groups: JourneyGroup[];
  organizations: Organization[];
  archivedCount: number;
  showArchived: boolean;
  latestSessions: Map<string, LatestScopeSession>;
  sidebarScopes?: SidebarScopes;
}> = ({
  user,
  groups,
  organizations,
  archivedCount,
  showArchived,
  latestSessions,
  sidebarScopes,
}) => {
  const archived = groups.flatMap((g) => g.journeys.filter((j) => j.status === "archived"));

  return (
    <Layout title="Journeys" user={user} sidebarScopes={sidebarScopes}>
      <div class="scope-list">
        <header class="scope-list-header">
          <h1>Journeys</h1>
          <p class="scope-list-intro">
            Narrower situational scopes — a pursuit, a period, a crossing
            you're going through. A journey may belong to an organization or
            stand alone as personal. When reception detects one, its briefing
            and current situation join the composed prompt.
          </p>
        </header>

        {groups.map((group) => {
          const activeJourneys = group.journeys.filter((j) => j.status === "active");
          if (activeJourneys.length === 0) return null;
          return (
            <section class="journey-group">
              <header class="journey-group-header">
                {group.organization ? (
                  <a
                    href={`/organizations/${group.organization.key}`}
                    class="journey-group-org"
                  >
                    {group.organization.name}
                    <span class="journey-group-arrow">→</span>
                  </a>
                ) : (
                  <span class="journey-group-personal">Personal journeys</span>
                )}
              </header>
              <div class="scope-rows">
                {activeJourneys.map((j) => (
                  <ScopeRow
                    href={`/journeys/${j.key}`}
                    name={j.name}
                    scopeKey={j.key}
                    body={j.summary || (j.briefing ? firstLine(j.briefing) : null)}
                    lastSession={latestSessions.get(j.key) ?? null}
                  />
                ))}
              </div>
            </section>
          );
        })}

        {archivedCount > 0 && !showArchived && (
          <p class="scope-archive-toggle">
            <a href="/journeys?archived=1">
              Show {archivedCount} archived journey{archivedCount === 1 ? "" : "s"} →
            </a>
          </p>
        )}

        {showArchived && archived.length > 0 && (
          <section class="scope-archived">
            <h2>Archived</h2>
            <ul>
              {archived.map((j) => (
                <li>
                  <a href={`/journeys/${j.key}`}>{j.name}</a>
                  <span class="scope-archived-key">{j.key}</span>
                </li>
              ))}
            </ul>
            <p class="scope-archive-toggle">
              <a href="/journeys">← Hide archived</a>
            </p>
          </section>
        )}

        <section class="scope-create">
          <form method="POST" action="/journeys" class="scope-create-form">
            <h2>New journey</h2>
            <label>
              <span class="scope-label">Name</span>
              <input type="text" name="name" required placeholder="display name" />
            </label>
            <label>
              <span class="scope-label">Key</span>
              <input
                type="text"
                name="key"
                required
                placeholder="slug-like-this"
                pattern="[a-z0-9-]+"
                title="lowercase letters, numbers, and hyphens only"
              />
              <span class="scope-hint">
                stable identifier — letters, numbers, hyphens; set once
              </span>
            </label>
            <label>
              <span class="scope-label">Organization (optional)</span>
              <select name="organization_id">
                <option value="">(personal journey)</option>
                {organizations.map((o) => (
                  <option value={o.id}>{o.name}</option>
                ))}
              </select>
              <span class="scope-hint">
                leave blank for a personal journey; pick an organization to group it
              </span>
            </label>
            <button type="submit" class="scope-create-submit">Create</button>
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
  sidebarScopes?: SidebarScopes;
}> = ({
  user,
  journey,
  organizations,
  parentOrganization,
  sessions,
  sessionsTotal,
  sidebarScopes,
}) => {
  const isArchived = journey.status === "archived";

  return (
    <Layout title={`${journey.name} — Journey`} user={user} wide sidebarScopes={sidebarScopes}>
      <div class="scope-workshop">
        <nav class="workshop-breadcrumb">
          <a href="/journeys">← Journeys</a>
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
          {isArchived && <span class="scope-status-badge">archived</span>}
        </nav>

        <header class="workshop-header">
          <h1>{journey.name}</h1>
          <p class="workshop-header-help">
            Narrower scope. <strong>Briefing</strong> is what this journey is
            — what you're pursuing or crossing. Stable.{" "}
            <strong>Situation</strong> is where it stands right now — the
            active phase or focus. Evolves. Both enter the composed prompt
            when reception detects this journey.
          </p>
        </header>

        <section class="workshop-summary">
          <div class="workshop-summary-header">
            <span class="workshop-summary-label">Summary</span>
            <span class="workshop-summary-sub">
              used by reception routing and by the scope card · regenerated automatically on Save
            </span>
          </div>
          {journey.summary ? (
            <p class="workshop-summary-body">{journey.summary}</p>
          ) : (
            <p class="workshop-summary-empty">
              No summary yet. It will be generated on the next Save, or you can regenerate manually below.
            </p>
          )}
          <form method="POST" action={`/journeys/${journey.key}/regenerate-summary`}>
            <button type="submit" class="workshop-summary-regenerate">
              Regenerate summary
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
          <label class="workshop-label" for="scope-name">Name</label>
          <input
            id="scope-name"
            type="text"
            name="name"
            value={journey.name}
            required
            class="scope-input"
          />

          <label class="workshop-label" for="scope-organization">Organization</label>
          <span class="scope-field-hint">
            Leave blank for a personal journey; pick an organization to group it there.
          </span>
          <select
            id="scope-organization"
            name="organization_id"
            class="scope-input"
          >
            <option value="" selected={journey.organization_id === null}>
              (personal journey)
            </option>
            {organizations.map((o) => (
              <option value={o.id} selected={journey.organization_id === o.id}>
                {o.name}
              </option>
            ))}
          </select>

          <label class="workshop-label" for="scope-briefing">Briefing</label>
          <span class="scope-field-hint">
            What this journey is. Purpose, what you're pursuing, what makes it a crossing. Stable — edited rarely.
          </span>
          <textarea
            id="scope-briefing"
            name="briefing"
            class="workshop-textarea scope-textarea"
            spellcheck="false"
          >{journey.briefing}</textarea>

          <label class="workshop-label" for="scope-situation">Situation</label>
          <span class="scope-field-hint">
            Where this journey stands right now. Active phase, focus, progress. Evolving — edited as state changes.
          </span>
          <textarea
            id="scope-situation"
            name="situation"
            class="workshop-textarea scope-textarea"
            spellcheck="false"
          >{journey.situation}</textarea>

          <div class="workshop-actions">
            <button type="submit" class="workshop-save">Save</button>
            <a href="/journeys" class="workshop-cancel">Cancel</a>
          </div>
        </form>

        <section class="scope-lifecycle">
          <h2>Lifecycle</h2>
          {isArchived ? (
            <form method="POST" action={`/journeys/${journey.key}/unarchive`}>
              <button type="submit" class="scope-lifecycle-primary">
                Unarchive
              </button>
              <span class="scope-lifecycle-note">
                Restore to active. The journey becomes eligible for routing again.
              </span>
            </form>
          ) : (
            <form method="POST" action={`/journeys/${journey.key}/archive`}>
              <button type="submit" class="scope-lifecycle-primary">
                Archive
              </button>
              <span class="scope-lifecycle-note">
                Hidden from routing and the default list. Readable via direct URL.
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
              onclick={`return confirm('Delete journey "${journey.name}"? This cannot be undone.')`}
            >
              Delete this journey
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
