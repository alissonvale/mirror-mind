import type { FC } from "hono/jsx";
import type { SessionStats } from "../../../server/session-stats.js";
import type { ComposedSnapshot } from "../../../server/composed-snapshot.js";
import type { ResponseMode } from "../../../server/expression.js";

export interface ScopeOption {
  key: string;
  name: string;
}

export interface SessionTagState {
  /** The pool — keys currently tagged on the session. */
  personaKeys: string[];
  organizationKeys: string[];
  journeyKeys: string[];
  /** All candidates available to add for this user. */
  availablePersonas: ScopeOption[];
  availableOrganizations: ScopeOption[];
  availableJourneys: ScopeOption[];
}

/** CV1.E7.S1: response-mode selection for the session. */
export interface ResponseModeState {
  /** The session override, or null when "auto" (follow reception). */
  override: ResponseMode | null;
}

export interface RailState {
  /**
   * The session this rail snapshot was built from. Threaded into every
   * form the rail renders so POSTs act on the viewed session, even when
   * the user is on `/conversation/<id>` for an older session (the
   * "current" session by last-activity is a separate concept).
   */
  sessionId: string;
  sessionStats: SessionStats;
  composed: ComposedSnapshot;
  personaDescriptor: string | null;
  personaInitials: string;
  personaColor: string;
  userName: string;
  /** When false, the cost row is hidden entirely. Regular users (non-admins) never see cost. */
  showCost: boolean;
  /** When false and showCost true, cost renders as USD. When true, renders as BRL. */
  showBrl: boolean;
  /** Conversion rate used to derive USD from the BRL heuristic when needed. */
  usdToBrlRate: number;
  /** CV1.E4.S4: session-level scope tag pool + available candidates. */
  tags: SessionTagState;
  /** CV1.E7.S1: response mode state for the session. */
  responseMode: ResponseModeState;
}

const PERSONA_COLORS = [
  "#b88a6b",
  "#8b7d6b",
  "#8aa08b",
  "#b69b7c",
  "#7c9aa0",
  "#a88b8b",
  "#9a8ba0",
  "#8ba095",
];

export function avatarInitials(name: string | null): string {
  if (!name) return "";
  const parts = name.split(/[-_\s]+/).filter(Boolean);
  if (parts.length === 0) return name.slice(0, 2).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function avatarColor(name: string | null): string {
  if (!name) return "#c9c4bd";
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return PERSONA_COLORS[hash % PERSONA_COLORS.length];
}

function formatTokens(n: number): string {
  if (n >= 1000) return `~${(n / 1000).toFixed(1)}k tokens`;
  return `~${n} tokens`;
}

function formatBRL(n: number): string {
  return `R$ ${n.toFixed(4).replace(".", ",")}`;
}

function formatUSD(n: number): string {
  return `$ ${n.toFixed(4)}`;
}

/**
 * Look-inside rail (CV1.E7.S2 follow-up). What used to be the
 * "Attention Memory" rail with two disclosures (Edit context / Look
 * inside) is now a single admin-only inspection panel. The Edit
 * context block was redundant — the header already carries tag
 * editing. What remains is the ficha técnica: composed snapshot +
 * session stats.
 *
 * Visibility rules:
 * - Mounted only when user.role === "admin" (gated in MirrorPage).
 * - Default hidden via data-visible="false". Toggled by the header
 *   menu's "Look inside" item + the close × in the rail header.
 * - Toggle state persisted in localStorage (mirror.rail.visible).
 */
export const ContextRail: FC<{ rail: RailState }> = ({ rail }) => {
  const { sessionStats, composed } = rail;
  const persona = composed.persona;
  const tokens = sessionStats.tokensIn + sessionStats.tokensOut;

  let costText: string | null = null;
  if (rail.showCost && sessionStats.costBRL !== null) {
    if (rail.showBrl) {
      costText = formatBRL(sessionStats.costBRL);
    } else {
      const usd =
        rail.usdToBrlRate > 0 ? sessionStats.costBRL / rail.usdToBrlRate : 0;
      costText = formatUSD(usd);
    }
  }

  return (
    <aside
      id="context-rail"
      class="context-rail context-rail-admin"
      data-visible="false"
    >
      <div class="rail-header">
        <span class="rail-title">Look inside</span>
        <button
          type="button"
          class="rail-close"
          aria-label="Close look inside"
          title="Close"
          data-toggle="rail"
        >
          ×
        </button>
      </div>

      <div class="rail-body">
        <div class="rail-look-block">
          <div class="rail-block-title">Composed</div>
          <div class="rail-row rail-mono" id="rail-layers">
            {composed.layers.join(" · ") || "—"}
          </div>
          <div
            class="rail-row"
            id="rail-composed-persona"
            data-hidden={persona ? "false" : "true"}
          >
            {persona ? `◇ ${persona}` : ""}
          </div>
          <div
            class="rail-row rail-scope"
            id="rail-composed-organization"
            data-hidden={composed.organization ? "false" : "true"}
          >
            {composed.organization
              ? `organization: ${composed.organization}`
              : ""}
          </div>
          <div
            class="rail-row rail-scope"
            id="rail-composed-journey"
            data-hidden={composed.journey ? "false" : "true"}
          >
            {composed.journey ? `journey: ${composed.journey}` : ""}
          </div>
        </div>

        <div class="rail-look-block">
          <div class="rail-block-title">Session</div>
          <div class="rail-row" id="rail-messages">
            {sessionStats.messages} messages
          </div>
          <div class="rail-row rail-mono" id="rail-tokens">
            {formatTokens(tokens)}
          </div>
          <div
            class="rail-row rail-mono"
            id="rail-cost"
            data-hidden={costText === null ? "true" : "false"}
          >
            {costText ?? ""}
          </div>
          <div class="rail-row rail-muted rail-mono" id="rail-model">
            {sessionStats.model}
          </div>
        </div>
      </div>
    </aside>
  );
};

/**
 * Scope tag editor. Used inline by the header (conversation-header.tsx)
 * where it needs to render per-group pills + add/remove forms. The
 * slim rail no longer mounts this component directly — the editor
 * lives in the header, the rail is look-inside only.
 *
 * Kept here as the shared implementation so the header and any future
 * tag editor surface don't duplicate it.
 */
export const ScopeTagGroup: FC<{
  label: string;
  type: "persona" | "organization" | "journey";
  tagged: string[];
  available: ScopeOption[];
  sessionId: string;
}> = ({ label, type, tagged, available, sessionId }) => {
  const taggedSet = new Set(tagged);
  const unpicked = available.filter((o) => !taggedSet.has(o.key));
  const displayName = (key: string): string => {
    const opt = available.find((o) => o.key === key);
    return opt ? opt.name : key;
  };
  return (
    <div class="rail-scope-tags-group">
      <div class="rail-scope-tags-label">{label}</div>
      {tagged.length === 0 && unpicked.length === 0 && (
        <div class="rail-scope-tags-empty">
          (none configured — add {label.toLowerCase()} first)
        </div>
      )}
      {tagged.length > 0 && (
        <div class="rail-scope-tags-pills">
          {tagged.map((key) => (
            <form
              method="POST"
              action="/conversation/untag"
              class="rail-scope-tags-pill-form"
            >
              <input type="hidden" name="sessionId" value={sessionId} />
              <input type="hidden" name="type" value={type} />
              <input type="hidden" name="key" value={key} />
              <span class="rail-scope-tags-pill-name">{displayName(key)}</span>
              <button
                type="submit"
                class="rail-scope-tags-pill-remove"
                aria-label={`Remove ${key}`}
                title="Remove from this conversation"
              >
                ×
              </button>
            </form>
          ))}
        </div>
      )}
      {unpicked.length > 0 && (
        <form
          method="POST"
          action="/conversation/tag"
          class="rail-scope-tags-add"
        >
          <input type="hidden" name="sessionId" value={sessionId} />
          <input type="hidden" name="type" value={type} />
          <select name="key" class="rail-scope-tags-select" required>
            <option value="">Add {label.toLowerCase().replace(/s$/, "")}…</option>
            {unpicked.map((o) => (
              <option value={o.key}>{o.name}</option>
            ))}
          </select>
          <button type="submit" class="rail-scope-tags-add-btn" aria-label="Add">
            +
          </button>
        </form>
      )}
    </div>
  );
};
