import type { FC } from "hono/jsx";
import { raw } from "hono/html";
import type { User } from "../../../server/db.js";
import type {
  IdentidadeState,
  LayerSection,
  LayerSubsection,
  PersonaItem,
} from "../../../server/portraits/identidade-synthesis.js";
import { TopBarLayout } from "./avatar-top-bar.js";
import { ts } from "../i18n.js";

/**
 * Identidade — the user's self-portrait as a continuous read (CV1.E14).
 *
 * Replaces /map (cognitive map / structural grid) with a memoir-shaped
 * page: bookplate → soul → role → behavior → expression → cast. Five
 * flat sections, one h1 each in small caps. No "ego" anywhere in the
 * chrome (per user directive 2026-05-05).
 *
 * The page itself is named "Identidade" / "Identity"; the section that
 * carries the `ego/identity` layer's content is labeled "PAPEL" / "ROLE"
 * so the user-facing terminology doesn't collide with the page name.
 *
 * Light synthesis: layer markdown content rendered verbatim, sub-headings
 * converted to italic guide lines (`☞ heading`), paragraphs preserved
 * as `<p>` blocks. No LLM.
 */
export const IdentidadePage: FC<{
  user: User;
  state: IdentidadeState;
  /** /map URL — single edit affordance in the footer. */
  mapUrl: string;
}> = ({ user, state, mapUrl }) => {
  return (
    <TopBarLayout title={ts("identidade.title")} user={user}>
      <style>{raw(IDENTIDADE_STYLES)}</style>

      <div class="identidade-page">
        <NameBookplate name={user.name} />

        <Section
          label={ts("identidade.section.alma")}
          layer={state.alma}
          stubKey="identidade.stub.alma"
        />
        <Section
          label={ts("identidade.section.papel")}
          layer={state.papel}
          stubKey="identidade.stub.papel"
        />
        <Section
          label={ts("identidade.section.comportamento")}
          layer={state.comportamento}
          stubKey="identidade.stub.comportamento"
        />
        <Section
          label={ts("identidade.section.expressao")}
          layer={state.expressao}
          stubKey="identidade.stub.expressao"
        />
        <ElencoSection elenco={state.elenco} />

        <footer class="identidade-footer">
          <a href={mapUrl} class="identidade-edit-link">
            {ts("identidade.editLink")}
          </a>
        </footer>
      </div>
    </TopBarLayout>
  );
};

const NameBookplate: FC<{ name: string }> = ({ name }) => (
  <div class="identidade-bookplate" aria-label="identidade owner">
    <span class="identidade-bookplate-name">{name}</span>
    <span class="identidade-bookplate-rule" aria-hidden="true"></span>
  </div>
);

const Section: FC<{
  label: string;
  layer: LayerSection;
  stubKey: string;
}> = ({ label, layer, stubKey }) => (
  <section class="identidade-section">
    <h2 class="identidade-section-label">{label}</h2>

    {layer.isEmpty ? (
      <p class="identidade-stub">
        {ts(stubKey)} <a href={layer.editPath}>{ts("identidade.stub.cta")}</a>
      </p>
    ) : (
      <>
        {layer.preamble.map((p) => (
          <p class="identidade-paragraph">{p}</p>
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
  <div class="identidade-subsection">
    <p class="identidade-subhead">
      <span class="identidade-subhead-glyph" aria-hidden="true">
        {SUBSECTION_GLYPH}
      </span>{" "}
      <em>{sub.heading}</em>
    </p>
    {sub.paragraphs.map((p) => (
      <p class="identidade-paragraph">{p}</p>
    ))}
  </div>
);

const ElencoSection: FC<{ elenco: PersonaItem[] }> = ({ elenco }) => {
  if (elenco.length === 0) {
    return (
      <section class="identidade-section">
        <h2 class="identidade-section-label">{ts("identidade.section.elenco")}</h2>
        <p class="identidade-stub">{ts("identidade.stub.elenco")}</p>
      </section>
    );
  }
  return (
    <section class="identidade-section">
      <h2 class="identidade-section-label">{ts("identidade.section.elenco")}</h2>
      <p class="identidade-elenco-intro">{ts("identidade.elenco.intro")}</p>
      <ul class="identidade-elenco-list">
        {elenco.map((p) => (
          <li class="identidade-elenco-item">
            <span
              class="identidade-elenco-glyph"
              style={`color: ${p.color};`}
              aria-hidden="true"
            >
              ◇
            </span>
            <a href={p.portraitPath} class="identidade-elenco-name">
              {p.key}
            </a>
            {p.descriptor && (
              <span class="identidade-elenco-descriptor">{p.descriptor}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
};

const IDENTIDADE_STYLES = `
  /* Outer shell at 980px (matches the system standard — workshops,
     lists, /espelho, portraits). Prose blocks inside cap at 720px so
     the reading column stays comfortable for long scroll reads. The
     bookplate centers across the full 980 width. */
  .identidade-page {
    max-width: 980px;
    margin: 1.5rem auto 4rem;
    padding: 0 1.5rem;
    color: #2d3748;
    font-size: 0.96rem;
    line-height: 1.7;
  }

  /* Bookplate (same shape as /espelho) — centered across the full
     outer width. */
  .identidade-bookplate {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.6rem;
    margin: 0 auto 3rem;
  }
  .identidade-bookplate-name {
    font-family: 'Iowan Old Style', 'Charter', 'Georgia', serif;
    font-size: 0.78rem;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: #a0aec0;
    text-align: center;
  }
  .identidade-bookplate-rule {
    display: block;
    width: 3rem;
    height: 1px;
    background: #cbd5e0;
  }

  /* Section labels — small caps, generous spacing, sits as a placa
     above the prose. Reading column constrained to 720px so the
     long-form read stays comfortable inside the wider shell. */
  .identidade-section {
    margin: 3.5rem 0;
    max-width: 720px;
  }
  .identidade-section-label {
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
  .identidade-subsection {
    margin: 1.8rem 0;
  }
  .identidade-subhead {
    margin: 0 0 0.7rem 0;
    color: #4a5568;
    font-size: 0.94rem;
  }
  .identidade-subhead-glyph {
    color: #a0aec0;
    margin-right: 0.3rem;
  }
  .identidade-subhead em {
    font-family: 'EB Garamond', 'Baskerville', Georgia, serif;
    font-style: italic;
    font-size: 1.05rem;
    color: #2d3748;
  }

  /* Body paragraphs — comfortable leading, generous bottom margin. */
  .identidade-paragraph {
    margin: 0 0 1rem 0;
    line-height: 1.7;
  }
  .identidade-paragraph:last-child { margin-bottom: 0; }
  .identidade-paragraph strong { font-weight: 600; }

  /* Stub block — when a layer is unwritten. Italic, muted, with a
     small CTA. */
  .identidade-stub {
    font-family: 'EB Garamond', Georgia, serif;
    font-style: italic;
    color: #a0aec0;
    margin: 0;
  }
  .identidade-stub a {
    color: #718096;
    text-decoration: none;
    border-bottom: 1px dotted #cbd5e0;
  }
  .identidade-stub a:hover { color: #2d3748; }

  /* Cast list — each persona gets a colored ◇, name links to portrait,
     italic descriptor follows. */
  .identidade-elenco-intro {
    color: #4a5568;
    font-style: italic;
    margin: 0 0 1.5rem 0;
  }
  .identidade-elenco-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .identidade-elenco-item {
    display: flex;
    gap: 0.6rem;
    align-items: baseline;
    margin: 0.5rem 0;
    line-height: 1.7;
  }
  .identidade-elenco-glyph {
    width: 1rem;
    display: inline-block;
    flex: 0 0 auto;
  }
  .identidade-elenco-name {
    color: #2c5282;
    text-decoration: none;
    font-weight: 500;
  }
  .identidade-elenco-name:hover { text-decoration: underline; }
  .identidade-elenco-descriptor {
    color: #718096;
    font-size: 0.92rem;
    font-style: italic;
  }

  /* Footer — single edit affordance. Quiet, right-aligned. Stays in
     the reading column (720px) so the link aligns with the prose
     above, not floats out at the right edge of the 980 shell. */
  .identidade-footer {
    margin-top: 3rem;
    padding-top: 1rem;
    border-top: 1px solid #edf2f7;
    text-align: right;
    max-width: 720px;
  }
  .identidade-edit-link {
    color: #a0aec0;
    text-decoration: none;
    font-size: 0.85rem;
  }
  .identidade-edit-link:hover { color: #2d3748; }
`;
