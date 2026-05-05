import type { FC } from "hono/jsx";
import { raw } from "hono/html";
import type { User } from "../../../server/db.js";
import type {
  JourneyPortrait,
  ScenarioItem,
  FrontItem,
} from "../../../server/portraits/journey-synthesis.js";
import { TopBarLayout } from "./avatar-top-bar.js";
import { ts } from "../i18n.js";

/**
 * Journey portrait — read view that replaces the CRUD form as the default
 * landing for `/journeys/<key>` (CV1.E13.S1). The form moves to
 * `/journeys/<key>/editar` (locale-aware: `/edit` for `en`).
 *
 * Editorial reference (acceptance criteria) lives at
 * `docs/design/entity-profiles.md` — three reference drafts must be
 * reproducible from the underlying data.
 *
 * Sections render conditionally on what the journey carries. A travessia
 * with no anchored cena says so explicitly; a travessia with no
 * conversations says so explicitly. The page assembles from data, not
 * from a fixed template.
 */
export const JourneyPortraitPage: FC<{
  user: User;
  portrait: JourneyPortrait;
  /** Locale-aware path to the form (`/journeys/<key>/editar` | `/edit`). */
  editPath: string;
}> = ({ user, portrait, editPath }) => {
  return (
    <TopBarLayout title={portrait.name} user={user}>
      <style>{raw(PORTRAIT_STYLES)}</style>

      <div class="portrait-shell" data-entity="journey">
        <PortraitHeader name={portrait.name} editPath={editPath} />
        <PortraitLede portrait={portrait} />
        <NumericTilesRow portrait={portrait} />
        <WhereItLivesSection portrait={portrait} />
        <StructuralSection portrait={portrait} />
        <LiveQuestionSection portrait={portrait} />
        <ConversationsSection portrait={portrait} />
        <PortraitClose portrait={portrait} />
        <PortraitFooter portrait={portrait} editPath={editPath} />
      </div>
    </TopBarLayout>
  );
};

const PortraitHeader: FC<{ name: string; editPath: string }> = ({
  name,
  editPath,
}) => (
  <header class="portrait-header">
    <h1 class="portrait-title">{name}</h1>
    <a href={editPath} class="portrait-edit-link-top" aria-label={ts("portrait.editLink.journey")}>
      {ts("portrait.editTopLabel")}
    </a>
  </header>
);

const PortraitLede: FC<{ portrait: JourneyPortrait }> = ({ portrait }) => {
  if (portrait.lede.text === null) return null;
  return (
    <div class="portrait-lede-block">
      <p class="portrait-lede">{portrait.lede.text}</p>
    </div>
  );
};

const NumericTilesRow: FC<{ portrait: JourneyPortrait }> = ({ portrait }) => {
  if (portrait.tiles.length === 0) return null;
  return (
    <div class="portrait-tiles">
      {portrait.tiles.map((tile) => (
        <div class="portrait-tile">
          <div class="portrait-tile-number">{tile.number}</div>
          <div class="portrait-tile-label">{tile.label}</div>
        </div>
      ))}
    </div>
  );
};

const WhereItLivesSection: FC<{ portrait: JourneyPortrait }> = ({ portrait }) => {
  const w = portrait.whereItLives;
  if (
    w.org === null &&
    w.persona === null &&
    w.scene === null &&
    w.parenthetical === null
  ) {
    return null;
  }
  return (
    <section class="portrait-section">
      <h2 class="portrait-section-title">{ts("portrait.whereItLives")}</h2>
      <div class="portrait-adjacencies">
        {w.org !== null && (
          <div class="portrait-adj-line">
            <span class="portrait-adj-glyph">⌂</span>
            <a href={`/organizations/${w.org.key}`} class="portrait-adj-link">
              {w.org.name}
            </a>
          </div>
        )}
        {w.persona !== null && (
          <div class="portrait-adj-line">
            <span class="portrait-adj-glyph">◇</span>
            <a href={`/map/persona/${w.persona.key}`} class="portrait-adj-link">
              {w.persona.key}
            </a>
            {w.persona.descriptor !== null && (
              <span class="portrait-adj-descriptor">{w.persona.descriptor}</span>
            )}
          </div>
        )}
        {w.scene !== null && (
          <div class="portrait-adj-line">
            <span class="portrait-adj-glyph">❖</span>
            <a href={`/cenas/${w.scene.key}`} class="portrait-adj-link">
              {w.scene.title}
            </a>
          </div>
        )}
        {w.parenthetical !== null && (
          <p class="portrait-parenthetical">({w.parenthetical})</p>
        )}
      </div>
    </section>
  );
};

const StructuralSection: FC<{ portrait: JourneyPortrait }> = ({ portrait }) => {
  const s = portrait.structuralSection;
  if (s === null) return null;
  if (s.kind === "scenarios") {
    return (
      <section class="portrait-section">
        <h2 class="portrait-section-title">{ts("portrait.threeScenarios")}</h2>
        <div class="portrait-list">
          {s.items.map((item: ScenarioItem) => (
            <div class="portrait-list-item">
              <div class="portrait-list-item-head">
                <span class="portrait-list-marker">{item.letter}</span>
                <span class="portrait-list-title">·  {item.title}</span>
              </div>
              {item.body && <p class="portrait-list-body">{item.body}</p>}
            </div>
          ))}
        </div>
      </section>
    );
  }
  return (
    <section class="portrait-section">
      <h2 class="portrait-section-title">{ts("portrait.threeLiveFronts")}</h2>
      <div class="portrait-list">
        {s.items.map((item: FrontItem) => (
          <div class="portrait-list-item">
            <div class="portrait-list-item-head">
              <span class="portrait-list-marker">·</span>
              <span class="portrait-list-title">{item.title}</span>
            </div>
            {item.body && <p class="portrait-list-body">{item.body}</p>}
          </div>
        ))}
      </div>
    </section>
  );
};

const LiveQuestionSection: FC<{ portrait: JourneyPortrait }> = ({ portrait }) => {
  if (portrait.liveQuestion === null) return null;
  return (
    <section class="portrait-section">
      <h2 class="portrait-section-title">{ts("portrait.theLiveQuestion")}</h2>
      <p class="portrait-question-primary">{portrait.liveQuestion.primary}</p>
      {portrait.liveQuestion.confessionalLayer !== null && (
        <p class="portrait-question-confessional">
          {portrait.liveQuestion.confessionalLayer}
        </p>
      )}
    </section>
  );
};

const ConversationsSection: FC<{ portrait: JourneyPortrait }> = ({ portrait }) => {
  return (
    <section class="portrait-section">
      <h2 class="portrait-section-title">{ts("portrait.conversationsThatShaped")}</h2>
      {portrait.conversationsEmpty ? (
        <p class="portrait-empty-state">{ts("portrait.noConversationsYet")}</p>
      ) : (
        <div class="portrait-conversations">
          {portrait.conversations.map((conv) => (
            <a
              href={`/conversation/${conv.sessionId}`}
              class="portrait-conv-item"
            >
              <div class="portrait-conv-head">
                <span class="portrait-conv-title">{conv.title}</span>
                <span class="portrait-conv-date">
                  {formatDateShort(conv.date)}
                </span>
              </div>
              {conv.citableLine !== null && (
                <p class="portrait-conv-quote">❝ {conv.citableLine} ❞</p>
              )}
            </a>
          ))}
        </div>
      )}
    </section>
  );
};

const PortraitClose: FC<{ portrait: JourneyPortrait }> = ({ portrait }) => {
  if (portrait.close === null) return null;
  return (
    <div class="portrait-close-block">
      <p class="portrait-close">{portrait.close.text}</p>
    </div>
  );
};

const PortraitFooter: FC<{
  portrait: JourneyPortrait;
  editPath: string;
}> = ({ portrait, editPath }) => {
  return (
    <footer class="portrait-footer">
      <div class="portrait-footer-meta">
        {ts("portrait.startedIn", {
          date: formatMonthYear(portrait.startedAt),
        })}
        {" · "}
        {portrait.silenceMonths !== null
          ? ts("portrait.silenceFor", { n: portrait.silenceMonths })
          : ts("portrait.lastUpdate", {
              relative: humanizeRelative(portrait.daysSinceUpdate),
            })}
      </div>
      <a href={editPath} class="portrait-edit-link">
        {ts("portrait.editLink.journey")}
      </a>
    </footer>
  );
};

/**
 * Locale-aware path to the form for an entity.
 *  `pt-BR` → `/<entity>/<key>/editar`
 *  everything else → `/<entity>/<key>/edit`
 *
 * Both paths are accepted by the route handler; the locale only decides
 * which one is rendered as the canonical URL inside the page.
 */
export function editPathFor(
  entity: "journeys" | "organizations" | "cenas",
  key: string,
  locale: string,
): string {
  const slug = locale === "pt-BR" ? "editar" : "edit";
  return `/${entity}/${key}/${slug}`;
}

// --- Formatters -------------------------------------------------------

function formatMonthYear(timestamp: number): string {
  const d = new Date(timestamp);
  // pt-BR-ish abbreviation; keeps deterministic across locales.
  // Refined locale-aware formatting can land in a follow-up.
  const months = [
    "jan", "fev", "mar", "abr", "mai", "jun",
    "jul", "ago", "set", "out", "nov", "dez",
  ];
  return `${months[d.getMonth()]}/${d.getFullYear()}`;
}

function formatDateShort(timestamp: number): string {
  const d = new Date(timestamp);
  const months = [
    "jan", "fev", "mar", "abr", "mai", "jun",
    "jul", "ago", "set", "out", "nov", "dez",
  ];
  return `${d.getDate().toString().padStart(2, "0")} ${months[d.getMonth()]}`;
}

function humanizeRelative(days: number): string {
  if (days === 0) return "hoje";
  if (days === 1) return "1 dia";
  if (days < 30) return `${days} dias`;
  const months = Math.floor(days / 30);
  if (months === 1) return "1 mês";
  return `${months} meses`;
}

const PORTRAIT_STYLES = `
  .portrait-shell {
    max-width: 640px;
    margin: 2rem auto 4rem;
    padding: 0 1.5rem;
    color: var(--text, #2d3748);
    font-size: 0.95rem;
    line-height: 1.6;
  }

  .portrait-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    border-left: 3px solid #7c9aa0;
    padding-left: 1.25rem;
    margin-bottom: 1.5rem;
  }
  .portrait-title {
    font-family: "EB Garamond", Georgia, serif;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    font-size: 1.3rem;
    margin: 0;
  }
  .portrait-edit-link-top {
    font-size: 0.8rem;
    color: var(--muted, #a0aec0);
    text-decoration: none;
  }
  .portrait-edit-link-top:hover {
    color: var(--text, #2d3748);
  }

  .portrait-lede-block {
    border-left: 3px solid #7c9aa0;
    padding: 0 1.25rem;
    margin: 0.5rem 0 2rem;
  }
  .portrait-lede {
    font-family: "EB Garamond", Georgia, serif;
    font-style: italic;
    font-size: 1.1rem;
    line-height: 1.7;
    color: #2d3748;
    margin: 0;
  }

  .portrait-tiles {
    display: flex;
    gap: 2.5rem;
    margin: 2rem 0 3rem;
    padding-left: 1.25rem;
  }
  .portrait-tile { flex: 1 1 0; }
  .portrait-tile-number {
    font-family: "EB Garamond", Georgia, serif;
    font-size: 1.6rem;
    color: #2c5282;
    line-height: 1.1;
  }
  .portrait-tile-label {
    font-size: 0.75rem;
    color: var(--muted, #718096);
    margin-top: 0.3rem;
    line-height: 1.3;
    letter-spacing: 0.02em;
  }

  .portrait-section {
    margin: 2.5rem 0;
  }
  .portrait-section-title {
    font-size: 0.7rem;
    color: var(--muted, #718096);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    font-weight: 600;
    margin: 0 0 1rem 0;
  }

  .portrait-adjacencies {
    line-height: 1.9;
  }
  .portrait-adj-line {
    display: flex;
    gap: 0.6rem;
    align-items: baseline;
    margin: 0.2rem 0;
  }
  .portrait-adj-glyph {
    color: #7c9aa0;
    width: 1rem;
    display: inline-block;
  }
  .portrait-adj-link {
    color: #2c5282;
    text-decoration: none;
    font-weight: 500;
  }
  .portrait-adj-link:hover { text-decoration: underline; }
  .portrait-adj-descriptor {
    color: var(--muted, #718096);
    font-size: 0.88rem;
    margin-left: 0.6rem;
  }
  .portrait-parenthetical {
    margin-top: 0.6rem;
    font-style: italic;
    color: var(--muted, #718096);
    font-size: 0.9rem;
  }

  .portrait-list-item {
    margin: 0.8rem 0 1rem 0;
  }
  .portrait-list-item-head {
    display: flex;
    gap: 0.4rem;
    align-items: baseline;
  }
  .portrait-list-marker {
    color: #7c9aa0;
    font-weight: 600;
  }
  .portrait-list-title {
    font-weight: 500;
  }
  .portrait-list-body {
    margin: 0.3rem 0 0 1.5rem;
    color: #4a5568;
    font-size: 0.92rem;
    line-height: 1.6;
  }

  .portrait-question-primary {
    margin: 0 0 1rem 0;
    line-height: 1.7;
  }
  .portrait-question-confessional {
    color: #4a5568;
    font-size: 0.94rem;
    line-height: 1.65;
    margin: 0;
  }

  .portrait-empty-state {
    font-family: "EB Garamond", Georgia, serif;
    font-style: italic;
    color: var(--muted, #718096);
    line-height: 1.7;
    margin: 0;
  }

  .portrait-conv-item {
    display: block;
    text-decoration: none;
    color: inherit;
    margin: 1rem 0;
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--border, #edf2f7);
  }
  .portrait-conv-item:last-child { border-bottom: none; }
  .portrait-conv-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }
  .portrait-conv-title { font-weight: 500; }
  .portrait-conv-date {
    color: var(--muted, #a0aec0);
    font-size: 0.85rem;
  }
  .portrait-conv-quote {
    font-family: "EB Garamond", Georgia, serif;
    font-style: italic;
    color: #4a5568;
    margin: 0.4rem 0 0 0;
    line-height: 1.7;
  }

  .portrait-close-block {
    margin: 4rem 0 3rem;
    text-align: center;
  }
  .portrait-close {
    font-family: "EB Garamond", Georgia, serif;
    font-style: italic;
    font-size: 1.05rem;
    color: #2d3748;
    line-height: 1.7;
    max-width: 480px;
    margin: 0 auto;
  }

  .portrait-footer {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-top: 3rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border, #edf2f7);
    font-size: 0.82rem;
  }
  .portrait-footer-meta {
    color: var(--muted, #a0aec0);
  }
  .portrait-edit-link {
    color: var(--muted, #a0aec0);
    text-decoration: none;
  }
  .portrait-edit-link:hover {
    color: var(--text, #2d3748);
  }
`;
