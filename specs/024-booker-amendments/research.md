# Research: Booker amendments

Decisions resolving the plan's unknowns. No open `NEEDS CLARIFICATION` — the four product decisions are
settled in the spec (from the Phase 4 draft).

## R1 — The discriminator: a per-booking live-payment helper (023)

**Decision**: Add `bookingHasLivePayment(db, bookingId): Promise<boolean>` to the 023 payments domain — true
iff a `payment_bookings` line for that booking belongs to a `performer_payments` row with `voided_at IS NULL`.
It reuses the exact live-settlement semantics of 023's `settledCentsByBookingForEvent`/`eventHasLiveSettlement`
(join `payment_bookings → performer_payments`, filter `voided_at IS NULL`), scoped to one booking.

**Rationale**: FR-004/FR-005/FR-006 all key on "is this booking settled by a **live** check?" A single,
well-named helper keeps the rule in one place and makes a **voided** payment automatically not count (FR-006).

**Alternatives**: Re-derive per call site — rejected (duplicated, drift-prone).

## R2 — Lead status cascade inside `patchBooking`

**Decision**: In `patchBooking`'s **status-transition** branch (no performer change), after the booking's own
status update, if the booking is a **band lead on its event** (`bandId != null` && `performerType ==
'lead_musician'`) and the status actually changed, update sibling bookings — same `eventId` + `bandId`, not the
lead itself — whose current status equals the lead's **previous** status, to the lead's new status. Status only
(no pay/donated/note touched). The re-point branch does **not** cascade.

**Rationale**: FR-001/FR-002. Keying the followers on the lead's *previous* status is what makes each a
**legal** transition by construction (they share the from-state), so the existing `bookingStatus` table needs
no change and a diverged/declined member is naturally skipped. Confining it to the status branch keeps re-point
(FR-002) out of the cascade. And because the cascade lives **inside `patchBooking`**, any status change made by
a **direct `bookings` update** — the no-show `declined` sets in `substitutePerformer`/`repointBand` (R3/R4) —
bypasses it by construction, so substituting a no-show **lead** never declines the band (analyze H1).

**Alternatives**: Cascade to *all* siblings regardless of status — rejected (would revive a declined member,
and could force an illegal transition).

## R3 — Re-point/clear guardrail + a unified `substitutePerformer`

**Decision**: In `patchBooking` (the re-point branch, when `performerId` changes) and in `deleteBooking`,
**refuse** with a validation error when `bookingHasLivePayment` is true. Add `substitutePerformer(db,
bookingId, newPerformerId, …)` that branches on the discriminator: **unpaid** → re-point the slot (the existing
reset-to-proposed path); **paid** → set the original booking to **`declined`** (the no-show record) and
`createBooking` a fresh slot for the substitute (same `performerType`). Returns the resulting booking(s).

**Rationale**: FR-004/FR-005. Guarding `patchBooking`/`deleteBooking` protects 023's line-sum invariant (a
paid booking can't be re-pointed or removed to orphan its check line). `substitutePerformer` gives the caller
one operation that "does the right thing" per the discriminator, so the UI need not branch. The paid-branch
no-show is a **direct `bookings` update** (not a `patchBooking` call), so it does **not** trigger the lead
cascade — substituting a no-show lead leaves the band intact (analyze H1). The check itself is voided/reissued
on the money side (023) — separate, FS-driven.

**Alternatives**: Let the UI orchestrate decline + create — rejected (easy to get half-done; the atomic op is
safer and testable).

## R4 — `repointBand` reuses `bookBand`, applies the discriminator per member

**Decision**: `repointBand(db, eventId, fromBandId, toBandId, …)`: for each of the event's `fromBandId`
bookings, **remove** it if unpaid, **keep** it as `declined` (no-show) if it has a live payment; then call the
existing `bookBand(eventId, toBandId)` to book the incoming roster fresh (proposed, standard rates, lead as
`lead_musician`). All in one transaction, audited. Non-band bookings on the event are untouched.

**Rationale**: FR-003 + the FR-005 interaction (a paid outgoing member is kept, not orphaned). Reusing
`bookBand` means the incoming band follows the exact 008 roster/rate/lead rules — no duplication. "Start over,
no overlap reconciliation" falls out for free (a shared member simply gets a new proposed booking under the new
band).

**Alternatives**: Try to match shared members and preserve their status — rejected (explicitly out of scope;
the booker wants a clean re-book).

## R5 — Substitute / guest = a fresh booking (appearance credit)

**Decision**: A substitute (via `substitutePerformer` paid-branch) and a guest sit-in (a plain
`createBooking`) each get their **own** booking. A no-show is kept as `declined` (not deleted) when a check was
written.

**Rationale**: FR-007. `getPerformer` counts **bookings** for appearances/earnings, so the person who played
must have a booking of their own; `declined` preserves the no-show on the record without crediting an
appearance.

## R6 — Surfaces & routes

**Decision**: The **lead cascade** needs no new UI — it rides the existing lead status change on the booking
report/modal. Add a **band re-point** control (pick a new band) and a **substitute** action on the report/modal
(`(admin)/bookings-report` + `_modals/BookingModal`), and expose the substitute add-booking on the **gate**
(FS). New thin routes: `POST /api/events/[id]/repoint-band { fromBandId, toBandId }` and `POST
/api/bookings/[id]/substitute { newPerformerId }`, both `booking.write`-scoped. The re-point/clear refusal
surfaces the "settled by a live check — void it first, or substitute" message inline.

**Rationale**: FR-008. Both the Booker (report) and FS (gate) already hold `booking.write`; the operations are
service-level so both surfaces call the same code.
