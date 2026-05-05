import { describe, it, expect } from "vitest";
import type { User } from "../server/db.js";
import { AvatarTopBar, TopBarLayout } from "../adapters/web/pages/avatar-top-bar.js";

function asAdmin(): User {
  return {
    id: "u1",
    name: "Admin User",
    token_hash: "h",
    role: "admin",
    show_brl_conversion: 1,
    locale: "en",
    created_at: 0,
  };
}
function asUser(): User {
  return {
    id: "u2",
    name: "Regular",
    token_hash: "h",
    role: "user",
    show_brl_conversion: 1,
    locale: "en",
    created_at: 0,
  };
}

async function renderToHtml(node: JSX.Element): Promise<string> {
  const result = node as unknown as { toString: () => string | Promise<string> };
  return await Promise.resolve(result.toString());
}

describe("AvatarTopBar (CV1.E11.S2)", () => {
  it("renders user name and brand", async () => {
    const html = await renderToHtml(<AvatarTopBar user={asUser()} />);
    expect(html).toContain("Regular");
    expect(html).toContain("Mirror Mind");
    expect(html).toContain("data-avatar-toggle");
    expect(html).toContain("data-avatar-dropdown");
  });

  it("renders Admin and Docs items only for admin role", async () => {
    const adminHtml = await renderToHtml(<AvatarTopBar user={asAdmin()} />);
    expect(adminHtml).toContain('href="/admin"');
    expect(adminHtml).toContain('href="/docs"');

    const userHtml = await renderToHtml(<AvatarTopBar user={asUser()} />);
    expect(userHtml).not.toContain('href="/admin"');
    expect(userHtml).not.toContain('href="/docs"');
  });

  it("renders Identidade and Memórias for any user (post CV1.E14)", async () => {
    const html = await renderToHtml(<AvatarTopBar user={asUser()} />);
    expect(html).toContain('href="/identidade"');
    expect(html).toContain('href="/memorias"');
  });

  it("renders Skills as disabled with em-breve badge", async () => {
    const html = await renderToHtml(<AvatarTopBar user={asUser()} />);
    expect(html).toContain("Skills");
    expect(html).toContain("avatar-top-bar-dropdown-item-disabled");
    expect(html).toContain("avatar-top-bar-badge");
  });

  it("logout is a POST form to /logout", async () => {
    const html = await renderToHtml(<AvatarTopBar user={asUser()} />);
    expect(html).toMatch(/form[^>]+method="POST"[^>]+action="\/logout"/i);
  });

  it("TopBarLayout wraps children with avatar bar + main", async () => {
    const html = await renderToHtml(
      <TopBarLayout title="Test" user={asUser()}>
        <p>hello</p>
      </TopBarLayout>,
    );
    expect(html).toContain("<title>Test — Mirror Mind</title>");
    expect(html).toContain("avatar-top-bar");
    expect(html).toContain("topbar-main");
    expect(html).toContain("hello");
    expect(html).toContain("/public/avatar-top-bar.js");
  });
});
