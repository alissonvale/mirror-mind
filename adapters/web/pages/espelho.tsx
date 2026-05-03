import type { FC } from "hono/jsx";
import type { User } from "../../../server/db.js";
import { TopBarLayout } from "./avatar-top-bar.js";
import { ts } from "../i18n.js";

/**
 * O Espelho — the contemplative entry-point that the ◆ Mirror Mind
 * logo points to (CV1.E12.S1). Reads as a single self-portrait:
 * "Sou X. Estou em Y. Vivi Z."
 *
 * S1 ships the chrome inversion + this empty shell. S2 fills the
 * synthesis body (glance + pulse + depth panes). S3 wires the
 * inscription block above the synthesis.
 *
 * Slots reserved (not rendered in S1) so later stories have a
 * stable mounting point:
 *   - .espelho-inscription  → S3
 *   - .espelho-glance       → S2
 *   - .espelho-depth        → S2
 */
export const EspelhoPage: FC<{ user: User }> = ({ user }) => {
  return (
    <TopBarLayout title={ts("espelho.title")} user={user}>
      <style>{`
        .espelho-page {
          max-width: 720px; margin: 3rem auto; padding: 0 1.5rem;
        }
        .espelho-placeholder {
          color: #a0aec0; font-style: italic;
          font-size: 0.95rem;
          text-align: center;
          padding: 3rem 0;
        }
      `}</style>

      <div class="espelho-page">
        <p class="espelho-placeholder">{ts("espelho.placeholder")}</p>
      </div>
    </TopBarLayout>
  );
};
