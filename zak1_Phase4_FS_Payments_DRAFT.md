# Phase 4 — FS Payments, Booker Amendments & Report Re-keying — DRAFT SPEC + NOTES

**Status:** Pre-`/speckit-specify` working draft · **Date:** 2026-07-28 · **Amends:** feature 020 (Booker
experience) and **corrects** feature 019 (payments & membership). Not yet a SpecKit feature — this is the
requirements capture to feed `/speckit-specify`.

> Personas: **Sean** = Booker · **Mary** = Financial Secretary (FS, holds the checkbook) · **Mike** =
> Treasurer (enters QBO) · **Meg** = Door Attendant (door count; her own experience is a *separate* Phase-4
> milestone, touched here only where she shares the `/gate` surface). Organizers evaluate event success.

---

## 1. Summary

A coherent slice spanning three consumers of one payment substrate:

1. **Booker (Sean)** — two amendments to 020: a **band-lead status cascade** and a **band re-point**.
2. **Financial Secretary (Mary)** — records the **actual** performer payments (checks) on the `/gate` report:
   check numbers, amounts, allocation line-items, discrepancies, **voids/reissues**, and **substitutions**.
3. **Treasurer (Mike) & Organizers** — read that substrate from opposite ends: Mike by **check-written date**
   (for QBO), organizers by **incurred/performance date**.

The load-bearing insight: **a written check is the discriminator** between a clean pre-payment edit and a
preserved-for-the-record correction. And **everyone who actually plays gets a booking** — appearance and
cost records are booking-based.

---

## 2. Booker amendments to 020

### 2.1 Band-lead status cascade

When the Booker changes the **status of a band's lead** (`bandId != null` **and**
`performerType = "lead_musician"`) on an event, every sibling booking (same `eventId` + `bandId`) that is
**still in lockstep with the lead's previous status** moves to the lead's new status.

- **Lockstep only** — a member individually diverged (e.g. already `declined`) is left untouched; never
  revived. Because followers share the lead's *from*-status, the move is always transition-legal under the
  existing state machine (`bookingStatus.ts`).
- **Status only** — each member keeps their own pay / donated / note.
- **Non-lead independence** — changing a non-lead member's status is a local edit; it cascades to no one.
- **Not on re-point** — re-pointing the lead to a different performer is a separate operation (§2.2).

### 2.2 Band re-point ("start booking over")

The Booker can swap the band booked on an event — pick a different band, analogous to re-pointing an
individual musician's slot. Example: **Shandy** (Eileen, Jane, Rebecca) → **Sister Haggis** (Eileen, Jane)
when Rebecca declines with no sub.

- **No automatic overlap recognition.** The system does not try to notice shared members — it replaces the
  outgoing band's bookings with the new band's **current roster booked fresh** (`proposed`, standard rates,
  lead as `lead_musician`). Justified because **pay may change** under the new band, so a reset is correct,
  not lossy.
- A performer in both bands (Eileen, Jane) simply gets a new `proposed` booking under the new band; any prior
  status/pay under the old band is not carried over.
- Ad-hoc non-band bookings on the event (caller, sound tech) are untouched.
- Disposition of an outgoing member (Rebecca) follows the **universal discriminator** (§3).

---

## 3. The universal rule — a written check is the discriminator

Applies to substitution, band re-point, and last-minute declines/no-shows alike:

- **No payment on the booking** → **re-point / clear is available**. The existing individual re-point (change
  performer → reset to `proposed`) applies; a clean swap, **no outgoing record retained**. Available to
  **both Mary (on `/gate`) and Sean (on the report)**.
- **A check was written** → **re-point is blocked**. Preserve the outgoing performer as a **no-show** record,
  add the substitute as a **new booking**, and **void + reissue** the check.

Consequences, unified:

- **Substitution** (Tom→Chuck): no check → re-point; check written → keep Tom no-show + new booking for Chuck
  - void/reissue.
- **Band re-point** outgoing member: no check → clear/swap; check written → keep as `declined`, void reported
  to the treasurer.
- **Wrong amount** (Jane): a check exists → always a void + reissue against the same booking, never
  mutate-in-place.

This mirrors 019's delete-guardrail instinct: **money written ⇒ never erase; preserve the trail.** It retires
the earlier *tentative "cleared"* policy — clearing is only ever the pre-payment convenience.

> **Rule R (re-point guardrail):** a booking with a **live (non-voided)** `performer_payments` line **cannot**
> be re-pointed; the UI must offer the no-show + new-booking + void path instead. A booking whose only
> payment lines are **voided does NOT block re-point** *(tentative)* — a voided check is un-committed money,
> so a clean swap is fine.

---

## 4. Financial Secretary workflow (Mary)

1. **At the break (~halfway)**, Mary opens the **gate report** for the event.
2. Reviews the **expected bookings** (`bookings.pay_cents` where `requires_check`).
3. **Writes checks** and records **check number + actual amount** → one `performer_payments` row per check.
4. **Actual ≠ expected** → a **note** on that check (discrepancy explanation); may follow a link to the
   payments detail page. Most common discrepancy: the check **settles the booking AND an additional
   obligation** explained in the note.
5. **Allocation** — each payment links to the **booking(s) it settles** with a **per-line amount**.
6. A discrepancy that **settles no booking** (a **non-performer expense reimbursement**) is **out of scope** —
   it stays in the **B42** backlog and is likely **YAGNI**, because **Mike (Treasurer), not Mary**, will most
   likely reimburse non-performers. Consequence: **every allocation line settles a real booking** in this
   slice (see §6.3). In-scope discrepancies are all booking-linked: a line whose amount differs from the
   booking's expected pay, and the band-to-lead allocation (§4.1) — each with a note.

### 4.1 Aggregation (why the M:N join stays, with per-line amounts)

One check may cover several bookings:

- **Most often** one check per performer.
- **One check to the lead** covering the whole band (payee = lead ≠ most settled performers). The check
  **exceeds the lead's own booking**, so it registers as a **discrepancy**; Mary then **allocates it across
  all the band's bookings** (per-line amounts summing to the check). **Rare**, but the concrete driver of the
  per-line allocation model.
- **Cross-event**: when Mary runs out of checks, a future-event check settles a past unpaid booking *and* a
  current one — so settled bookings can belong to **different events**.

### 4.2 Voids & reissues

- **Wrong amount:** void #1453, write #1456 (same booking).
- **Substitution:** #1562 to Tom → Tom fell ill, **Chuck** covers → void #1562, write #1565 to Chuck. Chuck
  **wasn't booked**, so Mary **adds a new booking on `/gate`** (likely reusing the 020 `BookingModal`). Tom is
  kept as a **no-show** (§3, check-written branch).
- A voided check **persists** (Mike must record the void in QBO); it shows on the treasurer report as voided.
- Void → replacement pairs are **linked** (`replaces_payment_id`).

### 4.3 Substitution vs. guest sit-in — both get their own booking

- **Substitution (Chuck for Tom):** new booking for Chuck; Tom kept as no-show. *We want the record that
  Chuck played the dance.*
- **Guest sit-in (Barney):** Tom's friend Barney is in town and joins the intact band for the event — nobody
  dropped. Barney **gets his own booking** for sitting in, plus his payment.
- **Why booking-for-everyone:** appearance count and earnings in `getPerformer` are **booking-based**
  (`performerService.ts`), so a performer with no booking never shows as having played.

---

## 5. Treasurer (Mike) & Organizer needs

- **Mike → QBO:** needs **check-written date** + **check number**, and the **allocation of each check against
  bills** (every line it covers). He works the **per-event treasurer report**, which now **includes the
  line-item / QBO view**. That report lists checks **written at (recorded-at) this event** — check date = the
  event's date — each expandable to its covered lines (which may reference other events' bookings). Voided
  checks appear distinctly.
- **Organizers:** need costs booked to **when the performer performed** (the **incurred** date) — i.e. each
  settled booking's own event date — derived from the **per-line amounts** via `payment_bookings → booking →
  event.event_date`, **not** from the payment's `event_id`.
- **Delayed check** naturally splits: it dates to the writing event for Mike (cash out), while its cost lands
  on the performance event for the organizer. A booking paid late shows as an **outstanding reconciliation
  gap** on its own event until the check lands (consistent with 019's booked-but-unpaid behavior).

---

## 6. Data model (the spine)

```text
events ─< bookings ─< payment_bookings >─ performer_payments >─ performers (payee = check recipient)
             │ pay_cents        │ amount_cents        │ check_number, amount_cents,
          (expectation +      (allocation line,       │ event_id = written-at (= check date),
           appearance          per bill/booking)      │ voided_at, void_reason, replaces_payment_id,
           record)                                    │ override_reason (note)
```

### 6.1 Corrections to 019 (`bookings.check_number` is an error → remove it)

`performer_payments` is the **single, authoritative** check store. New additive migration **`0026`**:

- **Drop** `bookings.check_number` (schema `db/schema/bookings.ts` + migration).
- Retire the gate check-write path `PATCH /api/bookings/[id]/check` + `checkNumberPatchSchema`
  (`validation/treasurer.ts`); the `/gate` report writes `performer_payments` instead.
- **Re-home the delete guardrail** — `eventService.ts` currently blocks event deletion on
  `isNotNull(bookings.check_number)`; re-key it to **`performer_payments` for the event**, or the guardrail
  silently vanishes with the column.
- Drop the `checkNumber: null` reset in the re-point branch (`bookingService.ts`) and the stale-check test
  assertion.
- Nothing historical is lost: 019's 0024 backfill already mirrored booking check numbers into
  `performer_payments`.

### 6.2 `performer_payments` (adds)

- Keep **`payee_performer_id`** = who the check is written to (needed for the pay-the-lead aggregation case;
  it differs from most settled performers).
- **`event_id`** re-defined as **"gate report where the check was recorded"** (= check-written date, always an
  event date since checks are always cut on the event date — **no separate `check_date` column**, YAGNI).
- **Voids:** `voided_at` (nullable), `void_reason`, `replaces_payment_id` (new check → the voided one).
- `override_reason` remains the discrepancy **note**.

### 6.3 `payment_bookings` (adds) — allocation lines

- Add **`amount_cents`** = portion of the check applied to that line (required for QBO bill allocation and for
  organizer per-event cost; discrepancies are where actual ≠ expected, so store it, don't derive).
- **`booking_id` stays NOT NULL** — every allocation line settles a real booking. Booking-less obligation
  lines (non-performer reimbursement) are **deferred with B42** (Mike's job; YAGNI here).
- Keep **M:N** (one check → many bookings, across events; e.g. the band-to-lead allocation).

### 6.4 Report re-keying

- **Treasurer/QBO (per-event):** group payments by `event_id` (recorded-at = check date); expand each to its
  allocation lines; show voided checks distinctly.
- **Organizer (per-event success):** sum `payment_bookings.amount_cents` whose booking belongs to the event
  (incurred date), ignoring `event_id`.

---

## 7. New / changed surfaces

- **`/gate` (door) page** gains FS payment entry (check #, amount, note → `performer_payments` +
  `payment_bookings`) and an **add-booking** affordance for substitutions/sit-ins (reuse 020 `BookingModal`).
  Mary already holds `performer.write` (019 FR-009a); confirm `booking.write` scope for the add-booking action.
- **Booker report / modals (020)** gain the **lead cascade** and **band re-point** actions.
- **Treasurer report** (`domain/treasurer/reportService.ts` + `(admin)/treasurer/[eventId]`) gains the
  line-item/QBO view and voided-check rendering.
- **Organizer report** re-keyed to incurred date.

---

## 8. Decisions log (confirmed)

| # | Decision | Rationale |
|---|---|---|
| D-cascade | Lead status cascade to **lockstep** members only; diverged/declined untouched; status-only; non-lead independent | Always transition-legal; band moves as a unit without reviving deliberate exceptions |
| D-repoint | Band re-point = wholesale "start over" (fresh `proposed`, standard rates); no overlap recognition | Pay may change under the new band |
| D-check-store | `bookings.check_number` is an error → **remove**; `performer_payments` is the sole check store | No reason for a check number on a booking; resolves the two-store duality |
| D-aggregate | Keep M:N `payment_bookings`; a check may settle many bookings, incl. **cross-event** and pay-the-lead | Real FS practice (ran-out-of-checks, one check to the band) |
| D-per-line | `payment_bookings` carries a **per-line amount**; obligation lines allow NULL booking | QBO bill allocation + organizer incurred-date cost need per-line dollars |
| D-check-date | Check date = event date; **derive** from `event_id`, no `check_date` column | Checks are always written on the event date |
| D-report-split | Treasurer groups by **recorded-at** (check date); organizer by **incurred** booking date | The two consumers date from opposite ends |
| D-void | Voids are first-class (`voided_at`/reason/`replaces_payment_id`), persist, shown to treasurer | A void is a QBO accounting event |
| D-sub-booking | Substitute (Chuck) **and** guest sit-in (Barney) each get their **own booking** | "Record that they played"; appearance/earnings are booking-based |
| D-noshow | Substituted-out performer with a written check is **kept as no-show** | For the record |
| D-discriminator | **Written check** decides: no payment → re-point/clear; payment → preserve + new booking + void | Money written ⇒ never erase |
| D-payee | `payee_performer_id` stays = **check recipient** (≠ settled performers under aggregation) | Pay-the-lead case |
| D-b42-out | **Non-performer expense reimbursement stays backlog (B42), likely YAGNI** → `payment_bookings.booking_id` **NOT NULL**; no booking-less lines | Mike, not Mary, reimburses non-performers |
| D-void-repoint | A **voided** payment does **not** block re-point; only a **live** one does *(tentative)* | Voided = un-committed money |
| D-lead-alloc | Band-to-lead check is a discrepancy → Mary **allocates it across all band bookings** (rare) | Concrete driver of per-line allocation |

---

## 9. Open questions / to validate

- **Report validation pass** (the recurring caveat): confirm the recorded-at vs. incurred split reads
  correctly across **booking, organizer, and treasurer** reports before freezing.
- **Per-performer actual earnings under aggregation** — when one check pays the lead for the band, individual
  members' *actual* earnings are ambiguous (no check to them). Decide how `getPerformer` earnings source
  (expected `pay_cents` vs. actual `performer_payments`) behaves. *(Flag, not a blocker.)*
- ~~**Obligation-line payee for non-performers**~~ — **RESOLVED (out):** non-performer reimbursement is Mike's,
  stays B42 backlog / YAGNI; no booking-less lines here.
- ~~**Re-point guardrail precision**~~ — **RESOLVED (tentative):** voided payment does **not** block re-point;
  only a live one does.
- **`booking.write` on `/gate`** — confirm Mary's scope for adding a booking there.
- **Meg (Door Attendant)** — where her door count meets the gate report is a **separate Phase-4 milestone**;
  captured here only as the shared `/gate` add-booking surface.

---

## 10. Constitution alignment (v1.3.0)

- **I Test-First** — domain rules (cascade, discriminator, aggregation allocation, void/reissue, report
  re-keying) go test-first against real Postgres; `/gate` modal interactions get component tests (jsdom, per
  the 020 harness).
- **II YAGNI** — no `check_date` column (derive); reuse `BookingModal`; pull in only the B42 slice the
  obligation-line needs.
- **III Type Safety** — Zod at the `/gate` payment-entry and add-booking boundaries; enum/rule exhaustiveness
  preserved.
- **IV Observability** — payment writes, voids, re-points, cascades all through `writeAudit`.

---

## 11. Out of scope (this slice)

- Meg's full Door Attendant experience beyond the shared `/gate` booking-add.
- **Non-performer expense reimbursement (B42)** — done by **Mike (Treasurer)**, not Mary; stays backlog,
  likely YAGNI. No booking-less payment lines in this slice.
- Any change to public/confirmed-only display or the online-membership path.
