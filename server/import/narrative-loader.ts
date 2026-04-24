import { randomBytes, createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync, copyFileSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import matter from "gray-matter";

import { getUserByName, createUser, type User } from "../db/users.js";
import { setIdentityLayer } from "../db/identity.js";
import {
  getOrganizationByKey,
  createOrganization,
  updateOrganization,
} from "../db/organizations.js";
import {
  getJourneyByKey,
  createJourney,
  updateJourney,
  linkJourneyOrganization,
} from "../db/journeys.js";
import { createSessionAt } from "../db/sessions.js";
import { appendEntry } from "../db/entries.js";
import {
  addSessionPersona,
  addSessionOrganization,
  addSessionJourney,
} from "../db/session-tags.js";
import {
  parseConversationMarkdown,
  MarkdownConversationError,
} from "./markdown-conversation.js";

// ---------- Configuration ----------

/**
 * Location of the fictional Reilly-Marchetti family fixture tree.
 * One subdirectory per user under `users/`. See docs/product-use-narrative/
 * for the full narrative and format.
 */
export const NARRATIVE_ROOT = path.resolve(
  process.cwd(),
  "docs/product-use-narrative",
);

export const TOKENS_FILE = path.join(NARRATIVE_ROOT, ".tokens.local");

// ---------- Types ----------

export interface LoadOptions {
  /** Wipe and re-import conversations instead of skipping duplicates. */
  resetConversations?: boolean;
  /** Regenerate bearer tokens even for users that already exist. */
  resetTokens?: boolean;
  /** Write a timestamped backup of the DB file before any DB write. */
  backup?: boolean;
}

export interface UserLoadReport {
  slug: string;
  name: string;
  created: boolean;
  tokenAction: "generated" | "kept" | "regenerated" | "unknown-lost";
  identityUpserts: number;
  orgsUpserted: number;
  journeysUpserted: number;
  conversationsImported: number;
  conversationsSkipped: number;
}

export interface LoadReport {
  users: UserLoadReport[];
  backupPath: string | null;
}

interface ScopeFile {
  name: string;
  status: string;
  organizationKey?: string;
  briefing: string;
  situation: string;
  summary: string | null;
}

// ---------- Entry point ----------

export function loadNarrative(
  db: Database.Database,
  opts: LoadOptions = {},
): LoadReport {
  if (!existsSync(NARRATIVE_ROOT)) {
    throw new Error(
      `Narrative root not found: ${NARRATIVE_ROOT}. Are you running from the mirror-mind project root?`,
    );
  }

  const usersRoot = path.join(NARRATIVE_ROOT, "users");
  if (!existsSync(usersRoot)) {
    throw new Error(`Expected users directory not found: ${usersRoot}`);
  }

  const backupPath = opts.backup ? backupDatabase(db) : null;
  const tokens = readTokensFile();

  const slugs = readdirSync(usersRoot)
    .filter((name) => statSync(path.join(usersRoot, name)).isDirectory())
    .sort();

  const reports: UserLoadReport[] = [];

  for (const slug of slugs) {
    const userDir = path.join(usersRoot, slug);
    const report = loadOneUser(db, slug, userDir, tokens, opts);
    reports.push(report);
  }

  writeTokensFile(tokens);

  return { users: reports, backupPath };
}

// ---------- One user ----------

function loadOneUser(
  db: Database.Database,
  slug: string,
  userDir: string,
  tokens: Record<string, string>,
  opts: LoadOptions,
): UserLoadReport {
  const name = slugToName(slug);
  const existing = getUserByName(db, name);

  let user: User;
  let created = false;
  let tokenAction: UserLoadReport["tokenAction"];

  if (!existing) {
    const token = randomBytes(32).toString("hex");
    const tokenHash = hashToken(token);
    user = createUser(db, name, tokenHash, "user");
    tokens[slug] = token;
    tokenAction = "generated";
    created = true;
  } else {
    user = existing;
    if (opts.resetTokens) {
      const token = randomBytes(32).toString("hex");
      const tokenHash = hashToken(token);
      db.prepare("UPDATE users SET token_hash = ? WHERE id = ?").run(
        tokenHash,
        user.id,
      );
      tokens[slug] = token;
      tokenAction = "regenerated";
    } else if (tokens[slug]) {
      tokenAction = "kept";
    } else {
      tokenAction = "unknown-lost";
    }
  }

  const identityUpserts = upsertIdentity(db, user.id, userDir);
  const { orgsUpserted, orgIdByKey } = upsertOrganizations(db, user.id, userDir);
  const journeysUpserted = upsertJourneys(db, user.id, userDir, orgIdByKey);

  const { imported, skipped } = loadConversations(db, user, userDir, !!opts.resetConversations);

  return {
    slug,
    name,
    created,
    tokenAction,
    identityUpserts,
    orgsUpserted,
    journeysUpserted,
    conversationsImported: imported,
    conversationsSkipped: skipped,
  };
}

// ---------- Identity ----------

function upsertIdentity(
  db: Database.Database,
  userId: string,
  userDir: string,
): number {
  const identityRoot = path.join(userDir, "identity");
  if (!existsSync(identityRoot)) return 0;

  let count = 0;
  for (const layer of readdirSync(identityRoot)) {
    const layerDir = path.join(identityRoot, layer);
    if (!statSync(layerDir).isDirectory()) continue;
    for (const file of readdirSync(layerDir)) {
      if (!file.endsWith(".md")) continue;
      const key = file.replace(/\.md$/, "");
      const raw = readFileSync(path.join(layerDir, file), "utf-8");
      const content = stripPreHeading(raw);
      setIdentityLayer(db, userId, layer, key, content);
      count++;
    }
  }
  return count;
}

// ---------- Organizations ----------

function upsertOrganizations(
  db: Database.Database,
  userId: string,
  userDir: string,
): { orgsUpserted: number; orgIdByKey: Map<string, string> } {
  const orgsRoot = path.join(userDir, "organizations");
  const orgIdByKey = new Map<string, string>();
  if (!existsSync(orgsRoot)) return { orgsUpserted: 0, orgIdByKey };

  let count = 0;
  for (const file of readdirSync(orgsRoot)) {
    if (!file.endsWith(".md")) continue;
    const key = file.replace(/\.md$/, "");
    const raw = readFileSync(path.join(orgsRoot, file), "utf-8");
    const parsed = parseScopeFile(stripPreHeading(raw));

    const existing = getOrganizationByKey(db, userId, key);
    let id: string;
    if (existing) {
      updateOrganization(db, userId, key, {
        name: parsed.name,
        briefing: parsed.briefing,
        situation: parsed.situation,
      });
      id = existing.id;
    } else {
      const created = createOrganization(
        db,
        userId,
        key,
        parsed.name,
        parsed.briefing,
        parsed.situation,
      );
      id = created.id;
    }
    orgIdByKey.set(key, id);
    count++;
  }
  return { orgsUpserted: count, orgIdByKey };
}

// ---------- Journeys ----------

function upsertJourneys(
  db: Database.Database,
  userId: string,
  userDir: string,
  orgIdByKey: Map<string, string>,
): number {
  const journeysRoot = path.join(userDir, "journeys");
  if (!existsSync(journeysRoot)) return 0;

  let count = 0;
  for (const file of readdirSync(journeysRoot)) {
    if (!file.endsWith(".md")) continue;
    const key = file.replace(/\.md$/, "");
    const raw = readFileSync(path.join(journeysRoot, file), "utf-8");
    const parsed = parseScopeFile(stripPreHeading(raw));

    const orgId = parsed.organizationKey
      ? orgIdByKey.get(parsed.organizationKey) ?? null
      : null;

    const existing = getJourneyByKey(db, userId, key);
    if (existing) {
      updateJourney(db, userId, key, {
        name: parsed.name,
        briefing: parsed.briefing,
        situation: parsed.situation,
      });
      // Only adjust the org link if the file specifies one and it differs.
      if (parsed.organizationKey && existing.organization_id !== orgId) {
        linkJourneyOrganization(db, userId, key, orgId);
      }
    } else {
      createJourney(
        db,
        userId,
        key,
        parsed.name,
        parsed.briefing,
        parsed.situation,
        orgId,
      );
    }
    count++;
  }
  return count;
}

// ---------- Conversations ----------

function loadConversations(
  db: Database.Database,
  user: User,
  userDir: string,
  reset: boolean,
): { imported: number; skipped: number } {
  const convRoot = path.join(userDir, "conversations");
  if (!existsSync(convRoot)) return { imported: 0, skipped: 0 };

  if (reset) {
    resetConversationsForUser(db, user.id);
  }

  const files = readdirSync(convRoot)
    .filter((f) => f.endsWith(".md"))
    .sort();

  // Pick up where the max existing session timestamp left off, so re-runs
  // don't collide with a millisecond already claimed by a prior import.
  let lastTs = getMaxSessionCreatedAt(db, user.id);
  const importStartedAt = Date.now();

  let imported = 0;
  let skipped = 0;

  for (const file of files) {
    const raw = readFileSync(path.join(convRoot, file), "utf-8");
    const fm = matter(raw);
    const meta = fm.data as Record<string, unknown>;

    const title = typeof meta.title === "string" ? meta.title.trim() : path.basename(file, ".md");

    if (!reset && sessionTitleExists(db, user.id, title)) {
      skipped++;
      continue;
    }

    const parsed = parseConversationMarkdown(raw);
    if (parsed.messages.length === 0) {
      skipped++;
      continue;
    }

    const personaKey = typeof meta.persona === "string" ? meta.persona : null;
    const orgKeys = toStringArray(meta.organizations);
    const journeyKeys = toStringArray(meta.journeys);

    const ts = Math.max(importStartedAt, lastTs + 1);
    lastTs = ts;

    db.transaction(() => {
      const sessionId = createSessionAt(db, user.id, title, ts);
      let parentId: string | null = null;
      for (let i = 0; i < parsed.messages.length; i++) {
        const m = parsed.messages[i]!;
        const entryTs = ts + i;
        const data: Record<string, unknown> = {
          role: m.role,
          content: [{ type: "text", text: m.content }],
          timestamp: entryTs,
        };
        // Mirror the carry-through used by the canonical importer so that
        // `/me` and `/organizations/<key>` aggregations see these sessions.
        if (m.role === "assistant") {
          if (personaKey) data._persona = personaKey;
          if (orgKeys[0]) data._organization = orgKeys[0];
          if (journeyKeys[0]) data._journey = journeyKeys[0];
        }
        parentId = appendEntry(db, sessionId, parentId, "message", data, entryTs);
      }

      if (personaKey) addSessionPersona(db, sessionId, personaKey);
      for (const k of orgKeys) addSessionOrganization(db, sessionId, k);
      for (const k of journeyKeys) addSessionJourney(db, sessionId, k);
    })();

    imported++;
  }

  return { imported, skipped };
}

// ---------- Parsers ----------

/**
 * Returns everything from the first `# ` heading onward. Anything above the
 * first heading (e.g. a breadcrumb link) is treated as documentation chrome
 * and discarded. Matches the loader contract documented in the narrative
 * index.
 */
export function stripPreHeading(raw: string): string {
  const idx = raw.search(/^# /m);
  if (idx === -1) return raw.trim();
  return raw.slice(idx).trim();
}

/**
 * Parses an organization or journey scope file. Expected shape (after
 * stripPreHeading):
 *
 *   # <name>
 *
 *   **Status:** active
 *   **Organization:** some-org-key   (only for journeys)
 *
 *   ## Briefing
 *   ...
 *
 *   ## Situation
 *   ...
 *
 *   ## Summary        (optional)
 *   ...
 */
export function parseScopeFile(content: string): ScopeFile {
  const lines = content.split("\n");
  let name = "";
  let status = "active";
  let organizationKey: string | undefined;

  let i = 0;
  for (; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.startsWith("# ")) {
      name = line.slice(2).trim();
      i++;
      break;
    }
  }

  // Collect metadata until the first `## ` heading.
  for (; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.startsWith("## ")) break;
    const statusMatch = /^\*\*Status:\*\*\s*(\S+)/i.exec(line);
    if (statusMatch) status = statusMatch[1]!.trim();
    const orgMatch = /^\*\*Organization:\*\*\s*(\S+)/i.exec(line);
    if (orgMatch) organizationKey = orgMatch[1]!.trim();
  }

  const briefing = extractSection(lines, "Briefing");
  const situation = extractSection(lines, "Situation");
  const summary = extractSection(lines, "Summary");

  return {
    name,
    status,
    organizationKey,
    briefing,
    situation,
    summary: summary.length > 0 ? summary : null,
  };
}

function extractSection(lines: string[], header: string): string {
  const headerRe = new RegExp(`^##\\s+${header}\\s*$`, "i");
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (headerRe.test(lines[i]!)) {
      start = i + 1;
      break;
    }
  }
  if (start === -1) return "";

  let end = lines.length;
  for (let i = start; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i]!)) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join("\n").trim();
}

// ---------- Helpers ----------

function sessionTitleExists(
  db: Database.Database,
  userId: string,
  title: string,
): boolean {
  const row = db
    .prepare("SELECT 1 FROM sessions WHERE user_id = ? AND title = ? LIMIT 1")
    .get(userId, title);
  return !!row;
}

function resetConversationsForUser(db: Database.Database, userId: string): void {
  db.prepare(
    `DELETE FROM entries WHERE session_id IN (SELECT id FROM sessions WHERE user_id = ?)`,
  ).run(userId);
  db.prepare(
    `DELETE FROM session_personas WHERE session_id IN (SELECT id FROM sessions WHERE user_id = ?)`,
  ).run(userId);
  db.prepare(
    `DELETE FROM session_organizations WHERE session_id IN (SELECT id FROM sessions WHERE user_id = ?)`,
  ).run(userId);
  db.prepare(
    `DELETE FROM session_journeys WHERE session_id IN (SELECT id FROM sessions WHERE user_id = ?)`,
  ).run(userId);
  db.prepare(`DELETE FROM sessions WHERE user_id = ?`).run(userId);
}

function getMaxSessionCreatedAt(db: Database.Database, userId: string): number {
  const row = db
    .prepare(
      "SELECT COALESCE(MAX(created_at), 0) as ts FROM sessions WHERE user_id = ?",
    )
    .get(userId) as { ts: number };
  return row.ts;
}

function slugToName(slug: string): string {
  return slug
    .split("-")
    .map((s) => (s.length === 0 ? s : s[0]!.toUpperCase() + s.slice(1)))
    .join(" ");
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function toStringArray(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string");
  }
  return [];
}

function readTokensFile(): Record<string, string> {
  if (!existsSync(TOKENS_FILE)) return {};
  try {
    const raw = readFileSync(TOKENS_FILE, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, string>;
    }
    return {};
  } catch {
    return {};
  }
}

function writeTokensFile(tokens: Record<string, string>): void {
  const content = JSON.stringify(tokens, null, 2) + "\n";
  writeFileSync(TOKENS_FILE, content, { mode: 0o600 });
}

function backupDatabase(db: Database.Database): string {
  const dbPath = (db as unknown as { name: string }).name;
  const ts = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\..+$/, "")
    .replace("T", "-");
  const backupPath = `${dbPath}.bak-narrative-${ts}`;
  copyFileSync(dbPath, backupPath);
  return backupPath;
}

// ---------- Public helpers for admin CLI ----------

export function tokensPath(): string {
  return TOKENS_FILE;
}

export function readTokens(): Record<string, string> {
  return readTokensFile();
}
