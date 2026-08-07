# Feature Specification: Move Substitution to Payments + Fix Multi-Booking Check Numbers

**Feature Branch**: `043-payments-substitute-checkfix`

**Created**: 2026-08-06

**Status**: Draft

**Input**: User description: "R12 and D3"

## User Scenarios & Testing *(mandatory)*

Two related fixes to the Financial-Secretary's (Mary's) payment workflow, both on the **payments** page:

- **R12** — performer **substitution** currently lives on the **gate** page, where Mary gets a **permission error**
  (substitution requires a booking-management permission she doesn't have). Substitution is really a
  settlement concern — who actually played determines who gets paid — so it belongs where Mary manages checks.
- **D3** — a real defect found in use: a **multi-booking check** (one check split across several performers) can
  be saved **with no check number**, and that number **can't be edited afterward** — so the treasurer report shows
  a **dash** for a genuine check. (A live case: one $100 check to Clara covering Clara $50 + Micah $50 was stored
  with no check number and is currently unfixable without voiding and recreating it.)

### User Story 1 - Substitute a performer from the payments page (Priority: P1)

Mary opens the payments page for an event and substitutes a performer — choosing the booking and the replacement —
without hitting a permission error. The substitution behaves exactly as it does today. The gate page no longer
offers substitution.

**Why this priority**: It fixes a live permission failure (Mary can't substitute at all today from her surface)
and puts substitution where she works settlements.

**Independent Test**: As the Financial Secretary, substitute a performer from the payments page for an event with
a booking; confirm it succeeds (no permission error) and the booking/no-show outcome matches today's behavior;
confirm the gate page has no substitution control.

**Acceptance Scenarios**:

1. **Given** the Financial Secretary is on the payments page for an event, **When** she substitutes a performer on
   an **unpaid** booking, **Then** that booking is cleanly re-pointed to the substitute (no permission error).
2. **Given** a booking already settled by a **live check**, **When** she substitutes its performer, **Then** the
   original is kept as a **declined no-show** and the substitute is booked **fresh** (unchanged 024 semantics).
3. **Given** the gate page, **When** the Financial Secretary views it, **Then** there is **no** "substitute a
   performer" control there anymore.
4. **Given** the Booker on the bookings report, **When** they substitute a performer via the booking modal,
   **Then** it still works (the Booker's substitute access is retained — only the gate surface moved).

---

### User Story 2 - Multi-booking check numbers: required-or-commented, and editable (Priority: P1)

When Mary writes **one check covering several performers**, she can't accidentally save it with no check number and
no explanation, and if a number is missing or wrong she can fix it in place — so the treasurer report always shows
a real check number instead of a dash.

**Why this priority**: A live data defect — a valid check currently renders as a dash on the treasurer report and
cannot be corrected without destroying and recreating the payment.

**Independent Test**: Create a multi-booking check with a positive total and no check number → the system requires
a check number **or** a comment before saving. Then, on an existing multi-booking payment, add/correct the check
number in place → the treasurer report shows that number and the per-line split is unchanged.

**Acceptance Scenarios**:

1. **Given** Mary is recording a multi-booking check with a **positive** total and **no check number**, **When**
   she tries to save, **Then** she must supply either a check number **or** a comment — the payment is **not**
   silently saved with neither (the same rule the single-performer path already enforces).
2. **Given** Mary supplies a **comment** instead of a check number on a multi-booking check, **When** she saves,
   **Then** it saves (a check number is **not** forced — the checkless-with-comment option remains).
3. **Given** an existing **multi-booking** payment with a missing or wrong check number, **When** Mary edits the
   check number, **Then** it is updated **in place** (no void-and-recreate) and the **per-line allocation is
   unchanged**.
4. **Given** a multi-booking payment whose check number Mary has corrected, **When** the treasurer report is
   generated, **Then** it shows that check number (not a dash).

---

### Edge Cases

- **Multi-booking check, zero total**: the checkless-comment guard applies only to a **positive** total (a $0/free
  path is handled by the existing donate/free flows) — unchanged.
- **Editing the check number to blank**: clearing a check number on a payment is allowed only if it still
  satisfies the checkless rule (a positive payment left with no number needs a comment on record); otherwise the
  edit is refused, consistent with capture.
- **Substitution of a booking paid by a check recorded at another event** (cross-event): unchanged from today —
  the live-paid branch (keep no-show + fresh booking) still applies.
- **Voided payments**: remain non-editable (correct by reissue), unchanged.

## Clarifications

### Session 2026-08-06

- Q: When substitution moves to `/payments` and the route is re-gated for the FS, is the Booker's bookings-report
  substitute retained or removed? → A: **Retain both (no regression).** The substitute route accepts **either**
  the booking-management permission **or** the settlement permission, so the Booker keeps the bookings-report
  modal substitute and the FS gains it on `/payments`; only the **gate** substitute is removed. Nobody loses
  access; the FS's current 403 is fixed.

## Requirements *(mandatory)*

### Functional Requirements

#### R12 — substitution moves to payments

- **FR-001**: The **gate** page MUST NOT offer a performer-substitution control.
- **FR-002**: The **payments** page MUST offer a performer-substitution control (select a booking on the event +
  choose a substitute performer).
- **FR-003**: The Financial Secretary MUST be able to substitute a performer using her **payment/settlement**
  permission — she MUST NOT get a permission error (403) as she does today.
- **FR-004**: Substitution semantics MUST be **unchanged** from today: an **unpaid** booking is cleanly re-pointed
  to the substitute; a **live-paid** booking keeps the original as a **declined no-show** and books the substitute
  **fresh**.
- **FR-005**: The Booker's existing substitution affordance on the **bookings report** MUST be **retained** — the
  substitute action MUST be authorized by **either** the booking-management permission (the Booker) **or** the
  settlement permission (the FS). Both surfaces work; only the **gate** substitute is removed (FR-001). Nobody
  loses substitution access.

#### D3 — multi-booking check numbers

- **FR-006**: When recording a **multi-booking** check with a **positive** total and **no** check number, the
  system MUST require either a check number **or** a comment before saving — it MUST NOT silently persist a
  positive multi-booking payment with neither (the same checkless guard the single-performer path enforces).
- **FR-007**: A check number **MUST NOT be forced** on a multi-booking check — the checkless-with-comment option
  remains available.
- **FR-008**: The Financial Secretary MUST be able to **edit the check number** on an existing **multi-booking**
  payment (add a missing one or correct a wrong one) **in place**, without voiding and recreating the payment.
- **FR-009**: Editing a multi-booking payment's check number MUST **preserve its per-line allocation** (each
  booking's settled amount unchanged).

### Key Entities *(include if feature involves data)*

- **Performer substitution**: replacing who played on a booking. Semantics unchanged; only the **surface** (gate →
  payments) and the **permission** that authorizes it change.
- **Multi-booking performer payment**: one check split across several bookings/performers. Gains a save-time guard
  (check number or comment when the total is positive) and an in-place check-number correction that keeps its
  line allocation.
- **Treasurer report check number**: the per-check number shown on the report; the fix ensures a real
  multi-booking check shows its number instead of a dash.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The Financial Secretary can record a substitution from the payments page with **no** permission
  error.
- **SC-002**: The gate page shows **no** substitution control.
- **SC-003**: A multi-booking check with a positive total **cannot** be saved with neither a check number nor a
  comment (0% silent-null-check saves).
- **SC-004**: The Financial Secretary can add or correct a check number on an existing multi-booking payment, and
  afterward the treasurer report shows that number (not a dash) — with the per-line split unchanged.
- **SC-005**: Substitution outcomes and all payment amounts/allocations are unchanged by these fixes (semantics
  preserved).

## Assumptions

- **Substitution semantics are the feature-024 rules**, unchanged: unpaid → clean re-point; live-paid → original
  kept as a declined no-show + a fresh booking for the substitute. Only the surface and the authorizing permission
  move.
- **The substitute route accepts EITHER permission** (booking-management **or** settlement), per the 2026-08-06
  clarification — the settlement permission is the one the FS already uses for donate-at-settlement and
  add-settlement-performer (the feature-030 precedent), and the booking-management permission keeps the Booker's
  bookings-report substitute working. Both surfaces stay functional; the gate substitute is removed.
- **The checkless guard mirrors the single-performer path**: it triggers on a **positive** total with **no** check
  number and is satisfied by a comment; a check number is never forced.
- **In-place check-number editing needs no new data capability** — an existing payment's check number can be
  updated without changing its lines (the correction preserves the allocation). No schema change.
- **Out of scope**: changing substitution rules; changing how single-performer payments are captured/edited (they
  already work); the treasurer-report shape (040); and any migration — these are surface/permission and
  guard/affordance fixes.
