import type { FC } from "hono/jsx";
import { ts } from "../i18n.js";

/**
 * Shared portrait building blocks (CV1.E13). Components and styles
 * common to journey, organization, and scene portraits live here so
 * the per-entity pages stay focused on what's unique (sections that
 * differ by entity type, like "Onde ela mora" for journeys vs
 * "Quem passa por aqui" for orgs).
 */

// --- Types ------------------------------------------------------------

export interface NumericTile {
  number: string;
  label: string;
}

export interface ConversationItem {
  sessionId: string;
  title: string;
  date: number;
  citableLine: string | null;
}

export interface CloseBlock {
  text: string;
  source: "briefing" | "situation" | "last-conversation";
}

// --- Components -------------------------------------------------------

export const PortraitLede: FC<{ text: string | null }> = ({ text }) => {
  if (text === null) return null;
  return (
    <div class="portrait-lede-block">
      <p class="portrait-lede">{text}</p>
    </div>
  );
};

export const NumericTilesRow: FC<{ tiles: NumericTile[] }> = ({ tiles }) => {
  if (tiles.length === 0) return null;
  return (
    <div class="portrait-tiles">
      {tiles.map((tile) => (
        <div class="portrait-tile">
          <div class="portrait-tile-number">{tile.number}</div>
          <div class="portrait-tile-label">{tile.label}</div>
        </div>
      ))}
    </div>
  );
};

export const ConversationsSection: FC<{
  conversations: ConversationItem[];
  conversationsEmpty: boolean;
  /** i18n key for the empty-state copy. Varies per entity type:
   *  portrait.noConversationsYet (journey),
   *  portrait.noConversationsYetOrg, portrait.noConversationsYetScene. */
  emptyStateKey: string;
}> = ({ conversations, conversationsEmpty, emptyStateKey }) => {
  return (
    <section class="portrait-section">
      <h2 class="portrait-section-title">
        {ts("portrait.conversationsThatShaped")}
      </h2>
      {conversationsEmpty ? (
        <p class="portrait-empty-state">{ts(emptyStateKey)}</p>
      ) : (
        <div class="portrait-conversations">
          {conversations.map((conv) => (
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

export const PortraitClose: FC<{ close: CloseBlock | null }> = ({ close }) => {
  if (close === null) return null;
  return (
    <div class="portrait-close-block">
      <p class="portrait-close">{close.text}</p>
    </div>
  );
};

export const PortraitFooter: FC<{
  startedAt: number;
  daysSinceUpdate: number;
  silenceMonths: number | null;
  editPath: string;
  editLabel: string;
}> = ({ startedAt, daysSinceUpdate, silenceMonths, editPath, editLabel }) => {
  return (
    <footer class="portrait-footer">
      <div class="portrait-footer-meta">
        {ts("portrait.startedIn", { date: formatMonthYear(startedAt) })}
        {" · "}
        {silenceMonths !== null
          ? ts("portrait.silenceFor", { n: silenceMonths })
          : ts("portrait.lastUpdate", {
              relative: humanizeRelative(daysSinceUpdate),
            })}
      </div>
      <a href={editPath} class="portrait-edit-link">
        {editLabel}
      </a>
    </footer>
  );
};

// --- Helpers ----------------------------------------------------------

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

const MONTHS = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

function formatMonthYear(timestamp: number): string {
  const d = new Date(timestamp);
  return `${MONTHS[d.getMonth()]}/${d.getFullYear()}`;
}

export function formatDateShort(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getDate().toString().padStart(2, "0")} ${MONTHS[d.getMonth()]}`;
}

function humanizeRelative(days: number): string {
  if (days === 0) return "hoje";
  if (days === 1) return "1 dia";
  if (days < 30) return `${days} dias`;
  const months = Math.floor(days / 30);
  if (months === 1) return "1 mês";
  return `${months} meses`;
}

// --- Shared styles ----------------------------------------------------

/**
 * Shared CSS for portrait pages. Each entity-specific page injects
 * this once via `raw(PORTRAIT_STYLES)` plus any per-entity accent
 * overrides (e.g., the org portrait flips the strip color from teal
 * to warm-amber).
 */
export const PORTRAIT_STYLES = `
  /* Outer width matches the system's 980px (workshops, lists, /espelho).
     Prose blocks carry an inner reading column at 720px so line length
     stays comfortable for serif italic. */
  .portrait-shell {
    max-width: 980px;
    margin: 1.5rem auto 4rem;
    padding: 0 1.5rem;
    color: var(--text, #2d3748);
    font-size: 0.95rem;
    line-height: 1.6;
  }

  .portrait-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    border-left: 3px solid var(--portrait-accent, #7c9aa0);
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
    border-left: 3px solid var(--portrait-accent, #7c9aa0);
    padding: 0 1.25rem;
    margin: 0.5rem 0 2rem;
    max-width: 720px;
  }
  .portrait-lede {
    font-family: "EB Garamond", Georgia, serif;
    font-style: italic;
    font-size: 1.15rem;
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
  .portrait-tile { flex: 0 0 auto; min-width: 140px; }
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
    max-width: 720px;
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
    color: var(--portrait-accent, #7c9aa0);
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
    color: var(--portrait-accent, #7c9aa0);
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
    max-width: 720px;
  }
  .portrait-close {
    font-family: "EB Garamond", Georgia, serif;
    font-style: italic;
    font-size: 1.1rem;
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
    max-width: 720px;
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

  /* Nested journeys list (org portrait). Compact rows with status +
     recency, indented under "Travessias filhas:". */
  .portrait-nested-list {
    margin: 0.4rem 0 1rem 0;
    line-height: 1.9;
  }
  .portrait-nested-label {
    color: var(--muted, #718096);
    font-size: 0.88rem;
    font-style: italic;
    margin-bottom: 0.2rem;
  }
  .portrait-nested-line {
    display: flex;
    gap: 0.5rem;
    align-items: baseline;
    margin-left: 0.5rem;
  }
  .portrait-nested-marker {
    color: var(--portrait-accent, #7c9aa0);
  }
  .portrait-nested-link {
    color: #2c5282;
    text-decoration: none;
    font-weight: 500;
  }
  .portrait-nested-link:hover { text-decoration: underline; }
  .portrait-nested-meta {
    color: var(--muted, #a0aec0);
    font-size: 0.85rem;
  }
`;
