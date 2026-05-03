import type { FC } from "hono/jsx";
import type { RecentSessionWithScene } from "./home-inicio.js";
import { ts } from "../i18n.js";
import { formatRelativeTime } from "../../../server/formatters/relative-time.js";

/**
 * Shared list row for recent sessions. Renders inside any
 * `<ul class="conversations-rows">` and inherits all the visual
 * styling from style.css's `.conversations-row*` rules. Used by
 * the Recentes block on `/` (home) and the Histórico block on
 * `/memorias`.
 *
 * `returnTo` determines where the user lands after deleting a row
 * — defaults to /conversations (the inventory). Caller passes the
 * surface they want the user back on (`/`, `/memorias`).
 */
export const RecentRow: FC<{
  row: RecentSessionWithScene;
  returnTo?: string;
}> = ({ row, returnTo = "/conversations" }) => {
  return (
    <li class="conversations-row">
      <a class="conversations-row-link" href={`/conversation/${row.id}`}>
        <div class="conversations-row-head">
          <span class="conversations-row-title">
            {row.title ?? ts("home.inicio.recents.untitled")}
          </span>
          <span class="conversations-row-when">
            {formatRelativeTime(row.lastActivityAt) ?? ""}
          </span>
        </div>
        <div class="conversations-row-tags">
          {row.sceneTitle ? (
            <span class="conversations-row-tag conversations-row-tag-scene">
              ❖ {row.sceneTitle}
            </span>
          ) : (
            <span class="conversations-row-tag conversations-row-tag-no-scene">
              {ts("home.inicio.recents.noScene")}
            </span>
          )}
        </div>
      </a>
      {/* Forget — same hover-reveal pattern as on /conversations.
          Sits OUTSIDE the row's <a> so click doesn't navigate.
          confirm() guards the destructive POST. returnTo brings
          the user back to the surface they came from after the
          delete (Histórico, Recentes) instead of bouncing them
          to /conversations every time. */}
      <form
        method="POST"
        action="/conversation/forget"
        class="conversations-row-forget"
        onsubmit={`return confirm('${ts("conversations.row.forgetConfirm").replace(/'/g, "\\'")}')`}
      >
        <input type="hidden" name="sessionId" value={row.id} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <button
          type="submit"
          aria-label={ts("conversations.row.forgetAria")}
          title={ts("conversations.row.forgetTitle")}
        >
          ×
        </button>
      </form>
    </li>
  );
};
