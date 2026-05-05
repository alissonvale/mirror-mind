import type { FC } from "hono/jsx";
import { raw } from "hono/html";
import type { User } from "../../../server/db.js";
import type {
  NarrativaState,
  LayerSection,
  LayerSubsection,
  PersonaItem,
} from "../../../server/portraits/narrativa-synthesis.js";
import { TopBarLayout } from "./avatar-top-bar.js";
import { ts } from "../i18n.js";

/**
 * Narrativa — the user's self-portrait as a continuous read (CV1.E14).
 *
 * Replaces /map (cognitive map / structural grid) with a memoir-shaped
 * page: bookplate → soul → identity → behavior → expression → cast.
 * Five flat sections, one h1 each in small caps. No "ego" anywhere
 * in the chrome (per user directive 2026-05-05).
 *
 * Light synthesis: layer markdown content rendered verbatim, sub-headings
 * converted to italic guide lines (`☞ heading`), paragraphs preserved
 * as `<p>` blocks. No LLM.
 */
export const NarrativaPage: FC<{
  user: User;
  state: NarrativaState;
  /** /map URL — single edit affordance in the footer. */
  mapUrl: string;
}> = ({ user, state, mapUrl }) => {
  return (
    <TopBarLayout title={ts("narrativa.title")} user={user}>
      <style>{raw(NARRATIVA_STYLES)}</style>

      <div class="narrativa-page">
        <NameBookplate name={user.name} />

        <Section
          label={ts("narrativa.section.alma")}
          layer={state.alma}
          stubKey="narrativa.stub.alma"
        />
        <Section
          label={ts("narrativa.section.identidade")}
          layer={state.identidade}
          stubKey="narrativa.stub.identidade"
        />
        <Section
          label={ts("narrativa.section.comportamento")}
          layer={state.comportamento}
          stubKey="narrativa.stub.comportamento"
        />
        <Section
          label={ts("narrativa.section.expressao")}
          layer={state.expressao}
          stubKey="narrativa.stub.expressao"
        />
        <ElencoSection elenco={state.elenco} />

        <footer class="narrativa-footer">
          <a href={mapUrl} class="narrativa-edit-link">
            {ts("narrativa.editLink")}
          </a>
        </footer>
      </div>
    </TopBarLayout>
  );
};

const NameBookplate: FC<{ name: string }> = ({ name }) => (
  <div class="narrativa-bookplate" aria-label="narrativa owner">
    <span class="narrativa-bookplate-name">{name}</span>
    <span class="narrativa-bookplate-rule" aria-hidden="true"></span>
  </div>
);

const Section: FC<{
  label: string;
  layer: LayerSection;
  stubKey: string;
}> = ({ label, layer, stubKey }) => (
  <section class="narrativa-section">
    <h2 class="narrativa-section-label">{label}</h2>

    {layer.isEmpty ? (
      <p class="narrativa-stub">
        {ts(stubKey)} <a href={layer.editPath}>{ts("narrativa.stub.cta")}</a>
      </p>
    ) : (
      <>
        {layer.preamble.map((p) => (
          <p class="narrativa-paragraph">{p}</p>
        ))}
        {layer.subsections.map((sub: LayerSubsection) => (
          <SubsectionView sub={sub} />
        ))}
      </>
    )}
  </section>
);

const SUBSECTION_GLYPH = "☞"; // ☞ BLACK INDEX POINTING RIGHT

const SubsectionView: FC<{ sub: LayerSubsection }> = ({ sub }) => (
  <div class="narrativa-subsection">
    <p class="narrativa-subhead">
      <span class="narrativa-subhead-glyph" aria-hidden="true">
        {SUBSECTION_GLYPH}
      </span>{" "}
      <em>{sub.heading}</em>
    </p>
    {sub.paragraphs.map((p) => (
      <p class="narrativa-paragraph">{p}</p>
    ))}
  </div>
);

const ElencoSection: FC<{ elenco: PersonaItem[] }> = ({ elenco }) => {
  if (elenco.length === 0) {
    return (
      <section class="narrativa-section">
        <h2 class="narrativa-section-label">{ts("narrativa.section.elenco")}</h2>
        <p class="narrativa-stub">{ts("narrativa.stub.elenco")}</p>
      </section>
    );
  }
  return (
    <section class="narrativa-section">
      <h2 class="narrativa-section-label">{ts("narrativa.section.elenco")}</h2>
      <p class="narrativa-elenco-intro">{ts("narrativa.elenco.intro")}</p>
      <ul class="narrativa-elenco-list">
        {elenco.map((p) => (
          <li class="narrativa-elenco-item">
            <span
              class="narrativa-elenco-glyph"
              style={`color: ${p.color};`}
              aria-hidden="true"
            >
              ◇
            </span>
            <a href={p.portraitPath} class="narrativa-elenco-name">
              {p.key}
            </a>
            {p.descriptor && (
              <span class="narrativa-elenco-descriptor">{p.descriptor}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
};

const NARRATIVA_STYLES = `
  .narrativa-page {
    max-width: 720px;
    margin: 1.5rem auto 4rem;
    padding: 0 1.5rem;
    color: #2d3748;
    font-size: 0.96rem;
    line-height: 1.7;
  }

  /* Bookplate (same shape as /espelho). */
  .narrativa-bookplate {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.6rem;
    margin: 0 auto 3rem;
  }
  .narrativa-bookplate-name {
    font-family: 'Iowan Old Style', 'Charter', 'Georgia', serif;
    font-size: 0.78rem;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: #a0aec0;
    text-align: center;
  }
  .narrativa-bookplate-rule {
    display: block;
    width: 3rem;
    height: 1px;
    background: #cbd5e0;
  }

  /* Section labels — small caps, generous spacing, sits as a placa
     above the prose. */
  .narrativa-section {
    margin: 3.5rem 0;
  }
  .narrativa-section-label {
    font-size: 0.78rem;
    letter-spacing: 0.28em;
    text-transform: uppercase;
    color: #718096;
    font-weight: 600;
    margin: 0 0 1.5rem 0;
  }

  /* Subsection guides — pointing-finger glyph + heading in italic
     serif, muted color. Reads as a typographic finger pointing into
     the next chapter, not as a heading that breaks the page. */
  .narrativa-subsection {
    margin: 1.8rem 0;
  }
  .narrativa-subhead {
    margin: 0 0 0.7rem 0;
    color: #4a5568;
    font-size: 0.94rem;
  }
  .narrativa-subhead-glyph {
    color: #a0aec0;
    margin-right: 0.3rem;
  }
  .narrativa-subhead em {
    font-family: 'EB Garamond', 'Baskerville', Georgia, serif;
    font-style: italic;
    font-size: 1.05rem;
    color: #2d3748;
  }

  /* Body paragraphs — comfortable leading, generous bottom margin. */
  .narrativa-paragraph {
    margin: 0 0 1rem 0;
    line-height: 1.7;
  }
  .narrativa-paragraph:last-child { margin-bottom: 0; }
  .narrativa-paragraph strong { font-weight: 600; }

  /* Stub block — when a layer is unwritten. Italic, muted, with a
     small CTA. */
  .narrativa-stub {
    font-family: 'EB Garamond', Georgia, serif;
    font-style: italic;
    color: #a0aec0;
    margin: 0;
  }
  .narrativa-stub a {
    color: #718096;
    text-decoration: none;
    border-bottom: 1px dotted #cbd5e0;
  }
  .narrativa-stub a:hover { color: #2d3748; }

  /* Cast list — each persona gets a colored ◇, name links to portrait,
     italic descriptor follows. */
  .narrativa-elenco-intro {
    color: #4a5568;
    font-style: italic;
    margin: 0 0 1.5rem 0;
  }
  .narrativa-elenco-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .narrativa-elenco-item {
    display: flex;
    gap: 0.6rem;
    align-items: baseline;
    margin: 0.5rem 0;
    line-height: 1.7;
  }
  .narrativa-elenco-glyph {
    width: 1rem;
    display: inline-block;
    flex: 0 0 auto;
  }
  .narrativa-elenco-name {
    color: #2c5282;
    text-decoration: none;
    font-weight: 500;
  }
  .narrativa-elenco-name:hover { text-decoration: underline; }
  .narrativa-elenco-descriptor {
    color: #718096;
    font-size: 0.92rem;
    font-style: italic;
  }

  /* Footer — single edit affordance. Quiet, right-aligned. */
  .narrativa-footer {
    margin-top: 3rem;
    padding-top: 1rem;
    border-top: 1px solid #edf2f7;
    text-align: right;
  }
  .narrativa-edit-link {
    color: #a0aec0;
    text-decoration: none;
    font-size: 0.85rem;
  }
  .narrativa-edit-link:hover { color: #2d3748; }
`;
