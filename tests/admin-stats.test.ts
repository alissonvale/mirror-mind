import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getLatestRelease } from "../server/admin-stats.js";

describe("getLatestRelease", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "mirror-releases-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns null when the directory is empty", () => {
    expect(getLatestRelease(dir)).toBeNull();
  });

  it("returns null when the directory does not exist", () => {
    expect(getLatestRelease(path.join(dir, "missing"))).toBeNull();
  });

  it("picks the highest semver regardless of filesystem order", () => {
    writeFileSync(
      path.join(dir, "v0.2.0.md"),
      "# v0.2.0 — Second\n\n*16 April 2026*\n\nBody.\n",
    );
    writeFileSync(
      path.join(dir, "v0.10.0.md"),
      "# v0.10.0 — Tenth\n\n*21 April 2026*\n\nBody.\n",
    );
    writeFileSync(
      path.join(dir, "v0.1.0.md"),
      "# v0.1.0 — First\n\n*13 April 2026*\n\nBody.\n",
    );

    const result = getLatestRelease(dir);
    expect(result?.version).toBe("v0.10.0");
    expect(result?.title).toBe("Tenth");
    expect(result?.date).toBe("21 April 2026");
    expect(result?.url).toBe("/docs/releases/v0.10.0");
  });

  it("returns digest from frontmatter when present", () => {
    const body = [
      "---",
      "digest: |",
      "  Line one of the digest.",
      "  Line two of the digest.",
      "---",
      "# v0.9.0 — Subscription",
      "",
      "*21 April 2026*",
      "",
      "Body.",
      "",
    ].join("\n");
    writeFileSync(path.join(dir, "v0.9.0.md"), body);

    const result = getLatestRelease(dir);
    expect(result?.digest).toBe(
      "Line one of the digest.\nLine two of the digest.",
    );
    expect(result?.title).toBe("Subscription");
    expect(result?.date).toBe("21 April 2026");
  });

  it("returns null digest when frontmatter is absent", () => {
    writeFileSync(
      path.join(dir, "v0.1.0.md"),
      "# v0.1.0 — The Tracer Bullet\n\n*13 April 2026*\n\nBody.\n",
    );

    const result = getLatestRelease(dir);
    expect(result?.digest).toBeNull();
    expect(result?.title).toBe("The Tracer Bullet");
  });

  it("returns null digest when frontmatter lacks the digest key", () => {
    const body = [
      "---",
      "author: someone",
      "---",
      "# v0.1.0 — Title",
      "",
      "*13 April 2026*",
      "",
      "Body.",
    ].join("\n");
    writeFileSync(path.join(dir, "v0.1.0.md"), body);

    expect(getLatestRelease(dir)?.digest).toBeNull();
  });
});
