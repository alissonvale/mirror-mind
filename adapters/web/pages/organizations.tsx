import type { FC } from "hono/jsx";
import { Layout, type SidebarScopes } from "./layout.js";
import type { User, Organization } from "../../../server/db.js";
import type {
  LatestScopeSession,
  ScopeSessionRow,
} from "../../../server/scope-sessions.js";
import { formatRelativeTime } from "../../../server/formatters/relative-time.js";

/**
 * Pair-row used by both organization and journey list pages: the scope
 * card on the left, a "Last conversation" card on the right. Defined
 * once in organizations.tsx and re-imported from journeys.tsx to avoid
 * a third shared file for a single 40-line component.
 */
export const ScopeRow: FC<{
  href: string;
  name: string;
  scopeKey: string;
  body: string | null;
  lastSession: LatestScopeSession | null;
}> = ({ href, name, scopeKey, body, lastSession }) => (
  <div class="scope-row">
    <a href={href} class="scope-card">
      <div class="scope-card-name">{name}</div>
      <div class="scope-card-key">{scopeKey}</div>
      {body && <p class="scope-card-body">{body}</p>}
    </a>
    <div
      class={`scope-last ${lastSession ? "" : "scope-last--empty"}`}
      data-testid={`scope-last-${scopeKey}`}
    >
      <div class="scope-last-label">Last conversation</div>
      {lastSession ? (
        <>
          <div class="scope-last-title">
            {lastSession.title ?? "Untitled conversation"}
          </div>
          <div class="scope-last-when">
            {formatRelativeTime(lastSession.lastActivityAt) ?? "—"}
          </div>
        </>
      ) : (
        <div class="scope-last-empty">No conversations tagged yet</div>
      )}
    </div>
  </div>
);

/**
 * Sessions list rendered inside a scope's workshop page (CV1.E4.S5,
 * trimmed in the S5 follow-up). Shows a teaser of the most recent
 * sessions tagged to the scope (default 5 from the route); when more
 * exist, a "View all (N)" link goes to `/conversations` filtered by
 * the same scope key.
 *
 * Same shape on both `/organizations/<X>` and `/journeys/<X>` — defined
 * here, re-imported by journeys.tsx, same as `ScopeRow`.
 */
export const ScopeSessionsList: FC<{
  sessions: ScopeSessionRow[];
  total: number;
  scopeKind: "organization" | "journey";
  scopeKey: string;
}> = ({ sessions, total, scopeKind, scopeKey }) => {
  const scopeKindLabel = scopeKind === "organization" ? "organization" : "journey";
  const filterParam = scopeKind === "organization" ? "organization" : "journey";
  const viewAllHref = `/conversations?${filterParam}=${encodeURIComponent(scopeKey)}`;
  const hasMore = total > sessions.length;

  return (
    <section class="scope-sessions" data-testid="scope-sessions">
      <div class="scope-sessions-header">
        <h2 class="scope-sessions-title">Conversations</h2>
        <span class="scope-sessions-count">
          {total === 0
            ? ""
            : total === 1
              ? "1 conversation"
              : hasMore
                ? `${sessions.length} of ${total}`
                : `${total} conversations`}
        </span>
      </div>
      {total === 0 ? (
        <p class="scope-sessions-empty">
          This {scopeKindLabel} has no conversations tagged to it yet. Start a new
          one from the conversation page, or tag an existing session via the
          Context Rail.
        </p>
      ) : (
        <>
          <ul class="scope-sessions-list">
            {sessions.map((s) => (
              <li class="scope-sessions-row" data-testid={`scope-session-${s.sessionId}`}>
                <a class="scope-sessions-link" href={`/conversation/${s.sessionId}`}>
                  <div class="scope-sessions-row-head">
                    <span class="scope-sessions-row-title">
                      {s.title ?? "Untitled conversation"}
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
              <a href={viewAllHref}>View all {total} conversations →</a>
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
  const archived = organizations.filter((o) => o.status === "archived");

  return (
    <Layout title="Organizations" user={user} sidebarScopes={sidebarScopes}>
      <div class="scope-list">
        <header class="scope-list-header">
          <h1>Organizations</h1>
          <p class="scope-list-intro">
            Broader situational scopes you're in — a venture, a community, a
            role. Each organization can contain journeys. When reception
            detects one, its briefing and current situation join the composed
            prompt.
          </p>
        </header>

        {active.length > 0 && (
          <section class="scope-rows">
            {active.map((org) => (
              <ScopeRow
                href={`/organizations/${org.key}`}
                name={org.name}
                scopeKey={org.key}
                body={org.summary || (org.briefing ? firstLine(org.briefing) : null)}
                lastSession={latestSessions.get(org.key) ?? null}
              />
            ))}
          </section>
        )}

        {archivedCount > 0 && !showArchived && (
          <p class="scope-archive-toggle">
            <a href="/organizations?archived=1">
              Show {archivedCount} archived organization{archivedCount === 1 ? "" : "s"} →
            </a>
          </p>
        )}

        {showArchived && archived.length > 0 && (
          <section class="scope-archived">
            <h2>Archived</h2>
            <ul>
              {archived.map((org) => (
                <li>
                  <a href={`/organizations/${org.key}`}>{org.name}</a>
                  <span class="scope-archived-key">{org.key}</span>
                </li>
              ))}
            </ul>
            <p class="scope-archive-toggle">
              <a href="/organizations">← Hide archived</a>
            </p>
          </section>
        )}

        <section class="scope-create">
          <form method="POST" action="/organizations" class="scope-create-form">
            <h2>New organization</h2>
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
            <button type="submit" class="scope-create-submit">Create</button>
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
  sidebarScopes?: SidebarScopes;
}> = ({ user, organization: org, sessions, sessionsTotal, sidebarScopes }) => {
  const isArchived = org.status === "archived";

  return (
    <Layout title={`${org.name} — Organization`} user={user} wide sidebarScopes={sidebarScopes}>
      <div class="scope-workshop">
        <nav class="workshop-breadcrumb">
          <a href="/organizations">← Organizations</a>
          <span class="workshop-breadcrumb-sep">/</span>
          <span>{org.name}</span>
          <span class="workshop-breadcrumb-meta">· {org.key}</span>
          {isArchived && <span class="scope-status-badge">archived</span>}
        </nav>

        <header class="workshop-header">
          <h1>{org.name}</h1>
          <p class="workshop-header-help">
            Broader scope. <strong>Briefing</strong> is who this organization
            is — stable. <strong>Situation</strong> is where it stands right
            now — evolves over weeks and months. Both enter the composed
            prompt when reception detects this organization.
          </p>
        </header>

        <section class="workshop-summary">
          <div class="workshop-summary-header">
            <span class="workshop-summary-label">Summary</span>
            <span class="workshop-summary-sub">
              used by reception routing and by the scope card · regenerated automatically on Save
            </span>
          </div>
          {org.summary ? (
            <p class="workshop-summary-body">{org.summary}</p>
          ) : (
            <p class="workshop-summary-empty">
              No summary yet. It will be generated on the next Save, or you can regenerate manually below.
            </p>
          )}
          <form method="POST" action={`/organizations/${org.key}/regenerate-summary`}>
            <button type="submit" class="workshop-summary-regenerate">
              Regenerate summary
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
          <label class="workshop-label" for="scope-name">Name</label>
          <input
            id="scope-name"
            type="text"
            name="name"
            value={org.name}
            required
            class="scope-input"
          />

          <label class="workshop-label" for="scope-briefing">Briefing</label>
          <span class="scope-field-hint">
            Who this organization is. Purpose, mission, posture, values. Stable — edited rarely.
          </span>
          <textarea
            id="scope-briefing"
            name="briefing"
            class="workshop-textarea scope-textarea"
            spellcheck="false"
          >{org.briefing}</textarea>

          <label class="workshop-label" for="scope-situation">Situation</label>
          <span class="scope-field-hint">
            Where this organization stands right now. Current phase, active initiatives, what's in play. Evolving — edited as state changes.
          </span>
          <textarea
            id="scope-situation"
            name="situation"
            class="workshop-textarea scope-textarea"
            spellcheck="false"
          >{org.situation}</textarea>

          <div class="workshop-actions">
            <button type="submit" class="workshop-save">Save</button>
            <a href="/organizations" class="workshop-cancel">Cancel</a>
          </div>
        </form>

        <section class="scope-lifecycle">
          <h2>Lifecycle</h2>
          {isArchived ? (
            <form method="POST" action={`/organizations/${org.key}/unarchive`}>
              <button type="submit" class="scope-lifecycle-primary">
                Unarchive
              </button>
              <span class="scope-lifecycle-note">
                Restore to active. The organization becomes eligible for routing again.
              </span>
            </form>
          ) : (
            <form method="POST" action={`/organizations/${org.key}/archive`}>
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
            action={`/organizations/${org.key}/delete`}
            class="scope-lifecycle-destructive"
          >
            <button
              type="submit"
              class="scope-lifecycle-delete"
              onclick={`return confirm('Delete organization "${org.name}"? Journeys linked to it become personal (organization unlinks, journeys survive). This cannot be undone.')`}
            >
              Delete this organization
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
