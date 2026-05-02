import type { FC } from "hono/jsx";
import type { User } from "../../../server/db.js";
import { AvatarTopBar } from "./avatar-top-bar.js";
import { currentLocale } from "../i18n.js";

/**
 * @deprecated The cutover (CV1.E11.S5, 2026-05-02) removed the
 * sidebar; this interface stays as a no-op type so the dozens of
 * page components that still import it compile. Pages may keep
 * declaring `sidebarScopes?: SidebarScopes` in props — the value is
 * never read. Future sweep can grep-and-delete.
 */
export interface SidebarScopes {
  journeys: never[];
  organizations: never[];
}

/**
 * Page shell — was sidebar+content; now top bar+content (avatar
 * chrome). Renamed only conceptually: every legacy callsite that
 * imported `Layout` keeps working without changes. The `sidebarScopes`
 * prop is silently ignored (kept for back-compat with the dozens of
 * existing call sites that still pass it). Equivalent to
 * `TopBarLayout` from `avatar-top-bar.tsx`; the two will collapse to
 * one in a future cleanup sweep.
 */
export const Layout: FC<{
  title: string;
  user: User;
  children: any;
  wide?: boolean;
  sidebarScopes?: SidebarScopes;
}> = ({ title, user, children, wide }) => {
  const isAdmin = user.role === "admin";

  return (
    <html lang={currentLocale()}>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title} — Mirror Mind</title>
        <link rel="stylesheet" href="/public/style.css?v=persona-glyph-cluster-1" />
        <style>{`
          /* Same body override as TopBarLayout — global body { display: flex }
             from style.css line 5 was designed for sidebar+content; the
             avatar chrome stacks vertically. */
          body.topbar-layout {
            display: block;
            min-height: 100vh;
            background: #fafafa;
          }
          body.topbar-layout .topbar-main {
            display: block;
            width: 100%;
            max-width: 100%;
          }
          body.topbar-layout .topbar-main-wide {
            padding: 0;
          }
          .avatar-top-bar {
            display: flex; align-items: center;
            padding: 0.6rem 1.2rem;
            border-bottom: 1px solid #e0e0e0;
            background: #fff;
            position: sticky; top: 0; z-index: 100;
          }
          .avatar-top-bar-brand {
            font-weight: 600; text-decoration: none;
            color: #2d3748;
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
            background: #fff;
            border: 1px solid #e0e0e0;
            border-radius: 6px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.12);
            padding: 0.4rem 0;
          }
          .avatar-top-bar-dropdown[hidden] { display: none; }
          .avatar-top-bar-dropdown-header {
            display: flex; flex-direction: column;
            padding: 0.6rem 1rem;
            text-decoration: none;
            color: #2d3748;
          }
          .avatar-top-bar-dropdown-header:hover { background: #f7f7f7; }
          .avatar-top-bar-dropdown-name { font-weight: 600; }
          .avatar-top-bar-dropdown-email {
            font-size: 0.8rem; color: #718096;
          }
          .avatar-top-bar-dropdown-sep {
            border-top: 1px solid #e0e0e0;
            margin: 0.4rem 0;
          }
          .avatar-top-bar-dropdown-item {
            display: flex; align-items: center; justify-content: space-between;
            padding: 0.45rem 1rem;
            text-decoration: none;
            color: #2d3748;
            background: transparent; border: 0;
            width: 100%; text-align: left;
            font-size: 0.9rem; cursor: pointer;
          }
          .avatar-top-bar-dropdown-item:hover { background: #f7f7f7; }
          .avatar-top-bar-dropdown-item-disabled {
            color: #a0aec0; cursor: default;
          }
          .avatar-top-bar-dropdown-item-disabled:hover { background: transparent; }
          .avatar-top-bar-badge {
            font-size: 0.7rem;
            background: #edf2f7;
            color: #718096;
            padding: 0.1rem 0.4rem; border-radius: 3px;
          }
          .avatar-top-bar-dropdown-form { margin: 0; }
          .avatar-top-bar-dropdown-logout { color: #c53030; }
          .topbar-main { padding: 0; }
          .topbar-main > .content,
          .topbar-main > .scope-workshop,
          .topbar-main > .workshop {
            max-width: 980px; margin: 1.5rem auto; padding: 0 1.5rem;
          }
        `}</style>
        <link rel="icon" href="data:," />
      </head>
      <body class="topbar-layout">
        {isAdmin && <div id="budget-alert-banner" class="budget-alert-banner"></div>}
        <AvatarTopBar user={user} />
        <main class={wide ? "topbar-main topbar-main-wide" : "topbar-main"}>
          {children}
        </main>
        <script src="/public/avatar-top-bar.js?v=avatar-top-bar-1"></script>
        {/* layout.js carries budget-alert polling + map-card-preview
            truncation + composed-drawer interaction. Sidebar
            toggle/collapse helpers inside it are now dead no-ops
            (their target elements don't exist post-cutover) but the
            rest is still load-bearing. Cleanup pass can split the
            file into smaller modules later. */}
        <script src="/public/layout.js?v=sidebar-default-collapsed-1"></script>
      </body>
    </html>
  );
};
