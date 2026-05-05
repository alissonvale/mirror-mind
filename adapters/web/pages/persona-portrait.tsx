import type { FC } from "hono/jsx";
import { raw } from "hono/html";
import type { User } from "../../../server/db.js";
import type {
  PersonaPortrait,
  PersonaJourneyItem,
} from "../../../server/portraits/persona-synthesis.js";
import { TopBarLayout } from "./avatar-top-bar.js";
import { ts } from "../i18n.js";
import {
  NumericTilesRow,
  ConversationsSection,
  PortraitClose,
  PortraitFooter,
  PORTRAIT_STYLES,
} from "./portrait-shared.js";

/**
 * Persona portrait — read view for a persona/voice (CV1.E13.S4).
 *
 * Lives at `/personas/<key>`. The form moves to
 * `/personas/<key>/{editar,edit}` (locale-aware). The legacy
 * `/map/persona/<key>` URL still serves the form for backward compat.
 *
 * Diverges from journey/org/scene portraits in two named ways:
 *   - Accent color is **per-row** (`identity.color`), not axis-fixed.
 *     Each persona has its own voice color across the system; the
 *     portrait completes the coherence.
 *   - Two new editorial sections: "POSTURA" (extracted from the
 *     `## Postura` markdown section, rendered as flowing prose) and
 *     "ANTI-PADRÕES" (extracted from `## Anti-padrões`, rendered as
 *     a deliberately austere bullet list).
 */
export const PersonaPortraitPage: FC<{
  user: User;
  /** The persona key (used for the page title — this is the only
   *  portrait whose title is the entity key, not a separate `name`
   *  field, because personas don't carry a separate display name). */
  personaKey: string;
  portrait: PersonaPortrait;
  editPath: string;
}> = ({ user, personaKey, portrait, editPath }) => {
  return (
    <TopBarLayout title={personaKey} user={user}>
      <style>{raw(PORTRAIT_STYLES)}</style>
      <style>{raw(personaAccent(portrait.color))}</style>

      <div class="portrait-shell" data-entity="persona">
        <header class="portrait-header">
          <h1 class="portrait-title">{personaKey}</h1>
          <a
            href={editPath}
            class="portrait-edit-link-top"
            aria-label={ts("portrait.editLink.persona")}
          >
            {ts("portrait.editTopLabel")}
          </a>
        </header>

        {portrait.lede !== null ? (
          <div class="portrait-lede-block">
            <p class="portrait-lede">{portrait.lede}</p>
          </div>
        ) : null}

        <NumericTilesRow tiles={portrait.tiles} />

        <WhereItAppearsSection portrait={portrait} />
        <PostureSection portrait={portrait} />
        <AntipatternsSection portrait={portrait} />
        <ConversationsSection
          conversations={portrait.conversations}
          conversationsEmpty={portrait.conversationsEmpty}
          emptyStateKey="portrait.noConversationsYetPersona"
        />

        <PortraitClose close={portrait.close} />
        <PortraitFooter
          startedAt={portrait.startedAt}
          daysSinceUpdate={portrait.daysSinceUpdate}
          silenceMonths={portrait.silenceMonths}
          editPath={editPath}
          editLabel={ts("portrait.editLink.persona")}
        />
      </div>
    </TopBarLayout>
  );
};

const WhereItAppearsSection: FC<{ portrait: PersonaPortrait }> = ({
  portrait,
}) => {
  const w = portrait.whereItAppears;
  if (w.journeys.length === 0 && w.scenes.length === 0) return null;
  return (
    <section class="portrait-section">
      <h2 class="portrait-section-title">{ts("portrait.whereItAppears")}</h2>
      <div class="portrait-adjacencies">
        {w.journeys.map((j: PersonaJourneyItem) => (
          <div class="portrait-adj-line">
            <span class="portrait-adj-glyph">↝</span>
            <a href={`/journeys/${j.key}`} class="portrait-adj-link">
              {j.name}
            </a>
            <span class="portrait-adj-descriptor">
              {" · "}
              {ts(`portrait.journeyStatus.${j.status}`)}
              {" · "}
              {j.daysSinceLast === 0
                ? ts("portrait.recencyToday")
                : ts("portrait.recencyDays", { n: j.daysSinceLast })}
            </span>
          </div>
        ))}
        {w.scenes.map((s) => (
          <div class="portrait-adj-line">
            <span class="portrait-adj-glyph">❖</span>
            <a href={`/cenas/${s.key}`} class="portrait-adj-link">
              {s.title}
            </a>
          </div>
        ))}
      </div>
    </section>
  );
};

const PostureSection: FC<{ portrait: PersonaPortrait }> = ({ portrait }) => {
  if (portrait.posture === null || portrait.posture.length === 0) return null;
  return (
    <section class="portrait-section">
      <h2 class="portrait-section-title">{ts("portrait.posture")}</h2>
      <div class="portrait-posture">
        {portrait.posture.map((paragraph) => (
          <p class="portrait-posture-paragraph">{paragraph}</p>
        ))}
      </div>
    </section>
  );
};

const AntipatternsSection: FC<{ portrait: PersonaPortrait }> = ({
  portrait,
}) => {
  if (portrait.antipatterns === null || portrait.antipatterns.length === 0)
    return null;
  return (
    <section class="portrait-section">
      <h2 class="portrait-section-title">{ts("portrait.antipatterns")}</h2>
      <ul class="portrait-antipatterns">
        {portrait.antipatterns.map((line) => (
          <li class="portrait-antipattern-item">{line}</li>
        ))}
      </ul>
    </section>
  );
};

/**
 * Per-row accent — each persona ships its own color. CSS variables
 * scoped under `[data-entity="persona"]` so other portraits keep their
 * axis-fixed accents.
 */
function personaAccent(color: string): string {
  return `
  .portrait-shell[data-entity="persona"] {
    --portrait-accent: ${color};
  }
  .portrait-shell[data-entity="persona"] .portrait-tile-number {
    color: ${color};
  }

  /* Posture — flowing prose, paragraphs separated, slightly tighter
     leading than body. */
  .portrait-posture-paragraph {
    margin: 0 0 0.9rem 0;
    line-height: 1.7;
  }
  .portrait-posture-paragraph:last-child { margin-bottom: 0; }

  /* Anti-patterns — austere list. Marker is "·" in muted color, no
     number, no decoration. The "what I don't do" texture is the point. */
  .portrait-antipatterns {
    list-style: none;
    padding-left: 0;
    margin: 0;
  }
  .portrait-antipattern-item {
    padding-left: 1.2rem;
    position: relative;
    color: #4a5568;
    line-height: 1.6;
    margin: 0.35rem 0;
  }
  .portrait-antipattern-item::before {
    content: "·";
    position: absolute;
    left: 0.4rem;
    color: var(--portrait-accent, #a0aec0);
    font-weight: 600;
  }
  `;
}
