import type { FC } from "hono/jsx";
import { Layout } from "../layout.js";
import type { IdentityLayer } from "../../../server/db.js";

export const PersonasPage: FC<{
  userName: string;
  personas: IdentityLayer[];
  saved?: boolean;
  deleted?: string;
}> = ({ userName, personas, saved, deleted }) => (
  <Layout title={`Personas — ${userName}`}>
    <h1>Personas: {userName}</h1>
    <p>
      <a href={`/admin/identity/${userName}`}>&larr; Base identity</a>
      {" · "}
      <a href="/admin/users">&larr; Users</a>
    </p>

    {saved && <p style="color: green; margin-bottom: 1rem;">Persona saved.</p>}
    {deleted && (
      <p style="color: green; margin-bottom: 1rem;">
        Persona "{deleted}" deleted.
      </p>
    )}

    {personas.length === 0 && (
      <p style="color: #666; margin: 2rem 0;">
        No personas yet. Add one below or import from POC via admin CLI.
      </p>
    )}

    {personas.map((p) => (
      <div style="margin-bottom: 2rem;">
        <h2>{p.key}</h2>
        <form
          method="POST"
          action={`/admin/personas/${userName}`}
          class="admin-form"
        >
          <input type="hidden" name="action" value="save" />
          <input type="hidden" name="key" value={p.key} />
          <textarea name="content">{p.content}</textarea>
          <div style="display: flex; gap: 0.5rem;">
            <button type="submit">Save</button>
            <button
              type="submit"
              formaction={`/admin/personas/${userName}`}
              name="action"
              value="delete"
              style="background: #c00;"
              onclick="return confirm('Delete this persona?')"
            >
              Delete
            </button>
          </div>
        </form>
      </div>
    ))}

    <h2>Add persona</h2>
    <form
      method="POST"
      action={`/admin/personas/${userName}`}
      class="admin-form"
    >
      <input type="hidden" name="action" value="save" />
      <input
        type="text"
        name="key"
        placeholder="Persona id (e.g. writer, strategist)"
        required
      />
      <textarea name="content" placeholder="Persona prompt content" required></textarea>
      <button type="submit">Add</button>
    </form>
  </Layout>
);
