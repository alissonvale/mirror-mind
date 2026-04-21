/**
 * Human-friendly relative time: "just now", "5 minutes ago", "3 days ago".
 * Shared by the chat sidebar session-stats card and the home's Continue band.
 * Returns null for null/undefined/zero so callers can fall through to a
 * default render.
 */
export function formatRelativeTime(timestamp: number | null): string | null {
  if (!timestamp) return null;
  const now = Date.now();
  const diff = now - timestamp;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;
  const month = 30 * day;

  if (diff < minute) return "just now";
  if (diff < hour) {
    const n = Math.floor(diff / minute);
    return `${n} minute${n === 1 ? "" : "s"} ago`;
  }
  if (diff < day) {
    const n = Math.floor(diff / hour);
    return `${n} hour${n === 1 ? "" : "s"} ago`;
  }
  if (diff < week) {
    const n = Math.floor(diff / day);
    return `${n} day${n === 1 ? "" : "s"} ago`;
  }
  if (diff < month) {
    const n = Math.floor(diff / week);
    return `${n} week${n === 1 ? "" : "s"} ago`;
  }
  const n = Math.floor(diff / month);
  return `${n} month${n === 1 ? "" : "s"} ago`;
}
