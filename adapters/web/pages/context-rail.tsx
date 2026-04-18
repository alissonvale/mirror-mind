import type { FC } from "hono/jsx";
import type { SessionStats } from "../../../server/session-stats.js";
import type { ComposedSnapshot } from "../../../server/composed-snapshot.js";

export interface RailState {
  sessionStats: SessionStats;
  composed: ComposedSnapshot;
  personaDescriptor: string | null;
  personaInitials: string;
  personaColor: string;
  userName: string;
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

export function personaInitials(name: string | null): string {
  if (!name) return "";
  const parts = name.split(/[-_\s]+/).filter(Boolean);
  if (parts.length === 0) return name.slice(0, 2).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function personaColor(name: string | null): string {
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

export const ContextRail: FC<{ rail: RailState }> = ({ rail }) => {
  const { sessionStats, composed, personaDescriptor } = rail;
  const persona = composed.persona;
  const initials = rail.personaInitials;
  const color = rail.personaColor;
  const tokens = sessionStats.tokensIn + sessionStats.tokensOut;
  const costText =
    sessionStats.costBRL !== null ? formatBRL(sessionStats.costBRL) : null;

  return (
    <aside
      id="context-rail"
      class="context-rail"
      data-collapsed="false"
      data-persona={persona ?? ""}
    >
      <div class="rail-header">
        <span class="rail-title">Attention Memory</span>
        <button type="button" class="rail-toggle" aria-label="Toggle rail">
          <span class="rail-toggle-expanded">✕</span>
          <span class="rail-toggle-collapsed">◁</span>
        </button>
      </div>

      <div class="rail-body">
        <section class="rail-block rail-persona">
          <div
            class="persona-avatar"
            id="rail-persona-avatar"
            style={`background: ${color};`}
            data-empty={persona ? "false" : "true"}
          >
            <span id="rail-persona-initials">{persona ? initials : ""}</span>
          </div>
          <div class="persona-meta">
            <div class="persona-name" id="rail-persona-name">
              {persona ?? "ego"}
            </div>
            <div class="persona-descriptor" id="rail-persona-descriptor">
              {persona ? personaDescriptor ?? "" : "voz base"}
            </div>
          </div>
        </section>

        <section class="rail-block rail-session">
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
        </section>

        <section class="rail-block rail-composed">
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
        </section>

        <div class="rail-footer">
          <a href={`/admin/users/${rail.userName}`} class="rail-footer-link">
            Grounded in your identity
            <span class="rail-footer-arrow">→</span>
          </a>
        </div>
      </div>

      <div class="rail-collapsed-strip">
        <div
          class="persona-avatar persona-avatar-sm"
          style={`background: ${color};`}
          data-empty={persona ? "false" : "true"}
        >
          <span id="rail-collapsed-initials">{persona ? initials : ""}</span>
        </div>
        <div
          class="rail-collapsed-cost rail-mono"
          id="rail-collapsed-cost"
          data-hidden={costText === null ? "true" : "false"}
        >
          {costText ?? ""}
        </div>
      </div>
    </aside>
  );
};
