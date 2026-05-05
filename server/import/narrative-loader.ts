import { randomBytes, createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync, copyFileSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import matter from "gray-matter";

import { getUserByName, createUser, type User } from "../db/users.js";
import { setIdentityLayer, setIdentitySummary } from "../db/identity.js";
import {
  createInscription,
  pinInscription,
  listActiveInscriptions,
} from "../db/inscriptions.js";
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
import {
  createScene,
  getSceneByKey,
  updateScene,
  setScenePersonas,
  type SceneVoice,
} from "../db/scenes.js";
import {
  isResponseMode,
  isResponseLength,
  type ResponseMode,
  type ResponseLength,
} from "../expression.js";
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

/**
 * Slugs that get the admin role. Narratively:
 * - Dan Reilly stood up the server for the Reilly–Marchetti family and
 *   added the other three as users, so he owns the admin surface there.
 * - Antonio Castro plays the same role for the Brazilian household —
 *   he's the technical-leaning member who provisioned the server,
 *   added Bia, and runs the box.
 * The rest are regular users.
 */
const ADMIN_SLUGS = new Set<string>(["dan-reilly", "antonio-castro"]);

// ---------- Types ----------

export interface LoadOptions {
  /** Wipe and re-import conversations instead of skipping duplicates. */
  resetConversations?: boolean;
  /** Regenerate bearer tokens even for users that already exist. */
  resetTokens?: boolean;
  /** Write a timestamped backup of the DB file before any DB write. */
  backup?: boolean;
  /**
   * Override the file where bearer tokens are read and written. Defaults
   * to TOKENS_FILE under the narrative root. Tests pass a per-run path
   * in the OS temp dir so the in-memory DB run doesn't pollute the
   * production tokens file on disk.
   */
  tokensPath?: string;
}

export interface UserLoadReport {
  slug: string;
  name: string;
  role: "admin" | "user";
  created: boolean;
  tokenAction: "generated" | "kept" | "regenerated" | "unknown-lost";
  identityUpserts: number;
  orgsUpserted: number;
  journeysUpserted: number;
  scenesUpserted: number;
  inscriptionsSeeded: number;
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
  const tokensFile = opts.tokensPath ?? TOKENS_FILE;
  const tokens = readTokensFile(tokensFile);

  const slugs = readdirSync(usersRoot)
    .filter((name) => statSync(path.join(usersRoot, name)).isDirectory())
    .sort();

  const reports: UserLoadReport[] = [];

  for (const slug of slugs) {
    const userDir = path.join(usersRoot, slug);
    const report = loadOneUser(db, slug, userDir, tokens, opts);
    reports.push(report);
  }

  writeTokensFile(tokensFile, tokens);

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
  const intendedRole = ADMIN_SLUGS.has(slug) ? "admin" : "user";
  const existing = getUserByName(db, name);

  let user: User;
  let created = false;
  let tokenAction: UserLoadReport["tokenAction"];

  if (!existing) {
    const token = randomBytes(32).toString("hex");
    const tokenHash = hashToken(token);
    user = createUser(db, name, tokenHash, intendedRole);
    tokens[slug] = token;
    tokenAction = "generated";
    created = true;
  } else {
    user = existing;
    if (existing.role !== intendedRole) {
      db.prepare("UPDATE users SET role = ? WHERE id = ?").run(
        intendedRole,
        user.id,
      );
      user = { ...user, role: intendedRole };
    }
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

  // CV2.E1.S5 — narrative tenants can declare a UI locale via the
  // profile.md frontmatter. Default 'en' for tenants without the field
  // (the original Reilly/Marchetti family). The Brazilian tenant
  // (antonio-castro) sets `locale: pt-BR`.
  const declaredLocale = readProfileLocale(userDir);
  if (declaredLocale && declaredLocale !== user.locale) {
    db.prepare("UPDATE users SET locale = ? WHERE id = ?").run(
      declaredLocale,
      user.id,
    );
    user = { ...user, locale: declaredLocale };
  }

  const identityUpserts = upsertIdentity(db, user.id, userDir);
  const { orgsUpserted, orgIdByKey } = upsertOrganizations(db, user.id, userDir);
  const journeysUpserted = upsertJourneys(db, user.id, userDir, orgIdByKey);

  // CV1.E11.S6 follow-up: every narrative tenant gets a Voz da Alma
  // cena so /inicio lands non-empty for them too. Idempotent: skip
  // when the cena already exists (the user may have customized it).
  // Doctrine and self/soul are NOT seeded here — narrative tenants
  // bring their own identity material via userDir/identity/.
  if (!getSceneByKey(db, user.id, "voz-da-alma")) {
    createScene(db, user.id, "voz-da-alma", {
      title: "Voz da Alma",
      voice: "alma",
      briefing: "",
    });
  }

  // Per-tenant cenas declared in <userDir>/scenes/<key>.md. Same
  // upsert semantics as journeys/orgs: existing rows by key get
  // updated; new rows get created. The Voz da Alma cena above is
  // independent — narrative folders typically don't override it.
  const scenesUpserted = upsertScenes(db, user.id, userDir);

  // Inscriptions are seeded once — re-runs leave existing inscriptions
  // alone so user customizations (pins, edits, archives) survive a
  // re-provision. New tenants get N rows from `<userDir>/inscriptions.md`.
  const inscriptionsSeeded = loadInscriptions(db, user.id, user.name, userDir);

  const { imported, skipped } = loadConversations(db, user, userDir, !!opts.resetConversations);

  return {
    slug,
    name,
    role: user.role,
    created,
    tokenAction,
    identityUpserts,
    orgsUpserted,
    journeysUpserted,
    scenesUpserted,
    inscriptionsSeeded,
    conversationsImported: imported,
    conversationsSkipped: skipped,
  };
}

// ---------- Profile metadata ----------

/**
 * Reads `profile.md` and returns a supported locale declared in
 * frontmatter, or null if profile.md doesn't exist, has no frontmatter,
 * or declares an unsupported locale. The body of profile.md remains
 * narrative-author reference (not loaded into the DB) — only the
 * frontmatter is consulted for tenant metadata.
 */
function readProfileLocale(userDir: string): string | null {
  const profilePath = path.join(userDir, "profile.md");
  if (!existsSync(profilePath)) return null;
  const raw = readFileSync(profilePath, "utf-8");
  const fm = matter(raw);
  const declared = fm.data.locale;
  if (typeof declared !== "string") return null;
  if (declared === "en" || declared === "pt-BR") return declared;
  return null;
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

      // Optional `## Summary` section — distilled one-line voice for
      // the layer, surfaced by `/espelho` (mirror synthesis) so the
      // SOU pane renders a clean line instead of the first sentence
      // extracted from the layer body. When absent, the synthesis
      // falls back to the legacy first-sentence path.
      const summary = extractSection(content.split("\n"), "Summary");
      if (summary.length > 0) {
        setIdentitySummary(db, userId, layer, key, summary);
      }

      count++;
    }
  }
  return count;
}

// ---------- Inscriptions (ímãs) ----------

/**
 * Reads `<userDir>/inscriptions.md` (single file, bullet-list of
 * pinned phrases) and seeds the user's `inscriptions` table. Idempotent
 * on the user — when the user already has any active inscription,
 * the seed is skipped entirely so customizations (pins, edits,
 * archives) survive a re-provision.
 *
 * Line shape:
 *
 *   - "phrase text here" — Author *(pinned)*
 *   - "phrase text here" — Author
 *   - "phrase text here"
 *
 * Author and the `*(pinned)*` marker are both optional. Multiple
 * pinned entries are allowed — the synthesis picks the most recent
 * pinned_at; ties are broken deterministically by the daily picker.
 */
function loadInscriptions(
  db: Database.Database,
  userId: string,
  userName: string,
  userDir: string,
): number {
  const file = path.join(userDir, "inscriptions.md");
  if (!existsSync(file)) return 0;

  const existing = listActiveInscriptions(db, userId);
  if (existing.length > 0) return 0;

  const raw = readFileSync(file, "utf-8");
  const lines = raw.split("\n");

  const normalizedSelf = userName.trim().toLowerCase();

  let count = 0;
  let now = Date.now();
  for (const line of lines) {
    const parsed = parseInscriptionLine(line);
    if (!parsed) continue;
    // Self-attributed lines render attribution-less on /espelho, since
    // the bookplate at the top already names the user. Strip the
    // author when it matches the tenant's own name (case-insensitive).
    // Authored content stays in the markdown for readability — it just
    // doesn't get persisted as the inscription's `author` field.
    const author =
      parsed.author && parsed.author.trim().toLowerCase() === normalizedSelf
        ? null
        : parsed.author;
    const inscription = createInscription(
      db,
      userId,
      parsed.text,
      author,
      now,
    );
    if (parsed.pinned) {
      pinInscription(db, userId, inscription.id);
    }
    // Bump the synthetic clock so created_at is strictly increasing
    // across the seed batch. Keeps the daily-rotation picker
    // deterministic in tests + on first provision.
    now += 1;
    count++;
  }
  return count;
}

export function parseInscriptionLine(
  line: string,
): { text: string; author: string | null; pinned: boolean } | null {
  if (!line.startsWith("- ")) return null;
  const rest = line.slice(2);
  // Accept straight or curly opening quote.
  const openMatch = rest.match(/^["“]/);
  if (!openMatch) return null;
  const closeChar = openMatch[0] === "\"" ? "\"" : "”";
  const closeIdx = rest.indexOf(closeChar, 1);
  if (closeIdx === -1) return null;
  const text = rest.slice(1, closeIdx).trim();
  if (text.length === 0) return null;

  let after = rest.slice(closeIdx + 1).trim();
  const pinned = /\*\(pinned\)\*/.test(after);
  after = after.replace(/\*\(pinned\)\*/, "").trim();

  let author: string | null = null;
  // Em-dash separator: `— Author` (also tolerate `--` for ASCII writers).
  const dashMatch = after.match(/^(?:—|--)\s*(.+?)\s*$/);
  if (dashMatch && dashMatch[1] && dashMatch[1].trim().length > 0) {
    author = dashMatch[1].trim();
  }

  return { text, author, pinned };
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

// ---------- Scenes (CV1.E11.S5 follow-up) ----------

interface SceneFile {
  title: string;
  voice: SceneVoice | null;
  temporal_pattern: string | null;
  organization_key: string | null;
  journey_key: string | null;
  personas: string[];
  response_mode: ResponseMode | null;
  response_length: ResponseLength | null;
  briefing: string;
}

/**
 * Parses a scene file. Expected shape (after stripPreHeading):
 *
 *   # <title>
 *
 *   **Voice:** persona | alma         (default: persona)
 *   **Temporal:** qua 20h             (optional, free text)
 *   **Organization:** <org-key>       (optional)
 *   **Journey:** <journey-key>        (optional)
 *   **Personas:** key1, key2          (optional, ignored when voice=alma)
 *   **Mode:** conversational|essayistic|oracular  (optional)
 *   **Length:** brief|standard|full   (optional)
 *
 *   ## Briefing
 *   ...body becomes the cena's briefing...
 */
export function parseSceneFile(content: string): SceneFile {
  const lines = content.split("\n");
  let title = "";
  let voice: SceneVoice | null = null;
  let temporal: string | null = null;
  let organizationKey: string | null = null;
  let journeyKey: string | null = null;
  let personas: string[] = [];
  let responseMode: ResponseMode | null = null;
  let responseLength: ResponseLength | null = null;

  let i = 0;
  for (; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.startsWith("# ")) {
      title = line.slice(2).trim();
      i++;
      break;
    }
  }

  for (; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.startsWith("## ")) break;
    const m = /^\*\*([A-Za-z]+):\*\*\s*(.+)$/.exec(line);
    if (!m) continue;
    const [, key, valueRaw] = m;
    const value = valueRaw!.trim();
    switch (key!.toLowerCase()) {
      case "voice":
        voice = value === "alma" ? "alma" : null;
        break;
      case "temporal":
        temporal = value || null;
        break;
      case "organization":
        organizationKey = value || null;
        break;
      case "journey":
        journeyKey = value || null;
        break;
      case "personas":
        personas = value
          .split(",")
          .map((p) => p.trim())
          .filter((p) => p.length > 0);
        break;
      case "mode":
        responseMode = isResponseMode(value) ? value : null;
        break;
      case "length":
        responseLength = isResponseLength(value) ? value : null;
        break;
    }
  }

  const briefing = extractSection(lines, "Briefing");

  return {
    title,
    voice,
    temporal_pattern: temporal,
    organization_key: organizationKey,
    journey_key: journeyKey,
    personas: voice === "alma" ? [] : personas,
    response_mode: responseMode,
    response_length: responseLength,
    briefing,
  };
}

function upsertScenes(
  db: Database.Database,
  userId: string,
  userDir: string,
): number {
  const scenesRoot = path.join(userDir, "scenes");
  if (!existsSync(scenesRoot)) return 0;

  let count = 0;
  for (const file of readdirSync(scenesRoot)) {
    if (!file.endsWith(".md")) continue;
    const key = file.replace(/\.md$/, "");
    const raw = readFileSync(path.join(scenesRoot, file), "utf-8");
    const parsed = parseSceneFile(stripPreHeading(raw));
    if (!parsed.title) continue;

    const existing = getSceneByKey(db, userId, key);
    let sceneId: string;
    if (existing) {
      const updated = updateScene(db, userId, key, {
        title: parsed.title,
        temporal_pattern: parsed.temporal_pattern,
        briefing: parsed.briefing,
        voice: parsed.voice,
        response_mode: parsed.response_mode,
        response_length: parsed.response_length,
        organization_key: parsed.organization_key,
        journey_key: parsed.journey_key,
      });
      sceneId = (updated ?? existing).id;
    } else {
      const created = createScene(db, userId, key, {
        title: parsed.title,
        temporal_pattern: parsed.temporal_pattern,
        briefing: parsed.briefing,
        voice: parsed.voice,
        response_mode: parsed.response_mode,
        response_length: parsed.response_length,
        organization_key: parsed.organization_key,
        journey_key: parsed.journey_key,
      });
      sceneId = created.id;
    }

    // Cast — only when voice is not alma. Empty list is legitimate
    // (overrides any prior cast on the cena).
    if (parsed.voice !== "alma") {
      setScenePersonas(db, sceneId, parsed.personas);
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

function readTokensFile(file: string): Record<string, string> {
  if (!existsSync(file)) return {};
  try {
    const raw = readFileSync(file, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, string>;
    }
    return {};
  } catch {
    return {};
  }
}

function writeTokensFile(file: string, tokens: Record<string, string>): void {
  const content = JSON.stringify(tokens, null, 2) + "\n";
  writeFileSync(file, content, { mode: 0o600 });
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
  return readTokensFile(TOKENS_FILE);
}
