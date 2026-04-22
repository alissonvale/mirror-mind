import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "node:child_process";
import { existsSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const TEST_DIR = `/tmp/mirror-smoke-${Date.now()}`;
const DB_PATH = path.join(TEST_DIR, "data", "mirror.db");
const ADMIN = `npx tsx server/admin.ts`;

function run(cmd: string): string {
  return execSync(cmd, {
    cwd: path.resolve(import.meta.dirname, ".."),
    env: { ...process.env, MIRROR_DB_PATH: DB_PATH },
    encoding: "utf-8",
  });
}

describe("smoke: admin CLI end-to-end", { timeout: 30_000 }, () => {
  beforeAll(() => {
    mkdirSync(path.join(TEST_DIR, "data"), { recursive: true });
  });

  afterAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("creates a user with starter identity", () => {
    const output = run(`${ADMIN} user add smokeuser`);
    expect(output).toContain("User created.");
    expect(output).toContain("smokeuser");
    expect(output).toContain("Token");
  });

  it("lists the seeded ego/behavior and ego/expression baseline; self/soul and ego/identity are left empty", () => {
    const output = run(`${ADMIN} identity list smokeuser`);
    expect(output).toContain("[ego/behavior]");
    expect(output).toContain("[ego/expression]");
    // Self/soul and ego/identity are no longer seeded on user creation —
    // they stay empty so the Cognitive Map's invitations appear (S10).
    expect(output).not.toContain("[ego/identity]");
    expect(output).not.toContain("[self/soul]");
  });

  it("sets a specific identity layer", () => {
    const output = run(
      `${ADMIN} identity set smokeuser --layer ego --key behavior --text "I am direct."`,
    );
    expect(output).toContain("Identity layer set: ego/behavior");

    const list = run(`${ADMIN} identity list smokeuser`);
    expect(list).toContain("I am direct.");
  });

  it("imports identity from POC Mirror", () => {
    const pocPath = path.join(process.env.HOME!, ".espelho", "memoria.db");
    if (!existsSync(pocPath)) {
      console.log("Skipping POC import — ~/.espelho/memoria.db not found");
      return;
    }

    const output = run(`${ADMIN} identity import smokeuser --from-poc`);
    expect(output).toMatch(/Imported \d+ identity layers/);

    const list = run(`${ADMIN} identity list smokeuser`);
    expect(list).toContain("Alma");
  });

  it("rejects duplicate user", () => {
    expect(() => run(`${ADMIN} user add smokeuser`)).toThrow();
  });

  it("imports a directory of conversation markdowns", () => {
    // Set up a persona for the import to attach to.
    run(
      `${ADMIN} identity set smokeuser --layer persona --key estrategista --text "You are a strategist."`,
    );

    // Build a fixture directory with two valid conversations and one bad.
    const importDir = path.join(TEST_DIR, "imports");
    mkdirSync(importDir, { recursive: true });
    writeFileSync(
      path.join(importDir, "01-good.md"),
      `---\ntitle: "First"\n---\n\n**User:**\nhi\n\n**Assistant:**\nhello\n`,
    );
    writeFileSync(
      path.join(importDir, "02-good.md"),
      `**User:**\nagain\n\n**Assistant:**\nback\n`,
    );

    // Dry-run first.
    const dry = run(
      `${ADMIN} conversation import smokeuser --dir ${importDir} --persona estrategista --dry-run`,
    );
    expect(dry).toContain("DRY RUN");
    expect(dry).toContain("01-good.md");
    expect(dry).toContain("02-good.md");
    expect(dry).toContain("Re-run without --dry-run");

    // Real run.
    const out = run(
      `${ADMIN} conversation import smokeuser --dir ${importDir} --persona estrategista`,
    );
    expect(out).toContain("imported");
    expect(out).toContain("Sessions created: 2");
    expect(out).toContain("Entries  created: 4");
  });

  it("rejects conversation import with missing persona", () => {
    const importDir = path.join(TEST_DIR, "imports");
    expect(() =>
      run(
        `${ADMIN} conversation import smokeuser --dir ${importDir} --persona ghost`,
      ),
    ).toThrow();
  });
});
