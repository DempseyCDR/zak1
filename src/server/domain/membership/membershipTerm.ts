/**
 * Feature 019 (FR-003/FR-003a): resolve a dues payment's expiry to the NEXT occurrence of the club's
 * membership-year-end boundary on/after the payment date. Pure — no DB, no timezone (string math on
 * 'YYYY-MM-DD'). The boundary is a year-agnostic 'MM-DD' shared by all members.
 */

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Last day of a month (1..12) in a given year — used to clamp a 02-29 boundary in non-leap years. */
function daysInMonth(year: number, month1to12: number): number {
  // Day 0 of the next month is the last day of this one.
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
}

/** The boundary as it falls in a specific year, clamping an out-of-range day (e.g. 02-29) to month end. */
function boundaryInYear(year: number, mm: number, dd: number): string {
  const day = Math.min(dd, daysInMonth(year, mm));
  return `${year}-${pad2(mm)}-${pad2(day)}`;
}

/**
 * @param paymentDate 'YYYY-MM-DD' the dues were paid.
 * @param boundaryMMDD 'MM-DD' the club's membership year ends.
 * @returns 'YYYY-MM-DD' of the next boundary on/after the payment date.
 */
export function nextMembershipYearEnd(paymentDate: string, boundaryMMDD: string): string {
  const [py] = paymentDate.split("-").map(Number);
  const [mm, dd] = boundaryMMDD.split("-").map(Number);
  if (py === undefined || mm === undefined || dd === undefined) {
    throw new Error(`invalid date input: paymentDate=${paymentDate} boundary=${boundaryMMDD}`);
  }
  // ISO 'YYYY-MM-DD' strings compare lexically as dates.
  const thisYear = boundaryInYear(py, mm, dd);
  return thisYear >= paymentDate ? thisYear : boundaryInYear(py + 1, mm, dd);
}
