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

const ScopeTagGroup: FC<{
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

/**
 * Slimmed rail (CV1.E7.S2). The dense "everything in the rail" era
 * ended when the conversation header took over the job of surfacing
 * the conversation's identity (cast, scope, mode, menu). What stays
 * here is two disclosures — quiet by default, expandable on demand:
 *
 *  - Edit scope  → full scope editor (personas / orgs / journeys).
 *  - Look inside → the ficha técnica (composed snapshot + session stats).
 *
 * Everything that used to live as its own section (active persona,
 * response mode, session actions, footer link) moved into the header
 * or the menu.
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
      class="context-rail context-rail-slim"
      data-collapsed="false"
    >
      <div class="rail-header">
        <span class="rail-title">Attention Memory</span>
        <button type="button" class="rail-toggle" aria-label="Toggle rail">
          <span class="rail-toggle-expanded">✕</span>
          <span class="rail-toggle-collapsed">◁</span>
        </button>
      </div>

      <div class="rail-body">
        <details class="rail-disclosure" id="rail-edit-scope">
          <summary class="rail-disclosure-trigger">Edit context ›</summary>
          <div class="rail-disclosure-body">
            <ScopeTagGroup
              label="Personas"
              type="persona"
              tagged={rail.tags.personaKeys}
              available={rail.tags.availablePersonas}
              sessionId={rail.sessionId}
            />
            <ScopeTagGroup
              label="Organizations"
              type="organization"
              tagged={rail.tags.organizationKeys}
              available={rail.tags.availableOrganizations}
              sessionId={rail.sessionId}
            />
            <ScopeTagGroup
              label="Journeys"
              type="journey"
              tagged={rail.tags.journeyKeys}
              available={rail.tags.availableJourneys}
              sessionId={rail.sessionId}
            />
            <p class="rail-scope-tags-note">
              Personas: reception picks one per turn from the pool. Orgs and
              journeys: all tagged scopes enter the prompt.
            </p>
          </div>
        </details>

        <details class="rail-disclosure" id="rail-look-inside">
          <summary class="rail-disclosure-trigger">Look inside ›</summary>
          <div class="rail-disclosure-body">
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
        </details>
      </div>

      <div class="rail-collapsed-strip">
        <div class="rail-collapsed-label">rail</div>
      </div>
    </aside>
  );
};
