import type Database from "better-sqlite3";
import { getSceneByKey } from "../../server/db.js";
import {
  emptyCenaFormData,
  type CenaFormData,
} from "./pages/cenas-form.js";
import {
  isResponseMode,
  isResponseLength,
  type ResponseMode,
  type ResponseLength,
} from "../../server/expression.js";

/**
 * Parse a multipart form submission for the cena form into the same
 * `CenaFormData` shape used to render the page. Strips whitespace from
 * scalars; splits the comma-separated `personas` field into a deduped
 * trimmed array. Tolerates missing fields (returns the empty default
 * for each) — validation happens at the route, not here.
 */
export function parseSceneFormData(form: FormData): CenaFormData {
  const empty = emptyCenaFormData();
  const title = ((form.get("title") as string | null) ?? "").trim();
  const temporal_pattern =
    ((form.get("temporal_pattern") as string | null) ?? "").trim();
  const briefing = ((form.get("briefing") as string | null) ?? "").trim();
  const voiceRaw = ((form.get("voice") as string | null) ?? "persona").trim();
  const voice = voiceRaw === "alma" ? "alma" : "persona";
  const personasRaw = ((form.get("personas") as string | null) ?? "").trim();
  const personas =
    personasRaw === ""
      ? []
      : Array.from(
          new Set(
            personasRaw
              .split(",")
              .map((s) => s.trim())
              .filter((s) => s.length > 0),
          ),
        );
  const organization_key =
    ((form.get("organization_key") as string | null) ?? "").trim();
  const journey_key =
    ((form.get("journey_key") as string | null) ?? "").trim();
  const modeRaw =
    ((form.get("response_mode") as string | null) ?? "auto").trim();
  const response_mode: ResponseMode | "auto" = isResponseMode(modeRaw)
    ? modeRaw
    : "auto";
  const lengthRaw =
    ((form.get("response_length") as string | null) ?? "auto").trim();
  const response_length: ResponseLength | "auto" = isResponseLength(lengthRaw)
    ? lengthRaw
    : "auto";

  return {
    ...empty,
    title,
    temporal_pattern,
    briefing,
    voice,
    personas,
    organization_key,
    journey_key,
    response_mode,
    response_length,
  };
}

/**
 * Slugify a free-text title into a URL-safe key: lowercase, strip
 * accents, non-alphanumeric → hyphen, collapse runs, trim hyphens.
 * Empty or all-non-alphanumeric input returns "cena" so create never
 * fails on an unkeyable title.
 */
export function slugifyKey(input: string): string {
  const normalized = input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "cena";
}

/**
 * Resolve a unique scene key for the user. Returns the base key if
 * available; otherwise appends `-2`, `-3`, ... until an unused key
 * is found. Bounded to avoid infinite loops on pathological inputs.
 */
export function uniqueSceneKey(
  db: Database.Database,
  userId: string,
  baseKey: string,
): string {
  if (!getSceneByKey(db, userId, baseKey)) return baseKey;
  for (let i = 2; i <= 9999; i++) {
    const candidate = `${baseKey}-${i}`;
    if (!getSceneByKey(db, userId, candidate)) return candidate;
  }
  // Fallback — extremely unlikely to ever hit
  return `${baseKey}-${Date.now()}`;
}
