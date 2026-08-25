// Feature 055 (P7-R12): the public membership-year window label, derived from the single source
// (`club_settings.membership_year_end`, a year-agnostic 'MM-DD'). The year END is the setting; the START is the
// day after. Pure — no DB, no timezone.

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function fmt(mm: number, dd: number): string {
  return `${MONTHS[mm - 1]} ${dd}`;
}

/** `"08-31"` → `"September 1 – August 31"` (start = the day after the MM-DD end). */
export function membershipYearLabel(monthDay: string): string {
  const [mm, dd] = monthDay.split("-").map(Number);
  if (mm === undefined || dd === undefined) throw new Error(`invalid MM-DD: ${monthDay}`);
  // Day after the end boundary, using a fixed non-leap reference year for month rollover.
  const end = new Date(Date.UTC(2001, mm - 1, dd));
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() + 1);
  return `${fmt(start.getUTCMonth() + 1, start.getUTCDate())} – ${fmt(mm, dd)}`;
}
