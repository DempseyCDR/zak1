import type { BookingStatus } from "@/server/db/schema";

/**
 * Feature 018 (B23) booking lifecycle transitions.
 *
 *   proposed → requested → confirmed   (forward only — a skip is rejected)
 *   proposed / requested / confirmed → declined
 *   declined → proposed                (revive)
 *
 * Re-pointing a slot to a different performer forces the status back to `proposed`; that is handled in
 * `patchBooking`, not here (it is not an ordinary transition — the performer changes).
 */
const ALLOWED: Record<BookingStatus, readonly BookingStatus[]> = {
  proposed: ["requested", "declined"],
  requested: ["confirmed", "declined"],
  confirmed: ["declined"],
  declined: ["proposed"],
};

/** True if `to` is reachable from `from` (a same-status no-op is allowed and idempotent). */
export function isAllowedBookingTransition(from: BookingStatus, to: BookingStatus): boolean {
  return from === to || ALLOWED[from].includes(to);
}
