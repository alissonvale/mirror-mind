import type { FC } from "hono/jsx";
import { raw } from "hono/html";
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
      <a href="/" class="avatar-top-bar-brand">
        <span aria-hidden="true" class="avatar-top-bar-brand-glyph">◆</span>{" "}
        Mirror Mind
      </a>
      <a href="/inicio" class="avatar-top-bar-start">
        <span aria-hidden="true" class="avatar-top-bar-start-glyph">▶</span>{" "}
        {ts("topbar.start")}
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
          {/* Operational + contemplative entry points. */}
          <a href="/inicio" class="avatar-top-bar-dropdown-item">
            {ts("topbar.menu.start")}
          </a>
          <a href="/espelho" class="avatar-top-bar-dropdown-item">
            {ts("topbar.menu.espelho")}
          </a>
          <div class="avatar-top-bar-dropdown-sep" aria-hidden="true"></div>
          {/* Browse surfaces — territory of the user's accumulated state. */}
          <a href="/memorias" class="avatar-top-bar-dropdown-item">
            {ts("topbar.menu.memory")}
          </a>
          <a href="/territorio" class="avatar-top-bar-dropdown-item">
            {ts("topbar.menu.territory")}
          </a>
          <span class="avatar-top-bar-dropdown-item avatar-top-bar-dropdown-item-disabled">
            {ts("topbar.menu.skills")}
            <span class="avatar-top-bar-badge">{ts("topbar.badge.soon")}</span>
          </span>
          <a href="/identidade" class="avatar-top-bar-dropdown-item">
            {ts("topbar.menu.cognitive")}
          </a>
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
        <link rel="stylesheet" href="/public/style.css?v=chrome-mirror-flip-1" />
        {/* EB Garamond — used by the Sou pane's soul prose on /espelho.
            Loaded globally in chrome so the font is cached once and any
            future surface that wants the literary italic gets it free. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;1,400;1,500&display=swap"
        />
        <style>{raw(AVATAR_TOP_BAR_STYLES)}</style>
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

/**
 * Shared CSS for the avatar top bar chrome. Exported so both
 * `TopBarLayout` (above) and the legacy `Layout` (`./layout.tsx`)
 * include the SAME rules — preventing the drift that bit us when
 * the new Iniciar pill (CV1.E12.S1) was added to one inline copy
 * but not the other, and rendered unstyled on /me, /map, and
 * other legacy surfaces.
 *
 * Single source of truth lives here. New chrome rules belong in
 * this constant so every page picks them up.
 */
export const AVATAR_TOP_BAR_STYLES = `
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
  .avatar-top-bar-start {
    display: inline-flex; align-items: center; gap: 0.3rem;
    margin-left: 1rem;
    padding: 0.3rem 0.7rem;
    border-radius: 999px;
    background: #f0f4f8;
    color: #2c5282;
    font-size: 0.85rem;
    font-weight: 500;
    text-decoration: none;
    transition: background 0.12s;
  }
  .avatar-top-bar-start:hover { background: #dde6f0; }
  .avatar-top-bar-start-glyph {
    font-size: 0.7rem;
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
`;
