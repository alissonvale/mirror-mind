import type { FC } from "hono/jsx";
import { raw } from "hono/html";
import type { User } from "../../../server/db.js";
import type {
  OrganizationPortrait,
  NestedJourneyItem,
} from "../../../server/portraits/organization-synthesis.js";
import type {
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
} from "./portrait-shared.js";

/**
 * Organization portrait — read view that replaces the CRUD form as the
 * default landing for `/organizations/<key>` (CV1.E13.S2). The form
 * moves to `/organizations/<key>/editar` (locale-aware: `/edit` for `en`).
 *
 * Visual silhouette differs from the journey portrait by accent color
 * (warm-amber instead of teal) — signals "this is a place, not a
 * journey". Section structure also differs: "Quem passa por aqui"
 * (nested journeys + adjacencies) replaces "Onde ela mora", and the
 * lede heuristic flips to situation-first.
 */
export const OrganizationPortraitPage: FC<{
  user: User;
  portrait: OrganizationPortrait;
  /** Locale-aware path to the form. */
  editPath: string;
}> = ({ user, portrait, editPath }) => {
  return (
    <TopBarLayout title={portrait.name} user={user}>
      <style>{raw(PORTRAIT_STYLES)}</style>
      <style>{raw(ORG_ACCENT)}</style>

      <div class="portrait-shell" data-entity="organization">
        <header class="portrait-header">
          <h1 class="portrait-title">{portrait.name}</h1>
          <a
            href={editPath}
            class="portrait-edit-link-top"
            aria-label={ts("portrait.editLink.organization")}
          >
            {ts("portrait.editTopLabel")}
          </a>
        </header>

        <PortraitLede text={portrait.lede.text} />
        <NumericTilesRow tiles={portrait.tiles} />
        <WhoComesByHereSection portrait={portrait} />
        <StructuralSection portrait={portrait} />
        <ConversationsSection
          conversations={portrait.conversations}
          conversationsEmpty={portrait.conversationsEmpty}
          emptyStateKey="portrait.noConversationsYetOrg"
        />
        <PortraitClose close={portrait.close} />
        <PortraitFooter
          startedAt={portrait.startedAt}
          daysSinceUpdate={portrait.daysSinceUpdate}
          silenceMonths={portrait.silenceMonths}
          editPath={editPath}
          editLabel={ts("portrait.editLink.organization")}
        />
      </div>
    </TopBarLayout>
  );
};

const WhoComesByHereSection: FC<{ portrait: OrganizationPortrait }> = ({
  portrait,
}) => {
  const w = portrait.whoComesByHere;
  if (
    w.nestedJourneys.length === 0 &&
    w.primaryPersona === null &&
    w.anchoredScene === null &&
    w.parenthetical === null
  ) {
    return null;
  }
  return (
    <section class="portrait-section">
      <h2 class="portrait-section-title">{ts("portrait.whoComesByHere")}</h2>
      <div class="portrait-adjacencies">
        {w.nestedJourneys.length > 0 && (
          <div class="portrait-nested-list">
            <div class="portrait-nested-label">
              {ts("portrait.nestedJourneys")}
            </div>
            {w.nestedJourneys.map((j: NestedJourneyItem) => (
              <div class="portrait-nested-line">
                <span class="portrait-nested-marker">·</span>
                <a href={`/journeys/${j.key}`} class="portrait-nested-link">
                  {j.name}
                </a>
                <span class="portrait-nested-meta">
                  {" · "}
                  {ts(`portrait.journeyStatus.${j.status}`)}
                  {j.daysSinceLast !== null && (
                    <>
                      {" · "}
                      {j.daysSinceLast === 0
                        ? ts("portrait.recencyToday")
                        : ts("portrait.recencyDays", { n: j.daysSinceLast })}
                    </>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}

        {w.primaryPersona !== null && (
          <div class="portrait-adj-line">
            <span class="portrait-adj-glyph">◇</span>
            <a
              href={`/personas/${w.primaryPersona.key}`}
              class="portrait-adj-link"
            >
              {w.primaryPersona.key}
            </a>
            {w.primaryPersona.descriptor !== null && (
              <span class="portrait-adj-descriptor">
                {w.primaryPersona.descriptor}
              </span>
            )}
          </div>
        )}

        {w.anchoredScene !== null && (
          <div class="portrait-adj-line">
            <span class="portrait-adj-glyph">❖</span>
            <a
              href={`/cenas/${w.anchoredScene.key}`}
              class="portrait-adj-link"
            >
              {w.anchoredScene.title}
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

const StructuralSection: FC<{ portrait: OrganizationPortrait }> = ({
  portrait,
}) => {
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

/**
 * Org portrait flips the accent strip + tile colors from teal (journey)
 * to warm-amber (org), following the espelho's Sou pane palette.
 * Scoped to `[data-entity="organization"]` so the journey portrait keeps
 * its teal even on a page that imports both styles.
 */
const ORG_ACCENT = `
  .portrait-shell[data-entity="organization"] {
    --portrait-accent: #b8956a;
  }
  .portrait-shell[data-entity="organization"] .portrait-tile-number {
    color: #8b6f47;
  }
`;
