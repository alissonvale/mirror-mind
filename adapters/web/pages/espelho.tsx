import type { FC } from "hono/jsx";
import type { User } from "../../../server/db.js";
import type {
  MirrorState,
  GlanceState,
  SouState,
  EstouState,
  VivoState,
  ShiftMarker,
  DominantVoice,
} from "../../../server/mirror/synthesis.js";
import { TopBarLayout } from "./avatar-top-bar.js";
import { ts } from "../i18n.js";

/**
 * O Espelho — the contemplative entry-point that ◆ Mirror Mind points to
 * (CV1.E12.S1 wired the chrome; S2 fills the synthesis body).
 *
 * Reads top-to-bottom as one self-portrait:
 *   - Inscription (S3, slot reserved here)
 *   - Glance: one sentence in active voice ("I'm facing X, ...")
 *   - Shifts: small textual markers since last visit (when relevant)
 *   - Depth: three panes — Sou / Estou / Vivo — each with a paragraph
 *     and a drill-down link to its tool surface.
 */
export const EspelhoPage: FC<{ user: User; state: MirrorState }> = ({
  user,
  state,
}) => {
  const isEmpty =
    state.glance.soulOrientation === null &&
    state.glance.dominantVoice === null &&
    state.glance.focusJourney === null &&
    state.estou.activeJourneys.length === 0 &&
    state.estou.activeSceneCount === 0 &&
    state.vivo.weekConversationCount === 0 &&
    state.sou.soulSummary === null &&
    state.sou.identitySummary === null;

  return (
    <TopBarLayout title={ts("espelho.title")} user={user}>
      <style>{ESPELHO_STYLES}</style>

      <div class="espelho-page">
        {/* Inscription slot — S3 mounts content here. Silent until then. */}
        <aside class="espelho-inscription" data-espelho-inscription></aside>

        {isEmpty ? (
          <p class="espelho-empty">{ts("espelho.empty")}</p>
        ) : (
          <>
            <GlanceLine glance={state.glance} />
            <ShiftsBlock shifts={state.shifts} />
            <section class="espelho-depth">
              <SouPane sou={state.sou} />
              <EstouPane estou={state.estou} />
              <VivoPane vivo={state.vivo} />
            </section>
          </>
        )}
      </div>
    </TopBarLayout>
  );
};

const GlanceLine: FC<{ glance: GlanceState }> = ({ glance }) => {
  const fragments: string[] = [];
  if (glance.soulOrientation) {
    fragments.push(
      ts("espelho.glance.frag.soul", { what: glance.soulOrientation }),
    );
  }
  if (glance.dominantVoice) {
    fragments.push(ts(voiceFragKey(glance.dominantVoice)));
  }
  if (glance.focusJourney) {
    fragments.push(
      ts("espelho.glance.frag.journey", { name: glance.focusJourney.name }),
    );
  }
  if (fragments.length === 0) return null;

  return (
    <p class="espelho-glance">
      <span class="espelho-glance-opener">{ts("espelho.glance.opener")}</span>{" "}
      {fragments.join(", ")}.
    </p>
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
  const isEmpty =
    sou.soulSummary === null &&
    sou.identitySummary === null &&
    sou.dominantVoice === null;
  return (
    <article class="espelho-pane">
      <h2 class="espelho-pane-heading">{ts("espelho.depth.sou.heading")}</h2>
      <div class="espelho-pane-body">
        {isEmpty ? (
          <p class="espelho-pane-empty">{ts("espelho.depth.sou.empty")}</p>
        ) : (
          <>
            {sou.soulSummary && <p>{sou.soulSummary}</p>}
            {sou.identitySummary && <p>{sou.identitySummary}</p>}
            {sou.dominantVoice && (
              <p>
                {ts(
                  sou.dominantVoice === "alma"
                    ? "espelho.depth.sou.line.voice.alma"
                    : "espelho.depth.sou.line.voice.persona",
                )}
              </p>
            )}
          </>
        )}
      </div>
      <a class="espelho-pane-drilldown" href="/map">
        {ts("espelho.depth.sou.drilldown")}
      </a>
    </article>
  );
};

const EstouPane: FC<{ estou: EstouState }> = ({ estou }) => {
  const lines: string[] = [];
  if (estou.activeJourneys.length > 0) {
    const names = estou.activeJourneys.map((j) => j.name).join(", ");
    if (estou.activeJourneys.length === 1) {
      lines.push(ts("espelho.depth.estou.line.journeys.one", { names }));
    } else {
      lines.push(
        ts("espelho.depth.estou.line.journeys.many", {
          n: estou.activeJourneys.length,
          names,
        }),
      );
    }
  }
  if (estou.dominantOrg) {
    lines.push(
      ts("espelho.depth.estou.line.org", { name: estou.dominantOrg.name }),
    );
  }
  if (estou.activeSceneCount > 0) {
    if (estou.mostRecentScene) {
      lines.push(
        ts(
          estou.activeSceneCount === 1
            ? "espelho.depth.estou.line.scenes.recent.one"
            : "espelho.depth.estou.line.scenes.recent",
          { n: estou.activeSceneCount, name: estou.mostRecentScene.title },
        ),
      );
    } else {
      lines.push(
        ts(
          estou.activeSceneCount === 1
            ? "espelho.depth.estou.line.scenes.bare.one"
            : "espelho.depth.estou.line.scenes.bare.many",
          { n: estou.activeSceneCount },
        ),
      );
    }
  }
  return (
    <article class="espelho-pane">
      <h2 class="espelho-pane-heading">{ts("espelho.depth.estou.heading")}</h2>
      <div class="espelho-pane-body">
        {lines.length === 0 ? (
          <p class="espelho-pane-empty">{ts("espelho.depth.estou.empty")}</p>
        ) : (
          lines.map((l) => <p>{l}</p>)
        )}
      </div>
      <a class="espelho-pane-drilldown" href="/territorio">
        {ts("espelho.depth.estou.drilldown")}
      </a>
    </article>
  );
};

const VivoPane: FC<{ vivo: VivoState }> = ({ vivo }) => {
  const lines: string[] = [];
  if (vivo.recurringThemes.length > 0) {
    const themes = vivo.recurringThemes.map((t) => t.name).join(", ");
    lines.push(
      ts(
        vivo.recurringThemes.length === 1
          ? "espelho.depth.vivo.line.themes.one"
          : "espelho.depth.vivo.line.themes.many",
        { themes },
      ),
    );
  }
  if (vivo.weekConversationCount > 0) {
    if (vivo.weekDayCount === 1) {
      lines.push(
        vivo.weekConversationCount === 1
          ? ts("espelho.depth.vivo.line.activity.today")
          : ts("espelho.depth.vivo.line.activity.todayMany", {
              n: vivo.weekConversationCount,
            }),
      );
    } else {
      lines.push(
        vivo.weekConversationCount === 1
          ? ts("espelho.depth.vivo.line.activity.weekOne")
          : ts("espelho.depth.vivo.line.activity.week", {
              n: vivo.weekConversationCount,
              days: vivo.weekDayCount,
            }),
      );
    }
  }
  if (vivo.lastSessionTitle) {
    lines.push(
      ts("espelho.depth.vivo.line.last", { title: vivo.lastSessionTitle }),
    );
  }
  return (
    <article class="espelho-pane">
      <h2 class="espelho-pane-heading">{ts("espelho.depth.vivo.heading")}</h2>
      <div class="espelho-pane-body">
        {lines.length === 0 ? (
          <p class="espelho-pane-empty">{ts("espelho.depth.vivo.empty")}</p>
        ) : (
          lines.map((l) => <p>{l}</p>)
        )}
      </div>
      <a class="espelho-pane-drilldown" href="/memorias">
        {ts("espelho.depth.vivo.drilldown")}
      </a>
    </article>
  );
};

function voiceFragKey(voice: DominantVoice): string {
  return voice === "alma"
    ? "espelho.glance.frag.voice.alma"
    : "espelho.glance.frag.voice.persona";
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
  .espelho-page {
    max-width: 680px; margin: 3rem auto; padding: 0 1.5rem;
  }

  .espelho-inscription {
    /* S3 mounting point. Empty in S1/S2 — silent space. */
    min-height: 0;
  }

  .espelho-empty {
    color: #a0aec0; font-style: italic;
    text-align: center;
    padding: 3rem 0;
    line-height: 1.6;
  }

  .espelho-glance {
    font-size: 1.15rem;
    line-height: 1.55;
    color: #2a2a2a;
    margin: 0 0 1.2rem;
    font-weight: 400;
  }
  .espelho-glance-opener {
    color: #2c5282;
    font-weight: 500;
  }

  .espelho-shifts {
    list-style: none;
    margin: 0 0 2.5rem;
    padding: 0;
    border-top: 1px solid #edf2f7;
    padding-top: 0.8rem;
  }
  .espelho-shift {
    color: #718096;
    font-size: 0.85rem;
    font-style: italic;
    line-height: 1.6;
  }
  .espelho-shift::before {
    content: "·";
    margin-right: 0.5rem;
    color: #cbd5e0;
  }

  .espelho-depth {
    display: flex; flex-direction: column;
    gap: 1.8rem;
  }

  .espelho-pane {
    display: flex; flex-direction: column;
  }
  .espelho-pane-heading {
    font-size: 0.78rem;
    font-weight: 500;
    color: #2c5282;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin: 0 0 0.5rem;
  }
  .espelho-pane-body p {
    margin: 0 0 0.4rem;
    color: #2a2a2a;
    line-height: 1.55;
    font-size: 1rem;
  }
  .espelho-pane-body p:last-child {
    margin-bottom: 0;
  }
  .espelho-pane-empty {
    color: #a0aec0; font-style: italic;
    font-size: 0.9rem;
  }
  .espelho-pane-drilldown {
    align-self: flex-start;
    margin-top: 0.6rem;
    color: #4a6fa5;
    text-decoration: none;
    font-size: 0.85rem;
  }
  .espelho-pane-drilldown:hover {
    text-decoration: underline;
  }
`;
