import { randomBytes, createHash } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import { homedir } from "node:os";
import Database from "better-sqlite3";
import {
  openDb,
  createUser,
  getUserByName,
  setIdentityLayer,
  getIdentityLayers,
  getOrCreateSession,
} from "./db.js";

// --- Starter identity templates ---

const STARTER_SOUL = `# Soul

## Who I Am
I am a personal intelligence mirror. My purpose is to amplify my user's awareness.

## Core Role
(Describe the mirror's primary function for you.)

## Domains
(List the domains where the mirror operates.)
`;

const STARTER_IDENTITY = `# Identity

## Who I am and what I do
I am my user's primary intelligence asset — a conscious mirror of their values, behavior, and voice.
`;

const STARTER_BEHAVIOR = `# Behavior

## Tone and Style
- Calm, confident, non-reactive
- Direct and pragmatic

## Constraints
1. Stay within my domain
2. Never invent data — admit when I don't know
3. I'm an intellectual partner, not a task executor
`;

// --- Import from POC ---

export function importIdentityFromPoc(
  db: Database.Database,
  userId: string,
  pocDbPath: string,
): number {
  if (!existsSync(pocDbPath)) {
    throw new Error(`POC database not found: ${pocDbPath}`);
  }

  const pocDb = new Database(pocDbPath, { readonly: true });
  const rows = pocDb
    .prepare(
      `SELECT layer, key, content FROM identity
       WHERE (layer = 'self' AND key = 'soul')
          OR (layer = 'ego' AND key IN ('identity', 'behavior'))`,
    )
    .all() as { layer: string; key: string; content: string }[];
  pocDb.close();

  for (const row of rows) {
    setIdentityLayer(db, userId, row.layer, row.key, row.content);
  }

  return rows.length;
}

// --- CLI ---

function usage(): never {
  console.log(`Usage:
  npx tsx server/admin.ts user add <name>
  npx tsx server/admin.ts identity set <name> --layer <layer> --key <key> --text <text>
  npx tsx server/admin.ts identity list <name>
  npx tsx server/admin.ts identity import <name> --from-poc`);
  process.exit(1);
}

function parseFlag(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return undefined;
  return args[idx + 1];
}

function main() {
  const args = process.argv.slice(2);
  const group = args[0];
  const action = args[1];
  const name = args[2];

  if (!group || !action) usage();

  const db = openDb();

  if (group === "user" && action === "add" && name) {
    const existing = getUserByName(db, name);
    if (existing) {
      console.error(`User "${name}" already exists.`);
      process.exit(1);
    }

    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const user = createUser(db, name, tokenHash);

    setIdentityLayer(db, user.id, "self", "soul", STARTER_SOUL);
    setIdentityLayer(db, user.id, "ego", "identity", STARTER_IDENTITY);
    setIdentityLayer(db, user.id, "ego", "behavior", STARTER_BEHAVIOR);

    const sessionId = getOrCreateSession(db, user.id);

    console.log(`
User created.

  Name:     ${name}
  ID:       ${user.id}
  Session:  ${sessionId}

  Token (store it — won't be shown again):

  ${token}
`);
    return;
  }

  if (group === "identity" && action === "set" && name) {
    const user = getUserByName(db, name);
    if (!user) {
      console.error(`User "${name}" not found.`);
      process.exit(1);
    }

    const layer = parseFlag(args, "--layer");
    const key = parseFlag(args, "--key");
    const text = parseFlag(args, "--text");

    if (!layer || !key || !text) {
      console.error("Missing flags: --layer, --key, and --text are required.");
      process.exit(1);
    }

    setIdentityLayer(db, user.id, layer, key, text);
    console.log(`Identity layer set: ${layer}/${key}`);
    return;
  }

  if (group === "identity" && action === "list" && name) {
    const user = getUserByName(db, name);
    if (!user) {
      console.error(`User "${name}" not found.`);
      process.exit(1);
    }

    const layers = getIdentityLayers(db, user.id);
    if (layers.length === 0) {
      console.log(`No identity layers for "${name}".`);
      return;
    }

    console.log(`Identity layers for "${name}":\n`);
    for (const l of layers) {
      const preview = l.content.replace(/\n/g, " ").slice(0, 80);
      console.log(`  [${l.layer}/${l.key}] ${preview}...`);
    }
    console.log();
    return;
  }

  if (group === "identity" && action === "import" && name) {
    const user = getUserByName(db, name);
    if (!user) {
      console.error(`User "${name}" not found.`);
      process.exit(1);
    }

    const fromPoc = args.includes("--from-poc");
    if (!fromPoc) {
      console.error("Missing flag: --from-poc");
      process.exit(1);
    }

    const pocPath = path.join(homedir(), ".espelho", "memoria.db");
    const count = importIdentityFromPoc(db, user.id, pocPath);
    console.log(`Imported ${count} identity layers from POC Mirror.`);
    return;
  }

  usage();
}

// Only run CLI when executed directly, not when imported
const isDirectRun =
  process.argv[1]?.endsWith("admin.ts") ||
  process.argv[1]?.endsWith("admin.js");
if (isDirectRun) {
  main();
}
