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
import { ts } from "../i18n.js";
import type {
  User,
  LoadedMessage,
  DivergentRun,
} from "../../../server/db.js";

/**
 * CV1.E9.S4: pool of personas the user can pick as a manual destination
 * via the "Enviar Para…" popover. Built from cast (session_personas)
 * first, then the user's full persona inventory (alphabetical), with
 * dedupe so cast members don't appear twice.
 */
export interface SendToPersona {
  key: string;
  color: string;
  inCast: boolean;
}

/**
 * CV1.E7.S9 phase 1: per-turn mode visibility on the assistant bubble.
 * Maps the two non-default response modes to subtle text glyphs that
 * render at the bubble's left-of-text position via a CSS pseudo-
 * element driven by `data-mode-icon`. Returns `undefined` for
 * `conversational` (the default mode) and for unknown modes — both
 * cases leave the attribute absent so nothing renders.
 *
 * Why conversational is silent: it's the mode reception picks by the
 * lighter-mode tiebreaker (the conservative default — see
 * server/reception.ts). Showing a glyph on every conversational turn
 * is visual noise on what is already the dominant case. Presence of a
 * glyph now means *"reception escalated above conversational on this
 * turn"* — a stronger signal precisely because the default is silent.
 *
 * Glyph rationale (monochromatic line-art for visual consistency
 * with ◇ persona, ⌂ org, ↝ journey):
 *   - ☰ compositional   — three lines; structured, list-shaped reply
 *   - ¶ essayistic      — pilcrow; classical mark for prose
 *
 * Kept as a tiny named helper (not inline) so chat.js can mirror the
 * mapping without code duplication when streaming bubbles in.
 */
export function modeIcon(mode: string): string | undefined {
  if (mode === "compositional") return "☰";
  if (mode === "essayistic") return "¶";
  return undefined;
}

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
  /**
   * CV1.E7.S8: out-of-pool divergent runs grouped by parent_entry_id.
   * Each parent that has divergent siblings gets them rendered inline
   * below its canonical bubble as sub-bubbles. Empty map when there
   * are no divergent runs in the session.
   */
  divergentRuns?: Map<string, DivergentRun[]>;
  labMode?: boolean;
  sidebarScopes?: SidebarScopes;
  /**
   * CV1.E9.S4: list of personas to render in the "Enviar Para…" popover.
   * Caller (web adapter) builds the list from cast + inventory.
   */
  sendToPersonas?: SendToPersona[];
}> = ({
  user,
  messages,
  rail,
  personaTurnCounts,
  divergentRuns,
  labMode,
  sidebarScopes,
  sendToPersonas,
}) => {
  const bubbleSignatures = computeBubbleSignatures(messages);
  return (
  <Layout title={ts("conversation.htmlTitle")} user={user} wide sidebarScopes={sidebarScopes}>
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
                      <span class="msg-badge msg-badge-organization">⌂ {organization}</span>
                    )}
                    {showJourney && (
                      <span class="msg-badge msg-badge-journey">↝ {journey}</span>
                    )}
                  </div>
                )}
                <div class="msg-body">
                  <div
                    class="bubble"
                    style={bubbleStyle}
                    data-mode-icon={
                      role === "assistant" && typeof meta.mode === "string"
                        ? modeIcon(meta.mode as string)
                        : undefined
                    }
                    data-mode={
                      role === "assistant" && typeof meta.mode === "string"
                        ? (meta.mode as string)
                        : undefined
                    }
                  >
                    {text}
                  </div>
                  {/* CV1.E7.S8: divergent runs attached to this entry,
                      rendered inline as sub-bubbles. Server-rendered
                      from the divergent_runs table on F5 / first load;
                      streamed in client-side via renderDivergentSubBubble
                      when the user clicks an out-of-pool suggestion. */}
                  {divergentRuns?.get(entryId)?.map((dr) => {
                    const icon =
                      dr.override_type === "organization"
                        ? "⌂"
                        : dr.override_type === "journey"
                        ? "↝"
                        : "◇";
                    const sideStyle =
                      dr.override_type === "persona"
                        ? `border-left: 3px solid ${resolvePersonaColor(
                            rail.personaColors[dr.override_key] ?? null,
                            dr.override_key,
                          )};`
                        : undefined;
                    return (
                      <div
                        class="divergent-bubble"
                        data-divergent-id={dr.id}
                        data-override-type={dr.override_type}
                        data-override-key={dr.override_key}
                      >
                        <div class="divergent-badge">
                          {icon} {dr.override_key} — {ts("conversation.divergentRun")}
                        </div>
                        <div
                          class="divergent-bubble-content"
                          style={sideStyle}
                        >
                          {dr.content}
                        </div>
                      </div>
                    );
                  })}
                  <form
                    method="POST"
                    action="/conversation/turn/forget"
                    class="msg-delete-form"
                    onsubmit={`return confirm('${ts("conversation.confirmDelete").replace(/'/g, "\\'")}')`}
                  >
                    <input type="hidden" name="entryId" value={entryId} />
                    <input type="hidden" name="sessionId" value={rail.sessionId} />
                    <button
                      type="submit"
                      class="msg-delete-btn"
                      aria-label={ts("conversation.deleteExchange")}
                      title={ts("conversation.deleteExchange")}
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
            placeholder={ts("conversation.inputPlaceholder")}
            autocomplete="off"
            autofocus
          />
          {/* CV1.E9.S4: "Enviar Para…" — manual destination picker.
              Anchors a popover (#send-to-popover) below the chat form.
              Disabled mid-stream by chat.js along with the Send button.
              Hidden when there are no destinations to pick (no Alma
              path possible without identity content; trivially still
              listed because the user can pick Alma even on a fresh
              install). */}
          <button
            id="send-to-btn"
            type="button"
            class="send-to-btn"
            aria-haspopup="menu"
            aria-controls="send-to-popover"
            aria-expanded="false"
            title={ts("conversation.sendTo.title")}
          >
            {ts("conversation.sendTo.button")}
          </button>
          <button type="submit">{ts("conversation.send")}</button>
        </form>
        {/* CV1.E9.S4: destination picker popover. Closed by default;
            chat.js opens it on send-to-btn click and closes on ESC,
            click-outside, or item selection. */}
        <div
          id="send-to-popover"
          class="send-to-popover"
          role="menu"
          data-open="false"
          aria-hidden="true"
        >
          <button
            type="button"
            class="send-to-item send-to-item-alma"
            role="menuitem"
            data-destination="alma"
          >
            <span class="send-to-icon">◈</span>
            <span class="send-to-label">{ts("conversation.sendTo.alma")}</span>
          </button>
          {sendToPersonas && sendToPersonas.length > 0 && (
            <>
              <div class="send-to-divider" role="separator" />
              {sendToPersonas.map((p) => (
                <button
                  type="button"
                  class={`send-to-item send-to-item-persona${p.inCast ? " send-to-item-cast" : ""}`}
                  role="menuitem"
                  data-destination={`persona:${p.key}`}
                >
                  <span class="send-to-icon" style={`color: ${p.color};`}>
                    ◇
                  </span>
                  <span class="send-to-label">{p.key}</span>
                </button>
              ))}
            </>
          )}
        </div>
        {labMode && (
          <label class="lab-bypass-toggle" title={ts("conversation.lab.bypassTitle")}>
            <input type="checkbox" id="lab-bypass-persona" />
            <span>{ts("conversation.lab.bypassLabel")}</span>
          </label>
        )}
      </div>
      {user.role === "admin" && <ContextRail rail={rail} />}
    </div>
    <script src="/public/chat.js?v=enviar-para-1"></script>
  </Layout>
  );
};
