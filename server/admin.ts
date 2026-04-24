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
import {
  importConversationDir,
  ImportError,
  type ImportReport,
} from "./import/conversation-importer.js";
import {
  loadNarrative,
  readTokens,
  tokensPath,
  type LoadReport,
} from "./import/narrative-loader.js";

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
          OR (layer = 'ego' AND key IN ('identity', 'behavior'))
          OR layer = 'persona'`,
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

  // ego/behavior and ego/expression are seeded — see adapters/web/index.tsx
  // for rationale. Self/soul and ego/identity are left empty so the
  // Cognitive Map's invitations appear on first use.
  setIdentityLayer(db, user.id, "ego", "behavior", loadTemplate("behavior"));
  setIdentityLayer(db, user.id, "ego", "expression", loadTemplate("expression"));

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

function handleConversationImport(
  db: Database.Database,
  name: string,
  args: string[],
) {
  const dir = parseFlag(args, "--dir");
  const persona = parseFlag(args, "--persona");
  const organization = parseFlag(args, "--organization");
  const journey = parseFlag(args, "--journey");
  const dryRun = args.includes("--dry-run");

  if (!dir) {
    console.error("Missing flag: --dir <path>");
    process.exit(1);
  }
  if (!persona) {
    console.error("Missing flag: --persona <key>");
    process.exit(1);
  }
  if (!existsSync(dir)) {
    console.error(`Directory not found: ${dir}`);
    process.exit(1);
  }

  let report: ImportReport;
  try {
    report = importConversationDir(db, {
      userName: name,
      dir,
      personaKey: persona,
      organizationKey: organization,
      journeyKey: journey,
      dryRun,
    });
  } catch (err) {
    if (err instanceof ImportError) {
      console.error(err.message);
      process.exit(1);
    }
    throw err;
  }

  printImportReport(report);
}

function printImportReport(report: ImportReport) {
  const mode = report.dryRun ? "DRY RUN — nothing was written" : "imported";
  const tags = [
    `persona=${report.persona}`,
    report.organization ? `organization=${report.organization}` : null,
    report.journey ? `journey=${report.journey}` : null,
  ]
    .filter(Boolean)
    .join(" ");

  console.log(`
Conversation import for user "${report.user}" (${tags})
${mode}

  Files processed:    ${report.filesProcessed}
  Sessions ${report.dryRun ? "(would be) created" : "created"}: ${report.dryRun ? report.files.filter((f) => f.status === "would-import").length : report.sessionsCreated}
  Entries  ${report.dryRun ? "(would be) created" : "created"}: ${report.dryRun ? report.files.reduce((acc, f) => acc + (f.entryCount ?? 0), 0) : report.entriesCreated}
`);

  for (const f of report.files) {
    const icon =
      f.status === "imported" || f.status === "would-import"
        ? "✓"
        : f.status === "skipped"
          ? "·"
          : "✗";
    const detail =
      f.status === "imported" || f.status === "would-import"
        ? `${f.entryCount} entries → "${f.title}"`
        : (f.reason ?? "");
    console.log(`  ${icon} ${f.filename}  ${detail}`);
  }

  if (report.dryRun) {
    console.log(`
Re-run without --dry-run to apply.`);
  }
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

function handleNarrativeLoad(db: Database.Database, args: string[]) {
  const resetConversations = args.includes("--reset-conversations");
  const resetTokens = args.includes("--reset-tokens");
  const backup = !args.includes("--no-backup");

  let report: LoadReport;
  try {
    report = loadNarrative(db, { resetConversations, resetTokens, backup });
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }

  printNarrativeReport(report);
}

function handleNarrativeTokens() {
  const tokens = readTokens();
  const entries = Object.entries(tokens);
  if (entries.length === 0) {
    console.log(
      `No tokens recorded yet at ${tokensPath()}.\nRun 'narrative load' to provision the narrative users.`,
    );
    return;
  }

  console.log(`Tokens file: ${tokensPath()}\n`);
  for (const [slug, token] of entries) {
    console.log(`  ${slug.padEnd(24)} ${token}`);
  }
  console.log();
}

function printNarrativeReport(report: LoadReport) {
  console.log();
  if (report.backupPath) {
    console.log(`Backup written: ${report.backupPath}`);
    console.log();
  }

  for (const u of report.users) {
    const createdMarker = u.created ? "✓ created" : "· existed";
    const tokenMarker =
      u.tokenAction === "generated"
        ? "token generated"
        : u.tokenAction === "regenerated"
          ? "token regenerated"
          : u.tokenAction === "kept"
            ? "token kept"
            : "token not in .tokens.local (use --reset-tokens to regenerate)";

    const roleMarker = u.role === "admin" ? " [admin]" : "";
    console.log(`  ${createdMarker}  ${u.name} (${u.slug})${roleMarker}`);
    console.log(`      ${tokenMarker}`);
    console.log(
      `      identity=${u.identityUpserts}  orgs=${u.orgsUpserted}  journeys=${u.journeysUpserted}  conversations=${u.conversationsImported} imported, ${u.conversationsSkipped} skipped`,
    );
  }

  console.log(`\nTokens file: ${tokensPath()}\n`);
}

function usage(): never {
  console.log(`Usage:
  npx tsx server/admin.ts user add <name>
  npx tsx server/admin.ts user reset <name>
  npx tsx server/admin.ts identity set <name> --layer <layer> --key <key> --text <text>
  npx tsx server/admin.ts identity list <name>
  npx tsx server/admin.ts identity import <name> --from-poc
  npx tsx server/admin.ts conversation import <name> --dir <path> --persona <key> [--organization <key>] [--journey <key>] [--dry-run]
  npx tsx server/admin.ts telegram link <name> <telegram_id>
  npx tsx server/admin.ts narrative load [--reset-conversations] [--reset-tokens] [--no-backup]
  npx tsx server/admin.ts narrative tokens`);
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

  if (!group || !action) usage();

  const db = openDb();

  // Narrative commands don't take a user name — they operate on the fixture tree.
  if (group === "narrative" && action === "load") return handleNarrativeLoad(db, args);
  if (group === "narrative" && action === "tokens") return handleNarrativeTokens();

  const name = args[2];
  if (!name) usage();

  if (group === "user" && action === "add") handleUserAdd(db, name);
  else if (group === "user" && action === "reset") handleUserReset(db, name);
  else if (group === "identity" && action === "set") handleIdentitySet(db, name, args);
  else if (group === "identity" && action === "list") handleIdentityList(db, name);
  else if (group === "identity" && action === "import") handleIdentityImport(db, name, args);
  else if (group === "conversation" && action === "import") handleConversationImport(db, name, args);
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
