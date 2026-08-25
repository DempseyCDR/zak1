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

/**
 * Feature 055 (P7-R12): the club's **2-month early-renewal grace**. A dues payment in the final two months of
 * the membership year rolls to the NEXT year-end — i.e. the expiry is the first boundary that is at least two
 * months after the payment. Applies uniformly to every dues payment (new joins and renewals), so a member
 * paying on 2026-07-01 is covered through 2027-08-31. This is the single shared expiry calc for online
 * enrollment, door enrollment, and the public /join page. Built by shifting the payment forward two months and
 * reusing the pure `nextMembershipYearEnd` — the pure boundary math stays unchanged.
 */
export const EARLY_RENEWAL_GRACE_MONTHS = 2;

/** Add `n` calendar months to a 'YYYY-MM-DD', clamping the day to the target month's length. */
function addMonths(dateISO: string, n: number): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  if (y === undefined || m === undefined || d === undefined) {
    throw new Error(`invalid date input: ${dateISO}`);
  }
  const total = m - 1 + n; // 0-based month arithmetic
  const year = y + Math.floor(total / 12);
  const month = (total % 12) + 1;
  const day = Math.min(d, daysInMonth(year, month));
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function grantedMembershipExpiry(paymentDate: string, boundaryMMDD: string): string {
  return nextMembershipYearEnd(addMonths(paymentDate, EARLY_RENEWAL_GRACE_MONTHS), boundaryMMDD);
}
