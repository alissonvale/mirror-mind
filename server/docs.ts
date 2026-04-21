import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { marked, Renderer } from "marked";
import matter from "gray-matter";

/**
 * In-app docs reader (CV0.E3.S3). Reads files from the `docs/` folder at
 * request time, renders markdown to HTML with marked, and rewrites relative
 * `.md` links to their `/docs/...` routes so navigation stays inside the app.
 *
 * Runtime-over-build: docs change often; always-current beats build-step lag.
 * Admin-only is enforced at the route layer, not here.
 */

export const DOCS_ROOT = path.resolve(process.cwd(), "docs");

export interface NavNode {
  name: string;
  url: string;
  isFolder: boolean;
  children?: NavNode[];
}

/**
 * Map a URL path like "/docs/process/development-guide" (or "" for the root)
 * to an absolute filesystem path under DOCS_ROOT. Returns null on:
 *   - path traversal attempts
 *   - missing files
 * Priority: exact `.md` file first, then `<path>/index.md`.
 */
export function resolveDocPath(urlPath: string): string | null {
  // Normalize: strip /docs prefix, leading/trailing slashes.
  let rel = urlPath.replace(/^\/?docs\/?/, "").replace(/^\/+|\/+$/g, "");

  const tryPaths = rel === ""
    ? [path.join(DOCS_ROOT, "index.md")]
    : [
        path.join(DOCS_ROOT, `${rel}.md`),
        path.join(DOCS_ROOT, rel, "index.md"),
      ];

  for (const candidate of tryPaths) {
    const resolved = path.resolve(candidate);
    // Traversal guard: the resolved path must live under DOCS_ROOT.
    if (!resolved.startsWith(DOCS_ROOT + path.sep) && resolved !== DOCS_ROOT) {
      continue;
    }
    if (existsSync(resolved) && statSync(resolved).isFile()) {
      return resolved;
    }
  }
  return null;
}

/**
 * Derive the URL route for a given absolute filesystem path under DOCS_ROOT.
 * Used by the nav tree builder.
 */
function urlForPath(absPath: string): string {
  const rel = path.relative(DOCS_ROOT, absPath).replace(/\\/g, "/");
  if (rel === "index.md" || rel === "") return "/docs";
  if (rel.endsWith("/index.md")) return `/docs/${rel.slice(0, -9)}`;
  if (rel.endsWith(".md")) return `/docs/${rel.slice(0, -3)}`;
  return `/docs/${rel}`;
}

/**
 * Heuristic for a human-readable name. Uses the first `# heading` of the file
 * if the file is markdown; otherwise the basename.
 */
function nameForFile(absPath: string): string {
  const base = path.basename(absPath);
  if (base.endsWith(".md")) {
    try {
      const content = readFileSync(absPath, "utf-8");
      const match = content.match(/^#\s+(.+?)\s*$/m);
      if (match) return match[1].replace(/[✅⚠️◇💡🎯]\s*/g, "").trim();
    } catch {
      // fall through to filename
    }
    return base.replace(/\.md$/, "");
  }
  return base;
}

/**
 * Recursively build a navigation tree rooted at DOCS_ROOT. Each entry has a
 * display name, a URL, and children for folders.
 *
 * Folder ordering: `index.md` at the top if present, then folders alphabetical,
 * then files alphabetical. Filters out hidden files and anything non-md that
 * isn't a folder.
 */
export function buildNavTree(root: string = DOCS_ROOT): NavNode[] {
  function walk(dir: string): NavNode[] {
    const entries = readdirSync(dir, { withFileTypes: true });
    const folders: NavNode[] = [];
    const files: NavNode[] = [];

    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const idx = path.join(full, "index.md");
        const children = walk(full);
        const name = existsSync(idx) ? nameForFile(idx) : entry.name;
        folders.push({
          name,
          url: urlForPath(full),
          isFolder: true,
          children,
        });
      } else if (entry.name.endsWith(".md") && entry.name !== "index.md") {
        // index.md is navigated via its folder's URL — don't list it as a
        // separate sibling file.
        files.push({
          name: nameForFile(full),
          url: urlForPath(full),
          isFolder: false,
        });
      }
    }

    folders.sort((a, b) => a.name.localeCompare(b.name));
    files.sort((a, b) => a.name.localeCompare(b.name));
    return [...folders, ...files];
  }

  return walk(root);
}

/**
 * Returns the URL directory (ending with `/`) that contains the given
 * resolved doc file. This is what relative links in the file resolve
 * against. When the file is a folder's `index.md`, the dir is the folder
 * itself; otherwise it's the file's parent folder.
 */
export function urlDirForResolvedFile(absPath: string): string {
  const rel = path.relative(DOCS_ROOT, absPath).replace(/\\/g, "/");
  if (rel === "index.md") return "/docs/";
  if (rel.endsWith("/index.md")) {
    return "/docs/" + rel.slice(0, -"index.md".length);
  }
  const parent = path.posix.dirname(rel);
  return parent === "." ? "/docs/" : `/docs/${parent}/`;
}

/**
 * Render markdown to HTML using marked. Rewrites relative `.md` links to
 * `/docs/...` routes so navigation stays in the app. `dir` is the URL
 * directory the links resolve against — compute it via
 * `urlDirForResolvedFile(resolvedPath)`.
 */
export function renderMarkdown(md: string, dir: string): string {
  // Strip YAML frontmatter (e.g. release digests) before handing to marked —
  // otherwise the `---\n...\n---` block renders as a horizontal rule + literal
  // text on the `/docs` surface.
  const body = matter(md).content;

  const renderer = new Renderer();
  const origLink = renderer.link.bind(renderer);
  renderer.link = function ({ href, title, tokens }: any) {
    if (href && typeof href === "string") {
      const rewritten = rewriteDocLink(href, dir);
      if (rewritten !== null) {
        return origLink({ href: rewritten, title, tokens });
      }
    }
    return origLink({ href, title, tokens });
  };

  return marked.parse(body, { renderer, async: false }) as string;
}

/**
 * Rewrite a markdown link href to an in-app docs route when the link points
 * at something inside the docs tree. Returns null when the link should be
 * left alone (external URL, anchor, in-app non-docs path like `/map`).
 *
 * Handles three input shapes:
 *   - `../project/decisions.md` — relative .md
 *   - `product/prompt-composition/` — relative directory (trailing slash)
 *   - `/docs/process/worklog.md` — root-relative inside the docs tree
 *
 * The output is always an absolute `/docs/...` path with `.md`, `/index`,
 * and trailing slashes stripped for clean URLs.
 */
function rewriteDocLink(href: string, currentDir: string): string | null {
  if (
    href.startsWith("http://") ||
    href.startsWith("https://") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:") ||
    href.startsWith("#")
  ) {
    return null;
  }
  // Non-docs in-app paths (e.g. /map, /mirror) — leave alone.
  if (href.startsWith("/") && !href.startsWith("/docs")) {
    return null;
  }

  const [p, anchor] = href.split("#");
  let resolved: string;
  if (p.startsWith("/")) {
    resolved = p;
  } else {
    const url = new URL(p, `http://placeholder${currentDir}`);
    resolved = url.pathname;
  }

  // Normalize: drop .md, drop /index, drop trailing / (unless we're at root).
  resolved = resolved.replace(/\.md$/, "");
  resolved = resolved.replace(/\/index$/, "");
  if (resolved.length > 1 && resolved.endsWith("/")) {
    resolved = resolved.slice(0, -1);
  }

  // Ensure the /docs prefix — relative links resolved from a dir starting
  // with /docs/ already include it, but defensively handle anything that
  // slipped through.
  if (!resolved.startsWith("/docs")) {
    resolved = `/docs${resolved.startsWith("/") ? "" : "/"}${resolved}`;
  }

  return anchor ? `${resolved}#${anchor}` : resolved;
}
