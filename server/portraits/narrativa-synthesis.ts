import type Database from "better-sqlite3";
import { getIdentityLayers } from "../db.js";
import { resolvePersonaColor } from "../personas/colors.js";

/**
 * Synthesizes the state behind /narrativa (CV1.E14).
 *
 * Replaces the structural grid of /map (cognitive map) with a continuous
 * read — soul, identity, behavior, expression, and the cast of personas
 * woven into a single self-portrait. Light synthesis only: layer content
 * comes through verbatim, just rearranged with friendly section labels
 * and persona-aware typography.
 *
 * No "Ego" appears at any user-facing level — the three layers that
 * conceptually live under it (`identity`, `behavior`, `expression`)
 * surface as flat peers to the soul. The DB schema and internal code
 * keep the `ego` namespace; only the GUI is purified.
 */

// --- Public types -----------------------------------------------------

export interface NarrativaState {
  /** Soul layer content + headings parsed. */
  alma: LayerSection;
  /** ego/identity content. */
  identidade: LayerSection;
  /** ego/behavior content. */
  comportamento: LayerSection;
  /** ego/expression content. */
  expressao: LayerSection;
  /** All persona layers, ordered by sort_order then key. */
  elenco: PersonaItem[];
  /** Most recent updated_at across all layers — used for the footer. */
  lastUpdatedAt: number | null;
}

export interface LayerSection {
  /** Sub-sections parsed from `## ` headings. Empty array when the
   *  layer is unwritten or only has a preamble. */
  subsections: LayerSubsection[];
  /** Preamble paragraphs before the first `## ` heading. Empty when
   *  the content opens with a heading. */
  preamble: string[];
  /** True when the layer has zero content — page renders a stub
   *  block with an "esta camada ainda não foi escrita" italic note. */
  isEmpty: boolean;
  /** Locale-aware path the "editar" link points to. */
  editPath: string;
}

export interface LayerSubsection {
  heading: string;
  paragraphs: string[];
}

export interface PersonaItem {
  key: string;
  /** Persona's identity.summary — the one-line descriptor. Falls back
   *  to first paragraph of content when summary is empty. */
  descriptor: string | null;
  /** Resolved persona color (for the `◇` glyph and avatar coherence). */
  color: string;
  /** Locale-aware path to the portrait — clicking the persona name
   *  takes the user to its read view. */
  portraitPath: string;
}

// --- Orchestrator -----------------------------------------------------

export function composeNarrativa(
  db: Database.Database,
  userId: string,
): NarrativaState {
  const layers = getIdentityLayers(db, userId);

  const findLayer = (layer: string, key: string) =>
    layers.find((l) => l.layer === layer && l.key === key) ?? null;

  const soul = findLayer("self", "soul");
  const identity = findLayer("ego", "identity");
  const behavior = findLayer("ego", "behavior");
  const expression = findLayer("ego", "expression");

  // Personas — ordered the same way /personas + sidebar order them
  // (sort_order ascending, key ascending as tie-break).
  const personas = layers
    .filter((l) => l.layer === "persona")
    .sort((a, b) => {
      const ao = a.sort_order ?? 999;
      const bo = b.sort_order ?? 999;
      if (ao !== bo) return ao - bo;
      return a.key.localeCompare(b.key);
    });

  const elenco: PersonaItem[] = personas.map((p) => ({
    key: p.key,
    descriptor: p.summary && p.summary.trim().length > 0
      ? p.summary.trim()
      : firstParagraph(p.content),
    color: resolvePersonaColor(p.color, p.key),
    portraitPath: `/personas/${p.key}`,
  }));

  const updates = [soul, identity, behavior, expression, ...personas]
    .filter((l): l is NonNullable<typeof l> => l !== null)
    .map((l) => l.updated_at);
  const lastUpdatedAt = updates.length > 0 ? Math.max(...updates) : null;

  return {
    alma: parseLayer(soul?.content ?? "", "/map/self/soul"),
    identidade: parseLayer(identity?.content ?? "", "/map/ego/identity"),
    comportamento: parseLayer(behavior?.content ?? "", "/map/ego/behavior"),
    expressao: parseLayer(expression?.content ?? "", "/map/ego/expression"),
    elenco,
    lastUpdatedAt,
  };
}

// --- Layer parsing ----------------------------------------------------

/**
 * Parses a layer's markdown content into preamble + named subsections.
 *
 * The narrative-loader strips the `[< ... ](...)` back-link before
 * persisting; what reaches the DB starts at `# H1`. This function:
 *   1. Strips the leading `# H1` (layer title — already redundant
 *      with the section label rendered by the page).
 *   2. Captures any preamble paragraphs before the first `## ` heading.
 *   3. Splits the rest into subsections by `## ` markers.
 *   4. Returns isEmpty when content has no body at all.
 */
export function parseLayer(content: string, editPath: string): LayerSection {
  const trimmed = (content ?? "").trim();
  if (trimmed.length === 0) {
    return { subsections: [], preamble: [], isEmpty: true, editPath };
  }

  // Strip leading H1 + any blank lines after it.
  const afterH1 = trimmed.replace(/^#\s+[^\n]+(\n+|$)/, "");
  if (afterH1.trim().length === 0) {
    return { subsections: [], preamble: [], isEmpty: true, editPath };
  }

  // Split into preamble + sections by ## markers.
  const parts = afterH1.split(/(?=^##\s+)/m);
  const preamble: string[] = [];
  const subsections: LayerSubsection[] = [];

  for (const part of parts) {
    if (!part.startsWith("## ")) {
      // Preamble (text before the first H2).
      const paragraphs = splitParagraphs(part);
      preamble.push(...paragraphs);
      continue;
    }
    const headingMatch = part.match(/^##\s+(.+?)(?:\n|$)/);
    if (!headingMatch) continue;
    const heading = headingMatch[1]!.trim();
    const body = part.replace(/^##\s+.+?\n+/, "");
    const paragraphs = splitParagraphs(body);
    if (heading.length === 0) continue;
    subsections.push({ heading, paragraphs });
  }

  const isEmpty = preamble.length === 0 && subsections.length === 0;
  return { subsections, preamble, isEmpty, editPath };
}

// --- Helpers ----------------------------------------------------------

function splitParagraphs(text: string): string[] {
  if (!text || text.trim().length === 0) return [];
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

function firstParagraph(content: string): string | null {
  const trimmed = (content ?? "").trim();
  if (trimmed.length === 0) return null;
  // Skip leading H1.
  const afterH1 = trimmed.replace(/^#\s+[^\n]+(\n+|$)/, "");
  // Skip leading H2 if any (find first non-heading paragraph).
  const lines = afterH1.split("\n");
  const bodyLines: string[] = [];
  let inHeading = false;
  for (const line of lines) {
    if (line.startsWith("## ") || line.startsWith("# ")) {
      if (bodyLines.length > 0) break;
      inHeading = true;
      continue;
    }
    if (inHeading && line.trim().length === 0) {
      inHeading = false;
      continue;
    }
    if (line.trim().length === 0) {
      if (bodyLines.length > 0) break;
      continue;
    }
    bodyLines.push(line);
  }
  const para = bodyLines.join(" ").trim();
  return para.length > 0 ? para : null;
}
