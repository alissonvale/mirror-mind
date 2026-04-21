/**
 * Time-of-day greeting for the home page. Server local time — the mirror
 * speaks from where it runs, not where the reader happens to be. Future
 * story may route this through the user's own timezone.
 */
export function greetingFor(name: string, now: Date = new Date()): string {
  const hour = now.getHours();
  let phase: string;
  if (hour < 12) phase = "Good morning";
  else if (hour < 18) phase = "Good afternoon";
  else phase = "Good evening";
  return `${phase}, ${name}`;
}
