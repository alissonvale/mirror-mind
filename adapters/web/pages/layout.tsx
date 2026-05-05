import type { FC } from "hono/jsx";
import { raw } from "hono/html";
import type { User } from "../../../server/db.js";
import { AvatarTopBar, AVATAR_TOP_BAR_STYLES } from "./avatar-top-bar.js";
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
        <link rel="stylesheet" href="/public/style.css?v=session-model-row-1" />
        <style>{raw(AVATAR_TOP_BAR_STYLES)}</style>
        <style>{raw(`
          /* Layout-specific extras the shared chrome doesn't carry:
             wide-mode flag for legacy workshops + the inner-content
             centering that the sidebar era used to provide. */
          body.topbar-layout .topbar-main {
            max-width: 100%;
          }
          body.topbar-layout .topbar-main-wide {
            padding: 0;
          }
          .topbar-main { padding: 0; }
          .topbar-main > .content,
          .topbar-main > .scope-workshop,
          .topbar-main > .workshop {
            max-width: 980px; margin: 1.5rem auto; padding: 0 1.5rem;
          }
        `)}</style>
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
