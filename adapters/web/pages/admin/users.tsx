import type { FC } from "hono/jsx";
import { Layout } from "../layout.js";
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
}> = ({ user, users, error, createdUser, createdToken }) => (
  <Layout title="Users" user={user}>
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
          <th>Identity</th>
        </tr>
      </thead>
      <tbody>
        {users.map((u) => (
          <tr>
            <td>{u.name}</td>
            <td>{u.role}</td>
            <td>{new Date(u.created_at).toLocaleDateString()}</td>
            <td>
              <a href={`/admin/users/${u.name}`}>Edit</a>
            </td>
          </tr>
        ))}
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
