import type Database from "better-sqlite3";
import type { IdentityLayer } from "../db.js";
import { resolvePersonaColor } from "../personas/colors.js";
import { getCached, computeSourceHash } from "./cache.js";
import { getCitableLineForSession } from "./conversation-citable-line.js";
import type {
  ConversationItem,
  CloseBlock,
  NumericTile,
} from "../../adapters/web/pages/portrait-shared.js";

/**
 * Synthesizes the state behind a persona portrait (CV1.E13.S4).
 *
 * Personas are voices the system speaks through. The portrait reflects
 * that:
 *   - Lede is the first paragraph of the persona's authored content —
 *     personas already open with a self-statement.
 *   - "ONDE ELA APARECE" lists journeys where the voice has been
 *     active and scenes anchored via `scene_personas`.
 *   - "POSTURA" extracts the `## Postura` section as flowing prose —
 *     the most distinctive editorial layer a persona has.
 *   - "ANTI-PADRÕES" extracts the `## Anti-padrões` section as a
 *     deliberately austere bullet list. The "what I don't do" texture
 *     is part of a persona's identity.
 *   - Tiles cap at 2 (conversation count + recency). No "tempo desde
 *     início" — personas are voices, not events with biographies.
 *
 * Unlike journey/org/scene portraits, the accent color is **per-row**
 * (`identity.color`) rather than axis-fixed. Each persona has its own
 * voice color across the system; the portrait completes the coherence.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const SILENCE_THRESHOLD_DAYS = 30;

// --- Public types -----------------------------------------------------

export interface PersonaPortrait {
  key: string;
  /** Resolved persona color (`identity.color` or hash-derived fallback). */
  color: string;

  /** First paragraph of authored content. Null when content is empty. */
  lede: string | null;

  tiles: NumericTile[];

  /** Where this voice has been active. */
  whereItAppears: PersonaWhereItAppears;

  /** Extracted `## Postura` section as paragraphs. Null when absent. */
  posture: string[] | null;

  /** Extracted `## Anti-padrões` section as a list. Null when absent. */
  antipatterns: string[] | null;

  conversations: ConversationItem[];
  conversationsEmpty: boolean;

  close: CloseBlock | null;

  startedAt: number;
  lastUpdatedAt: number;
  daysSinceUpdate: number;
  silenceMonths: number | null;
}

export interface PersonaWhereItAppears {
  /** Journeys where this persona is most active, ordered by recency. */
  journeys: PersonaJourneyItem[];
  /** Scenes anchored to this persona via `scene_personas`. */
  scenes: { key: string; title: string }[];
}

export interface PersonaJourneyItem {
  key: string;
  name: string;
  status: "active" | "concluded" | "archived";
  daysSinceLast: number;
}

// --- Orchestrator -----------------------------------------------------

export function composePersonaPortrait(
  db: Database.Database,
  userId: string,
  layer: IdentityLayer,
  now: number = Date.now(),
): PersonaPortrait {
  const sections = parsePersonaContent(layer.content);

  const lede = sections.lede;
  const posture = sections.posture;
  const antipatterns = sections.antipatterns;

  const tiles = composeTiles(db, userId, layer.key, now);
  const whereItAppears = composeWhereItAppears(db, userId, layer.key, now);
  const conversations = composePersonaConversations(db, userId, layer.key);
  const close = composeClose(sections);

  const lastUpdatedAt = layer.updated_at;
  const daysSinceUpdate = Math.floor((now - lastUpdatedAt) / DAY_MS);
  const silenceMonths =
    daysSinceUpdate > SILENCE_THRESHOLD_DAYS
      ? Math.max(1, Math.floor(daysSinceUpdate / 30))
      : null;

  return {
    key: layer.key,
    color: resolvePersonaColor(layer.color, layer.key),
    lede,
    tiles,
    whereItAppears,
    posture,
    antipatterns,
    conversations,
    conversationsEmpty: conversations.length === 0,
    close,
    startedAt: layer.updated_at, // identity table doesn't carry created_at; updated_at is the best we have
    lastUpdatedAt,
    daysSinceUpdate,
    silenceMonths,
  };
}

// --- Content parsing --------------------------------------------------

interface PersonaSections {
  lede: string | null;
  posture: string[] | null;
  antipatterns: string[] | null;
  exampleResponse: string | null;
}

/**
 * Parses a persona's markdown content into the editorial slots the
 * portrait needs. Identity content is already prose; the parser only
 * needs to find the `## Postura` and `## Anti-padrões` headings.
 *
 * Lede: the first paragraph **before** any `## ` heading. When the
 * content opens with `## Postura` directly, lede is null.
 *
 * Postura: paragraphs under `## Postura` (or English equivalent
 * `## Posture`), as a string array.
 *
 * Anti-padrões: lines under `## Anti-padrões` (or `## Anti-patterns`),
 * one per non-empty paragraph, with leading "Não " preserved.
 */
export function parsePersonaContent(content: string): PersonaSections {
  if (!content || content.trim().length === 0) {
    return { lede: null, posture: null, antipatterns: null, exampleResponse: null };
  }

  // Drop the leading H1 if present (e.g., "# Marido"); the body
  // follows. stripPreHeading-style.
  const trimmed = content.trim();
  const afterH1 = trimmed.replace(/^#\s+[^\n]+\n+/, "");

  // Split into "lede + sections" by H2 markers.
  const parts = afterH1.split(/(?=^##\s+)/m);

  let lede: string | null = null;
  let posture: string[] | null = null;
  let antipatterns: string[] | null = null;

  for (const part of parts) {
    if (!part.startsWith("## ")) {
      // Pre-section preamble — first paragraph becomes the lede.
      const paragraphs = part
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0);
      if (paragraphs.length > 0 && lede === null) {
        lede = paragraphs[0]!;
      }
      continue;
    }
    const headingMatch = part.match(/^##\s+(.+?)(?:\n|$)/);
    if (!headingMatch) continue;
    const heading = headingMatch[1]!.trim().toLowerCase();
    const body = part.replace(/^##\s+.+?\n+/, "").trim();
    if (body.length === 0) continue;

    if (
      heading === "postura" ||
      heading === "posture" ||
      heading === "stance"
    ) {
      posture = body
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0);
    } else if (
      heading === "anti-padrões" ||
      heading === "anti-padroes" ||
      heading === "anti-patterns" ||
      heading === "antipadroes"
    ) {
      antipatterns = body
        .split(/\n\s*\n/)
        .map((p) => p.trim().replace(/^[-*•·]\s*/, ""))
        .filter((p) => p.length > 0);
    }
  }

  return { lede, posture, antipatterns, exampleResponse: null };
}

// --- Tiles ------------------------------------------------------------

function composeTiles(
  db: Database.Database,
  userId: string,
  personaKey: string,
  now: number,
): NumericTile[] {
  const tiles: NumericTile[] = [];

  // Tile 1 — conversation count through this voice
  const countRow = db
    .prepare(
      `SELECT COUNT(DISTINCT s.id) as c
       FROM sessions s
       JOIN entries e ON e.session_id = s.id
       WHERE s.user_id = ?
         AND e.type = 'message'
         AND json_extract(e.data, '$._persona') = ?`,
    )
    .get(userId, personaKey) as { c: number };
  if (countRow.c > 0) {
    tiles.push({
      number:
        countRow.c === 1 ? "1 conversa" : `${countRow.c} conversas`,
      label: "através desta voz",
    });
  }

  // Tile 2 — recency
  const recencyRow = db
    .prepare(
      `SELECT MAX(s.created_at) as ts
       FROM sessions s
       JOIN entries e ON e.session_id = s.id
       WHERE s.user_id = ?
         AND e.type = 'message'
         AND json_extract(e.data, '$._persona') = ?`,
    )
    .get(userId, personaKey) as { ts: number | null };
  if (recencyRow.ts !== null) {
    const days = Math.floor((now - recencyRow.ts) / DAY_MS);
    tiles.push({
      number: `${days} dias`,
      label: "desde a última",
    });
  }

  return tiles;
}

// --- Where it appears -------------------------------------------------

function composeWhereItAppears(
  db: Database.Database,
  userId: string,
  personaKey: string,
  now: number,
): PersonaWhereItAppears {
  // Journeys where this persona has spoken — group sessions by
  // journey via the assistant entry meta, take the most recent.
  const journeyRows = db
    .prepare(
      `SELECT
         json_extract(e.data, '$._journey') as journey_key,
         MAX(s.created_at) as last_ts
       FROM sessions s
       JOIN entries e ON e.session_id = s.id
       WHERE s.user_id = ?
         AND e.type = 'message'
         AND json_extract(e.data, '$._persona') = ?
         AND json_extract(e.data, '$._journey') IS NOT NULL
       GROUP BY journey_key
       ORDER BY last_ts DESC
       LIMIT 5`,
    )
    .all(userId, personaKey) as { journey_key: string; last_ts: number }[];

  const journeys: PersonaJourneyItem[] = [];
  for (const row of journeyRows) {
    const j = db
      .prepare(
        "SELECT key, name, status FROM journeys WHERE user_id = ? AND key = ?",
      )
      .get(userId, row.journey_key) as
      | { key: string; name: string; status: string }
      | undefined;
    if (j) {
      journeys.push({
        key: j.key,
        name: j.name,
        status:
          j.status === "concluded" || j.status === "archived"
            ? (j.status as "concluded" | "archived")
            : "active",
        daysSinceLast: Math.floor((now - row.last_ts) / DAY_MS),
      });
    }
  }

  // Scenes anchored to this persona via scene_personas junction.
  const sceneRows = db
    .prepare(
      `SELECT sc.key, sc.title
       FROM scenes sc
       JOIN scene_personas sp ON sp.scene_id = sc.id
       WHERE sc.user_id = ? AND sp.persona_key = ? AND sc.status = 'active'
       ORDER BY sc.updated_at DESC
       LIMIT 5`,
    )
    .all(userId, personaKey) as { key: string; title: string }[];

  return { journeys, scenes: sceneRows };
}

// --- Conversations ----------------------------------------------------

function composePersonaConversations(
  db: Database.Database,
  userId: string,
  personaKey: string,
): ConversationItem[] {
  const rows = db
    .prepare(
      `SELECT
         s.id as sessionId,
         s.title,
         MAX(e.timestamp) as last_ts
       FROM sessions s
       JOIN entries e ON e.session_id = s.id
       WHERE s.user_id = ?
         AND e.type = 'message'
         AND json_extract(e.data, '$._persona') = ?
       GROUP BY s.id
       ORDER BY last_ts DESC
       LIMIT 5`,
    )
    .all(userId, personaKey) as {
    sessionId: string;
    title: string | null;
    last_ts: number;
  }[];

  return rows.map((row) => {
    const sourceHash = lastEntryTimestampHash(db, row.sessionId);
    const citableLine =
      sourceHash !== null
        ? getCached(
            db,
            "journey", // shared cache namespace
            row.sessionId,
            `citable_line:${row.sessionId}`,
            sourceHash,
          )
        : null;
    return {
      sessionId: row.sessionId,
      title: row.title ?? "(sem título)",
      date: row.last_ts,
      citableLine,
    };
  });
}

export async function warmPersonaPortraitCache(
  db: Database.Database,
  userId: string,
  personaKey: string,
): Promise<void> {
  const rows = db
    .prepare(
      `SELECT DISTINCT s.id as sessionId
       FROM sessions s
       JOIN entries e ON e.session_id = s.id
       WHERE s.user_id = ?
         AND e.type = 'message'
         AND json_extract(e.data, '$._persona') = ?
       LIMIT 5`,
    )
    .all(userId, personaKey) as { sessionId: string }[];

  await Promise.allSettled(
    rows.map((row) =>
      getCitableLineForSession(db, row.sessionId).catch((err) => {
        console.log(
          `[persona-portrait] citable-line warmup failed for ${row.sessionId}:`,
          (err as Error).message,
        );
        return null;
      }),
    ),
  );
}

// --- Close ------------------------------------------------------------

/**
 * For personas the close picks the last short sentence of `## Postura`
 * — that's where the most committed self-statements live. Falls back
 * to last sentence of the lede when posture is absent. Returns null
 * when neither is short enough to land alone.
 */
function composeClose(sections: PersonaSections): CloseBlock | null {
  const candidates: { text: string; source: CloseBlock["source"] }[] = [];

  if (sections.posture && sections.posture.length > 0) {
    const lastPara = sections.posture[sections.posture.length - 1]!;
    const sentences = splitSentences(lastPara);
    for (let i = sentences.length - 1; i >= 0; i--) {
      const s = sentences[i]!;
      if (s.length >= 20 && s.length <= 140) {
        candidates.push({ text: s, source: "briefing" });
        break;
      }
    }
  }

  if (sections.lede && candidates.length === 0) {
    const sentences = splitSentences(sections.lede);
    for (let i = sentences.length - 1; i >= 0; i--) {
      const s = sentences[i]!;
      if (s.length >= 20 && s.length <= 140) {
        candidates.push({ text: s, source: "briefing" });
        break;
      }
    }
  }

  return candidates[0] ?? null;
}

// --- Helpers ----------------------------------------------------------

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-ZÀ-Ý"“])/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
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
