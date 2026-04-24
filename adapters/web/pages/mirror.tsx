import type { FC } from "hono/jsx";
import { Layout, type SidebarScopes } from "./layout.js";
import { ContextRail, type RailState } from "./context-rail.js";
import type { User, LoadedMessage } from "../../server/db.js";

export const MirrorPage: FC<{
  user: User;
  messages: LoadedMessage[];
  rail: RailState;
  labMode?: boolean;
  sidebarScopes?: SidebarScopes;
}> = ({ user, messages, rail, labMode, sidebarScopes }) => (
  <Layout title="Mirror" user={user} wide sidebarScopes={sidebarScopes}>
    <div class="chat-shell">
      <div class="chat-container">
        <div id="messages" data-session-id={rail.sessionId}>
          {messages.map(({ id: entryId, data: msg, meta }) => {
            const role = msg.role as string;
            const text =
              typeof msg.content === "string"
                ? (msg.content as string)
                : ((msg.content as any[]) ?? [])
                    .filter((b: any) => b.type === "text")
                    .map((b: any) => b.text)
                    .join("");
            const persona = meta.persona as string | undefined;
            const organization = meta.organization as string | undefined;
            const journey = meta.journey as string | undefined;
            const hasBadges = persona || organization || journey;
            return (
              <div class={`msg msg-${role}`} data-entry-id={entryId}>
                {hasBadges && (
                  <div class="msg-badges">
                    {persona && <span class="msg-badge msg-badge-persona">◇ {persona}</span>}
                    {organization && (
                      <span class="msg-badge msg-badge-organization">◈ {organization}</span>
                    )}
                    {journey && (
                      <span class="msg-badge msg-badge-journey">↝ {journey}</span>
                    )}
                  </div>
                )}
                <div class="bubble">{text}</div>
                <form
                  method="POST"
                  action="/conversation/turn/forget"
                  class="msg-delete-form"
                  onsubmit="return confirm('Delete this exchange? The user message and its reply will be removed from this conversation.')"
                >
                  <input type="hidden" name="entryId" value={entryId} />
                  <input type="hidden" name="sessionId" value={rail.sessionId} />
                  <button
                    type="submit"
                    class="msg-delete-btn"
                    aria-label="Delete this exchange"
                    title="Delete this exchange"
                  >
                    ×
                  </button>
                </form>
              </div>
            );
          })}
        </div>
        <form id="chat-form">
          <input
            type="text"
            id="chat-input"
            placeholder="Type a message..."
            autocomplete="off"
            autofocus
          />
          <button type="submit">Send</button>
        </form>
        {labMode && (
          <label class="lab-bypass-toggle" title="Bypass persona routing — responds with soul+ego only (Identity Lab exploration)">
            <input type="checkbox" id="lab-bypass-persona" />
            <span>Lab mode — bypass persona</span>
          </label>
        )}
      </div>
      <ContextRail rail={rail} />
    </div>
    <script src="/public/chat.js?v=delete-turn-1"></script>
  </Layout>
);
