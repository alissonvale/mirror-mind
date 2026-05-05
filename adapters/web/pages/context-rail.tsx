import type { FC } from "hono/jsx";
import type { SessionStats } from "../../../server/session-stats.js";
import type { ComposedSnapshot } from "../../../server/composed-snapshot.js";
import type { ResponseMode, ResponseLength } from "../../../server/expression.js";
import type { SessionVoice } from "../../../server/db.js";
import { ts } from "../i18n.js";

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

/** CV1.E10.S2: response-length selection for the session. */
export interface ResponseLengthState {
  /** The session override, or null when "auto" (mode dictates length). */
  override: ResponseLength | null;
}

/** CV1.E9.S6: session voice override (Alma vs persona pool). */
export interface SessionVoiceState {
  /** "alma" when the session is locked to Soul Voice; null when the cast pool drives voice. */
  override: SessionVoice | null;
}

/** CV1.E15.S3: per-session model override. NULL on either field means
 *  the session inherits (from scene if anchored, else global). S4
 *  consumes this in the resolver chain. */
export interface SessionModelState {
  provider: string | null;
  id: string | null;
}

/** CV1.E15 follow-up: per-session toggle to surface a model badge
 *  on every assistant bubble. Default false; admin flips it on while
 *  comparing models in a specific conversation. */
export interface ShowModelBadgesState {
  enabled: boolean;
}

/** CV1.E11.S1 follow-up: the cena anchoring this session. */
export interface SessionSceneState {
  /** Cena key (slug). Null when the session is unscoped. */
  key: string | null;
  /** Cena title for display. Null when the session is unscoped. */
  title: string | null;
  /** Cena voice — "alma" drives the Cast/Voice mutex on the cena side. */
  voice: SessionVoice | null;
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
  /** CV1.E10.S2: response length state for the session. */
  responseLength: ResponseLengthState;
  /** CV1.E9.S6: session voice state — non-null forces Alma. */
  voice: SessionVoiceState;
  /** CV1.E15.S3: session-level model override (admin-only surface in
   *  the conversation header pouch). Either field null = inherit. */
  sessionModel: SessionModelState;
  /** CV1.E15 follow-up: admin toggle for per-bubble model badges. */
  showModelBadges: ShowModelBadgesState;
  /**
   * CV1.E11.S1 follow-up: cena anchored to this session, if any.
   * Drives the header's Scene zone (between Cast and Context). The
   * scene's briefing is what the composer injects every turn — the
   * pill makes that visible. Null when the session is unscoped.
   */
  scene: SessionSceneState;
  /**
   * persona-colors improvement: persona key → color (stored or
   * hash-derived). Consumers look up here instead of re-running the
   * hash at every render site.
   */
  personaColors: Record<string, string>;
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
  if (n >= 1000) return ts("rail.tokensK", { n: (n / 1000).toFixed(1) });
  return ts("rail.tokens", { n });
}

/**
 * CV1.E15 follow-up: collapse a model_id like "anthropic/claude-sonnet-4-6"
 * to its tail "claude-sonnet-4-6". Same convention used by the bubble
 * badge (S7) and the AdvancedZone summary tail (S3) so the rail and
 * those surfaces read consistently.
 */
function shortModelId(id: string): string {
  return id.split("/").pop() ?? id;
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
      data-i18n-scene-line={ts("rail.sceneLine", { key: "{key}" })}
      data-i18n-organization-line={ts("rail.organizationLine", { key: "{key}" })}
      data-i18n-journey-line={ts("rail.journeyLine", { key: "{key}" })}
      data-i18n-mode-line={ts("rail.modeLine", { key: "{key}" })}
    >
      <div class="rail-header">
        <span class="rail-title">{ts("rail.lookInside")}</span>
        <button
          type="button"
          class="rail-close"
          aria-label={ts("rail.closeAria")}
          title={ts("rail.close")}
          data-toggle="rail"
        >
          ×
        </button>
      </div>

      <div class="rail-body">
        {/* CV1.E9 follow-up: empty-composed hide. When nothing has
            been composed yet (fresh session), the entire Composed
            block is hidden so the title doesn't sit alone. The block
            unhides as soon as a turn lands; updateRail in chat.js
            mirrors the toggle for live updates. */}
        <div
          class="rail-look-block"
          id="rail-composed-block"
          data-empty={composed.layers.length === 0 ? "true" : "false"}
        >
          <div class="rail-block-title">{ts("rail.composed")}</div>
          <div class="rail-row rail-mono" id="rail-layers">
            {composed.layers.join(" · ") || ts("common.dash")}
          </div>
          {/* CV1.E9.S3: Alma indicator. Mounts only when the turn was
              routed through the Soul Voice path. The persona row
              below stays hidden because Alma forces personas empty. */}
          <div
            class="rail-row"
            id="rail-composed-alma"
            data-hidden={composed.isAlma ? "false" : "true"}
          >
            {composed.isAlma ? `◈ ${ts("header.cast.alma")}` : ""}
          </div>
          <div
            class="rail-row"
            id="rail-composed-persona"
            data-hidden={persona ? "false" : "true"}
          >
            {persona ? `❖ ${persona}` : ""}
          </div>
          <div
            class="rail-row rail-scope"
            id="rail-composed-scene"
            data-hidden={composed.scene ? "false" : "true"}
          >
            {composed.scene
              ? ts("rail.sceneLine", { key: composed.scene })
              : ""}
          </div>
          <div
            class="rail-row rail-scope"
            id="rail-composed-organization"
            data-hidden={composed.organization ? "false" : "true"}
          >
            {composed.organization
              ? ts("rail.organizationLine", { key: composed.organization })
              : ""}
          </div>
          <div
            class="rail-row rail-scope"
            id="rail-composed-journey"
            data-hidden={composed.journey ? "false" : "true"}
          >
            {composed.journey
              ? ts("rail.journeyLine", { key: composed.journey })
              : ""}
          </div>
          <div
            class="rail-row"
            id="rail-composed-mode"
            data-hidden={composed.mode ? "false" : "true"}
          >
            {composed.mode ? ts("rail.modeLine", { key: composed.mode }) : ""}
          </div>
        </div>

        <div class="rail-look-block">
          <div class="rail-block-title">{ts("rail.session")}</div>
          <div class="rail-row" id="rail-messages">
            {ts("rail.messages", { count: sessionStats.messages })}
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
          {/* CV1.E15 follow-up: per-model breakdown. The session can
              mix models when there's a rerun or when the admin
              changed the override mid-thread; surfacing one row per
              `model_id ×count` matches reality. Pre-S4 turns (no
              stamped model) silently skip. id stays `rail-model` for
              chat.js' updateRail hook. */}
          <div class="rail-row rail-muted rail-mono" id="rail-model">
            {sessionStats.models.length === 0
              ? ""
              : sessionStats.models
                  .map((m) =>
                    m.count === 1
                      ? shortModelId(m.model_id)
                      : `${shortModelId(m.model_id)} ×${m.count}`,
                  )
                  .join(", ")}
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
