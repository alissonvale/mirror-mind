/**
 * Persona colors — shared palette + deterministic hash fallback.
 *
 * Starting with the persona-colors improvement, each persona has a
 * persistent `color` stored in the identity table. When a persona is
 * created without one, or when we're backfilling the column, we derive
 * a color deterministically from the persona key so the visual is
 * stable even before the user personalizes it.
 *
 * The palette is the same 8 shades originally declared in
 * adapters/web/pages/context-rail.tsx; it lives here so server-side
 * code can reuse it without reaching into a frontend module.
 */

export const PERSONA_COLORS: readonly string[] = [
  "#b88a6b",
  "#8b7d6b",
  "#8aa08b",
  "#b69b7c",
  "#7c9aa0",
  "#a88b8b",
  "#9a8ba0",
  "#8ba095",
] as const;

/**
 * Deterministic hash → PERSONA_COLORS[i]. Mirrors the Horner-style
 * `avatarColor` helper on the frontend so server-render and
 * client-render agree when no persisted color exists.
 */
export function hashPersonaColor(name: string): string {
  if (!name) return "#c9c4bd";
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return PERSONA_COLORS[hash % PERSONA_COLORS.length];
}

/**
 * Validates a hex color string (`#rgb`, `#rrggbb`, `#rrggbbaa`).
 * Used by the /map/persona/:key/color endpoint before writing to the
 * DB. Returns the lowercased valid hex, or null when rejected.
 */
export function normalizeHexColor(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  if (!/^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/.test(trimmed)) {
    return null;
  }
  return trimmed;
}

/**
 * Resolves a persona's color, honoring persistence when set and
 * falling back to the deterministic hash when NULL. Callers that
 * already have the `IdentityLayer` row should just read `.color`
 * themselves and pass it through this helper for the fallback.
 */
export function resolvePersonaColor(
  storedColor: string | null | undefined,
  key: string,
): string {
  return storedColor ?? hashPersonaColor(key);
}
