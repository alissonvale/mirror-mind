import Database from "better-sqlite3";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { getUserByName } from "../db/users.js";
import { getOrganizationByKey } from "../db/organizations.js";
import { getJourneyByKey } from "../db/journeys.js";
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

export interface ImportOptions {
  userName: string;
  dir: string;
  personaKey: string;
  organizationKey?: string;
  journeyKey?: string;
  dryRun?: boolean;
}

export type ImportFileStatus =
  | "imported"
  | "would-import"
  | "skipped"
  | "error";

export interface ImportFileResult {
  filename: string;
  status: ImportFileStatus;
  title?: string | null;
  entryCount?: number;
  reason?: string;
}

export interface ImportReport {
  user: string;
  persona: string;
  organization: string | null;
  journey: string | null;
  dryRun: boolean;
  filesProcessed: number;
  sessionsCreated: number;
  entriesCreated: number;
  files: ImportFileResult[];
}

export class ImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportError";
  }
}

/**
 * Imports a directory of canonical conversation markdown files into the
 * mirror as new sessions tagged with the given persona (and optional
 * organization / journey). See docs/product/conversation-markdown-format.md
 * for the input contract.
 *
 * Validation is fail-stop: missing user / persona / organization / journey
 * throws before any write. Per-file failures (parse errors, alternation
 * violations, empty bodies) are recorded in the report and do not abort
 * the rest of the run.
 *
 * In dry-run mode, no DB writes happen — the function still parses every
 * file and reports what it *would* create.
 */
export function importConversationDir(
  db: Database.Database,
  opts: ImportOptions,
): ImportReport {
  const user = getUserByName(db, opts.userName);
  if (!user) {
    throw new ImportError(`User "${opts.userName}" not found.`);
  }

  if (!personaExists(db, user.id, opts.personaKey)) {
    throw new ImportError(
      `Persona "${opts.personaKey}" not found for user "${opts.userName}". Create the identity layer first.`,
    );
  }

  if (opts.organizationKey) {
    const org = getOrganizationByKey(db, user.id, opts.organizationKey);
    if (!org) {
      throw new ImportError(
        `Organization "${opts.organizationKey}" not found for user "${opts.userName}".`,
      );
    }
  }

  if (opts.journeyKey) {
    const j = getJourneyByKey(db, user.id, opts.journeyKey);
    if (!j) {
      throw new ImportError(
        `Journey "${opts.journeyKey}" not found for user "${opts.userName}".`,
      );
    }
  }

  const files = readdirSync(opts.dir)
    .filter((f) => f.toLowerCase().endsWith(".md"))
    .sort();

  const report: ImportReport = {
    user: opts.userName,
    persona: opts.personaKey,
    organization: opts.organizationKey ?? null,
    journey: opts.journeyKey ?? null,
    dryRun: !!opts.dryRun,
    filesProcessed: 0,
    sessionsCreated: 0,
    entriesCreated: 0,
    files: [],
  };

  const importStartedAt = Date.now();
  let lastSessionTs = getMaxSessionCreatedAt(db, user.id);

  for (const filename of files) {
    const fullPath = path.join(opts.dir, filename);
    const text = readFileSync(fullPath, "utf-8");

    let parsed;
    try {
      parsed = parseConversationMarkdown(text);
    } catch (err) {
      const reason =
        err instanceof MarkdownConversationError
          ? err.message
          : `Unexpected error: ${(err as Error).message}`;
      report.files.push({ filename, status: "error", reason });
      report.filesProcessed++;
      continue;
    }

    if (parsed.messages.length === 0) {
      report.files.push({
        filename,
        status: "skipped",
        reason: "no role headings found",
      });
      report.filesProcessed++;
      continue;
    }

    const title = parsed.title ?? path.basename(filename, ".md");

    if (opts.dryRun) {
      report.files.push({
        filename,
        status: "would-import",
        title,
        entryCount: parsed.messages.length,
      });
      report.filesProcessed++;
      continue;
    }

    // Bump the session timestamp past any sibling already in the DB or
    // imported earlier in this run, so listRecentSessionsForUser stays
    // deterministic when many imports collide on the same millisecond.
    const sessionTs = Math.max(importStartedAt, lastSessionTs + 1);
    lastSessionTs = sessionTs;

    db.transaction(() => {
      const sessionId = createSessionAt(db, user.id, title, sessionTs);
      let parentId: string | null = null;
      for (let i = 0; i < parsed.messages.length; i++) {
        const m = parsed.messages[i]!;
        const entryTs = sessionTs + i;
        const data = {
          role: m.role,
          content: [{ type: "text", text: m.content }],
          timestamp: entryTs,
        };
        parentId = appendEntry(db, sessionId, parentId, "message", data, entryTs);
      }
      addSessionPersona(db, sessionId, opts.personaKey);
      if (opts.organizationKey) {
        addSessionOrganization(db, sessionId, opts.organizationKey);
      }
      if (opts.journeyKey) {
        addSessionJourney(db, sessionId, opts.journeyKey);
      }

      report.sessionsCreated++;
      report.entriesCreated += parsed.messages.length;
    })();

    report.files.push({
      filename,
      status: "imported",
      title,
      entryCount: parsed.messages.length,
    });
    report.filesProcessed++;
  }

  return report;
}

function personaExists(
  db: Database.Database,
  userId: string,
  key: string,
): boolean {
  const row = db
    .prepare(
      "SELECT 1 FROM identity WHERE user_id = ? AND layer = 'persona' AND key = ?",
    )
    .get(userId, key);
  return !!row;
}

function getMaxSessionCreatedAt(
  db: Database.Database,
  userId: string,
): number {
  const row = db
    .prepare(
      "SELECT COALESCE(MAX(created_at), 0) as ts FROM sessions WHERE user_id = ?",
    )
    .get(userId) as { ts: number };
  return row.ts;
}
