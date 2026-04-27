import type { FC } from "hono/jsx";
import { Layout, type SidebarScopes } from "./layout.js";
import type { User } from "../../../server/db.js";
import type { MeStats } from "../../../server/me-stats.js";
import { formatRelativeTime } from "../../../server/formatters/relative-time.js";
import { avatarInitials, avatarColor } from "./context-rail.js";
import { ts, currentLocale } from "../i18n.js";

export interface MeProps {
  currentUser: User;
  stats: MeStats;
  editingName?: boolean;
  nameError?: string;
  saved?: string;
  sidebarScopes?: SidebarScopes;
}

function formatMemberSince(ts: number, locale: string): string {
  const tag = locale === "pt-BR" ? "pt-BR" : "en-US";
  return new Date(ts).toLocaleDateString(tag, {
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
  const locale = currentLocale();

  return (
    <Layout title={ts("me.htmlTitle")} user={currentUser} sidebarScopes={sidebarScopes}>
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
                <button type="submit" class="me-name-save">{ts("common.save")}</button>
                <a href="/me" class="me-name-cancel">{ts("common.cancel")}</a>
                {nameError && <p class="me-name-error">{nameError}</p>}
              </form>
            ) : (
              <h1 class="me-name">
                {currentUser.name}
                <a href="/me?editName=1" class="me-name-edit">{ts("me.editName")}</a>
              </h1>
            )}
            <p class="me-meta">
              {ts("me.memberSince", { date: formatMemberSince(stats.memberSince, locale) })}
              {isAdmin && <span class="me-role-badge">{ts("me.adminBadge")}</span>}
            </p>
          </div>
        </section>

        {/* PREFERENCES */}
        <section class="me-band">
          <header class="me-band-header">
            <h2>{ts("me.preferences.title")}</h2>
          </header>

          {/* Language — available to every user (CV2.E1.S3). */}
          <form method="POST" action="/me/locale" class="me-pref-row">
            <p class="me-pref-title">{ts("me.preferences.language")}</p>
            <label class="me-pref-select-wrap">
              <select
                name="locale"
                class="me-pref-select"
                onchange="this.form.submit()"
              >
                <option value="en" selected={currentUser.locale === "en"}>
                  {ts("me.preferences.languageEn")}
                </option>
                <option value="pt-BR" selected={currentUser.locale === "pt-BR"}>
                  {ts("me.preferences.languagePtBr")}
                </option>
              </select>
            </label>
            <p class="me-pref-note">{ts("me.preferences.languageNote")}</p>
          </form>

          {/* Currency — admin-only (CV0.E4.S6 / CV0.E3.S6 lineage). */}
          {isAdmin && (
            <form method="POST" action="/me/show-brl" class="me-pref-row">
              <p class="me-pref-title">{ts("me.preferences.currencyTitle")}</p>
              <label class="me-pref-radio">
                <input
                  type="radio"
                  name="show_brl"
                  value="0"
                  checked={!preferBrl}
                  onchange="this.form.submit()"
                />
                <span>{ts("me.preferences.currencyUsd")}</span>
              </label>
              <label class="me-pref-radio">
                <input
                  type="radio"
                  name="show_brl"
                  value="1"
                  checked={preferBrl}
                  onchange="this.form.submit()"
                />
                <span>{ts("me.preferences.currencyBrl")}</span>
              </label>
              <p class="me-pref-note">
                {ts("me.preferences.currencyNote")}
              </p>
            </form>
          )}
        </section>

        {/* HOW THE MIRROR SEES YOU */}
        <section class="me-band">
          <header class="me-band-header">
            <h2>{ts("me.stats.title")}</h2>
          </header>
          <dl class="me-stats">
            <div class="me-stat">
              <dt>{ts("me.stats.conversations")}</dt>
              <dd>{stats.sessionsTotal}</dd>
            </div>
            <div class="me-stat">
              <dt>{ts("me.stats.messages")}</dt>
              <dd>{stats.messagesTotal}</dd>
            </div>
            <div class="me-stat">
              <dt>{ts("me.stats.favoritePersona")}</dt>
              <dd>{stats.favoritePersona ?? ts("common.dash")}</dd>
            </div>
            <div class="me-stat">
              <dt>{ts("me.stats.lastActivity")}</dt>
              <dd>
                {stats.lastActivityAt
                  ? formatRelativeTime(stats.lastActivityAt) ?? ts("common.dash")
                  : ts("common.dash")}
              </dd>
            </div>
          </dl>
        </section>

        {/* DATA */}
        <section class="me-band">
          <header class="me-band-header">
            <h2>{ts("me.data.title")}</h2>
          </header>
          <ul class="me-data-list">
            <li>
              <span class="me-data-label">{ts("me.data.exportLabel")}</span>
              <span class="me-data-note">
                {ts("me.data.exportNote")}
                {" ("}
                {isAdmin ? (
                  <a href="/docs/project/roadmap/cv1-depth/cv1-e6-memory-map/">
                    CV1.E6.S6
                  </a>
                ) : (
                  "CV1.E6.S6"
                )}
                {")"}
              </span>
            </li>
          </ul>
        </section>
      </div>
    </Layout>
  );
};
