import type { FC } from "hono/jsx";
import { Layout } from "../layout.js";
import type { IdentityLayer } from "../../../server/db.js";

export const IdentityPage: FC<{
  userName: string;
  layers: IdentityLayer[];
  saved?: boolean;
}> = ({ userName, layers, saved }) => (
  <Layout title={`Identity — ${userName}`}>
    <h1>Identity: {userName}</h1>
    <p>
      <a href="/admin/users">&larr; Users</a>
      {" · "}
      <a href={`/admin/personas/${userName}`}>Personas</a>
    </p>

    {saved && <p style="color: green; margin-bottom: 1rem;">Layer saved.</p>}

    {layers.map((l) => (
      <div style="margin-bottom: 2rem;">
        <h2>
          {l.layer}/{l.key}
        </h2>
        <form
          method="POST"
          action={`/admin/identity/${userName}`}
          class="admin-form"
        >
          <input type="hidden" name="layer" value={l.layer} />
          <input type="hidden" name="key" value={l.key} />
          <textarea name="content">{l.content}</textarea>
          <button type="submit">Save</button>
        </form>
      </div>
    ))}

    <h2>Add layer</h2>
    <form
      method="POST"
      action={`/admin/identity/${userName}`}
      class="admin-form"
    >
      <input type="text" name="layer" placeholder="Layer (e.g. ego)" required />
      <input
        type="text"
        name="key"
        placeholder="Key (e.g. behavior)"
        required
      />
      <textarea name="content" placeholder="Content" required></textarea>
      <button type="submit">Add</button>
    </form>
  </Layout>
);
