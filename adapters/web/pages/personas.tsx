import type { FC } from "hono/jsx";
import { Layout, type SidebarScopes } from "./layout.js";
import type { User, IdentityLayer } from "../../../server/db.js";
import { avatarInitials } from "./context-rail.js";
import { resolvePersonaColor } from "../../../server/personas/colors.js";

/**
 * Personas listing — mirrors the /journeys and /organizations shape.
 * Each row is a small card linking to the persona workshop. Reorder and
 * sidebar-visibility controls are intentionally absent: personas are
 * not shown in the sidebar, and without that axis the ordering has no
 * downstream effect the user can feel. The DB columns stay (the
 * structure is intact) so the controls can return later without a
 * schema change.
 *
 * The colored badge on the left carries initials from the persona key
 * (mentora → "ME", product-designer → "PD"). This is a placeholder for
 * a proper avatar — same shape, same color-hashing as the user avatar.
 */
export const PersonasListPage: FC<{
  user: User;
  personas: IdentityLayer[];
  sidebarScopes?: SidebarScopes;
}> = ({ user, personas, sidebarScopes }) => {
  return (
    <Layout title="Personas" user={user} sidebarScopes={sidebarScopes}>
      <div class="scope-list">
        <header class="scope-list-header">
          <h1>Personas</h1>
          <p class="scope-list-intro">
            Specialized lenses the mirror activates for specific domains.
            Reception picks one when the message clearly lands in a persona's
            territory; otherwise the base voice answers. Each persona's
            content joins the composed prompt when it's active.
          </p>
        </header>

        {personas.length > 0 ? (
          <section class="scope-rows">
            {personas.map((p) => {
              const initials = avatarInitials(p.key);
              const color = resolvePersonaColor(p.color, p.key);
              return (
                <a href={`/map/persona/${p.key}`} class="scope-card persona-card">
                  <span
                    class="persona-avatar-badge"
                    style={`background-color: ${color}`}
                    aria-hidden="true"
                  >
                    {initials}
                  </span>
                  <span class="persona-card-body">
                    <span class="scope-card-name">{p.key}</span>
                    {p.summary && (
                      <span class="scope-card-body-text">{p.summary}</span>
                    )}
                  </span>
                </a>
              );
            })}
          </section>
        ) : (
          <p class="scope-list-intro">
            No personas yet. Create them from the Cognitive Map.
          </p>
        )}
      </div>
    </Layout>
  );
};
