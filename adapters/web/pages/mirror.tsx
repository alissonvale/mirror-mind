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
        <div
          id="messages"
          data-session-id={rail.sessionId}
          data-pool-personas={rail.tags.personaKeys.join(",")}
          data-pool-organizations={rail.tags.organizationKeys.join(",")}
          data-pool-journeys={rail.tags.journeyKeys.join(",")}
        >
          {messages.map(({ id: entryId, data: msg, meta }) => {
            const role = msg.role as string;
            const text =
              typeof msg.content === "string"
                ? (msg.content as string)
                : ((msg.content as any[]) ?? [])
                    .filter((b: any) => b.type === "text")
                    .map((b: any) => b.text)
                    .join("");
            // Suppress the badge when the per-message pick is already
            // implied by the session's tag pool (CV1.E7 refinement).
            // When pool contains the pick, the rail already communicates
            // it — repeating on every bubble is noise. When the pool is
            // empty (free reception) or doesn't contain the pick (rare
            // divergence), the badge keeps informational value.
            const persona = meta.persona as string | undefined;
            const organization = meta.organization as string | undefined;
            const journey = meta.journey as string | undefined;
            const personaInPool = persona && rail.tags.personaKeys.includes(persona);
            const orgInPool = organization && rail.tags.organizationKeys.includes(organization);
            const journeyInPool = journey && rail.tags.journeyKeys.includes(journey);
            const showPersona = persona && !personaInPool;
            const showOrg = organization && !orgInPool;
            const showJourney = journey && !journeyInPool;
            const hasBadges = showPersona || showOrg || showJourney;
            return (
              <div class={`msg msg-${role}`} data-entry-id={entryId}>
                {hasBadges && (
                  <div class="msg-badges">
                    {showPersona && <span class="msg-badge msg-badge-persona">◇ {persona}</span>}
                    {showOrg && (
                      <span class="msg-badge msg-badge-organization">◈ {organization}</span>
                    )}
                    {showJourney && (
                      <span class="msg-badge msg-badge-journey">↝ {journey}</span>
                    )}
                  </div>
                )}
                <div class="msg-body">
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
    <script src="/public/chat.js?v=badge-in-pool-1"></script>
  </Layout>
);
