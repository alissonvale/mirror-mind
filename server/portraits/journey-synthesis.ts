import type Database from "better-sqlite3";
import type { Journey } from "../db.js";

/**
 * Synthesizes the state behind a journey portrait (CV1.E13.S1).
 *
 * Mirrors the shape of `server/mirror/synthesis.ts` (the /espelho
 * synthesizer): pure DB queries + light regex/heuristics, no i18n,
 * no rendering. The page consumes the typed result and templates
 * via the locale layer.
 *
 * Round 2 ships the deterministic core: lede source, numeric tiles,
 * "onde ela mora" adjacencies, structural section detection, live
 * question detection, deterministic close, footer math. Two LLM
 * extraction points (citable conversation lines, lede synthesis
 * fallback) are wired in subsequent rounds with `entity_profile_cache`
 * source-hash invalidation.
 *
 * The acceptance bar — the three reference drafts in
 * `docs/design/entity-profiles.md` — must be reproducible from the
 * underlying data without authorial intervention.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const SILENCE_THRESHOLD_DAYS = 30;

// --- Public types -----------------------------------------------------

export interface JourneyPortrait {
  key: string;
  name: string;
  status: "active" | "concluded" | "archived";

  /** First block: the contemplative one to four sentences. */
  lede: LedeBlock;

  /** Three numeric tiles max; can be 0..3. Tile 1 (signature fact) is
   *  often null until LLM extraction lands; we still emit the slot
   *  ordering deterministically. */
  tiles: NumericTile[];

  /** Adjacencies + parenthetical declaration of absences. */
  whereItLives: WhereItLives;

  /** Conditional — null when the situation declares no enumerated
   *  branches or continuous fronts. */
  structuralSection: StructuralSection | null;

  /** Conditional — null when the briefing/situation does not declare a
   *  central question. */
  liveQuestion: LiveQuestion | null;

  /** Empty in early rounds. The conversations list ships in round 3. */
  conversations: ConversationItem[];

  /** When true, the page renders the italic "ainda não veio à frente
   *  em diálogo" line instead of an empty list. */
  conversationsEmpty: boolean;

  /** The closing italic line. Briefing-first per design principle 9. */
  close: CloseBlock | null;

  /** Footer math, all deterministic. */
  startedAt: number;
  lastUpdatedAt: number;
  daysSinceUpdate: number;
  /** Non-null when daysSinceUpdate > SILENCE_THRESHOLD_DAYS. */
  silenceMonths: number | null;
}

export interface LedeBlock {
  text: string | null;
  source: "briefing" | "situation" | "synthesis" | null;
}

export interface NumericTile {
  /** Big-number string (already humanized: "8 meses", "3 cenários"). */
  number: string;
  /** Two short label lines (rendered stacked). */
  label: string;
}

export interface WhereItLives {
  org: { key: string; name: string } | null;
  /** Most-frequent persona across sessions tagged with this journey,
   *  with a one-line descriptor pulled from the persona layer's
   *  `summary` column when present. */
  persona: { key: string; descriptor: string | null } | null;
  /** First scene linked to this journey via `scenes.journey_key`. When
   *  multiple, picks the most recently updated. */
  scene: { key: string; title: string } | null;
  /** Italic declaration of what's missing as intentional information.
   *  Null when all three adjacencies are present. */
  parenthetical: string | null;
}

export type StructuralSection =
  | { kind: "scenarios"; items: ScenarioItem[] }
  | { kind: "fronts"; items: FrontItem[] };

export interface ScenarioItem {
  letter: string;
  title: string;
  body: string;
}

export interface FrontItem {
  title: string;
  body: string;
}

export interface LiveQuestion {
  primary: string;
  /** Optional confessional second paragraph. */
  confessionalLayer: string | null;
}

export interface ConversationItem {
  sessionId: string;
  title: string;
  date: number;
  /** Set in round 4 when LLM extraction is wired. Null in earlier rounds. */
  citableLine: string | null;
}

export interface CloseBlock {
  text: string;
  source: "briefing" | "situation" | "last-conversation";
}

// --- Orchestrator -----------------------------------------------------

export function composeJourneyPortrait(
  db: Database.Database,
  userId: string,
  journey: Journey,
  now: number = Date.now(),
): JourneyPortrait {
  const lede = composeLede(journey);
  const tiles = composeTiles(db, userId, journey, now);
  const whereItLives = composeWhereItLives(db, userId, journey);
  const structuralSection = detectStructuralSection(journey.situation ?? "");
  const liveQuestion = detectLiveQuestion(
    journey.briefing ?? "",
    journey.situation ?? "",
  );
  const close = composeClose(journey);

  const lastUpdatedAt = journey.updated_at;
  const daysSinceUpdate = Math.floor((now - lastUpdatedAt) / DAY_MS);
  const silenceMonths =
    daysSinceUpdate > SILENCE_THRESHOLD_DAYS
      ? Math.max(1, Math.floor(daysSinceUpdate / 30))
      : null;

  return {
    key: journey.key,
    name: journey.name,
    status: journey.status,
    lede,
    tiles,
    whereItLives,
    structuralSection,
    liveQuestion,
    conversations: [], // round 3 wires the listing
    conversationsEmpty: true, // round 3 will set based on actual count
    close,
    startedAt: journey.created_at,
    lastUpdatedAt,
    daysSinceUpdate,
    silenceMonths,
  };
}

// --- Lede -------------------------------------------------------------

/**
 * Round 2 strategy: take the **last paragraph** of the briefing.
 * Empirically the strongest distillation in journey briefings —
 * verified across the three reference drafts (Bia Saturada, Voltar
 * a BH, Pós-Lançamento). Falls back to situation when briefing is
 * empty or too short. Returns null when both are missing — the page
 * renders nothing in the lede slot.
 *
 * Round 4 will add LLM-synthesis fallback for the case where neither
 * field carries a strong opening on its own.
 */
export function composeLede(journey: Journey): LedeBlock {
  const briefingParagraph = lastParagraph(journey.briefing ?? "");
  if (briefingParagraph !== null && briefingParagraph.length >= 60) {
    return { text: briefingParagraph, source: "briefing" };
  }

  const situationParagraph = lastParagraph(journey.situation ?? "");
  if (situationParagraph !== null && situationParagraph.length >= 60) {
    return { text: situationParagraph, source: "situation" };
  }

  return { text: null, source: null };
}

// --- Tiles ------------------------------------------------------------

/**
 * Round 2 tile policy:
 *   - Tile 1: time since journey creation (deterministic, universal)
 *   - Tile 2: structural anchor — count of scenarios/fronts when the
 *     situation has the pattern, else omitted
 *   - Tile 3: recency — days since most recent session tagged with
 *     this journey, OR omitted when zero sessions
 *
 * The "signature concrete fact" tile observed in the reference drafts
 * (3 plantões, 9 meses DM) requires LLM extraction and lands in a
 * later round. For now, tile 1 (time-since-start) holds that slot.
 */
export function composeTiles(
  db: Database.Database,
  userId: string,
  journey: Journey,
  now: number,
): NumericTile[] {
  const tiles: NumericTile[] = [];

  // Tile 1 — tempo desde início
  const ageTile = composeAgeTile(journey.created_at, now);
  if (ageTile !== null) tiles.push(ageTile);

  // Tile 2 — structural anchor
  const structural = detectStructuralSection(journey.situation ?? "");
  if (structural !== null) {
    if (structural.kind === "scenarios") {
      tiles.push({
        number: `${structural.items.length} cenários`,
        label: "que reviro",
      });
    } else {
      tiles.push({
        number: `${structural.items.length} frentes`,
        label: "que pulsam",
      });
    }
  }

  // Tile 3 — recency or omitted
  const recencyTile = composeRecencyTile(db, userId, journey.key, now);
  if (recencyTile !== null) tiles.push(recencyTile);

  return tiles;
}

function composeAgeTile(createdAt: number, now: number): NumericTile | null {
  const ageDays = Math.floor((now - createdAt) / DAY_MS);
  if (ageDays < 7) return null; // brand-new — skip the tile
  if (ageDays < 60) {
    return {
      number: `${ageDays} dias`,
      label: "desde que comecei",
    };
  }
  const ageMonths = Math.floor(ageDays / 30);
  if (ageMonths < 18) {
    return {
      number: `${ageMonths} meses`,
      label: "desde que comecei",
    };
  }
  const ageYears = Math.floor(ageDays / 365);
  return {
    number: `${ageYears} anos`,
    label: "desde que comecei",
  };
}

function composeRecencyTile(
  db: Database.Database,
  userId: string,
  journeyKey: string,
  now: number,
): NumericTile | null {
  const row = db
    .prepare(
      `SELECT MAX(s.created_at) as ts
       FROM sessions s
       JOIN session_journeys sj ON sj.session_id = s.id
       WHERE s.user_id = ? AND sj.journey_key = ?`,
    )
    .get(userId, journeyKey) as { ts: number | null } | undefined;

  if (!row || row.ts === null) return null;
  const days = Math.floor((now - row.ts) / DAY_MS);
  return {
    number: `${days} dias`,
    label: "desde a última conversa",
  };
}

// --- "Onde ela mora" --------------------------------------------------

export function composeWhereItLives(
  db: Database.Database,
  userId: string,
  journey: Journey,
): WhereItLives {
  // Org affiliation (from journey.organization_id FK).
  let org: WhereItLives["org"] = null;
  if (journey.organization_id !== null) {
    const orgRow = db
      .prepare(
        "SELECT key, name FROM organizations WHERE id = ? AND user_id = ?",
      )
      .get(journey.organization_id, userId) as
      | { key: string; name: string }
      | undefined;
    if (orgRow) org = { key: orgRow.key, name: orgRow.name };
  }

  // Anchored scene (most recently updated scene linked via journey_key).
  const sceneRow = db
    .prepare(
      `SELECT key, title FROM scenes
       WHERE user_id = ? AND journey_key = ? AND status = 'active'
       ORDER BY updated_at DESC LIMIT 1`,
    )
    .get(userId, journey.key) as { key: string; title: string } | undefined;
  const scene = sceneRow ? { key: sceneRow.key, title: sceneRow.title } : null;

  // Most-frequent persona across sessions tagged with this journey.
  const personaRow = db
    .prepare(
      `SELECT sp.persona_key as k, COUNT(*) as c
       FROM session_personas sp
       JOIN session_journeys sj ON sj.session_id = sp.session_id
       JOIN sessions s ON s.id = sp.session_id
       WHERE s.user_id = ? AND sj.journey_key = ?
       GROUP BY sp.persona_key
       ORDER BY c DESC, sp.persona_key ASC
       LIMIT 1`,
    )
    .get(userId, journey.key) as { k: string; c: number } | undefined;

  let persona: WhereItLives["persona"] = null;
  if (personaRow) {
    const descriptorRow = db
      .prepare(
        "SELECT summary FROM identity WHERE user_id = ? AND layer = 'persona' AND key = ?",
      )
      .get(userId, personaRow.k) as { summary: string | null } | undefined;
    persona = {
      key: personaRow.k,
      descriptor: descriptorRow?.summary ?? null,
    };
  }

  // Parenthetical: declare what's missing as intentional info.
  const missing: string[] = [];
  if (org === null) missing.push("sem organização afiliada");
  if (persona === null) missing.push("sem persona declarada");
  if (scene === null) missing.push("sem cena recorrente");
  const parenthetical =
    missing.length === 0
      ? null
      : missing.length === 3
        ? "Esta travessia ainda não cristalizou em diálogo — sem persona, sem cena, sem organização afiliada."
        : missing.join(" · ");

  return { org, persona, scene, parenthetical };
}

// --- Structural section -----------------------------------------------

const SCENARIO_RE = /\*\*Cenário\s+([A-Z])\s+—\s+([^\n*]+?)\*\*\s*([^]*?)(?=\*\*Cenário\s+[A-Z]\s+—|$)/g;
const FRONT_RE = /\*\*(A primeira|A segunda|A terceira|A quarta|A quinta)\s+([^\n*]+?)\.\*\*\s*([^]*?)(?=\*\*(?:A primeira|A segunda|A terceira|A quarta|A quinta)|$)/g;

export function detectStructuralSection(
  situation: string,
): StructuralSection | null {
  if (situation.length === 0) return null;

  // Try scenarios first — pattern is more specific.
  const scenarios = matchAll(situation, SCENARIO_RE).map((m) => ({
    letter: m[1]!,
    title: m[2]!.trim(),
    body: collapseWhitespace(m[3] ?? ""),
  }));
  if (scenarios.length >= 2) {
    return { kind: "scenarios", items: scenarios };
  }

  // Fall through to fronts.
  const fronts = matchAll(situation, FRONT_RE).map((m) => ({
    title: m[2]!.trim(),
    body: collapseWhitespace(m[3] ?? ""),
  }));
  if (fronts.length >= 2) {
    return { kind: "fronts", items: fronts };
  }

  return null;
}

// --- Live question ----------------------------------------------------

const QUESTION_MARKERS = [
  /A pergunta (?:é|viva|de fundo)/i,
  /A questão (?:é|de fundo|honesta)/i,
  /A dúvida (?:é|real)/i,
  /eu vou .+\?/i,
];

const CONFESSIONAL_MARKERS = [
  /Tem também uma camada/i,
  /uma camada que evito olhar/i,
  /E mais embaixo/i,
  /Tem também uma camada mais antiga/i,
];

export function detectLiveQuestion(
  briefing: string,
  situation: string,
): LiveQuestion | null {
  // Try situation first — questions tend to live in the more recent
  // narrative layer. Falls through to briefing.
  for (const text of [situation, briefing]) {
    if (text.length === 0) continue;
    const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p.length > 0);
    let primary: string | null = null;
    let confessional: string | null = null;
    for (const p of paragraphs) {
      if (
        primary === null &&
        QUESTION_MARKERS.some((re) => re.test(p))
      ) {
        primary = p;
        continue;
      }
      if (
        primary !== null &&
        confessional === null &&
        CONFESSIONAL_MARKERS.some((re) => re.test(p))
      ) {
        confessional = p;
      }
    }
    if (primary !== null) {
      return { primary, confessionalLayer: confessional };
    }
  }
  return null;
}

// --- Close ------------------------------------------------------------

/**
 * Round 2 strategy: take the most pithy short snippet from the
 * briefing — empirically the last sentence of the closing paragraph
 * works for the three reference drafts.
 *
 * Round 4 will add a "best of" picker that compares the briefing
 * candidate against the last conversation's strongest assistant
 * line and picks the more pointed one.
 */
export function composeClose(journey: Journey): CloseBlock | null {
  const briefingClose = pickClosingFragment(journey.briefing ?? "");
  if (briefingClose !== null) {
    return { text: briefingClose, source: "briefing" };
  }
  const situationClose = pickClosingFragment(journey.situation ?? "");
  if (situationClose !== null) {
    return { text: situationClose, source: "situation" };
  }
  return null;
}

function pickClosingFragment(text: string): string | null {
  const last = lastParagraph(text);
  if (last === null) return null;
  // Take the last sentence of the last paragraph, capped at ~140 chars
  // for the rendered close (italic, centered, generous whitespace).
  const sentences = last
    .split(/(?<=[.!?])\s+(?=[A-ZÀ-Ý"“])/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (sentences.length === 0) return null;
  // Look for a punchline shape: short, ends with period, has an
  // adversative or definitive cadence ("mas", "—", "Já", "Saí").
  const candidate =
    sentences.reverse().find((s) => s.length >= 20 && s.length <= 140) ??
    sentences[0]!;
  return candidate.length > 200 ? candidate.slice(0, 197) + "…" : candidate;
}

// --- Helpers ----------------------------------------------------------

function lastParagraph(text: string): string | null {
  if (!text || text.trim().length === 0) return null;
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (paragraphs.length === 0) return null;
  return paragraphs[paragraphs.length - 1]!;
}

function collapseWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function matchAll(text: string, re: RegExp): RegExpExecArray[] {
  const results: RegExpExecArray[] = [];
  // Reset lastIndex defensively in case the regex was used elsewhere.
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    results.push(m);
    if (m.index === re.lastIndex) re.lastIndex++; // guard against zero-width matches
  }
  return results;
}
