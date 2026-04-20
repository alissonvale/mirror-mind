import type { FC } from "hono/jsx";
import { Layout } from "./layout.js";
import type { User, Organization } from "../../../server/db.js";

export const OrganizationsListPage: FC<{
  user: User;
  organizations: Organization[];
  archivedCount: number;
  showArchived: boolean;
}> = ({ user, organizations, archivedCount, showArchived }) => {
  const active = organizations.filter((o) => o.status === "active");
  const archived = organizations.filter((o) => o.status === "archived");

  return (
    <Layout title="Organizations" user={user}>
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

        <section class="scope-create">
          <form method="POST" action="/organizations" class="scope-create-form">
            <h2>New organization</h2>
            <label>
              <span class="scope-label">Name</span>
              <input type="text" name="name" required placeholder="Software Zen" />
            </label>
            <label>
              <span class="scope-label">Key</span>
              <input
                type="text"
                name="key"
                required
                placeholder="software-zen"
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

        {active.length === 0 && archived.length === 0 ? (
          <section class="scope-empty">
            <p>
              You have no organizations yet. Create one above to give broader
              situational context to the conversations that happen inside it.
              Personal journeys can stand alone — organizations are optional.
            </p>
          </section>
        ) : null}

        {active.length > 0 && (
          <section class="scope-grid">
            {active.map((org) => (
              <a href={`/organizations/${org.key}`} class="scope-card">
                <div class="scope-card-name">{org.name}</div>
                <div class="scope-card-key">{org.key}</div>
                {(org.summary || org.briefing) && (
                  <p class="scope-card-body">
                    {org.summary || firstLine(org.briefing)}
                  </p>
                )}
              </a>
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
      </div>
    </Layout>
  );
};

export const OrganizationWorkshopPage: FC<{
  user: User;
  organization: Organization;
}> = ({ user, organization: org }) => {
  const isArchived = org.status === "archived";

  return (
    <Layout title={`${org.name} — Organization`} user={user} wide>
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
