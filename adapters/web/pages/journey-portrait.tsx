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
import {
  PortraitLede,
  NumericTilesRow,
  ConversationsSection,
  PortraitClose,
  PortraitFooter,
  PORTRAIT_STYLES,
  editPathFor,
} from "./portrait-shared.js";

export { editPathFor };

/**
 * Journey portrait — read view that replaces the CRUD form as the default
 * landing for `/journeys/<key>` (CV1.E13.S1). The form moves to
 * `/journeys/<key>/editar` (locale-aware: `/edit` for `en`).
 *
 * Shared building blocks (lede, tiles, conversations, close, footer)
 * live in `portrait-shared.tsx` and are reused by the org portrait
 * (CV1.E13.S2) and future scene portrait (S3). Sections specific to
 * journeys — "Onde ela mora", structural section (cenários | frentes),
 * "A pergunta viva" — live here.
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
        <header class="portrait-header">
          <h1 class="portrait-title">{portrait.name}</h1>
          <a
            href={editPath}
            class="portrait-edit-link-top"
            aria-label={ts("portrait.editLink.journey")}
          >
            {ts("portrait.editTopLabel")}
          </a>
        </header>

        <PortraitLede text={portrait.lede.text} />
        <NumericTilesRow tiles={portrait.tiles} />
        <WhereItLivesSection portrait={portrait} />
        <StructuralSection portrait={portrait} />
        <LiveQuestionSection portrait={portrait} />
        <ConversationsSection
          conversations={portrait.conversations}
          conversationsEmpty={portrait.conversationsEmpty}
          emptyStateKey="portrait.noConversationsYet"
        />
        <PortraitClose close={portrait.close} />
        <PortraitFooter
          startedAt={portrait.startedAt}
          daysSinceUpdate={portrait.daysSinceUpdate}
          silenceMonths={portrait.silenceMonths}
          editPath={editPath}
          editLabel={ts("portrait.editLink.journey")}
        />
      </div>
    </TopBarLayout>
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
            <a href={`/personas/${w.persona.key}`} class="portrait-adj-link">
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
