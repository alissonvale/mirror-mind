import type { FC } from "hono/jsx";
import { Layout, type SidebarScopes } from "./layout.js";
import type { User } from "../../../server/db.js";
import type { MeStats } from "../../../server/me-stats.js";
import { formatRelativeTime } from "../../../server/formatters/relative-time.js";
import { avatarInitials, avatarColor } from "./context-rail.js";

export interface MeProps {
  currentUser: User;
  stats: MeStats;
  editingName?: boolean;
  nameError?: string;
  saved?: string;
  sidebarScopes?: SidebarScopes;
}

function formatMemberSince(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export const MePage: FC<MeProps> = ({
  currentUser,
  stats,
  editingName = false,
  nameError,
  saved,
  sidebarScopes,
}) => {
  const isAdmin = currentUser.role === "admin";
  const initials = avatarInitials(currentUser.name);
  const color = avatarColor(currentUser.name);
  // show_brl_conversion = 1 → user prefers BRL; 0 → prefers USD.
  // Legacy column name (CV0.E3.S6); semantic shifted in CV0.E4.S6.
  const preferBrl = currentUser.show_brl_conversion === 1;

  return (
    <Layout title="About You" user={currentUser} sidebarScopes={sidebarScopes}>
      <div class="me">
        {saved && <div class="me-flash">{saved}</div>}

        {/* HEADER */}
        <section class="me-band me-header">
          <span
            class="me-avatar"
            style={`background-color: ${color}`}
            aria-hidden="true"
          >
            {initials}
          </span>
          <div class="me-header-body">
            {editingName ? (
              <form method="POST" action="/me/name" class="me-name-form">
                <input
                  type="text"
                  name="name"
                  class="me-name-input"
                  value={currentUser.name}
                  required
                  maxlength={40}
                  autofocus
                  autocomplete="off"
                  spellcheck="false"
                />
                <button type="submit" class="me-name-save">Save</button>
                <a href="/me" class="me-name-cancel">Cancel</a>
                {nameError && <p class="me-name-error">{nameError}</p>}
              </form>
            ) : (
              <h1 class="me-name">
                {currentUser.name}
                <a href="/me?editName=1" class="me-name-edit">edit</a>
              </h1>
            )}
            <p class="me-meta">
              Member since {formatMemberSince(stats.memberSince)}
              {isAdmin && <span class="me-role-badge">admin</span>}
            </p>
          </div>
        </section>

        {/* PREFERENCES */}
        <section class="me-band">
          <header class="me-band-header">
            <h2>Preferences</h2>
          </header>
          {isAdmin ? (
            <form method="POST" action="/me/show-brl" class="me-pref-row">
              <p class="me-pref-title">Preferred currency for cost display</p>
              <label class="me-pref-radio">
                <input
                  type="radio"
                  name="show_brl"
                  value="0"
                  checked={!preferBrl}
                  onchange="this.form.submit()"
                />
                <span>USD — $</span>
              </label>
              <label class="me-pref-radio">
                <input
                  type="radio"
                  name="show_brl"
                  value="1"
                  checked={preferBrl}
                  onchange="this.form.submit()"
                />
                <span>BRL — R$</span>
              </label>
              <p class="me-pref-note">
                Applies to the Context Rail and the budget dashboard.
              </p>
            </form>
          ) : (
            <p class="me-pref-empty">
              No preferences to set yet. More settings arrive with future
              stories — language, timezone, theme.
            </p>
          )}
        </section>

        {/* HOW THE MIRROR SEES YOU */}
        <section class="me-band">
          <header class="me-band-header">
            <h2>How the mirror sees you</h2>
          </header>
          <dl class="me-stats">
            <div class="me-stat">
              <dt>Conversations</dt>
              <dd>{stats.sessionsTotal}</dd>
            </div>
            <div class="me-stat">
              <dt>Messages</dt>
              <dd>{stats.messagesTotal}</dd>
            </div>
            <div class="me-stat">
              <dt>Most active persona</dt>
              <dd>{stats.favoritePersona ?? "—"}</dd>
            </div>
            <div class="me-stat">
              <dt>Last activity</dt>
              <dd>
                {stats.lastActivityAt
                  ? formatRelativeTime(stats.lastActivityAt) ?? "—"
                  : "—"}
              </dd>
            </div>
          </dl>
        </section>

        {/* DATA */}
        <section class="me-band">
          <header class="me-band-header">
            <h2>Data</h2>
          </header>
          <ul class="me-data-list">
            <li>
              <span class="me-data-label">Export my data</span>
              <span class="me-data-note">
                coming with the Memory Map (CV1.E6.S6)
              </span>
            </li>
          </ul>
        </section>
      </div>
    </Layout>
  );
};
