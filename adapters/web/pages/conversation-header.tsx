import type { FC } from "hono/jsx";
import type { RailState, ScopeOption } from "./context-rail.js";
import { avatarInitials, avatarColor } from "./context-rail.js";

/**
 * Per-persona turn counts — how many assistant messages each persona
 * wrote across this session. Read from `_persona` meta on entries.
 * Present in the RailState bundle because the header consumes it for
 * the cast popover.
 */
export interface PersonaTurnCounts {
  [personaKey: string]: number;
}

export interface ConversationHeaderData {
  rail: RailState;
  /** How many times each persona in the pool spoke this session. */
  personaTurnCounts: PersonaTurnCounts;
  /** True when the viewing user is admin — gates the "Look inside" menu item. */
  isAdmin: boolean;
}

/**
 * Conversation header — the always-visible strip above the chat that
 * surfaces the conversation's identity at a glance (CV1.E7.S2).
 *
 * Two zones:
 *  - Cast (mutable ensemble) on the left — avatars of personas in the
 *    session's pool, each with a popover for descriptor / turn count /
 *    remove, plus a `+` affordance to convoke a new persona.
 *  - Scope (stable context) on the right — org and journey pills, each
 *    openable for inline edit.
 *
 * Plus a mode pill (click expands segmented control) and a `⋯` menu
 * with New topic / Forget / Look inside.
 */
export const ConversationHeader: FC<ConversationHeaderData> = ({
  rail,
  personaTurnCounts,
  isAdmin,
}) => {
  return (
    <div class="conversation-header" data-session-id={rail.sessionId}>
      <div class="header-row">
        <CastZone
          personaKeys={rail.tags.personaKeys}
          available={rail.tags.availablePersonas}
          turnCounts={personaTurnCounts}
          sessionId={rail.sessionId}
        />
        <ScopeZone
          organizationKeys={rail.tags.organizationKeys}
          journeyKeys={rail.tags.journeyKeys}
          availableOrganizations={rail.tags.availableOrganizations}
          availableJourneys={rail.tags.availableJourneys}
          sessionId={rail.sessionId}
        />
        <ModePill
          current={rail.responseMode.override}
          sessionId={rail.sessionId}
        />
        <HeaderMenu sessionId={rail.sessionId} isAdmin={isAdmin} />
      </div>
    </div>
  );
};

// ─── Cast ──────────────────────────────────────────────────────────

const CastZone: FC<{
  personaKeys: string[];
  available: ScopeOption[];
  turnCounts: PersonaTurnCounts;
  sessionId: string;
}> = ({ personaKeys, available, turnCounts, sessionId }) => {
  const unpicked = available.filter((o) => !personaKeys.includes(o.key));
  return (
    <div class="header-zone header-zone-cast" aria-label="Cast">
      <span class="header-zone-label">Cast</span>
      <div class="header-cast-list">
        {personaKeys.map((key) => (
          <CastAvatar
            key={key}
            personaKey={key}
            turns={turnCounts[key] ?? 0}
            sessionId={sessionId}
          />
        ))}
        {personaKeys.length === 0 && (
          <span class="header-cast-empty">empty</span>
        )}
        {unpicked.length > 0 && (
          <details class="header-cast-add">
            <summary class="header-cast-add-trigger" aria-label="Convoke persona">
              +
            </summary>
            <div class="header-cast-add-panel">
              <form method="POST" action="/conversation/tag">
                <input type="hidden" name="sessionId" value={sessionId} />
                <input type="hidden" name="type" value="persona" />
                <select name="key" class="header-cast-add-select" required>
                  <option value="">Convoke a persona…</option>
                  {unpicked.map((o) => (
                    <option value={o.key}>{o.name}</option>
                  ))}
                </select>
                <button type="submit" class="header-cast-add-commit">
                  Add
                </button>
              </form>
            </div>
          </details>
        )}
      </div>
    </div>
  );
};

const CastAvatar: FC<{
  personaKey: string;
  turns: number;
  sessionId: string;
}> = ({ personaKey, turns, sessionId }) => {
  const color = avatarColor(personaKey);
  const initials = avatarInitials(personaKey);
  return (
    <details class="header-cast-avatar-wrap" data-persona={personaKey}>
      <summary
        class="header-cast-avatar"
        style={`background: ${color};`}
        aria-label={personaKey}
        title={personaKey}
      >
        {initials}
      </summary>
      <div class="header-cast-popover">
        <div class="header-cast-popover-name">{personaKey}</div>
        <div class="header-cast-popover-turns">
          {turns === 0
            ? "no turns yet in this session"
            : turns === 1
            ? "1 turn this session"
            : `${turns} turns this session`}
        </div>
        <a class="header-cast-popover-link" href={`/map/persona/${personaKey}`}>
          View persona →
        </a>
        <form method="POST" action="/conversation/untag">
          <input type="hidden" name="sessionId" value={sessionId} />
          <input type="hidden" name="type" value="persona" />
          <input type="hidden" name="key" value={personaKey} />
          <button type="submit" class="header-cast-popover-remove">
            Dismiss from cast
          </button>
        </form>
      </div>
    </details>
  );
};

// ─── Scope ─────────────────────────────────────────────────────────

const ScopeZone: FC<{
  organizationKeys: string[];
  journeyKeys: string[];
  availableOrganizations: ScopeOption[];
  availableJourneys: ScopeOption[];
  sessionId: string;
}> = ({
  organizationKeys,
  journeyKeys,
  availableOrganizations,
  availableJourneys,
  sessionId,
}) => {
  // Class names and the underlying session_* tables keep the historical
  // 'scope' terminology (CV1.E4 heritage); the user-facing label reads
  // 'Context' since CV1.E7.S2 — orgs and journeys are the stable
  // context of the conversation, not a limit or reach.
  return (
    <div class="header-zone header-zone-scope" aria-label="Context">
      <span class="header-zone-label">Context</span>
      <div class="header-scope-list">
        <ScopePillGroup
          type="organization"
          icon="◈"
          tagged={organizationKeys}
          available={availableOrganizations}
          sessionId={sessionId}
        />
        <ScopePillGroup
          type="journey"
          icon="≡"
          tagged={journeyKeys}
          available={availableJourneys}
          sessionId={sessionId}
        />
        {organizationKeys.length === 0 && journeyKeys.length === 0 && (
          <span class="header-scope-empty">no context</span>
        )}
      </div>
    </div>
  );
};

const MAX_SCOPE_VISIBLE = 3;

const ScopePillGroup: FC<{
  type: "organization" | "journey";
  icon: string;
  tagged: string[];
  available: ScopeOption[];
  sessionId: string;
}> = ({ type, icon, tagged, available, sessionId }) => {
  const taggedSet = new Set(tagged);
  const unpicked = available.filter((o) => !taggedSet.has(o.key));
  const visible = tagged.slice(0, MAX_SCOPE_VISIBLE);
  const overflow = tagged.slice(MAX_SCOPE_VISIBLE);
  const displayName = (key: string): string =>
    available.find((o) => o.key === key)?.name ?? key;

  const removeForm = (key: string) => (
    <form method="POST" action="/conversation/untag" class="header-scope-pill-form">
      <input type="hidden" name="sessionId" value={sessionId} />
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="key" value={key} />
      <span class="header-scope-pill-icon" aria-hidden="true">
        {icon}
      </span>
      <span class="header-scope-pill-name">{displayName(key)}</span>
      <button
        type="submit"
        class="header-scope-pill-remove"
        aria-label={`Remove ${key}`}
      >
        ×
      </button>
    </form>
  );

  return (
    <div class="header-scope-group" data-type={type}>
      {visible.map((key) => removeForm(key))}
      {overflow.length > 0 && (
        <details class="header-scope-overflow">
          <summary class="header-scope-overflow-trigger">
            +{overflow.length} more
          </summary>
          <div class="header-scope-overflow-panel">
            {overflow.map((key) => removeForm(key))}
          </div>
        </details>
      )}
      {unpicked.length > 0 && (
        <details class="header-scope-add">
          <summary
            class="header-scope-add-trigger"
            aria-label={`Add ${type}`}
            title={`Add ${type}`}
          >
            {icon} +
          </summary>
          <div class="header-scope-add-panel">
            <form method="POST" action="/conversation/tag">
              <input type="hidden" name="sessionId" value={sessionId} />
              <input type="hidden" name="type" value={type} />
              <select name="key" class="header-scope-add-select" required>
                <option value="">Add {type}…</option>
                {unpicked.map((o) => (
                  <option value={o.key}>{o.name}</option>
                ))}
              </select>
              <button type="submit" class="header-scope-add-commit">
                Add
              </button>
            </form>
          </div>
        </details>
      )}
    </div>
  );
};

// ─── Mode ──────────────────────────────────────────────────────────

const MODE_OPTIONS: { key: string; label: string; hint: string }[] = [
  { key: "auto", label: "auto", hint: "reception picks" },
  { key: "conversational", label: "conversational", hint: "short, close" },
  { key: "compositional", label: "compositional", hint: "structured" },
  { key: "essayistic", label: "essayistic", hint: "reflective, fuller" },
];

const ModePill: FC<{ current: string | null; sessionId: string }> = ({
  current,
  sessionId,
}) => {
  const activeKey = current ?? "auto";
  const activeLabel =
    MODE_OPTIONS.find((m) => m.key === activeKey)?.label ?? "auto";
  return (
    <div class="header-zone header-zone-mode" aria-label="Response mode">
      <span class="header-zone-label">Mode</span>
      <details class="header-mode-pouch">
        <summary
          class="header-mode-pill"
          aria-label="Change response mode"
          title="Change response mode"
        >
          {activeLabel} ▾
        </summary>
        <div class="header-mode-panel">
          <form method="POST" action="/conversation/response-mode">
            <input type="hidden" name="sessionId" value={sessionId} />
            <div class="header-mode-segmented">
              {MODE_OPTIONS.map((m) => (
                <button
                  type="submit"
                  name="mode"
                  value={m.key}
                  class={`header-mode-option ${m.key === activeKey ? "header-mode-option-active" : ""}`}
                  title={m.hint}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </form>
        </div>
      </details>
    </div>
  );
};

// ─── Menu ──────────────────────────────────────────────────────────

const HeaderMenu: FC<{ sessionId: string; isAdmin: boolean }> = ({
  sessionId,
  isAdmin,
}) => {
  return (
    <details class="header-menu">
      <summary
        class="header-menu-trigger"
        aria-label="Conversation actions"
        title="Conversation actions"
      >
        ⋯
      </summary>
      <div class="header-menu-panel">
        <form
          method="POST"
          action="/conversation/begin-again"
          class="header-menu-form"
        >
          <button type="submit" class="header-menu-item">
            New topic
          </button>
        </form>
        {isAdmin && (
          <button
            type="button"
            class="header-menu-item header-menu-item-link"
            data-toggle="rail"
          >
            Look inside
          </button>
        )}
        <form
          method="POST"
          action="/conversation/forget"
          class="header-menu-form"
        >
          <button
            type="submit"
            class="header-menu-item header-menu-item-danger"
            onclick="return confirm('Forget this conversation? This cannot be undone.')"
          >
            Forget this conversation
          </button>
        </form>
      </div>
    </details>
  );
};
