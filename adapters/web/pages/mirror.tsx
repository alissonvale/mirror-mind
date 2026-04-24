import type { FC } from "hono/jsx";
import { Layout, type SidebarScopes } from "./layout.js";
import {
  ContextRail,
  type RailState,
  avatarInitials,
  avatarColor,
} from "./context-rail.js";
import {
  ConversationHeader,
  type PersonaTurnCounts,
} from "./conversation-header.js";
import type { User, LoadedMessage } from "../../server/db.js";

/**
 * Pre-compute the assistant persona signature for each message:
 * - `showSignature` — does this bubble get the lateral color bar?
 *   True for assistant bubbles with a persona.
 * - `showBadge` — does this bubble get the `◇ persona` text badge?
 *   True only on persona TRANSITIONS (first persona in the session or
 *   persona differs from the previous assistant's persona). When the
 *   persona continues from the last turn, the color bar alone carries
 *   continuity; stacking a fresh label every turn is noise.
 */
function computeBubbleSignatures(
  messages: LoadedMessage[],
): Array<{ showSignature: boolean; showBadge: boolean; persona: string | null }> {
  const out: Array<{ showSignature: boolean; showBadge: boolean; persona: string | null }> = [];
  let lastAssistantPersona: string | null = null;
  for (const m of messages) {
    const role = m.data.role as string | undefined;
    if (role !== "assistant") {
      out.push({ showSignature: false, showBadge: false, persona: null });
      continue;
    }
    const persona = (m.meta.persona as string | undefined) ?? null;
    if (!persona) {
      // Reset the tracking — the next persona'd assistant should show a badge.
      lastAssistantPersona = null;
      out.push({ showSignature: false, showBadge: false, persona: null });
      continue;
    }
    const changed = persona !== lastAssistantPersona;
    out.push({
      showSignature: true,
      showBadge: changed,
      persona,
    });
    lastAssistantPersona = persona;
  }
  return out;
}

export const MirrorPage: FC<{
  user: User;
  messages: LoadedMessage[];
  rail: RailState;
  personaTurnCounts: PersonaTurnCounts;
  labMode?: boolean;
  sidebarScopes?: SidebarScopes;
}> = ({ user, messages, rail, personaTurnCounts, labMode, sidebarScopes }) => {
  const bubbleSignatures = computeBubbleSignatures(messages);
  return (
  <Layout title="Mirror" user={user} wide sidebarScopes={sidebarScopes}>
    <div class="chat-shell">
      <div class="chat-container">
        <ConversationHeader
          rail={rail}
          personaTurnCounts={personaTurnCounts}
          isAdmin={user.role === "admin"}
        />
        <div
          id="messages"
          data-session-id={rail.sessionId}
          data-pool-personas={rail.tags.personaKeys.join(",")}
          data-pool-organizations={rail.tags.organizationKeys.join(",")}
          data-pool-journeys={rail.tags.journeyKeys.join(",")}
        >
          {messages.map(({ id: entryId, data: msg, meta }, index) => {
            const role = msg.role as string;
            const text =
              typeof msg.content === "string"
                ? (msg.content as string)
                : ((msg.content as any[]) ?? [])
                    .filter((b: any) => b.type === "text")
                    .map((b: any) => b.text)
                    .join("");
            const organization = meta.organization as string | undefined;
            const journey = meta.journey as string | undefined;
            // Org + journey: suppress the badge when the pool already
            // carries the pick. Persona badge has its own rule below —
            // only on transitions, regardless of pool.
            const orgInPool = organization && rail.tags.organizationKeys.includes(organization);
            const journeyInPool = journey && rail.tags.journeyKeys.includes(journey);
            const showOrg = organization && !orgInPool;
            const showJourney = journey && !journeyInPool;

            const sig = bubbleSignatures[index];
            const personaColor = sig.persona ? avatarColor(sig.persona) : null;
            const bubbleStyle = sig.showSignature
              ? `border-left: 3px solid ${personaColor};`
              : undefined;
            const hasBadges = sig.showBadge || showOrg || showJourney;

            return (
              <div
                class={`msg msg-${role}`}
                data-entry-id={entryId}
                data-persona={sig.persona ?? ""}
              >
                {hasBadges && (
                  <div class="msg-badges">
                    {sig.showBadge && sig.persona && (
                      <span class="msg-badge msg-badge-persona">◇ {sig.persona}</span>
                    )}
                    {showOrg && (
                      <span class="msg-badge msg-badge-organization">◈ {organization}</span>
                    )}
                    {showJourney && (
                      <span class="msg-badge msg-badge-journey">↝ {journey}</span>
                    )}
                  </div>
                )}
                <div class="msg-body">
                  <div class="bubble" style={bubbleStyle}>
                    {text}
                  </div>
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
      {user.role === "admin" && <ContextRail rail={rail} />}
    </div>
    <script src="/public/chat.js?v=s2-rail-admin-only-1"></script>
  </Layout>
  );
};
