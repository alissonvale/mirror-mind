import type { FC } from "hono/jsx";
import { Layout } from "../layout.js";
import type { IdentityLayer } from "../../../server/db.js";

export const UserProfilePage: FC<{
  userName: string;
  baseLayers: IdentityLayer[];
  personas: IdentityLayer[];
  saved?: string;
  deleted?: string;
}> = ({ userName, baseLayers, personas, saved, deleted }) => (
  <Layout title={userName}>
    <h1>{userName}</h1>
    <p>
      <a href="/admin/users">&larr; All users</a>
    </p>

    {saved && (
      <p class="flash flash-success">{saved} saved.</p>
    )}
    {deleted && (
      <p class="flash flash-success">"{deleted}" deleted.</p>
    )}

    <section class="layer-group">
      <h2>Base Identity</h2>
      {baseLayers.map((l) => (
        <details class="layer-card">
          <summary>
            <span class="layer-label">{l.layer}/{l.key}</span>
            <span class="layer-preview">
              {l.content.split("\n").find((line) => line.trim() && !line.startsWith("#"))?.trim().slice(0, 80) ?? ""}
            </span>
          </summary>
          <form
            method="POST"
            action={`/admin/users/${userName}`}
            class="layer-form"
          >
            <input type="hidden" name="group" value="base" />
            <input type="hidden" name="layer" value={l.layer} />
            <input type="hidden" name="key" value={l.key} />
            <textarea name="content">{l.content}</textarea>
            <button type="submit">Save</button>
          </form>
        </details>
      ))}
    </section>

    <section class="layer-group">
      <h2>
        Personas
        <span class="count">{personas.length}</span>
      </h2>

      {personas.length === 0 && (
        <p class="empty">No personas yet. Add one below or import via admin CLI.</p>
      )}

      {personas.map((p) => (
        <details class="layer-card">
          <summary>
            <span class="layer-label">{p.key}</span>
            <span class="layer-preview">
              {p.content.split("\n").find((line) => line.trim() && !line.startsWith("#"))?.trim().slice(0, 80) ?? ""}
            </span>
          </summary>
          <form
            method="POST"
            action={`/admin/users/${userName}`}
            class="layer-form"
          >
            <input type="hidden" name="group" value="persona" />
            <input type="hidden" name="key" value={p.key} />
            <textarea name="content">{p.content}</textarea>
            <div style="display: flex; gap: 0.5rem;">
              <button type="submit">Save</button>
              <button
                type="submit"
                name="action"
                value="delete"
                class="btn-danger"
                onclick="return confirm('Delete this persona?')"
              >
                Delete
              </button>
            </div>
          </form>
        </details>
      ))}

      <details class="layer-card layer-card-new">
        <summary>
          <span class="layer-label">+ Add persona</span>
        </summary>
        <form
          method="POST"
          action={`/admin/users/${userName}`}
          class="layer-form"
        >
          <input type="hidden" name="group" value="persona" />
          <input
            type="text"
            name="key"
            placeholder="Persona id (e.g. writer, strategist)"
            required
          />
          <textarea name="content" placeholder="Persona prompt content" required></textarea>
          <button type="submit">Add</button>
        </form>
      </details>
    </section>
  </Layout>
);
