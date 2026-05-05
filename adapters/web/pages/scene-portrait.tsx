import type { FC } from "hono/jsx";
import { raw } from "hono/html";
import type { User } from "../../../server/db.js";
import type {
  ScenePortrait,
  ScenePersonaItem,
} from "../../../server/portraits/scene-synthesis.js";
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
 * Scene portrait — read view that lives at `/cenas/<key>` (CV1.E13.S3).
 *
 * Cenas are declarative — they describe a kind of moment, not a story.
 * The portrait reflects that:
 *   - The briefing IS the lede (no diagnosis-extraction heuristic).
 *   - "QUANDO ELA ACONTECE" surfaces `temporal_pattern`.
 *   - "ELENCO" bifurcates by voice: persona-voiced cenas list cast
 *     personas; alma-voiced cenas render a ♔ Voz da Alma indicator.
 *   - Empty briefing renders a stub block with the voice glyph in
 *     display position (♔ for alma, otherwise muted).
 *
 * Visual silhouette: plum accent (`#9a8ba0`, the /espelho Vivo-pane
 * palette) — distinct from journey teal and org warm-amber.
 */
export const ScenePortraitPage: FC<{
  user: User;
  portrait: ScenePortrait;
  /** Locale-aware path to the form (`/cenas/<key>/editar` | `/edit`). */
  editPath: string;
}> = ({ user, portrait, editPath }) => {
  const isAlma = portrait.cast.kind === "alma";
  return (
    <TopBarLayout title={portrait.title} user={user}>
      <style>{raw(PORTRAIT_STYLES)}</style>
      <style>{raw(SCENE_ACCENT)}</style>

      <div class="portrait-shell" data-entity="scene" data-voice={isAlma ? "alma" : "persona"}>
        <header class="portrait-header">
          <h1 class="portrait-title">{portrait.title}</h1>
          <a
            href={editPath}
            class="portrait-edit-link-top"
            aria-label={ts("portrait.editLink.scene")}
          >
            {ts("portrait.editTopLabel")}
          </a>
        </header>

        {portrait.lede !== null ? (
          <div class="portrait-lede-block">
            <p class="portrait-lede">{portrait.lede}</p>
          </div>
        ) : (
          <SceneEmptyLede isAlma={isAlma} />
        )}

        <NumericTilesRow tiles={portrait.tiles} />

        <TemporalPatternSection portrait={portrait} />
        <CastSection portrait={portrait} />
        <TerritorySection portrait={portrait} />

        <ConversationsSection
          conversations={portrait.conversations}
          conversationsEmpty={portrait.conversationsEmpty}
          emptyStateKey="portrait.noConversationsYetScene"
        />

        <PortraitClose close={portrait.close} />
        <PortraitFooter
          startedAt={portrait.startedAt}
          daysSinceUpdate={portrait.daysSinceUpdate}
          silenceMonths={portrait.silenceMonths}
          editPath={editPath}
          editLabel={ts("portrait.editLink.scene")}
        />
      </div>
    </TopBarLayout>
  );
};

/**
 * Stub block when the cena has no briefing yet (auto-seeded Voz da
 * Alma cenas, freshly stub-created cenas via the form). Glyph in
 * display position; one italic line inviting the user to author the
 * briefing.
 */
const SceneEmptyLede: FC<{ isAlma: boolean }> = ({ isAlma }) => (
  <div class="portrait-scene-stub">
    <div class={`portrait-scene-stub-glyph${isAlma ? " portrait-scene-stub-glyph-alma" : ""}`}>
      {isAlma ? "♔" : "❖"}
    </div>
    <p class="portrait-scene-stub-text">
      {ts(
        isAlma
          ? "portrait.sceneStubAlma"
          : "portrait.sceneStubPersona",
      )}
    </p>
  </div>
);

const TemporalPatternSection: FC<{ portrait: ScenePortrait }> = ({
  portrait,
}) => {
  if (portrait.temporalPattern === null) return null;
  return (
    <section class="portrait-section">
      <h2 class="portrait-section-title">{ts("portrait.whenItHappens")}</h2>
      <p class="portrait-temporal">{portrait.temporalPattern}</p>
    </section>
  );
};

const CastSection: FC<{ portrait: ScenePortrait }> = ({ portrait }) => {
  if (portrait.cast.kind === "alma") {
    return (
      <section class="portrait-section">
        <h2 class="portrait-section-title">{ts("portrait.cast")}</h2>
        <div class="portrait-adj-line">
          <span class="portrait-cast-alma-glyph">♔</span>
          <span class="portrait-cast-alma-label">
            {ts("portrait.castAlma")}
          </span>
          <span class="portrait-adj-descriptor">
            {ts("portrait.castAlmaDescriptor")}
          </span>
        </div>
      </section>
    );
  }
  if (portrait.cast.personas.length === 0) return null;
  return (
    <section class="portrait-section">
      <h2 class="portrait-section-title">{ts("portrait.cast")}</h2>
      <div class="portrait-adjacencies">
        {portrait.cast.personas.map((p: ScenePersonaItem) => (
          <div class="portrait-adj-line">
            <span class="portrait-adj-glyph">◇</span>
            <a href={`/personas/${p.key}`} class="portrait-adj-link">
              {p.key}
            </a>
            {p.descriptor !== null && (
              <span class="portrait-adj-descriptor">{p.descriptor}</span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};

const TerritorySection: FC<{ portrait: ScenePortrait }> = ({ portrait }) => {
  const t = portrait.territory;
  if (t.org === null && t.journey === null) return null;
  return (
    <section class="portrait-section">
      <h2 class="portrait-section-title">{ts("portrait.inWhichTerritory")}</h2>
      <div class="portrait-adjacencies">
        {t.org !== null && (
          <div class="portrait-adj-line">
            <span class="portrait-adj-glyph">⌂</span>
            <a href={`/organizations/${t.org.key}`} class="portrait-adj-link">
              {t.org.name}
            </a>
          </div>
        )}
        {t.journey !== null && (
          <div class="portrait-adj-line">
            <span class="portrait-adj-glyph">↝</span>
            <a href={`/journeys/${t.journey.key}`} class="portrait-adj-link">
              {t.journey.name}
            </a>
          </div>
        )}
      </div>
    </section>
  );
};

const SCENE_ACCENT = `
  .portrait-shell[data-entity="scene"] {
    --portrait-accent: #9a8ba0;
  }
  .portrait-shell[data-entity="scene"] .portrait-tile-number {
    color: #6b5a72;
  }

  /* Stub block — when the cena has no briefing. The glyph sits in
     display position (similar to the espelho's drop-cap gesture), an
     italic line invites the user to author. */
  .portrait-scene-stub {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    margin: 2rem 0 3rem;
    max-width: 720px;
  }
  .portrait-scene-stub-glyph {
    font-family: "EB Garamond", Georgia, serif;
    font-size: 3rem;
    color: var(--portrait-accent, #9a8ba0);
    line-height: 1;
    margin-bottom: 1rem;
  }
  .portrait-scene-stub-glyph-alma {
    color: #b8956a;
  }
  .portrait-scene-stub-text {
    font-family: "EB Garamond", Georgia, serif;
    font-style: italic;
    color: var(--muted, #718096);
    line-height: 1.7;
    margin: 0;
  }

  /* Temporal pattern — italic, larger than body, single line. */
  .portrait-temporal {
    font-family: "EB Garamond", Georgia, serif;
    font-style: italic;
    font-size: 1.05rem;
    color: #2d3748;
    margin: 0;
    line-height: 1.6;
  }

  /* Voz da Alma cast indicator — warm-amber glyph, label slightly
     emphasized. */
  .portrait-cast-alma-glyph {
    color: #b8956a;
    width: 1rem;
    display: inline-block;
    font-size: 1rem;
  }
  .portrait-cast-alma-label {
    font-weight: 500;
    color: #2d3748;
  }
`;
