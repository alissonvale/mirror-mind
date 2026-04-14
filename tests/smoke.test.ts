import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "node:child_process";
import { existsSync, rmSync, mkdirSync } from "node:fs";
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

  it("lists starter identity layers", () => {
    const output = run(`${ADMIN} identity list smokeuser`);
    expect(output).toContain("[ego/behavior]");
    expect(output).toContain("[ego/identity]");
    expect(output).toContain("[self/soul]");
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
});
