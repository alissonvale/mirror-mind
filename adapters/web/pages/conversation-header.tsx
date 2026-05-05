import type { FC } from "hono/jsx";
import type {
  RailState,
  ScopeOption,
  SessionModelState,
} from "./context-rail.js";
import { avatarInitials } from "./context-rail.js";
import { resolvePersonaColor } from "../../../server/personas/colors.js";
import type { CatalogEntry } from "../../../server/db/models-catalog.js";
import { ModelPicker } from "./components/model-picker.js";
import { ts } from "../i18n.js";

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
  /** CV1.E15.S3: model catalog for the admin-only "Modelo" row inside
   *  the Advanced pouch. Undefined for non-admin requests. */
  modelCatalog?: CatalogEntry[];
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
  modelCatalog,
}) => {
  return (
    <div class="conversation-header" data-session-id={rail.sessionId}>
      <div class="header-row">
        <CastZone
          personaKeys={rail.tags.personaKeys}
          available={rail.tags.availablePersonas}
          turnCounts={personaTurnCounts}
          sessionId={rail.sessionId}
          personaColors={rail.personaColors}
          voice={rail.voice.override}
        />
        <SceneZone
          sceneKey={rail.scene.key}
          sceneTitle={rail.scene.title}
          sceneVoice={rail.scene.voice}
          sessionId={rail.sessionId}
        />
        <ScopeZone
          organizationKeys={rail.tags.organizationKeys}
          journeyKeys={rail.tags.journeyKeys}
          availableOrganizations={rail.tags.availableOrganizations}
          availableJourneys={rail.tags.availableJourneys}
          sessionId={rail.sessionId}
        />
        <AdvancedZone
          mode={rail.responseMode.override}
          length={rail.responseLength.override}
          sessionId={rail.sessionId}
          isAdmin={isAdmin}
          sessionModel={rail.sessionModel}
          modelCatalog={modelCatalog}
        />
        <HeaderMenu sessionId={rail.sessionId} isAdmin={isAdmin} />
      </div>
    </div>
  );
};

// ─── Cast ──────────────────────────────────────────────────────────

const ALMA_COLOR = "#b8956a";
const ALMA_GLYPH = "♔";

const CastZone: FC<{
  personaKeys: string[];
  available: ScopeOption[];
  turnCounts: PersonaTurnCounts;
  sessionId: string;
  personaColors: Record<string, string>;
  voice: "alma" | null;
}> = ({ personaKeys, available, turnCounts, sessionId, personaColors, voice }) => {
  const unpicked = available.filter((o) => !personaKeys.includes(o.key));
  const isAlmaCast = voice === "alma";
  return (
    <div class="header-zone header-zone-cast" aria-label={ts("header.cast.label")}>
      <span class="header-zone-label">{ts("header.cast.label")}</span>
      <div class="header-cast-list">
        {/* CV1.E9.S6: when voice=alma, the cast renders a single Alma
            avatar in lieu of any persona avatars. The two states are
            mutually exclusive at the data layer (setSessionVoice
            clears session_personas; addSessionPersona clears voice). */}
        {isAlmaCast && (
          <CastAvatarAlma sessionId={sessionId} />
        )}
        {!isAlmaCast && personaKeys.map((key) => (
          <CastAvatar
            key={key}
            personaKey={key}
            turns={turnCounts[key] ?? 0}
            sessionId={sessionId}
            color={personaColors[key] ?? resolvePersonaColor(null, key)}
          />
        ))}
        {!isAlmaCast && personaKeys.length === 0 && (
          <span class="header-cast-empty">{ts("header.cast.empty")}</span>
        )}
        {/* Add picker — visible whenever the cast is in pool mode and
            unpicked options exist. Alma also shows up as the first
            option inside the picker (see panel) to make Alma a
            reachable choice from the same surface as personas. */}
        {!isAlmaCast && unpicked.length > 0 && (
          <details class="header-cast-add">
            <summary class="header-cast-add-trigger" aria-label={ts("header.cast.convoke")}>
              +
            </summary>
            <div class="header-cast-add-panel">
              {/* CV1.E9.S6: Alma sits at the top of the picker as a
                  first-class entry — own form, distinct visual
                  treatment, separator below. Selecting it POSTs to
                  /conversation/voice (which clears any existing
                  personas on the server). */}
              <form
                method="POST"
                action="/conversation/voice"
                class="header-cast-add-alma-form"
              >
                <input type="hidden" name="sessionId" value={sessionId} />
                <input type="hidden" name="voice" value="alma" />
                <button
                  type="submit"
                  class="header-cast-add-alma-btn"
                  title={ts("header.cast.almaHint")}
                >
                  <span class="header-cast-add-alma-glyph" aria-hidden="true">
                    {ALMA_GLYPH}
                  </span>
                  <span class="header-cast-add-alma-label">
                    {ts("header.cast.alma")}
                  </span>
                </button>
              </form>
              <div class="header-cast-add-divider" aria-hidden="true" />
              <form method="POST" action="/conversation/tag">
                <input type="hidden" name="sessionId" value={sessionId} />
                <input type="hidden" name="type" value="persona" />
                <select name="key" class="header-cast-add-select" required>
                  <option value="">{ts("header.cast.convokePrompt")}</option>
                  {unpicked.map((o) => (
                    <option value={o.key}>{o.name}</option>
                  ))}
                </select>
                <button type="submit" class="header-cast-add-commit">
                  {ts("header.cast.add")}
                </button>
              </form>
            </div>
          </details>
        )}
        {/* When the cast is empty AND voice=null (no personas, no
            Alma), the picker is the only path to populate it. Alma
            appears in the picker even when there are zero unpicked
            personas — without this, an account with no personas would
            have no UI to convoke Alma. */}
        {!isAlmaCast && personaKeys.length === 0 && unpicked.length === 0 && (
          <details class="header-cast-add">
            <summary class="header-cast-add-trigger" aria-label={ts("header.cast.convoke")}>
              +
            </summary>
            <div class="header-cast-add-panel">
              <form method="POST" action="/conversation/voice">
                <input type="hidden" name="sessionId" value={sessionId} />
                <input type="hidden" name="voice" value="alma" />
                <button type="submit" class="header-cast-add-alma-btn">
                  <span class="header-cast-add-alma-glyph" aria-hidden="true">
                    {ALMA_GLYPH}
                  </span>
                  <span class="header-cast-add-alma-label">
                    {ts("header.cast.alma")}
                  </span>
                </button>
              </form>
            </div>
          </details>
        )}
      </div>
    </div>
  );
};

const CastAvatarAlma: FC<{ sessionId: string }> = ({ sessionId }) => (
  <details class="header-cast-avatar-wrap" data-voice="alma">
    <summary
      class="header-cast-avatar header-cast-avatar-alma"
      style={`background: ${ALMA_COLOR};`}
      aria-label={ts("header.cast.alma")}
      title={ts("header.cast.alma")}
    >
      {ALMA_GLYPH}
    </summary>
    <div class="header-cast-popover">
      <div class="header-cast-popover-name">{ts("header.cast.alma")}</div>
      <div class="header-cast-popover-turns">
        {ts("header.cast.almaDescription")}
      </div>
      <form method="POST" action="/conversation/voice">
        <input type="hidden" name="sessionId" value={sessionId} />
        <input type="hidden" name="voice" value="" />
        <button type="submit" class="header-cast-popover-remove">
          {ts("header.cast.almaDismiss")}
        </button>
      </form>
    </div>
  </details>
);

const CastAvatar: FC<{
  personaKey: string;
  turns: number;
  sessionId: string;
  color: string;
}> = ({ personaKey, turns, sessionId, color }) => {
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
            ? ts("header.cast.turnsZero")
            : turns === 1
            ? ts("header.cast.turnsOne")
            : ts("header.cast.turnsMany", { count: turns })}
        </div>
        <a class="header-cast-popover-link" href={`/map/persona/${personaKey}`}>
          {ts("header.cast.viewPersona")}
        </a>
        <form method="POST" action="/conversation/untag">
          <input type="hidden" name="sessionId" value={sessionId} />
          <input type="hidden" name="type" value="persona" />
          <input type="hidden" name="key" value={personaKey} />
          <button type="submit" class="header-cast-popover-remove">
            {ts("header.cast.dismiss")}
          </button>
        </form>
      </div>
    </details>
  );
};

// ─── Scene (CV1.E11.S1 follow-up) ──────────────────────────────────
//
// The cena anchoring the session — null when the session was started
// from the free input (no scene chosen) and reception's cold-start
// suggestion was either dismissed or didn't fire.
//
// Renders as a single pill: glyph (♔ for Alma cenas, ❖ for persona
// cenas) + title + a popover that links to the cena's editor and
// lets the user clear the link (sets sessions.scene_id = NULL).
// Hidden entirely when scene is null.

const SceneZone: FC<{
  sceneKey: string | null;
  sceneTitle: string | null;
  sceneVoice: "alma" | null;
  sessionId: string;
}> = ({ sceneKey, sceneTitle, sceneVoice, sessionId }) => {
  if (!sceneKey || !sceneTitle) return null;
  const isAlma = sceneVoice === "alma";
  const glyph = isAlma ? "♔" : "❖";
  const color = isAlma ? "#b8956a" : "#2c5282";
  return (
    <div class="header-zone header-zone-scene" aria-label={ts("header.scene.label")}>
      <span class="header-zone-label">{ts("header.scene.label")}</span>
      <details class="header-scene-pill-wrap">
        <summary
          class="header-scene-pill"
          style={`color: ${color}; border-color: ${color};`}
          title={sceneTitle}
        >
          <span class="header-scene-glyph" aria-hidden="true">
            {glyph}
          </span>
          <span class="header-scene-title">{sceneTitle}</span>
        </summary>
        <div class="header-scene-popover">
          <a
            class="header-scene-popover-link"
            href={`/cenas/${sceneKey}/editar`}
          >
            {ts("header.scene.edit")}
          </a>
          <form
            method="POST"
            action={`/conversation/${sessionId}/clear-scene`}
            class="header-scene-popover-form"
          >
            <button type="submit" class="header-scene-popover-remove">
              {ts("header.scene.clear")}
            </button>
          </form>
        </div>
      </details>
    </div>
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
    <div class="header-zone header-zone-scope" aria-label={ts("header.context.label")}>
      <span class="header-zone-label">{ts("header.context.label")}</span>
      <div class="header-scope-list">
        <ScopePillGroup
          type="organization"
          icon="⌂"
          tagged={organizationKeys}
          available={availableOrganizations}
          sessionId={sessionId}
        />
        <ScopePillGroup
          type="journey"
          icon="↝"
          tagged={journeyKeys}
          available={availableJourneys}
          sessionId={sessionId}
        />
        {organizationKeys.length === 0 && journeyKeys.length === 0 && (
          <span class="header-scope-empty">{ts("header.context.empty")}</span>
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

  const addAria =
    type === "organization"
      ? ts("header.context.addOrganization")
      : ts("header.context.addJourney");
  const addPrompt =
    type === "organization"
      ? ts("header.context.addOrganizationPrompt")
      : ts("header.context.addJourneyPrompt");

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
        aria-label={ts("header.context.removeAria", { key })}
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
            {ts("header.context.overflowMore", { count: overflow.length })}
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
            aria-label={addAria}
            title={addAria}
          >
            {icon} +
          </summary>
          <div class="header-scope-add-panel">
            <form method="POST" action="/conversation/tag">
              <input type="hidden" name="sessionId" value={sessionId} />
              <input type="hidden" name="type" value={type} />
              <select name="key" class="header-scope-add-select" required>
                <option value="">{addPrompt}</option>
                {unpicked.map((o) => (
                  <option value={o.key}>{o.name}</option>
                ))}
              </select>
              <button type="submit" class="header-scope-add-commit">
                {ts("header.cast.add")}
              </button>
            </form>
          </div>
        </details>
      )}
    </div>
  );
};

// ─── Advanced (Mode + Length) ──────────────────────────────────────
//
// CV1.E10.S2 — both mode and length live behind a single collapsed
// disclosure ("Avançado ▾"). The summary shows compact state — both
// "auto/auto" by default, or "ensaio/breve" when configured. The user
// confirmed this trade-off: tucking mode behind a tap costs one
// click but keeps the always-visible header focused on what's
// uniquely identity-bearing (cast + scope), with both knobs only one
// disclosure away when needed.

const AdvancedZone: FC<{
  mode: string | null;
  length: string | null;
  sessionId: string;
  isAdmin: boolean;
  sessionModel: SessionModelState;
  modelCatalog?: CatalogEntry[];
}> = ({ mode, length, sessionId, isAdmin, sessionModel, modelCatalog }) => {
  const activeMode = mode ?? "auto";
  const activeLength = length ?? "auto";

  const modeOptions: { key: string; label: string; hint: string }[] = [
    { key: "auto", label: ts("header.mode.auto"), hint: ts("header.mode.autoHint") },
    { key: "conversational", label: ts("header.mode.conversational"), hint: ts("header.mode.conversationalHint") },
    { key: "compositional", label: ts("header.mode.compositional"), hint: ts("header.mode.compositionalHint") },
    { key: "essayistic", label: ts("header.mode.essayistic"), hint: ts("header.mode.essayisticHint") },
  ];
  const lengthOptions: { key: string; label: string; hint: string }[] = [
    { key: "auto", label: ts("header.length.auto"), hint: ts("header.length.autoHint") },
    { key: "brief", label: ts("header.length.brief"), hint: ts("header.length.briefHint") },
    { key: "standard", label: ts("header.length.standard"), hint: ts("header.length.standardHint") },
    { key: "full", label: ts("header.length.full"), hint: ts("header.length.fullHint") },
  ];

  const modeLabel =
    modeOptions.find((m) => m.key === activeMode)?.label ?? ts("header.mode.auto");
  const lengthLabel =
    lengthOptions.find((l) => l.key === activeLength)?.label ?? ts("header.length.auto");

  // CV1.E15.S3: when admin has a session-level model override, surface
  // a compact tail in the summary — `· <model_short>`. Short form takes
  // the substring after the last `/` of `model_id` so multi-vendor IDs
  // like "anthropic/claude-sonnet-4-6" don't blow up the pill width.
  const modelShort =
    sessionModel.id !== null
      ? sessionModel.id.split("/").pop() ?? sessionModel.id
      : null;

  // Compact summary: when all axes are auto/null, just show the zone
  // label. Otherwise compose mode/length, with the model tail when set.
  const baseSummary =
    activeMode === "auto" && activeLength === "auto"
      ? ts("header.advanced.summaryAuto")
      : `${modeLabel}/${lengthLabel}`;
  const summary = modelShort
    ? `${baseSummary} · ${modelShort}`
    : baseSummary;

  return (
    <div class="header-zone header-zone-advanced" aria-label={ts("header.advanced.aria")}>
      <span class="header-zone-label">{ts("header.advanced.label")}</span>
      <details class="header-advanced-pouch">
        <summary
          class="header-advanced-pill"
          aria-label={ts("header.advanced.changeAria")}
          title={ts("header.advanced.changeAria")}
          data-auto-label={ts("header.advanced.summaryAuto")}
        >
          {summary} ▾
        </summary>
        <div class="header-advanced-panel">
          <div class="header-advanced-row">
            <span class="header-advanced-row-label">
              {ts("header.mode.label")}
            </span>
            <form method="POST" action="/conversation/response-mode">
              <input type="hidden" name="sessionId" value={sessionId} />
              <div class="header-mode-segmented">
                {modeOptions.map((m) => (
                  <button
                    type="submit"
                    name="mode"
                    value={m.key}
                    class={`header-mode-option ${m.key === activeMode ? "header-mode-option-active" : ""}`}
                    title={m.hint}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </form>
          </div>
          <div class="header-advanced-row">
            <span class="header-advanced-row-label">
              {ts("header.length.label")}
            </span>
            <form method="POST" action="/conversation/response-length">
              <input type="hidden" name="sessionId" value={sessionId} />
              <div class="header-mode-segmented">
                {lengthOptions.map((l) => (
                  <button
                    type="submit"
                    name="length"
                    value={l.key}
                    class={`header-mode-option ${l.key === activeLength ? "header-mode-option-active" : ""}`}
                    title={l.hint}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </form>
          </div>
          {/* CV1.E15.S3: per-session model override. Admin-only — the
              row hides entirely for regular users. The form posts both
              fields together; an empty model_id clears the override
              and falls back through the resolver chain (S4 wires it). */}
          {isAdmin && modelCatalog && (
            <div class="header-advanced-row header-advanced-row-model">
              <span class="header-advanced-row-label">
                {ts("header.model.label")}
              </span>
              <form
                method="POST"
                action="/conversation/model"
                class="header-model-form"
              >
                <input type="hidden" name="sessionId" value={sessionId} />
                <input
                  type="text"
                  name="model_provider"
                  value={sessionModel.provider ?? ""}
                  placeholder={ts("header.model.providerPlaceholder")}
                  class="header-model-provider"
                  list="header-model-providers"
                  autocomplete="off"
                />
                <datalist id="header-model-providers">
                  <option value="openrouter" />
                </datalist>
                <ModelPicker
                  name="model_id"
                  value={sessionModel.id ?? ""}
                  catalog={modelCatalog}
                  listId="header-model-catalog"
                  className="header-model-id"
                />
                <button type="submit" class="header-model-save">
                  {ts("header.model.save")}
                </button>
              </form>
              <p class="header-model-hint">{ts("header.model.hint")}</p>
            </div>
          )}
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
        aria-label={ts("header.menu.aria")}
        title={ts("header.menu.aria")}
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
            {ts("header.menu.newTopic")}
          </button>
        </form>
        {isAdmin && (
          <button
            type="button"
            class="header-menu-item header-menu-item-link"
            data-toggle="rail"
          >
            {ts("header.menu.lookInside")}
          </button>
        )}
        <form
          method="POST"
          action="/conversation/forget"
          class="header-menu-form"
        >
          <input type="hidden" name="sessionId" value={sessionId} />
          <button
            type="submit"
            class="header-menu-item header-menu-item-danger"
            onclick={`return confirm('${ts("header.menu.forgetConfirm").replace(/'/g, "\\'")}')`}
          >
            {ts("header.menu.forget")}
          </button>
        </form>
      </div>
    </details>
  );
};
