import type { FC } from "hono/jsx";
import { Layout, type SidebarScopes } from "../layout.js";
import type { User, UserRole } from "../../../../server/db.js";

interface UserRow {
  id: string;
  name: string;
  role: UserRole;
  created_at: number;
}

export const UsersPage: FC<{
  user: User;
  users: UserRow[];
  error?: string;
  createdUser?: string;
  createdToken?: string;
  sidebarScopes?: SidebarScopes;
}> = ({ user, users, error, createdUser, createdToken, sidebarScopes }) => (
  <Layout title="Users" user={user} sidebarScopes={sidebarScopes}>
    <h1>Users</h1>

    {createdToken && (
      <div>
        <p>
          User <strong>{createdUser}</strong> created. Token (save it — won't be
          shown again):
        </p>
        <div class="token-display">{createdToken}</div>
      </div>
    )}

    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Role</th>
          <th>Created</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {users.map((u) => {
          const isSelf = u.id === user.id;
          const nextRole = u.role === "admin" ? "user" : "admin";
          return (
            <tr>
              <td>{u.name}</td>
              <td>
                {isSelf ? (
                  <span class="user-role-self">{u.role} (you)</span>
                ) : (
                  <form
                    method="POST"
                    action={`/admin/users/${u.name}/role`}
                    class="user-inline-form"
                  >
                    <input type="hidden" name="role" value={nextRole} />
                    <button type="submit" class="user-row-action">
                      {u.role} · click to {nextRole === "admin" ? "promote" : "demote"}
                    </button>
                  </form>
                )}
              </td>
              <td>{new Date(u.created_at).toLocaleDateString()}</td>
              <td class="user-row-actions">
                <a href={`/map/${u.name}`}>View map</a>
                {!isSelf && (
                  <form
                    method="POST"
                    action={`/admin/users/${u.name}/delete`}
                    class="user-inline-form"
                  >
                    <button
                      type="submit"
                      class="user-row-action user-row-action--destructive"
                      onclick={`return confirm('Delete ${u.name} and all their data? This cannot be undone.')`}
                    >
                      Delete
                    </button>
                  </form>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>

    <h2>Create user</h2>
    {error && <p class="error">{error}</p>}
    <form method="POST" action="/admin/users" class="admin-form">
      <input type="text" name="name" placeholder="Username" required />
      <label class="admin-form-check">
        <input type="checkbox" name="is_admin" value="1" />
        <span>Admin</span>
      </label>
      <button type="submit">Create</button>
    </form>
  </Layout>
);
