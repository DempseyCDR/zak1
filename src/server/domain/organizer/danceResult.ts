/** Pure per-event organizer calculations (integer cents in/out). */

export function danceNetCents(i: {
  admissionCents: number;
  merchandiseCents: number;
  rentCents: number;
  performerTotalCents: number;
  ongoingCents: number;
  miscCents: number;
}): number {
  return (
    i.admissionCents +
    i.merchandiseCents -
    i.rentCents -
    i.performerTotalCents -
    i.ongoingCents -
    i.miscCents
  );
}

/**
 * paying dancers = attendance − distinct performers − 1 (door attendant) − comps, floored at 0.
 * comps (feature 014) = people admitted free; default 0 keeps historical callers unchanged (FR-013, FR-003).
 */
export function payingDancers(
  attendanceCount: number,
  performerCount: number,
  compCount = 0,
): number {
  return Math.max(0, attendanceCount - performerCount - 1 - compCount);
}

/** Avg Ticket cents = admission ÷ paying dancers (no fee subtraction, FR-006); 0 when no dancers. */
export function avgTicketCents(admissionCents: number, dancers: number): number {
  if (dancers <= 0) return 0;
  return Math.round(admissionCents / dancers);
}

/**
 * Break-Even Dancers: additional paying dancers needed (at the current Avg Ticket) to reach
 * Dance Net = 0. Only meaningful when Dance Net < 0; null otherwise or when Avg Ticket is 0 (FR-005).
 */
export function breakEvenDancers(danceNetCents: number, avgTicketCents: number): number | null {
  if (danceNetCents >= 0 || avgTicketCents <= 0) return null;
  return Math.ceil(-danceNetCents / avgTicketCents);
}
