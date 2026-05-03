import type { FC } from "hono/jsx";
import type { User, Inscription } from "../../../server/db.js";
import type {
  MirrorState,
  SouState,
  EstouState,
  VivoState,
  ShiftMarker,
} from "../../../server/mirror/synthesis.js";
import { TopBarLayout } from "./avatar-top-bar.js";
import { ts } from "../i18n.js";

/**
 * O Espelho — the contemplative entry-point that ◆ Mirror Mind points to
 * (CV1.E12.S2).
 *
 * Visual system:
 *   - Glance: serif italic, larger, centered. The 2-second read.
 *   - Shifts: tiny inline italic markers under the glance.
 *   - Depth: 3 cards in a row, color-coded per axis (amber/teal/plum),
 *     each with a small glyph next to the heading and a subtle left
 *     accent. Numeric content (counts) renders as typographic tiles
 *     instead of prose, to break the "wall of text" feel.
 *   - Inscription slot is reserved at top for S3.
 */
export const EspelhoPage: FC<{
  user: User;
  state: MirrorState;
  inscription: Inscription | null;
}> = ({ user, state, inscription }) => {
  const isEmpty =
    state.vivo.weekConversationCount === 0 &&
    state.vivo.dominantVoice === null &&
    state.vivo.focusJourney === null &&
    state.estou.activeJourneys.length === 0 &&
    state.estou.activeSceneCount === 0 &&
    state.sou.soulSummary === null &&
    state.sou.identitySummary === null;

  return (
    <TopBarLayout title={ts("espelho.title")} user={user}>
      <style>{ESPELHO_STYLES}</style>

      <div class="espelho-page">
        <InscriptionBlock inscription={inscription} />

        {isEmpty ? (
          <p class="espelho-empty">{ts("espelho.empty")}</p>
        ) : (
          <>
            <ShiftsBlock shifts={state.shifts} />
            <section class="espelho-depth">
              <VivoPane vivo={state.vivo} />
              <EstouPane estou={state.estou} />
              <SouPane sou={state.sou} />
            </section>
          </>
        )}

        <footer class="espelho-footer">
          <a href="/espelho/imas" class="espelho-footer-link">
            {ts("espelho.footer.imasLink")}
          </a>
        </footer>
      </div>
    </TopBarLayout>
  );
};

const InscriptionBlock: FC<{ inscription: Inscription | null }> = ({
  inscription,
}) => {
  // No inscription → silent (no placeholder, no CTA). The slot stays
  // present in the DOM as a stable mounting anchor for tests + future
  // CSS but renders no visible content.
  if (!inscription) {
    return <aside class="espelho-inscription" data-espelho-inscription></aside>;
  }
  return (
    <aside class="espelho-inscription" data-espelho-inscription>
      <blockquote class="espelho-inscription-text">
        {inscription.text}
      </blockquote>
      {inscription.author && (
        <cite class="espelho-inscription-author">— {inscription.author}</cite>
      )}
    </aside>
  );
};

const ShiftsBlock: FC<{ shifts: ShiftMarker[] }> = ({ shifts }) => {
  if (shifts.length === 0) return null;
  return (
    <ul class="espelho-shifts" aria-label="changes since last visit">
      {shifts.map((s) => (
        <li class="espelho-shift">{renderShift(s)}</li>
      ))}
    </ul>
  );
};

const SouPane: FC<{ sou: SouState }> = ({ sou }) => {
  const isEmpty = sou.soulSummary === null && sou.identitySummary === null;
  return (
    <article class="espelho-pane" data-axis="sou">
      <PaneHeading
        axis="sou"
        href="/map"
        glyph="✦"
        question={ts("espelho.depth.sou.question")}
      >
        {ts("espelho.depth.sou.heading")}
      </PaneHeading>
      <div class="espelho-pane-body">
        {isEmpty ? (
          <p class="espelho-pane-empty">{ts("espelho.depth.sou.empty")}</p>
        ) : (
          <>
            {sou.soulSummary && (
              <p class="espelho-pane-prose">{sou.soulSummary}</p>
            )}
            {sou.identitySummary && (
              <p class="espelho-pane-prose">{sou.identitySummary}</p>
            )}
          </>
        )}
      </div>
    </article>
  );
};

const EstouPane: FC<{ estou: EstouState }> = ({ estou }) => {
  const isEmpty =
    estou.activeJourneys.length === 0 &&
    estou.dominantOrg === null &&
    estou.activeSceneCount === 0;
  return (
    <article class="espelho-pane" data-axis="estou">
      <PaneHeading
        axis="estou"
        href="/territorio"
        glyph="◉"
        question={ts("espelho.depth.estou.question")}
      >
        {ts("espelho.depth.estou.heading")}
      </PaneHeading>
      <div class="espelho-pane-body">
        {isEmpty ? (
          <p class="espelho-pane-empty">{ts("espelho.depth.estou.empty")}</p>
        ) : (
          <>
            {estou.activeJourneys.length > 0 && (
              <Tile
                n={estou.activeJourneys.length}
                label={tileLabel("journeys", estou.activeJourneys.length)}
                sub={estou.activeJourneys.map((j) => j.name).join(", ")}
              />
            )}
            {estou.dominantOrg && (
              <p class="espelho-pane-tag">
                <span class="espelho-pane-tag-glyph">⌂</span>{" "}
                {estou.dominantOrg.name}
              </p>
            )}
            {estou.activeSceneCount > 0 && (
              <Tile
                n={estou.activeSceneCount}
                label={tileLabel("scenes", estou.activeSceneCount)}
                sub={
                  estou.mostRecentScene
                    ? ts("espelho.tile.sub.scenes.lastOpened", {
                        name: estou.mostRecentScene.title,
                      })
                    : undefined
                }
              />
            )}
          </>
        )}
      </div>
    </article>
  );
};

const VivoPane: FC<{ vivo: VivoState }> = ({ vivo }) => {
  const isEmpty =
    vivo.recurringThemes.length === 0 &&
    vivo.weekConversationCount === 0 &&
    vivo.dominantVoice === null &&
    vivo.focusJourney === null &&
    vivo.lastSessionTitle === null;
  return (
    <article class="espelho-pane" data-axis="vivo">
      <PaneHeading
        axis="vivo"
        href="/memorias"
        glyph="◌"
        question={ts("espelho.depth.vivo.question")}
      >
        {ts("espelho.depth.vivo.heading")}
      </PaneHeading>
      <div class="espelho-pane-body">
        {isEmpty ? (
          <p class="espelho-pane-empty">{ts("espelho.depth.vivo.empty")}</p>
        ) : (
          <>
            {vivo.dominantVoice && (
              <p class="espelho-pane-tag">
                <span
                  class={
                    vivo.dominantVoice === "alma"
                      ? "espelho-pane-tag-glyph espelho-pane-tag-glyph--alma"
                      : "espelho-pane-tag-glyph"
                  }
                >
                  {vivo.dominantVoice === "alma" ? "♔" : "◇"}
                </span>{" "}
                {ts(
                  vivo.dominantVoice === "alma"
                    ? "espelho.depth.vivo.tag.voice.alma"
                    : "espelho.depth.vivo.tag.voice.persona",
                )}
              </p>
            )}
            {vivo.focusJourney && (
              <p class="espelho-pane-tag">
                <span class="espelho-pane-tag-glyph">↝</span>{" "}
                {vivo.focusJourney.name}
              </p>
            )}
            {vivo.recurringThemes.length > 0 && (
              <p class="espelho-pane-prose">
                <span class="espelho-pane-prose-lede">
                  {ts("espelho.vivo.themesIntro")}
                </span>{" "}
                {vivo.recurringThemes.map((t) => t.name).join(", ")}.
              </p>
            )}
            {vivo.weekConversationCount > 0 && (
              <Tile
                n={vivo.weekConversationCount}
                label={tileLabel(
                  "conversations",
                  vivo.weekConversationCount,
                )}
                sub={
                  vivo.weekDayCount === 1
                    ? ts("espelho.tile.sub.conversations.today")
                    : ts("espelho.tile.sub.conversations.days", {
                        n: vivo.weekDayCount,
                      })
                }
              />
            )}
            {vivo.lastSessionTitle && (
              <p class="espelho-pane-note">
                {ts("espelho.vivo.lastIntro", {
                  title: vivo.lastSessionTitle,
                })}
              </p>
            )}
          </>
        )}
      </div>
    </article>
  );
};

const PaneHeading: FC<{
  axis: "sou" | "estou" | "vivo";
  href: string;
  glyph: string;
  question: string;
  children: any;
}> = ({ href, glyph, question, children }) => (
  <header class="espelho-pane-header">
    <h2 class="espelho-pane-heading">
      <a href={href}>
        <span class="espelho-pane-glyph" aria-hidden="true">
          {glyph}
        </span>
        {children}
      </a>
    </h2>
    <p class="espelho-pane-question">{question}</p>
  </header>
);

const Tile: FC<{ n: number; label: string; sub?: string }> = ({
  n,
  label,
  sub,
}) => (
  <div class="espelho-tile">
    <div class="espelho-tile-row">
      <span class="espelho-tile-number">{n}</span>
      <span class="espelho-tile-label">{label}</span>
    </div>
    {sub && <p class="espelho-tile-sub">{sub}</p>}
  </div>
);

function tileLabel(
  noun: "journeys" | "scenes" | "conversations",
  n: number,
): string {
  const variant = n === 1 ? "one" : "many";
  return ts(`espelho.tile.label.${noun}.${variant}`);
}

function renderShift(s: ShiftMarker): string {
  switch (s.type) {
    case "soul-updated":
      if (s.daysAgo === 0) return ts("espelho.shifts.soul-updated.today");
      if (s.daysAgo === 1) return ts("espelho.shifts.soul-updated.yesterday");
      return ts("espelho.shifts.soul-updated.daysAgo", { n: s.daysAgo });
    case "new-journey":
      return ts("espelho.shifts.new-journey", { name: s.name });
    case "scene-reopened":
      return ts("espelho.shifts.scene-reopened", { name: s.name });
    case "many-conversations":
      return s.count === 1
        ? ts("espelho.shifts.many-conversations.one")
        : ts("espelho.shifts.many-conversations.many", { n: s.count });
  }
}

const ESPELHO_STYLES = `
  /* Color tokens — one per axis. Quiet, distinct. */
  .espelho-page {
    --espelho-amber: #b8956a;
    --espelho-teal: #4a7a8c;
    --espelho-plum: #8e6c8c;
    --espelho-serif: 'Iowan Old Style', 'Charter', 'Georgia', serif;

    max-width: 980px;
    margin: 3rem auto 5rem;
    padding: 0 1.5rem;
  }

  /* IMA (inscription) — user-pinned phrase. A small paper card held
     by a metaphorical magnet at the top of /espelho. Soft cream tile,
     subtle shadow, a tiny amber dot on top reading as the magnet. */
  .espelho-inscription {
    position: relative;
    font-family: var(--espelho-serif);
    text-align: center;
    margin: 0.6rem auto 3rem;
    max-width: 460px;
    padding: 1.4rem 1.6rem 1.2rem;
    background: #fdf8ec;
    border: 1px solid #f0e6cc;
    border-radius: 5px;
    box-shadow: 0 1px 3px rgba(120, 100, 60, 0.06);
  }
  .espelho-inscription:empty {
    /* Silent space when no ímã is the day's pick. */
    display: none;
    padding: 0;
    margin: 0;
    background: transparent;
    border: 0;
    box-shadow: none;
  }
  .espelho-inscription::before {
    /* The magnet — a tiny amber dot pressing the paper to the mirror. */
    content: "";
    position: absolute;
    top: -5px;
    left: 50%;
    transform: translateX(-50%);
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: #b8956a;
    box-shadow:
      0 1px 2px rgba(120, 100, 60, 0.3),
      inset 0 -1px 0 rgba(0, 0, 0, 0.1);
  }
  .espelho-inscription-text {
    margin: 0;
    color: #5a4a30;
    font-style: italic;
    font-size: 1.05rem;
    line-height: 1.6;
    quotes: "\\201C" "\\201D";
  }
  .espelho-inscription-text::before {
    content: open-quote;
    color: #c8a878;
    margin-right: 0.1rem;
  }
  .espelho-inscription-text::after {
    content: close-quote;
    color: #c8a878;
    margin-left: 0.1rem;
  }
  .espelho-inscription-author {
    display: block;
    margin-top: 0.6rem;
    font-style: normal;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 0.78rem;
    color: #a0866a;
    letter-spacing: 0.04em;
  }

  /* Footer — discrete link to the inscriptions management page. */
  .espelho-footer {
    margin-top: 3rem;
    text-align: right;
  }
  .espelho-footer-link {
    color: #a0aec0;
    font-size: 0.82rem;
    text-decoration: none;
    letter-spacing: 0.05em;
  }
  .espelho-footer-link:hover {
    color: #2c5282;
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .espelho-empty {
    color: #a0aec0; font-style: italic;
    font-family: var(--espelho-serif);
    text-align: center;
    padding: 3rem 0;
    line-height: 1.6;
    max-width: 540px;
    margin: 0 auto;
  }

  /* SHIFTS — small italic markers, inline if multiple. */
  .espelho-shifts {
    list-style: none;
    margin: 0 auto 3rem;
    max-width: 720px;
    padding: 0.8rem 0 0;
    border-top: 1px solid #edf2f7;
    text-align: center;
  }
  .espelho-shift {
    display: inline-block;
    margin: 0 0.2rem;
    color: #a0aec0;
    font-size: 0.78rem;
    font-style: italic;
    font-family: var(--espelho-serif);
  }
  .espelho-shift + .espelho-shift::before {
    content: "·";
    margin: 0 0.5rem 0 0.2rem;
    color: #cbd5e0;
  }

  /* DEPTH — 3 cards in a row, soft tinted, color accent on the left. */
  .espelho-depth {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 1.4rem;
    margin-top: 1rem;
  }

  .espelho-pane {
    display: flex; flex-direction: column;
    padding: 1.1rem 1.3rem 1.3rem;
    background: #fdfcf9;
    border-left: 2px solid #ddd;
    border-radius: 0 4px 4px 0;
  }
  .espelho-pane[data-axis="sou"] { border-left-color: var(--espelho-amber); }
  .espelho-pane[data-axis="estou"] { border-left-color: var(--espelho-teal); }
  .espelho-pane[data-axis="vivo"] { border-left-color: var(--espelho-plum); }

  .espelho-pane-header {
    margin-bottom: 1rem;
  }
  .espelho-pane-heading {
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.15em;
    margin: 0 0 0.25rem;
  }
  .espelho-pane-question {
    margin: 0;
    font-family: var(--espelho-serif);
    font-style: italic;
    font-size: 0.78rem;
    color: #a0aec0;
    font-weight: 400;
    letter-spacing: 0;
  }
  .espelho-pane-heading a {
    text-decoration: none;
    color: inherit;
    display: inline-flex; align-items: center; gap: 0.4rem;
  }
  .espelho-pane-heading a:hover {
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  .espelho-pane[data-axis="sou"] .espelho-pane-heading { color: var(--espelho-amber); }
  .espelho-pane[data-axis="estou"] .espelho-pane-heading { color: var(--espelho-teal); }
  .espelho-pane[data-axis="vivo"] .espelho-pane-heading { color: var(--espelho-plum); }

  .espelho-pane-glyph {
    font-size: 0.9rem;
    opacity: 0.9;
    line-height: 1;
  }

  .espelho-pane-body {
    display: flex; flex-direction: column;
    gap: 0.85rem;
  }

  /* Prose lines inside a pane (Sou identity text, Vivo themes line). */
  .espelho-pane-prose {
    font-family: var(--espelho-serif);
    font-size: 0.95rem;
    line-height: 1.5;
    color: #2a2a2a;
    margin: 0;
  }
  .espelho-pane-prose-lede {
    color: #718096;
    font-style: italic;
  }

  /* Inline tag-style line (e.g. dominant org). */
  .espelho-pane-tag {
    margin: 0;
    font-size: 0.85rem;
    color: #4a5568;
    display: inline-flex; align-items: center; gap: 0.35rem;
  }
  .espelho-pane-tag-glyph {
    color: #a0aec0;
    font-size: 0.95rem;
    line-height: 1;
  }
  .espelho-pane-tag-glyph--alma {
    color: #b8956a;
    font-size: 1.05rem;
  }

  /* Bottom note (e.g. Vivo's "última conversa: ..."). */
  .espelho-pane-note {
    margin: 0;
    font-size: 0.78rem;
    color: #a0aec0;
    font-style: italic;
    font-family: var(--espelho-serif);
  }

  .espelho-pane-empty {
    color: #a0aec0; font-style: italic;
    font-size: 0.88rem;
    font-family: var(--espelho-serif);
  }

  /* NUMERIC TILE — large display number + tiny caps label + optional sub. */
  .espelho-tile {
    display: flex; flex-direction: column;
    gap: 0.1rem;
  }
  .espelho-tile-row {
    display: flex; align-items: baseline; gap: 0.5rem;
  }
  .espelho-tile-number {
    font-size: 1.7rem;
    font-weight: 300;
    color: #2a2a2a;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }
  .espelho-tile-label {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: #718096;
    font-weight: 500;
  }
  .espelho-tile-sub {
    margin: 0.2rem 0 0;
    font-size: 0.78rem;
    color: #a0aec0;
    font-style: italic;
    font-family: var(--espelho-serif);
  }
`;
