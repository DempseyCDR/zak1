# Research: Financial-Secretary payments substrate

Decisions resolving the plan's unknowns. No open `NEEDS CLARIFICATION`.

## R1 — Per-line allocation lives on `payment_bookings.amount_cents`

**Decision**: Add `amount_cents` (integer, NOT NULL) to `payment_bookings`. The payment input becomes a list
of **lines** `{ bookingId, amount }`; `performer_payments.amount_cents` remains the check total and MUST equal
the sum of its live line amounts.

**Rationale**: QuickBooks bill-allocation and the organizer's per-event cost both need the dollars applied to
each covered bill, and a discrepancy is where actual ≠ expected — so the per-line figure is stored, not
derived from `bookings.pay_cents`. Keeping the check total on the payment lets a fast "does it balance?" check
run without re-summing lines.

**Alternatives**: Derive each line from the booking's expected pay — rejected: cannot represent a discrepancy
or an aggregated split.

## R2 — Relax the same-event constraint; the payment keeps its recorded-at event

**Decision**: `assertBookingsForEvent` (which throws `bookingEventMismatch` when a linked booking is not the
payment's event) becomes `assertBookingsExist` — bookings must exist, but MAY belong to **any** event. The
payment's `event_id` stays the **recorded-at** event (the check-written date); each line points to its own
booking (whose event is the performance date).

**Rationale**: FR-003 — a delayed check written at event B settles a booking performed at event A. The current
constraint makes that impossible. The recorded-at vs. incurred split (R4/R5) is exactly why the payment's
event and the line's booking-event legitimately differ.

**Alternatives**: Keep same-event and forbid cross-event — rejected: contradicts real FS practice (ran out of
checks) and FR-003.

## R3 — Void is first-class; settlement counts live lines only

**Decision**: Add `voided_at` (timestamptz null), `void_reason` (text), and `replaces_payment_id` (uuid,
self-FK) to `performer_payments`. A **void** sets `voided_at`/`void_reason` (it does **not** delete the row).
A **reissue** is a new payment whose `replaces_payment_id` points at the voided one. A booking's **settled
amount** = sum of `payment_bookings.amount_cents` over lines whose payment has `voided_at IS NULL`.

**Rationale**: FR-005/FR-006/FR-010 — a voided check must persist for the treasurer (a QBO void event) and
must not settle anything; the reissue is linked so the pair is visible. Soft-void (not delete) preserves the
paper trail; hard `deletePerformerPayment` remains only for a genuine mis-entry.

**Alternatives**: Delete-and-recreate on void — rejected: loses the void record the treasurer must enter.

## R4 — Treasurer report: per-LINE breakdown, cross-event lines included, voided distinct

**Decision**: The per-event treasurer report keeps grouping payments by `performer_payments.event_id`
(recorded-at), but (a) **drops the `bookings.event_id = eventId` filter** on the links so a cross-event check's
lines are not dropped; (b) presents each check **expandable to its lines** (per line: performer, booking,
`amount_cents`, QBO account) instead of one aggregate line per check; (c) lists **voided** checks in a
distinct section. The check-written date is the event's date (R2/FR-011).

**Rationale**: FR-008 — Mike allocates a check against its bills; he needs the lines, and a cross-event check's
past-event line must appear on the writing event's report. Voided checks must show so he records the void.

## R5 — Organizer cost: one combined figure (paid + outstanding) by the booking's event

**Decision** (refined per the user): the organizer's performer cost is a **single sum by incurred date** — for
each of the event's bookings, its **live settled amount** if paid (`Σ payment_bookings.amount_cents`, dated to
the booking's event), else its **expected `bookings.pay_cents`** (still-outstanding). The organizer view does
**not** break out paid vs. outstanding; that split is surfaced only to the **treasurer/FS** (the existing
reconciliation delta) and sometimes the **booker**. A delayed check's actual amount lands on its booking's
(past) event; until it is paid, that booking contributes its expected amount, so the event total is stable.

**Rationale**: FR-009. Pure-actual would show $0 for an un-settled event; a broken-out paid/outstanding pair
is noise for an organizer judging event success — they want "what did (will) this event cost in performer
pay," one number, by performance date. The paid/outstanding detail matters to whoever chases the money
(treasurer/FS/booker), and they already have the reconciliation delta. For a fully-paid event with no
discrepancy this equals today's expected sum, so it is a safe superset of current behavior.

**Alternatives**: Pure-actual (unpaid = $0) — rejected: understates un-settled events. Show the breakdown on
the organizer report — rejected per the user: organizers care about the total, not the split.

## R6 — Migration `0027` backfill of `amount_cents`

**Decision**: Add the columns, then backfill each existing `payment_bookings` line's `amount_cents`: for a
payment with **one** link → the payment's `amount_cents`; for a payment with **multiple** links → split by the
linked bookings' `pay_cents` proportionally, assigning any rounding remainder to the first line so the lines
sum exactly to the payment total. Then set `amount_cents` NOT NULL.

**Rationale**: 019's backfill created mostly one-booking payments (each = a booking's pay), so the common case
is exact. The proportional split handles any rare multi-link payment without loss; remainder-to-first keeps
the invariant "lines sum to total" (SC-002). On `zak1_dev` the set is tiny — verify with a before/after sum
check (like 021).

## R7 — FS entry surface

**Decision**: The FS records payments with per-line amounts and voids on the existing **`/payments`** page
(feature 019, already the FS/treasurer payment surface), extended for lines + void/reissue. Surfacing the same
entry on the **gate report** (per the Phase 4 draft, where Mary works at the break) is included as the
door-side affordance but reuses the same service/validation.

**Rationale**: `/payments` already exists and is scoped to `performer_payment.write`; extending it is lower-risk
than a fresh surface. The draft's "Mary records on the gate report" is satisfied by exposing the same entry
there. YAGNI: one service, two entry points, no duplication.

## R8 — Cross-event integrity: delete guardrail + reconciliation re-base (analyze H1/M1)

**Decision**: (H1) Widen the event-delete guardrail — it already blocks on a payment *recorded at* the event;
also block when any of the event's **bookings** is settled by a **live** payment line (via `payment_bookings`,
`voided_at IS NULL`), so a check written at another event that settles this event's booking still blocks
deletion. (M1) Re-base reconciliation (`reconcile.ts`, `listPerformerPayments`, and the treasurer/organizer
deltas) to **exclude voided** payments and reconcile an event by the **live per-line** amounts settling *that
event's bookings*, not by payments recorded at the event.

**Rationale**: Relaxing the same-event constraint (R2) opened two holes: deleting event A could cascade-drop a
booking that a cross-event check (recorded at B) settled — silently orphaning the paid line and breaking the
check's line-sum total (SC-002) — and the old event-total reconciliation (payments recorded at the event)
double-counts/misplaces a cross-event check. Both are closed by keying integrity on the **line→booking→event**
relationship and live-only settlement. FR-013 makes the guardrail a first-class requirement.

**Alternatives**: Leave the guardrail as-is — rejected: a real data-integrity break introduced by R2.
