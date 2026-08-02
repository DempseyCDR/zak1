# Feature Specification: Payments page optimized for the per-performer check workflow

**Feature Branch**: `030-payments-per-performer`

**Created**: 2026-08-01

**Status**: Draft

**Input**: User description: "P5-R3"

## User Scenarios & Testing *(mandatory)*

The Financial Secretary (Mary) settles an event by **writing a separate check to each performer**. Today's
payments page is built for the opposite path (pick one payee, tick several bookings, one check across many),
which makes her common case slow and error-prone. This feature reorganizes the page around one row per
performer while keeping the occasional shared-check path available.

### User Story 1 - Record a separate check per performer (Priority: P1) 🥇 MVP

Mary opens the payments page, the event is already selected (the most recent on/before today), and she sees
**one row per performer** booked on that event, each showing the performer's **role** and **booked amount**.
For each performer she writes a check, enters the **check number** on that performer's row, and it records a
payment **to that performer** for the **booked amount** — she doesn't pick a payee or tick a booking. If the
paid amount differs, she types the amount on that row.

**Why this priority**: This is the core of the redesign and the whole reason the page felt wrong for Mary.
It delivers the everyday value (fast per-performer checks) on its own; every other story refines it.

**Independent Test**: On a selected event with several booked performers, enter a check number on one
performer's row (leave the amount blank) → a payment to that performer for the booked amount is recorded, with
no payee selection or booking checkbox.

**Acceptance Scenarios**:

1. **Given** an event with booked, check-requiring performers, **When** Mary enters a check number on a
   performer's row and leaves the amount blank, **Then** a payment to that performer for the **booked amount**
   is recorded.
2. **Given** the same row, **When** Mary enters a check number **and** an explicit amount, **Then** the payment
   records **that** amount to that performer.
3. **Given** a performer's row she has not touched, **When** she saves/reviews, **Then** that performer remains
   **outstanding** (part of the reconciliation gap she is working down) — no payment is created.
4. **Given** several performers, **When** Mary records a check on each, **Then** each is its **own** payment to
   its **own** performer (no shared payee).

---

### User Story 2 - Non-paying bookings never prompt a check or read as a gap (Priority: P1)

Some **booked** performers are never paid — a **donated** performer, an **instructor** (forced-free), or any
**$0** booking. Mary sees them on the roster clearly marked **free**, with **no check field**, and they are
**excluded** from "payments due" and from the reconciliation gap, so the list reads complete but only
genuinely payable bookings ask for a check. (Open-band **musicians** are *not* booked or paid — they attend
and are comped into the next event in the group; they are counted attendees, not payments rows. The open
band's paid **lead musicians** *are* bookings and appear here. See Clarifications and Assumptions.)

**Why this priority**: Without this, the per-performer list shows false outstanding items and Mary can't trust
the reconciliation gap — it's inseparable from US1 being correct.

**Independent Test**: Add a donated performer and an instructor to an event → both appear as free (no check
field) and neither counts toward payments due or the outstanding gap.

**Acceptance Scenarios**:

1. **Given** a donated performer (`$0`, donated), **When** Mary views the event, **Then** the row shows as
   **free** with no check field and is excluded from payments due and the gap.
2. **Given** an instructor (forced-free) or any `$0` booking, **When** Mary views the event, **Then** the same
   free treatment applies.
3. **Given** a mix of payable and free bookings, **When** Mary reconciles, **Then** expected/outstanding
   reflects **only** the check-requiring bookings.

---

### User Story 3 - Last-minute donation at settlement (Priority: P2)

A performer who was booked-and-paid tells Mary at the door they're donating tonight (e.g. an open band's paid
**lead musician** waiving their fee). On that performer's row Mary enters **`0` and no check number**. The
performer **keeps their booking** (they played — the appearance stands), earns **nothing**, has **no check**,
and is **not** an outstanding gap — identical to a booked-donated performer. Mary can do this from the
payments page **without** holding the Booker's booking-edit rights.

**Why this priority**: A real recurring settlement case, but it builds on US1/US2 and is less frequent than the
straight per-performer check.

**Independent Test**: On a paid-booked performer's row, enter `0` with no check number and confirm → the
performer's expected drops to 0, appearance is retained, and no reconciliation gap remains for them.

**Acceptance Scenarios**:

1. **Given** a booked-paid performer, **When** Mary enters `0` and no check number on their row and confirms,
   **Then** the booking becomes **donated** (appearance kept, earnings 0, no check required) and it is not a
   gap.
2. **Given** Mary holds payment-write but **not** booking-edit rights, **When** she performs the
   donate-at-settlement action, **Then** it succeeds (a narrow settlement action, not general booking editing).
3. **Given** an accidental entry, **When** Mary is about to flip a performer to donated, **Then** she is asked
   to confirm before it applies.

---

### User Story 4 - Occasional shared check across performers (Priority: P2)

Now and then one check covers several booked performers (e.g. one check to a band lead settling the whole
band). A **button opens a checklist** where Mary picks a **single payee** and the **multiple bookings** that
check settles, each with its applied amount — the previous one-check-many-bookings behavior, now the
exception rather than the default.

**Why this priority**: Needed for completeness and to preserve today's capability, but it's the occasional
path, so it ranks below the per-performer default.

**Independent Test**: Open the multi-apply control, choose a payee and two bookings with amounts, record → one
payment to that payee settles both bookings.

**Acceptance Scenarios**:

1. **Given** several booked performers, **When** Mary opens the multi-apply control, selects a payee and two
   or more bookings with amounts, and records, **Then** one payment to that payee settles those bookings.
2. **Given** the shared-check payment, **When** Mary reconciles, **Then** the settled bookings are no longer
   outstanding.

---

### User Story 5 - Correct an existing payment inline (Priority: P2)

A performer's row that already shows a recorded payment can be **clicked to edit** its **paid amount** and
**check number** in place, without deleting and re-creating it.

**Why this priority**: Corrections are common (a mistyped check number or amount) but secondary to recording
the payments in the first place.

**Independent Test**: Click a paid performer's row, change the amount and check number, save → the payment
reflects the new values.

**Acceptance Scenarios**:

1. **Given** a performer with a recorded payment, **When** Mary clicks the row and edits the amount and/or
   check number, **Then** the payment updates in place.
2. **Given** a wrongly recorded check, **When** Mary needs to cancel it entirely, **Then** the existing void
   action remains available (unchanged).

---

### User Story 6 - Add a last-minute performer and pay them (Priority: P3)

A player shows up who wasn't booked. A **button adds a performer** to the event and records their check. The
new performer first gets a **booking** on the event, then their own check is recorded like any other row.

**Why this priority**: A real but infrequent lineup change; depends on the row model from US1.

**Independent Test**: Use the add-performer control for someone not booked → a booking is created for them on
the event and their per-performer row accepts a check.

**Acceptance Scenarios**:

1. **Given** a performer not booked on the event, **When** Mary adds them via the add-performer control,
   **Then** a booking is created for them on the event and their row accepts a check like any other.
2. **Given** the added performer, **When** Mary records their check, **Then** it is their own payment for the
   entered/booked amount.

---

### Edge Cases

- **Already-paid performer**: their row shows the recorded payment (editable per US5), not an empty new-check
  row.
- **Substitution**: a substitute is settled with **their own** booking and **their own** check; if the
  no-show's check was already written, Mary voids it — so the per-performer rows need **no** "pay someone else"
  override.
- **Cross-event delayed check**: a check written at this event that settles a booking from another event stays
  available through the multi-apply control (existing behavior); the per-performer rows are this event's
  bookings. Conversely, a booking on **this** event that was already settled by a check **recorded at another
  event** MUST render as **paid/settled**, not outstanding (FR-016) — otherwise Mary could write a duplicate
  check.
- **Positive amount with no check number**: the row does not silently record — it **prompts a confirmation
  that includes a free-text comment box** to explain the missing check; on confirm it records a check-less
  payment for that amount with the comment stored as the payment's note (see FR-014). (A `$0`/free booking
  with a check number typed remains a nonsensical entry and is blocked/ignored.)
- **Add-performer who is already booked** on the event: does not create a duplicate booking; surfaces the
  existing row instead.
- **Reversing a donate-at-settlement flip**: out of scope here (the Booker, who holds booking-edit rights, can
  restore the booking); the confirmation step guards against mis-entry.

## Clarifications

### Session 2026-08-01

- Q: On a per-performer row, what happens when a positive amount is entered with no check number? → A:
  Warn/confirm before recording, and the confirmation includes a free-text comment box to explain the missing
  check; the comment is stored as the payment's note (a check-less payment). (FR-014)
- Q: How does Mary commit her per-performer entries — per row or one batch save? → A: Per-row commit — each
  row records its own payment independently as she enters/confirms it (no batch "save all"). (FR-015)
- Q: Who can mark a booking as a donation of services? → A: **Both** the Booker (at booking time, by
  accepting a `0` expected payment — the donated state) and the Financial Secretary (at settlement, FR-007).
  The two paths set the **same** donated state; the payments page treats a donated booking as free regardless
  of who set it. (FR-006, FR-007)
- Q: How do open-band musicians vs. the open band's lead musicians appear on the payments page? → A:
  **Open-band musicians are not booked or paid** — they *attend* and are comped into the next event in the
  event group; comps are reported to the treasurer as **counts of all kinds, not lists of names** (existing
  attendance/gate/door model, feature 017), and are **out of this feature's scope**. The open band's one or
  two **lead musicians** *are* booked and paid (and may donate their services, FR-007), so they appear as
  ordinary payable rows. Free payments rows are thus donated performers, instructors, and `$0` bookings —
  not open-band musicians. (FR-006)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: On the payments page, selecting an event (default: most recent on/before today, via the existing
  shared event selector) MUST present **one row per performer** booked on that event, each showing the
  performer's **role** and **booked amount**.
- **FR-002**: Entering a **check number** on a performer's row with a **blank amount** MUST record a payment
  **to that performer** for the **booked amount** — i.e. a blank amount resolves to the **expected payment set
  at booking** (which may itself be `0`).
- **FR-003**: Entering a **check number and an explicit amount** on a row MUST record a payment to that
  performer for **that** amount.
- **FR-004**: A row Mary has not touched MUST remain **outstanding** (no payment created) and contribute to the
  reconciliation gap.
- **FR-005**: Each per-performer row MUST record its **own** payment to its **own** performer (the payee is
  always that row's performer — no per-row payee override).
- **FR-006**: Bookings that do **not** require a check — donated performers, instructors (forced-free), and
  any `$0` booking (mechanism: `requires_check = false`) — MUST be shown as **free** (no check field) and
  **excluded** from payments due and from the reconciliation gap, while still appearing on the roster. A
  **donated** booking is treated as free regardless of who set the donated state — the Booker at booking time
  (accepting a `0` expected payment) or the Financial Secretary at settlement (FR-007). *(Open-band musicians
  are comped **attendees**, not bookings — they do not appear as payments rows; their paid **lead musicians**
  do.)*
- **FR-007**: Entering `0` with **no check number** on a booked-paid performer's row MUST flip that booking to
  **donated** — appearance retained, earnings 0, no check required — so it is not an outstanding gap.
- **FR-008**: The donate-at-settlement action of FR-007 MUST be permitted for a user holding **payment-write**
  authority (the Financial Secretary / Treasurer) **without** requiring general booking-edit authority, and
  MUST require a **confirmation** before applying.
- **FR-009**: A **multi-apply** control MUST let the user record **one check to a single payee** settling
  **multiple** selected bookings, each with its applied amount (the previous one-check-many-bookings path,
  retained as the exception).
- **FR-010**: A recorded payment MUST be **editable in place** (paid amount and check number) by clicking its
  row; the existing **void** action MUST remain available and unchanged.
- **FR-011**: An **add-performer** control MUST let Mary add a performer who wasn't booked: it **creates a
  booking** for them on the event, then records their per-performer check. Adding a performer already booked on
  the event MUST NOT create a duplicate booking.
- **FR-012**: The event-bookings information feeding the payments page MUST convey, per booking, whether it
  **requires a check** and whether it is **donated**, so the page can render free vs. payable rows — **without**
  a schema change.
- **FR-013**: Reconciliation (expected vs. actual, outstanding gap) MUST reflect **only** check-requiring
  bookings and MUST otherwise preserve the existing payment substrate (per-line applied amounts, void,
  cross-event settlement, single-payee shared checks) unchanged.
- **FR-014**: Entering a **positive amount with no check number** on a per-performer row MUST NOT record
  silently. It MUST prompt a **confirmation that includes a free-text comment box** explaining the missing
  check; on confirm, a check-less payment for that amount is recorded with the comment stored as the payment's
  **note**. This is the only path that records a positive payment without a check number.
- **FR-015**: Each per-performer row MUST commit its payment **independently** — the row records when Mary
  enters/confirms it, and one row's outcome (success, failure, or a confirmation prompt) MUST NOT block or
  batch with other rows. There is **no** all-at-once "save all" for the per-performer rows.
- **FR-016**: A booking already settled by a **live check — including one recorded at another event** — MUST
  render as **paid/settled** and MUST NOT appear as outstanding (guards against a duplicate check). The
  per-row paid/outstanding classification therefore reflects the **cross-event settled amount** per booking,
  not only checks recorded at this event. Inline edit (FR-010) of a **cross-event** check occurs where it was
  recorded, not on this row.

### Key Entities

- **Performer payment**: an actual check the FS records — a payee, a check number (optional), a note, and one
  or more applied lines; may be voided. (Existing; unchanged substrate.)
- **Payment line**: the amount of a payment applied to a specific booking. (Existing.)
- **Booking**: a performer's engagement on an event, carrying **booked amount**, **requires-check**, and
  **donated** flags that drive whether the row is payable or free. (Existing fields.)
- **Event**: the single event whose performers are being settled. (Existing; selected via the shared selector.)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Recording a straightforward per-performer check takes a **single row entry** (type the check
  number) with **no** payee selection and **no** booking checkbox — fewer steps than today's dropdown +
  checkbox flow.
- **SC-002**: 100% of non-check-requiring **bookings** (donated / instructor / `$0`) appear as **free** and
  **never** as an outstanding item; open-band musicians (comped attendees) are not shown as payments rows at
  all.
- **SC-003**: A last-minute donation (`0`, no check number) results in **zero** expected and **zero**
  outstanding for that performer while retaining their appearance.
- **SC-004**: After per-performer checks are recorded, the reconciliation total equals the sum of booked (or
  entered) amounts for check-requiring bookings — no change in reconciliation results versus the current
  substrate for equivalent inputs.
- **SC-005**: An occasional shared check to a single payee across multiple bookings can still be recorded and
  correctly clears those bookings.
- **SC-006**: An existing payment can be corrected (amount and check number) without deleting and re-creating
  it.

## Assumptions

- **Reuses shipped infrastructure unchanged**: the shared event selector (028) drives event selection, and the
  023 payment substrate (per-line applied amounts, void, cross-event settlement, reconciliation, single-payee
  checks) is kept as-is. This is a **UI/UX redesign over the existing substrate** — **no schema change, no
  migration**. The `requires_check` and `is_donated` booking flags already exist and are reused.
- **Authority**: the Financial Secretary and Treasurer hold payment-write. The donate-at-settlement action is
  gated on **payment-write**, not booking-write; it is a narrow settlement action conceptually part of paying
  out, not general booking editing.
- **Donation has two entry points to the same state**: the Booker sets it at booking time (accepting a `0`
  expected payment) and the FS sets it at settlement (FR-007). Both yield a `donated` booking (appearance
  kept, earnings 0, no check). This feature owns only the FS/settlement path and the payments-page treatment;
  the Booker's booking-time path is existing behavior.
- **`is_donated` model is kept as-is for this feature (deferred decision).** 030 reads whether a booking is
  free/donated via the existing semantics and is **agnostic** to how that state is stored. A separate proposal
  — deriving donation from `pay_cents = 0` for payable types (making `is_donated` derivable rather than a
  stored column) and/or making expected pay null-defaulted — is **deferred to its own later decision** to
  avoid complicating `is_donated` logic inside this UI feature. It carries a real behavioral choice
  (freeze-at-booking vs resolve-on-read) and touches ~6 readers + a migration, so it is out of scope here.
  Tracked in the backlog.
- **Scope of the per-performer list**: the rows are **this event's** bookings; cross-event delayed checks
  remain available via the multi-apply control (existing behavior), not the per-row default.
- **Open-band musicians and comps are out of scope**: open-band musicians are handled as **comped attendees**
  (attendance `is_open_band`, `door_records.open_band_count`, cross-comped into the event group — feature
  017), not as payments bookings. Comps of all kinds are reported to the treasurer as **counts, not names**
  (existing gate/door/treasurer model). This feature touches neither — only the open band's paid **lead
  musician** bookings appear on the payments page.
- **Editing scope**: inline edit covers paid amount and check number; cancelling a check entirely uses the
  existing void action.
- **Add-performer creates a booking** (everyone who plays gets a booking); booking-less reimbursement (backlog
  B42) stays deferred.
- **Reversing a donate-at-settlement flip** is out of scope for this feature; the Booker (who holds
  booking-edit rights) can restore the booking if needed. A confirmation step guards against mis-entry.
- The exact route/permission naming for the donate-at-settlement action is an implementation detail settled in
  planning; the user-facing requirement is that payment-write suffices and booking-write is not required.
