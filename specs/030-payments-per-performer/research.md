# Research: Payments page per-performer workflow (P5-R3)

No open `NEEDS CLARIFICATION` items (two were resolved in `/speckit-clarify`: check-less positive amount →
confirm + comment; per-row independent commit). The decisions below record the grounded approach.

## R1 — Per-performer row records reuse `createPerformerPayment` (no new payment endpoint)

**Decision**: Each per-performer row maps to one existing `POST /api/performer-payments`
(`createPerformerPayment`, gated `performer_payment.write`) call with **payee = that row's performer** and a
**single line** `[{ bookingId, amount }]`. Blank amount is resolved **client-side** to the booking's
`pay_cents` (FR-002). A check-less positive amount (FR-014) passes `checkNumber: null` and the confirmation's
comment as `overrideReason` (the payment's note).

**Rationale**: The 023 create already supports a single-line payment, an optional check number, and a note —
exactly the per-performer check. No backend change; the redesign is how rows map to the call.

**Alternatives considered**: A dedicated per-performer endpoint — rejected (YAGNI; the existing create is a
superset). A batch endpoint — rejected (per-row independent commit, FR-015).

## R2 — Donate-at-settlement: a narrow `performer_payment.write` op, not `booking.write`

**Decision**: New `donateBookingAtSettlement(db, bookingId, authz)` in `bookingService` + `POST
/api/bookings/[id]/donate` gated on **`performer_payment.write`**. It sets `is_donated = true`,
`pay_cents = 0`, `requires_check = false` via a **direct `bookings` update** (not `patchBooking`), asserts the
FS's **payment scope** for the booking's event (reusing the existing payment scope assertion), and **refuses**
a booking that already has a **live payment** (`bookingHasLivePayment`) or is already donated. Emits a new
audit kind.

**Rationale**: Grounding confirmed the FS/Treasurer hold `performer_payment.write` (scoped) but **not**
`booking.write` (only Booker/Super-user). FR-008 requires this action without booking-write. A direct update
mirrors 024's no-show handling (H1) and avoids the band-lead status cascade (donation is not a status change).
Guarding a live-paid booking matches 024's written-check discriminator (void first, then donate).

**Alternatives considered**: Grant the FS `booking.write` — rejected (over-broad; see plan Complexity
Tracking). Represent the donation as a `$0` payment — rejected in the spec (bends 023 reconciliation; Q7→a).

## R3 — Add-performer at settlement: a narrow `performer_payment.write` op wrapping `createBooking`

**Decision**: New `addSettlementPerformer(db, eventId, { performerId, performerType }, authz)` + `POST
/api/events/[id]/settlement-performer` gated on **`performer_payment.write`** (scoped). It creates a booking
for the performer on the event (reusing `createBooking`'s logic), **deduping** if that performer is already
booked (returns the existing booking). The UI then records that performer's check via the normal per-row flow
(R1).

**Rationale**: FR-011: everyone who plays gets a booking (Q5), but the FS lacks `booking.write`; the existing
`POST /api/events/[id]/bookings` is `booking.write`-gated. A narrow, scope-asserted settlement op is the
minimal bridge. Splitting "create booking" from "record check" keeps each step atomic and reuses the per-row
payment path unchanged.

**Alternatives considered**: One combined create-booking-and-pay endpoint — rejected (couples two concerns;
the per-row payment path already exists and handles the confirm/comment/donate variants). Booking-less
reimbursement (B42) — out of scope (deferred).

## R4 — FR-012 is already satisfied by `getBookingsForEvent`

**Decision**: No change to the read endpoint. `getBookingsForEvent` already returns each full booking row —
including `pay_cents`, `is_donated`, `requires_check`, `performer_type`, and `performerName`. The payments
page simply **consumes** those fields (today it narrows the type and drops them) to render free vs. payable
rows. "Free" = `!requires_check`; the donated / instructor / `$0` cases all fall out of
`requires_check = false`. (Open-band musicians are comped **attendees**, not bookings, so they are not rows
here at all; the type exists as a forced-free booking type but real open-band handling is attendance-side —
feature 017. The open band's paid **lead musicians** are ordinary payable rows.)

**Rationale**: The flags exist on the row and are already serialized; FR-012's "convey requires-check /
donated, no schema change" is met by widening the page's consumed type, nothing more.

**Alternatives considered**: A new view shape — unnecessary.

## R5 — Reconciliation is unchanged

**Decision**: Leave `reconcilePayments` / `listPerformerPayments` as-is. Expected = sum of the event's
bookings' `pay_cents`; free/donated bookings contribute `0`, so they are already excluded numerically
(FR-013). The donate flip drops expected by setting `pay_cents = 0` (SC-003). "Excluded from the gap" is a
**UI** concern — free bookings render as free rows, not outstanding rows.

**Rationale**: The substrate already does the right arithmetic; the only work is presentation (which rows are
"outstanding"). Preserves 023 unchanged (spec Assumptions).

**Alternatives considered**: Filter `requires_check` inside reconcile — unnecessary (0 contribution already);
would be a substrate change the spec forbids.

## R6 — Multi-apply popup + inline edit reuse existing behavior/endpoints

**Decision**: The current page's payee-dropdown + booking-checkbox + "Record check" (one check → many
bookings) **relocates into a popup/modal** (FR-009) — same `createPerformerPayment` call with a chosen payee
and multiple lines. Inline edit (FR-010) reuses `patchPerformerPayment` (`PATCH /api/performer-payments/[id]`)
for amount + check number; **void** stays the existing action unchanged.

**Rationale**: These are existing capabilities re-presented; no new backend. Keeps the redesign focused on the
per-performer default while preserving today's power features.

**Alternatives considered**: Rebuild multi-apply from scratch — rejected (reuse the proven UI/endpoint).
