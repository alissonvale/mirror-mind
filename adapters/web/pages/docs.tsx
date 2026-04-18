import type { FC } from "hono/jsx";
import { raw } from "hono/html";
import { Layout } from "./layout.js";
import type { User } from "../../../server/db.js";
import type { NavNode } from "../../../server/docs.js";

export interface DocsPageProps {
  currentUser: User;
  currentUrl: string;
  html: string;
  title: string;
  nav: NavNode[];
}

const NavList: FC<{ nodes: NavNode[]; currentUrl: string }> = ({
  nodes,
  currentUrl,
}) => (
  <ul class="docs-nav-list">
    {nodes.map((node) => (
      <li
        class={`docs-nav-item ${node.isFolder ? "docs-nav-folder" : ""} ${
          node.url === currentUrl ? "docs-nav-current" : ""
        }`}
      >
        <a href={node.url} class="docs-nav-link">
          {node.name}
        </a>
        {node.children && node.children.length > 0 && (
          <NavList nodes={node.children} currentUrl={currentUrl} />
        )}
      </li>
    ))}
  </ul>
);

export const DocsPage: FC<DocsPageProps> = ({
  currentUser,
  currentUrl,
  html,
  title,
  nav,
}) => (
  <Layout title={`${title} — Docs`} user={currentUser} wide>
    <div class="docs-shell docs-nav-collapsed" id="docs-shell">
      <aside class="docs-nav">
        <div class="docs-nav-header">
          <a href="/docs" class="docs-nav-root">Docs</a>
        </div>
        <NavList nodes={nav} currentUrl={currentUrl} />
      </aside>
      <main class="docs-content">
        <button
          id="docs-nav-toggle"
          class="docs-nav-toggle"
          type="button"
          aria-label="Toggle navigation"
        >
          <span class="docs-nav-toggle-hide">← Hide navigation</span>
          <span class="docs-nav-toggle-show">→ Show navigation</span>
        </button>
        <article class="docs-prose">{raw(html)}</article>
      </main>
    </div>
    <script src="/public/docs.js?v=s3-3"></script>
  </Layout>
);
