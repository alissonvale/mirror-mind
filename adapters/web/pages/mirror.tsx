import type { FC } from "hono/jsx";
import { Layout, type SidebarScopes } from "./layout.js";
import {
  ContextRail,
  type RailState,
  avatarInitials,
} from "./context-rail.js";
import {
  ConversationHeader,
  type PersonaTurnCounts,
} from "./conversation-header.js";
import { resolvePersonaColor } from "../../../server/personas/colors.js";
import type { User, LoadedMessage } from "../../../server/db.js";

export interface BubbleSignature {
  /** True when at least one persona participated in this turn. */
  showSignature: boolean;
  /**
   * Personas added to the cast on THIS turn — personas present now
   * that weren't active in the previous assistant turn. One badge is
   * rendered per entry. When the set matches the previous turn's set
   * exactly, this array is empty (color bar continues, no fresh
   * badges).
   */
  newPersonasThisTurn: string[];
  /** The leading lens for this turn (first in the list). Drives the color bar. */
  primaryPersona: string | null;
  /** All personas active on this turn (for future consumers; current UI uses primary + new). */
  personas: string[];
}

/**
 * Pre-compute the assistant persona signature for each message
 * (CV1.E7.S5: set-based, not singular-based).
 *
 * Rules:
 * - `showSignature` — true when the turn has at least one persona.
 *   Drives the bubble's left color bar (rendered in the primary
 *   persona's color).
 * - `newPersonasThisTurn` — personas that entered the cast on THIS
 *   turn compared to the previous assistant turn's set. Renders one
 *   `◇ key` badge per entry. Same-set turn → empty array.
 * - Persona-less turn resets the tracker: the next persona'd turn
 *   starts with a fresh set, so its personas all count as "new."
 * - Set comparison ignores order. `[A, B]` followed by `[B, A]`
 *   produces no new-persona badges on the second turn.
 *
 * Meta read honors the CV1.E7.S5 dual-shape persistence: `_personas`
 * (array) is canonical; `_persona` (string) is the legacy fallback
 * for historical entries. Either source wraps up to a string[].
 */
function readPersonasFromMeta(meta: Record<string, unknown>): string[] {
  if (Array.isArray(meta.personas)) {
    return (meta.personas as unknown[]).filter(
      (x): x is string => typeof x === "string",
    );
  }
  if (typeof meta.persona === "string") return [meta.persona];
  return [];
}

function computeBubbleSignatures(messages: LoadedMessage[]): BubbleSignature[] {
  const out: BubbleSignature[] = [];
  let lastAssistantSet: Set<string> | null = null;
  for (const m of messages) {
    const role = m.data.role as string | undefined;
    if (role !== "assistant") {
      out.push({
        showSignature: false,
        newPersonasThisTurn: [],
        primaryPersona: null,
        personas: [],
      });
      continue;
    }
    const personas = readPersonasFromMeta(m.meta);
    if (personas.length === 0) {
      // Persona-less assistant turn: reset the tracker. Any next
      // persona'd turn starts a fresh set.
      lastAssistantSet = null;
      out.push({
        showSignature: false,
        newPersonasThisTurn: [],
        primaryPersona: null,
        personas: [],
      });
      continue;
    }
    const previousSet = lastAssistantSet ?? new Set<string>();
    const newOnes = personas.filter((k) => !previousSet.has(k));
    out.push({
      showSignature: true,
      newPersonasThisTurn: newOnes,
      primaryPersona: personas[0],
      personas,
    });
    lastAssistantSet = new Set(personas);
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
            const primaryColor = sig.primaryPersona
              ? rail.personaColors[sig.primaryPersona] ??
                resolvePersonaColor(null, sig.primaryPersona)
              : null;
            const bubbleStyle = sig.showSignature
              ? `border-left: 3px solid ${primaryColor};`
              : undefined;
            const hasBadges =
              sig.newPersonasThisTurn.length > 0 || showOrg || showJourney;

            return (
              <div
                class={`msg msg-${role}`}
                data-entry-id={entryId}
                data-persona={sig.primaryPersona ?? ""}
                data-personas={sig.personas.join(",")}
              >
                {hasBadges && (
                  <div class="msg-badges">
                    {sig.newPersonasThisTurn.map((key) => {
                      const color =
                        rail.personaColors[key] ??
                        resolvePersonaColor(null, key);
                      return (
                        <span
                          class="msg-badge msg-badge-persona"
                          style={`color: ${color};`}
                        >
                          ◇ {key}
                        </span>
                      );
                    })}
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
    <script src="/public/chat.js?v=scope-pill-hot-update-1"></script>
  </Layout>
  );
};
