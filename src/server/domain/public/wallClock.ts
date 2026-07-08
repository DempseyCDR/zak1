/**
 * Format a venue-local wall-clock time for display (feature 013). Operates on the raw "HH:MM(:SS)"
 * string only — no `Date`, no UTC/offset math — so the output is identical regardless of the server's
 * or viewer's time zone (FR-004). Examples: "19:30:00" → "7:30 PM", "14:00" → "2:00 PM". Returns null
 * for null/blank/unparseable input.
 */
export function formatWallClock(t: string | null | undefined): string | null {
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(t.trim());
  if (!m) return null;
  const hour24 = Number(m[1]);
  const minute = m[2]!;
  if (hour24 > 23 || Number(minute) > 59) return null;
  const period = hour24 < 12 ? "AM" : "PM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${minute} ${period}`;
}
