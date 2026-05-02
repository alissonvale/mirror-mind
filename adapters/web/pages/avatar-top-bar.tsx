import type { FC } from "hono/jsx";
import type { User } from "../../../server/db.js";
import { avatarInitials, avatarColor } from "./context-rail.js";
import { ts, currentLocale } from "../i18n.js";

/**
 * Shared chrome component for new surfaces (/inicio, /memoria, future
 * /mapa-cognitivo) during the strangler period (CV1.E11.S2). Logo on
 * the left, avatar button on the right, dropdown menu hidden by
 * default. No center navigation — design explicitly demoted the
 * sidebar's seven peer entries to this single avatar menu.
 */
export const AvatarTopBar: FC<{ user: User }> = ({ user }) => {
  const isAdmin = user.role === "admin";
  const initials = avatarInitials(user.name);
  const color = avatarColor(user.name);
  const userEmail = `${user.name.toLowerCase().replace(/\s+/g, ".")}`; // placeholder; we have no email column

  return (
    <header class="avatar-top-bar" data-avatar-top-bar>
      <a href="/inicio" class="avatar-top-bar-brand">
        <span aria-hidden="true" class="avatar-top-bar-brand-glyph">◆</span>{" "}
        Mirror Mind
      </a>
      <div class="avatar-top-bar-spacer"></div>
      <div class="avatar-top-bar-menu">
        <button
          type="button"
          class="avatar-top-bar-button"
          aria-haspopup="true"
          aria-expanded="false"
          data-avatar-toggle
          title={user.name}
        >
          <span
            class="avatar-top-bar-initials"
            style={`background-color: ${color}`}
            aria-hidden="true"
          >
            {initials}
          </span>
        </button>
        <div class="avatar-top-bar-dropdown" data-avatar-dropdown hidden>
          <a href="/me" class="avatar-top-bar-dropdown-header">
            <span class="avatar-top-bar-dropdown-name">{user.name}</span>
            <span class="avatar-top-bar-dropdown-email">{userEmail}</span>
          </a>
          <div class="avatar-top-bar-dropdown-sep" aria-hidden="true"></div>
          <a href="/map" class="avatar-top-bar-dropdown-item">
            {ts("topbar.menu.cognitive")}
          </a>
          <a href="/memoria" class="avatar-top-bar-dropdown-item">
            {ts("topbar.menu.memory")}
          </a>
          <span class="avatar-top-bar-dropdown-item avatar-top-bar-dropdown-item-disabled">
            {ts("topbar.menu.skills")}
            <span class="avatar-top-bar-badge">{ts("topbar.badge.soon")}</span>
          </span>
          {isAdmin && (
            <>
              <div class="avatar-top-bar-dropdown-sep" aria-hidden="true"></div>
              <a href="/admin" class="avatar-top-bar-dropdown-item">
                {ts("topbar.menu.admin")}
              </a>
              <a href="/docs" class="avatar-top-bar-dropdown-item">
                {ts("topbar.menu.docs")}
              </a>
            </>
          )}
          <div class="avatar-top-bar-dropdown-sep" aria-hidden="true"></div>
          <form
            method="POST"
            action="/logout"
            class="avatar-top-bar-dropdown-form"
          >
            <button
              type="submit"
              class="avatar-top-bar-dropdown-item avatar-top-bar-dropdown-logout"
            >
              {ts("topbar.menu.logout")}
            </button>
          </form>
        </div>
      </div>
    </header>
  );
};

/**
 * Page shell for new surfaces. Counterpart to `Layout` (sidebar
 * chrome) — same head/body scaffolding but with the avatar top bar
 * instead of the sidebar. Pages use this when they live in the
 * cena-first surface family.
 */
export const TopBarLayout: FC<{
  title: string;
  user: User;
  children: any;
}> = ({ title, user, children }) => {
  return (
    <html lang={currentLocale()}>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title} — Mirror Mind</title>
        <link rel="stylesheet" href="/public/style.css?v=brand-mirror-mind-1" />
        <style>{`
          /* Override the global body flex layout (style.css line 5)
             which assumes sidebar+content side-by-side. The new
             surface family stacks vertically: top bar + main. */
          body.topbar-layout {
            display: block;
            min-height: 100vh;
            background: #fafafa;
          }
          body.topbar-layout .topbar-main {
            display: block;
            width: 100%;
          }
          .avatar-top-bar {
            display: flex; align-items: center;
            padding: 0.6rem 1.2rem;
            border-bottom: 1px solid var(--border, #e0e0e0);
            background: var(--bg, #fff);
            position: sticky; top: 0; z-index: 100;
          }
          .avatar-top-bar-brand {
            font-weight: 600; text-decoration: none;
            color: var(--text, #2d3748);
            display: inline-flex; align-items: center; gap: 0.4rem;
          }
          .avatar-top-bar-brand-glyph {
            color: #2c5282;
            font-size: 1.05rem;
            line-height: 1;
          }
          .avatar-top-bar-spacer { flex: 1; }
          .avatar-top-bar-menu { position: relative; }
          .avatar-top-bar-button {
            background: transparent; border: 0; padding: 0;
            cursor: pointer;
          }
          .avatar-top-bar-initials {
            display: inline-flex; align-items: center; justify-content: center;
            width: 36px; height: 36px; border-radius: 50%;
            color: white; font-weight: 600; font-size: 0.85rem;
          }
          .avatar-top-bar-dropdown {
            position: absolute; top: calc(100% + 0.4rem); right: 0;
            min-width: 240px;
            background: var(--bg, #fff);
            border: 1px solid var(--border, #e0e0e0);
            border-radius: 6px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.12);
            padding: 0.4rem 0;
          }
          .avatar-top-bar-dropdown[hidden] { display: none; }
          .avatar-top-bar-dropdown-header {
            display: flex; flex-direction: column;
            padding: 0.6rem 1rem;
            text-decoration: none;
            color: var(--text, #2d3748);
          }
          .avatar-top-bar-dropdown-header:hover {
            background: var(--hover-bg, #f7f7f7);
          }
          .avatar-top-bar-dropdown-name { font-weight: 600; }
          .avatar-top-bar-dropdown-email {
            font-size: 0.8rem; color: var(--muted, #718096);
          }
          .avatar-top-bar-dropdown-sep {
            border-top: 1px solid var(--border, #e0e0e0);
            margin: 0.4rem 0;
          }
          .avatar-top-bar-dropdown-item {
            display: flex; align-items: center; justify-content: space-between;
            padding: 0.45rem 1rem;
            text-decoration: none;
            color: var(--text, #2d3748);
            background: transparent; border: 0;
            width: 100%; text-align: left;
            font-size: 0.9rem; cursor: pointer;
          }
          .avatar-top-bar-dropdown-item:hover {
            background: var(--hover-bg, #f7f7f7);
          }
          .avatar-top-bar-dropdown-item-disabled {
            color: var(--muted, #a0aec0); cursor: default;
          }
          .avatar-top-bar-dropdown-item-disabled:hover { background: transparent; }
          .avatar-top-bar-badge {
            font-size: 0.7rem;
            background: var(--muted-bg, #edf2f7);
            color: var(--muted, #718096);
            padding: 0.1rem 0.4rem; border-radius: 3px;
          }
          .avatar-top-bar-dropdown-form { margin: 0; }
          .avatar-top-bar-dropdown-logout { color: #c53030; }
        `}</style>
        <link rel="icon" href="data:," />
      </head>
      <body class="topbar-layout">
        <AvatarTopBar user={user} />
        <main class="topbar-main">{children}</main>
        <script src="/public/avatar-top-bar.js?v=avatar-top-bar-1"></script>
      </body>
    </html>
  );
};
