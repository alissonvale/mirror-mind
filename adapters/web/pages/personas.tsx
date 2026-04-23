import type { FC } from "hono/jsx";
import { Layout, type SidebarScopes } from "./layout.js";
import type { User, IdentityLayer } from "../../../server/db.js";

/**
 * Personas listing — mirrors the /journeys and /organizations shape.
 * Each row is a small card linking to the persona workshop (currently
 * the layer-workshop route under /map/persona/:key; round 3 gives the
 * persona its own read/edit page). Inline controls: reorder (↑/↓) and
 * sidebar visibility toggle (●/◎).
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
            {personas.map((p, idx) => {
              const hidden = p.show_in_sidebar === 0;
              return (
                <div class={`scope-row ${hidden ? "scope-row-hidden" : ""}`}>
                  <div class="scope-row-controls" aria-label="Row controls">
                    <form
                      method="post"
                      action={`/personas/${p.key}/reorder`}
                      class="scope-row-control-form"
                    >
                      <input type="hidden" name="direction" value="up" />
                      <button
                        type="submit"
                        class="scope-row-control"
                        title="Move up"
                        aria-label="Move up"
                        disabled={idx === 0}
                      >
                        ↑
                      </button>
                    </form>
                    <form
                      method="post"
                      action={`/personas/${p.key}/reorder`}
                      class="scope-row-control-form"
                    >
                      <input type="hidden" name="direction" value="down" />
                      <button
                        type="submit"
                        class="scope-row-control"
                        title="Move down"
                        aria-label="Move down"
                        disabled={idx === personas.length - 1}
                      >
                        ↓
                      </button>
                    </form>
                    <form
                      method="post"
                      action={`/personas/${p.key}/sidebar`}
                      class="scope-row-control-form"
                    >
                      <input type="hidden" name="visible" value={hidden ? "1" : "0"} />
                      <button
                        type="submit"
                        class={`scope-row-control ${hidden ? "scope-row-control-off" : ""}`}
                        title={hidden ? "Show in sidebar" : "Hide from sidebar"}
                        aria-label={hidden ? "Show in sidebar" : "Hide from sidebar"}
                      >
                        {hidden ? "◎" : "●"}
                      </button>
                    </form>
                  </div>
                  <a href={`/map/persona/${p.key}`} class="scope-card">
                    <div class="scope-card-name-row">
                      <span class="scope-card-name">{p.key}</span>
                    </div>
                    {p.summary && <p class="scope-card-body">{p.summary}</p>}
                  </a>
                </div>
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
