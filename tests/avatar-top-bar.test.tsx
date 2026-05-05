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

  it("renders the four-group dropdown structure", async () => {
    const html = await renderToHtml(<AvatarTopBar user={asUser()} />);
    // Group 1: operational + contemplative entries.
    expect(html).toContain('href="/inicio"');
    expect(html).toContain('href="/espelho"');
    // Group 2: browse surfaces — Memórias / Território / Skills / Identidade.
    expect(html).toContain('href="/memorias"');
    expect(html).toContain('href="/territorio"');
    expect(html).toContain('href="/identidade"');
    expect(html).toMatch(/avatar-top-bar-dropdown-item-disabled/); // Skills
  });

  it("orders dropdown groups: Iniciar → Espelho → browse → Identidade last", async () => {
    const html = await renderToHtml(<AvatarTopBar user={asUser()} />);
    const idxInicio = html.indexOf('href="/inicio"');
    const idxEspelho = html.indexOf('href="/espelho"');
    const idxMemorias = html.indexOf('href="/memorias"');
    const idxTerritorio = html.indexOf('href="/territorio"');
    const idxIdentidade = html.indexOf('href="/identidade"');
    expect(idxInicio).toBeGreaterThan(-1);
    expect(idxInicio).toBeLessThan(idxEspelho);
    expect(idxEspelho).toBeLessThan(idxMemorias);
    expect(idxMemorias).toBeLessThan(idxTerritorio);
    expect(idxTerritorio).toBeLessThan(idxIdentidade);
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
