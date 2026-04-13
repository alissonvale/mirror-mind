import { randomBytes, createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
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
  linkTelegramUser,
  type User,
} from "./db.js";

// --- Templates ---

function loadTemplate(name: string): string {
  return readFileSync(
    path.join(import.meta.dirname, "templates", `${name}.md`),
    "utf-8",
  );
}

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

// --- Command handlers ---

function requireUser(db: Database.Database, name: string): User {
  const user = getUserByName(db, name);
  if (!user) {
    console.error(`User "${name}" not found.`);
    process.exit(1);
  }
  return user;
}

function handleUserAdd(db: Database.Database, name: string) {
  const existing = getUserByName(db, name);
  if (existing) {
    console.error(`User "${name}" already exists.`);
    process.exit(1);
  }

  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const user = createUser(db, name, tokenHash);

  setIdentityLayer(db, user.id, "self", "soul", loadTemplate("soul"));
  setIdentityLayer(db, user.id, "ego", "identity", loadTemplate("identity"));
  setIdentityLayer(db, user.id, "ego", "behavior", loadTemplate("behavior"));

  const sessionId = getOrCreateSession(db, user.id);

  console.log(`
User created.

  Name:     ${name}
  ID:       ${user.id}
  Session:  ${sessionId}

  Token (store it — won't be shown again):

  ${token}
`);
}

function handleIdentitySet(db: Database.Database, name: string, args: string[]) {
  const user = requireUser(db, name);

  const layer = parseFlag(args, "--layer");
  const key = parseFlag(args, "--key");
  const text = parseFlag(args, "--text");

  if (!layer || !key || !text) {
    console.error("Missing flags: --layer, --key, and --text are required.");
    process.exit(1);
  }

  setIdentityLayer(db, user.id, layer, key, text);
  console.log(`Identity layer set: ${layer}/${key}`);
}

function handleIdentityList(db: Database.Database, name: string) {
  const user = requireUser(db, name);
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
}

function handleIdentityImport(db: Database.Database, name: string, args: string[]) {
  const user = requireUser(db, name);

  if (!args.includes("--from-poc")) {
    console.error("Missing flag: --from-poc");
    process.exit(1);
  }

  const pocPath = path.join(homedir(), ".espelho", "memoria.db");
  const count = importIdentityFromPoc(db, user.id, pocPath);
  console.log(`Imported ${count} identity layers from POC Mirror.`);
}

function handleTelegramLink(db: Database.Database, name: string, args: string[]) {
  const user = requireUser(db, name);
  const telegramId = args[3];

  if (!telegramId) {
    console.error("Missing telegram_id. Usage: telegram link <name> <telegram_id>");
    process.exit(1);
  }

  linkTelegramUser(db, telegramId, user.id);
  console.log(`Linked Telegram user ${telegramId} → ${name}`);
}

// --- CLI ---

function handleUserReset(db: Database.Database, name: string) {
  const user = requireUser(db, name);
  const deleted = db
    .prepare(
      `DELETE FROM entries WHERE session_id IN (SELECT id FROM sessions WHERE user_id = ?)`,
    )
    .run(user.id);
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(user.id);
  console.log(`Reset ${name}: ${deleted.changes} entries deleted, sessions cleared.`);
}

function usage(): never {
  console.log(`Usage:
  npx tsx server/admin.ts user add <name>
  npx tsx server/admin.ts user reset <name>
  npx tsx server/admin.ts identity set <name> --layer <layer> --key <key> --text <text>
  npx tsx server/admin.ts identity list <name>
  npx tsx server/admin.ts identity import <name> --from-poc
  npx tsx server/admin.ts telegram link <name> <telegram_id>`);
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

  if (!group || !action || !name) usage();

  const db = openDb();

  if (group === "user" && action === "add") handleUserAdd(db, name);
  else if (group === "user" && action === "reset") handleUserReset(db, name);
  else if (group === "identity" && action === "set") handleIdentitySet(db, name, args);
  else if (group === "identity" && action === "list") handleIdentityList(db, name);
  else if (group === "identity" && action === "import") handleIdentityImport(db, name, args);
  else if (group === "telegram" && action === "link") handleTelegramLink(db, name, args);
  else usage();
}

// Only run CLI when executed directly, not when imported
const isDirectRun =
  process.argv[1]?.endsWith("admin.ts") ||
  process.argv[1]?.endsWith("admin.js");
if (isDirectRun) {
  main();
}
