import type { FC } from "hono/jsx";
import { Layout, type SidebarScopes } from "../layout.js";
import type { User, UserRole } from "../../../../server/db.js";
import { ts, currentLocale } from "../../i18n.js";

interface UserRow {
  id: string;
  name: string;
  role: UserRole;
  created_at: number;
}

function formatCreatedDate(ts: number, locale: string): string {
  const tag = locale === "pt-BR" ? "pt-BR" : "en-US";
  return new Date(ts).toLocaleDateString(tag);
}

export const UsersPage: FC<{
  user: User;
  users: UserRow[];
  error?: string;
  createdUser?: string;
  createdToken?: string;
  sidebarScopes?: SidebarScopes;
}> = ({ user, users, error, createdUser, createdToken, sidebarScopes }) => {
  const locale = currentLocale();
  return (
  <Layout title={ts("admin.users.htmlTitle")} user={user} sidebarScopes={sidebarScopes}>
    <h1>{ts("admin.users.h1")}</h1>

    {createdToken && (
      <div>
        <p>
          {ts("admin.users.created.intro")}{" "}
          <strong>{createdUser}</strong>
          {ts("admin.users.created.outro")}
        </p>
        <div class="token-display">{createdToken}</div>
      </div>
    )}

    <table>
      <thead>
        <tr>
          <th>{ts("admin.users.colName")}</th>
          <th>{ts("admin.users.colRole")}</th>
          <th>{ts("admin.users.colCreated")}</th>
          <th>{ts("admin.users.colActions")}</th>
        </tr>
      </thead>
      <tbody>
        {users.map((u) => {
          const isSelf = u.id === user.id;
          const nextRole = u.role === "admin" ? "user" : "admin";
          const roleDisplay = u.role === "admin" ? ts("admin.users.roleAdmin") : ts("admin.users.roleUser");
          return (
            <tr>
              <td>{u.name}</td>
              <td>
                {isSelf ? (
                  <span class="user-role-self">{ts("admin.users.roleSelf", { role: roleDisplay })}</span>
                ) : (
                  <form
                    method="POST"
                    action={`/admin/users/${u.name}/role`}
                    class="user-inline-form"
                  >
                    <input type="hidden" name="role" value={nextRole} />
                    <button type="submit" class="user-row-action">
                      {ts(nextRole === "admin" ? "admin.users.clickToPromote" : "admin.users.clickToDemote", { role: roleDisplay })}
                    </button>
                  </form>
                )}
              </td>
              <td>{formatCreatedDate(u.created_at, locale)}</td>
              <td class="user-row-actions">
                <a href={`/map/${u.name}`}>{ts("admin.users.viewMap")}</a>
                {!isSelf && (
                  <form
                    method="POST"
                    action={`/admin/users/${u.name}/delete`}
                    class="user-inline-form"
                  >
                    <button
                      type="submit"
                      class="user-row-action user-row-action--destructive"
                      onclick={`return confirm('${ts("admin.users.deleteConfirm", { name: u.name }).replace(/'/g, "\\'")}')`}
                    >
                      {ts("admin.users.delete")}
                    </button>
                  </form>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>

    <h2>{ts("admin.users.createHeading")}</h2>
    {error && <p class="error">{error}</p>}
    <form method="POST" action="/admin/users" class="admin-form">
      <input type="text" name="name" placeholder={ts("admin.users.namePlaceholder")} required />
      <label class="admin-form-check">
        <input type="checkbox" name="is_admin" value="1" />
        <span>{ts("admin.users.adminCheck")}</span>
      </label>
      <button type="submit">{ts("admin.users.createSubmit")}</button>
    </form>
  </Layout>
  );
};
