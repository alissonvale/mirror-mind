import type Database from "better-sqlite3";
import type { Organization, Journey } from "../db.js";
import { getJourneys } from "../db/journeys.js";
import { getOrganizationSessions } from "../scope-sessions.js";
import { getCached, computeSourceHash } from "./cache.js";
import { getCitableLineForSession } from "./conversation-citable-line.js";
import {
  detectStructuralSection as journeyDetectStructuralSection,
  composeClose as journeyComposeClose,
  type StructuralSection,
  type LedeBlock,
  type NumericTile,
  type ConversationItem,
  type CloseBlock,
} from "./journey-synthesis.js";

/**
 * Synthesizes the state behind an organization portrait (CV1.E13.S2).
 *
 * Mirrors the shape of `journey-synthesis.ts` but with org-shaped
 * differences:
 *   - Lede is **situation-first** (orgs use briefing as identity manifesto;
 *     situation as current diagnosis — flips the journey heuristic).
 *   - Tiles emit nested-journey count instead of structural anchor.
 *   - "Quem passa por aqui" replaces "Onde ela mora" — orgs don't live
 *     somewhere, they're a place that hosts.
 *   - "Live question" section is reused but rarely fires for orgs.
 *
 * Reuses S1's structural detector and close picker via direct import.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const SILENCE_THRESHOLD_DAYS = 30;

// --- Public types -----------------------------------------------------

export interface OrganizationPortrait {
  key: string;
  name: string;
  status: "active" | "concluded" | "archived";

  lede: LedeBlock;
  tiles: NumericTile[];

  /** The org's central section: nested journeys + adjacent persona/scene. */
  whoComesByHere: WhoComesByHere;

  /** Reuses the journey detector (orgs occasionally enumerate frentes). */
  structuralSection: StructuralSection | null;

  conversations: ConversationItem[];
  conversationsEmpty: boolean;

  close: CloseBlock | null;

  startedAt: number;
  lastUpdatedAt: number;
  daysSinceUpdate: number;
  silenceMonths: number | null;
}

export interface WhoComesByHere {
  /** Nested journeys (1:N via journey.organization_id). Includes
   *  status + days-since-last-conversation per row. */
  nestedJourneys: NestedJourneyItem[];
  /** Most-frequent persona across sessions tagged with this org. */
  primaryPersona: { key: string; descriptor: string | null } | null;
  /** First scene anchored via scenes.organization_key. */
  anchoredScene: { key: string; title: string } | null;
  /** Italic declaration of absences when the section is sparse. */
  parenthetical: string | null;
}

export interface NestedJourneyItem {
  key: string;
  name: string;
  status: "active" | "concluded" | "archived";
  /** Days since the last session tagged with this journey. Null when
   *  the journey has no tagged sessions yet. */
  daysSinceLast: number | null;
}

// --- Orchestrator -----------------------------------------------------

export function composeOrganizationPortrait(
  db: Database.Database,
  userId: string,
  org: Organization,
  now: number = Date.now(),
): OrganizationPortrait {
  const lede = composeOrgLede(org);
  const tiles = composeOrgTiles(db, userId, org, now);
  const whoComesByHere = composeWhoComesByHere(db, userId, org, now);
  const structuralSection = journeyDetectStructuralSection(org.situation ?? "");
  const conversations = composeConversations(db, userId, org.key);
  const close = journeyComposeClose({
    briefing: org.briefing,
    situation: org.situation,
  } as any);

  const lastUpdatedAt = org.updated_at;
  const daysSinceUpdate = Math.floor((now - lastUpdatedAt) / DAY_MS);
  const silenceMonths =
    daysSinceUpdate > SILENCE_THRESHOLD_DAYS
      ? Math.max(1, Math.floor(daysSinceUpdate / 30))
      : null;

  return {
    key: org.key,
    name: org.name,
    status: org.status,
    lede,
    tiles,
    whoComesByHere,
    structuralSection,
    conversations,
    conversationsEmpty: conversations.length === 0,
    close,
    startedAt: org.created_at,
    lastUpdatedAt,
    daysSinceUpdate,
    silenceMonths,
  };
}

// --- Lede (situation-first for orgs) ----------------------------------

/**
 * Org briefings tend to be identity manifestos ("Pages Inteiras é minha
 * casa editorial..."); situation carries the current diagnosis. Flip
 * the journey heuristic — situation first, briefing fallback.
 *
 * The lede pulls the **first paragraph** of situation (the diagnostic
 * opening) and optionally appends a short closing sentence from the
 * briefing's last paragraph when both fit on a comfortable two-line
 * read.
 */
export function composeOrgLede(org: Organization): LedeBlock {
  const situationFirst = firstParagraph(org.situation ?? "");
  if (situationFirst !== null && situationFirst.length >= 30) {
    // Append a punchline from the briefing's last paragraph when it's
    // short enough to read together as one lede (≤ 200 chars combined).
    const briefingLast = lastSentence(lastParagraph(org.briefing ?? "") ?? "");
    if (
      briefingLast !== null &&
      briefingLast.length <= 120 &&
      situationFirst.length + briefingLast.length <= 280
    ) {
      return {
        text: `${situationFirst} ${briefingLast}`,
        source: "situation",
      };
    }
    return { text: situationFirst, source: "situation" };
  }

  const briefingLast = lastParagraph(org.briefing ?? "");
  if (briefingLast !== null && briefingLast.length >= 60) {
    return { text: briefingLast, source: "briefing" };
  }

  return { text: null, source: null };
}

// --- Tiles ------------------------------------------------------------

export function composeOrgTiles(
  db: Database.Database,
  userId: string,
  org: Organization,
  now: number,
): NumericTile[] {
  const tiles: NumericTile[] = [];

  // Tile 1 — tempo desde fundação (universal)
  const ageTile = composeAgeTile(org.created_at, now);
  if (ageTile !== null) tiles.push(ageTile);

  // Tile 2 — número de travessias dentro
  const nestedJourneys = getJourneys(db, userId, {
    organizationId: org.id,
    includeConcluded: true,
  }).filter((j) => j.status === "active");
  if (nestedJourneys.length > 0) {
    tiles.push({
      number:
        nestedJourneys.length === 1
          ? "1 travessia"
          : `${nestedJourneys.length} travessias`,
      label: nestedJourneys.length === 1 ? "ativa dentro" : "ativas dentro",
    });
  }

  // Tile 3 — recência (last session tagged with this org)
  const recencyTile = composeOrgRecencyTile(db, userId, org.key, now);
  if (recencyTile !== null) tiles.push(recencyTile);

  return tiles;
}

function composeAgeTile(
  createdAt: number,
  now: number,
): NumericTile | null {
  const ageDays = Math.floor((now - createdAt) / DAY_MS);
  if (ageDays < 7) return null;
  if (ageDays < 60) {
    return {
      number: `${ageDays} dias`,
      label: "como casa",
    };
  }
  const ageMonths = Math.floor(ageDays / 30);
  if (ageMonths < 18) {
    return {
      number: `${ageMonths} meses`,
      label: "como casa",
    };
  }
  const ageYears = Math.floor(ageDays / 365);
  return {
    number: ageYears === 1 ? "1 ano" : `${ageYears} anos`,
    label: "como casa",
  };
}

function composeOrgRecencyTile(
  db: Database.Database,
  userId: string,
  orgKey: string,
  now: number,
): NumericTile | null {
  const row = db
    .prepare(
      `SELECT MAX(s.created_at) as ts
       FROM sessions s
       JOIN entries e ON e.session_id = s.id
       WHERE s.user_id = ?
         AND e.type = 'message'
         AND json_extract(e.data, '$._organization') = ?`,
    )
    .get(userId, orgKey) as { ts: number | null } | undefined;
  if (!row || row.ts === null) return null;
  const days = Math.floor((now - row.ts) / DAY_MS);
  return {
    number: `${days} dias`,
    label: "desde a última conversa",
  };
}

// --- "Quem passa por aqui" --------------------------------------------

export function composeWhoComesByHere(
  db: Database.Database,
  userId: string,
  org: Organization,
  now: number,
): WhoComesByHere {
  // Nested journeys (active + concluded; archived hidden by default).
  const journeyRows = getJourneys(db, userId, {
    organizationId: org.id,
    includeConcluded: true,
  });
  const nestedJourneys: NestedJourneyItem[] = journeyRows.map((j: Journey) => ({
    key: j.key,
    name: j.name,
    status: j.status,
    daysSinceLast: lastJourneyActivityDays(db, userId, j.key, now),
  }));

  // Most-frequent persona across sessions tagged with this org via
  // _organization meta (mirror of the journey query, swapped key).
  const personaRow = db
    .prepare(
      `SELECT json_extract(e.data, '$._persona') AS persona, COUNT(*) AS c
       FROM entries e
       JOIN sessions s ON s.id = e.session_id
       WHERE s.user_id = ?
         AND e.type = 'message'
         AND json_extract(e.data, '$._organization') = ?
         AND json_extract(e.data, '$._persona') IS NOT NULL
       GROUP BY persona
       ORDER BY c DESC, persona ASC
       LIMIT 1`,
    )
    .get(userId, org.key) as { persona: string | null; c: number } | undefined;

  let primaryPersona: WhoComesByHere["primaryPersona"] = null;
  if (personaRow?.persona) {
    const descriptorRow = db
      .prepare(
        "SELECT summary FROM identity WHERE user_id = ? AND layer = 'persona' AND key = ?",
      )
      .get(userId, personaRow.persona) as
      | { summary: string | null }
      | undefined;
    primaryPersona = {
      key: personaRow.persona,
      descriptor: descriptorRow?.summary ?? null,
    };
  }

  // Anchored scene (most recently updated).
  const sceneRow = db
    .prepare(
      `SELECT key, title FROM scenes
       WHERE user_id = ? AND organization_key = ? AND status = 'active'
       ORDER BY updated_at DESC LIMIT 1`,
    )
    .get(userId, org.key) as { key: string; title: string } | undefined;
  const anchoredScene = sceneRow
    ? { key: sceneRow.key, title: sceneRow.title }
    : null;

  // Parenthetical: declare what's missing as intentional info.
  const missing: string[] = [];
  if (nestedJourneys.length === 0) missing.push("sem travessias filhas");
  if (primaryPersona === null) missing.push("sem persona dominante");
  if (anchoredScene === null) missing.push("sem cena ancorada");
  const parenthetical =
    missing.length === 0
      ? null
      : missing.length === 3
        ? "Esta casa ainda não foi habitada — sem travessias, sem persona, sem cena."
        : missing.join(" · ");

  return { nestedJourneys, primaryPersona, anchoredScene, parenthetical };
}

function lastJourneyActivityDays(
  db: Database.Database,
  userId: string,
  journeyKey: string,
  now: number,
): number | null {
  const row = db
    .prepare(
      `SELECT MAX(s.created_at) as ts
       FROM sessions s
       JOIN session_journeys sj ON sj.session_id = s.id
       WHERE s.user_id = ? AND sj.journey_key = ?`,
    )
    .get(userId, journeyKey) as { ts: number | null } | undefined;
  if (!row || row.ts === null) return null;
  return Math.floor((now - row.ts) / DAY_MS);
}

// --- Conversations ----------------------------------------------------

export function composeConversations(
  db: Database.Database,
  userId: string,
  orgKey: string,
): ConversationItem[] {
  const { rows } = getOrganizationSessions(db, userId, orgKey, 5);
  return rows.map((row) => {
    const sourceHash = lastEntryTimestampHash(db, row.sessionId);
    const citableLine =
      sourceHash !== null
        ? getCached(
            db,
            "journey",
            row.sessionId,
            `citable_line:${row.sessionId}`,
            sourceHash,
          )
        : null;
    return {
      sessionId: row.sessionId,
      title: row.title ?? "(sem título)",
      date: row.lastActivityAt,
      citableLine,
    };
  });
}

/**
 * Background warmup of the citable-line cache for sessions tagged
 * with this org. Mirrors `warmJourneyPortraitCache`.
 */
export async function warmOrganizationPortraitCache(
  db: Database.Database,
  userId: string,
  orgKey: string,
): Promise<void> {
  const { rows } = getOrganizationSessions(db, userId, orgKey, 5);
  await Promise.allSettled(
    rows.map((row) =>
      getCitableLineForSession(db, row.sessionId).catch((err) => {
        console.log(
          `[org-portrait] citable-line warmup failed for ${row.sessionId}:`,
          (err as Error).message,
        );
        return null;
      }),
    ),
  );
}

// --- Helpers ----------------------------------------------------------

function firstParagraph(text: string): string | null {
  if (!text || text.trim().length === 0) return null;
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (paragraphs.length === 0) return null;
  return paragraphs[0]!;
}

function lastParagraph(text: string): string | null {
  if (!text || text.trim().length === 0) return null;
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (paragraphs.length === 0) return null;
  return paragraphs[paragraphs.length - 1]!;
}

function lastSentence(paragraph: string): string | null {
  if (paragraph.length === 0) return null;
  const sentences = paragraph
    .split(/(?<=[.!?])\s+(?=[A-ZÀ-Ý"“])/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (sentences.length === 0) return null;
  return sentences[sentences.length - 1]!;
}

function lastEntryTimestampHash(
  db: Database.Database,
  sessionId: string,
): string | null {
  const row = db
    .prepare(
      `SELECT MAX(timestamp) as ts FROM entries
       WHERE session_id = ? AND type = 'message'
         AND json_extract(data, '$.role') = 'assistant'`,
    )
    .get(sessionId) as { ts: number | null } | undefined;
  if (!row || row.ts === null) return null;
  return computeSourceHash([sessionId, row.ts]);
}
