# Feature Specification: Performer Payments & Membership Acquisition

**Feature Branch**: `019-payments-membership`

**Created**: 2026-07-18

**Status**: Draft

**Input**: User description: "P3-5 — Performer payments & membership acquisition. Completes the FS/Treasurer
finance surface and the three membership-acquisition paths. Bundles B31 (door membership enrollment — a named
gate membership payment creates/renews the membership record), B28 (performer payment override — payment
separable from booking: substitute payee + aggregate one check across bookings), and B30 (online membership
via the club's existing PayPal hosted button + a webhook)."

## Clarifications

### Session 2026-07-18

- Q: B28 — how are performer payments modeled (substitute payee + one check aggregating several bookings)?
  → A: **A dedicated `performer_payments` table** (payee contact, actual amount, check number, override
  reason) with a **many-to-many link to bookings** (a `payment_bookings` join). One payment row can settle
  several bookings; the booking's rate stays the *expected* figure, untouched.
- Q: B31/B30 — what term does a dues payment grant, and how does a renewal extend? → A: **Fixed membership-
  year boundary** — a dues payment extends the membership to the **next membership-year-end** (a fixed date
  shared by all members), regardless of the payment date. This requires a **defined membership-year-end**
  (a club configuration); the exact boundary date is an operational input.
- Q: B30 — how does an online PayPal payment become a membership, and how is the webhook trusted? → A:
  **Auto-match by payer email, with signature verification and a manual fallback.** Each webhook is verified
  via PayPal's signature/transmission check; a verified payment whose **payer email matches** the email the
  member entered on the capture form creates/renews the membership. A verified-but-unmatched payment is
  **parked for an admin to link manually**. (Implementation confirms the exact PayPal event/payload.)

## User Scenarios & Testing *(mandatory)*

Two financial actors and the public. The **Financial Secretary (FS)** enrols members at the door and writes
the checks that pay performers; the **Treasurer** oversees the same, club-wide. A prospective or renewing
**member** (public, unauthenticated) can pay dues online. Membership acquisition now has three paths: at the
door (cash/card, FS-entered), online (self-service, PayPal), and the existing admin entry.

Stories are ordered so the shared **membership-creation** path (US1) lands before the online path (US3) that
reuses it; the performer-payment story (US2) is independent.

### User Story 1 - Door membership enrollment (Priority: P1)

When a dancer pays **dues at the door** — cash to the Door Attendant, or card/Venmo — the FS records it as a
**named** membership payment on the gate. Today that only records a dollar amount; now it also **creates or
renews the member's record** and **recomputes their membership status**, atomically with the gate sale.

**Why this priority**: It closes a real gap (dues taken at the door never became memberships) and establishes
the membership-creation path that the online story (US3) reuses. Self-contained and high value.

**Independent Test**: Enter a named door membership payment for a contact and confirm a membership record is
created/renewed and the contact's status updates — in the same transaction as the gate sale; an anonymous
(unnamed) membership line still records money without creating a membership.

**Acceptance Scenarios**:

1. **Given** the FS entering gate money, **When** they record a **named** membership payment for a contact,
   **Then** a membership record is created (or renewed) for that contact and their status is recomputed, in
   the same transaction as the gate sale.
2. **Given** a contact who already has a membership, **When** the FS records another named membership payment,
   **Then** the membership is **renewed** (extended per the term rule) rather than duplicated confusingly.
3. **Given** a membership dollar line with **no** named contact, **When** it is saved, **Then** money is
   recorded as today and **no** membership record is created.
4. **Given** a named membership payment that fails partway, **When** the transaction rolls back, **Then**
   neither the gate sale nor the membership record persists (all-or-nothing).

---

### User Story 2 - Performer payment override (Priority: P2)

The FS pays performers per the rates on their bookings, but **may override the payment**: the **payee can
differ** from the booked performer (a substitute sat in), and **amounts can be redistributed or aggregated**
— one check covering several bookings, or a performer's share redirected to another payee. The booked rate
stays the **expected** figure; the payment records what was **actually disbursed**.

**Why this priority**: Today booking and payment are conflated on one row (`performer_id` + `pay_cents` +
`check_number`), which cannot express substitution or aggregation. Separating them is the core finance
correctness fix, and it feeds the treasurer report's performer-payment lines.

**Independent Test**: For an event with several bookings, record a payment to a substitute payee, and a
single aggregated check covering multiple bookings; confirm the treasurer report shows the actual payments
and that the sum reconciles against the booked obligations.

**Acceptance Scenarios**:

1. **Given** a booked performer who is snowed in and a substitute who sits in, **When** the FS records the
   payment to the **substitute** payee, **Then** the payment shows the substitute (not the booked performer)
   as payee, while the booking record is unchanged.
2. **Given** three performers each booked at a rate, **When** one redirects their share to another and the FS
   writes **one aggregated check**, **Then** a single payment records the aggregated amount and check number
   against the covered bookings, and the others are recorded per their actual disbursement.
3. **Given** recorded payments for an event, **When** the treasurer report is assembled, **Then** it lists
   the **actual** payments (payee, amount, check number) and the total reconciles against the sum of booked
   obligations (surfacing any gap).
4. **Given** the booked rate is unchanged, **When** payments are recorded, **Then** the booking's rate
   remains the **expected** figure and is not overwritten by the actual disbursement.

---

### User Story 3 - Online membership purchase (Priority: P3)

A prospective or renewing member pays **dues online** from the public website using the club's existing
**PayPal hosted button**. Because the button is fully PayPal-hosted, the club's site gets **no automatic
callback** from the button itself; instead the member first **enters their info** on a capture page, and a
**server-side PayPal notification (webhook)** later confirms the payment and **creates/renews** the
membership from the captured info.

**Why this priority**: It is the first online sale to land and depends on an external service (PayPal), so it
comes last; it reuses the membership-creation path from US1. Deliberately narrow — membership only, one
button, no group tickets.

**Independent Test**: Submit the online capture form, simulate the PayPal payment notification, and confirm a
membership is created/renewed for the captured member and their status updates — with the notification's
authenticity verified and matched to the captured info.

**Acceptance Scenarios**:

1. **Given** a public visitor on the membership page, **When** they enter their info and pay via the PayPal
   button, **Then** their info is captured server-side awaiting payment confirmation.
2. **Given** captured member info, **When** the club receives a verified PayPal payment notification matching
   it, **Then** a membership record is created/renewed for that member and their status updates.
3. **Given** a payment notification whose authenticity **cannot be verified** (signature check fails),
   **When** it arrives, **Then** it is rejected and no membership is created.
4. **Given** a **verified** payment whose payer email **matches** a captured member, **When** it is
   processed, **Then** the membership is created/renewed; a **verified but unmatched** payment is **parked
   for an admin to link manually** rather than dropped (Clarifications 2026-07-18).
5. **Given** a duplicate or replayed notification, **When** it arrives, **Then** the membership is not created
   twice (idempotent).

### Edge Cases

- **Named membership payment for a contact without a payer record** — the system creates the payer link as
  needed (dues can be paid by the member or on their behalf).
- **Membership term** — a dues payment extends expiry to the **next membership-year-end** (a fixed shared
  boundary, FR-003); the boundary date is a club configuration that must be defined.
- **Performer payment with no matching booking** — can the FS record a payment (e.g., a substitute) with no
  prior booking, or must every payment reference at least one booking?
- **Aggregated check across events** — is one check allowed to cover bookings from *different* events, or
  only within one event? (Assumed within one event's settlement unless clarified.)
- **Online capture with no matching payment** (member enters info but never pays) — the captured info expires
  / is ignored; no membership is created.
- **Online payment with no prior capture** (paid directly via PayPal without the form) — reconciled manually;
  the webhook cannot create a membership it cannot match (ties to the matching clarification).
- **Money is always integer cents**; the advertised/entered dues amount is recorded but the membership term
  derives from the term rule, not the amount.

## Requirements *(mandatory)*

### Functional Requirements

#### Door membership enrollment (B31)

- **FR-001**: Recording a **named** `membership` gate payment MUST create or renew the named contact's
  **membership record** and **recompute** their membership status, **atomically** with the gate sale
  (all-or-nothing).
- **FR-002**: An **anonymous** (no named contact) membership line MUST continue to record money only, with no
  membership record created (unchanged behaviour).
- **FR-003**: A dues payment MUST set the membership's expiry to the **next membership-year-end boundary** —
  a fixed date shared by all members — regardless of the payment date (Clarifications 2026-07-18). This
  requires a **defined membership-year-end** as club configuration.
- **FR-003a**: The system MUST hold the **membership-year-end boundary** as a configured value; a dues
  payment resolves the expiry to the next occurrence of that boundary on/after the payment date.
- **FR-004**: A renewal MUST NOT create a confusingly duplicated active membership; repeat named payments
  extend/renew the member's standing.

#### Performer payment override (B28)

- **FR-005**: The system MUST record **performer payments separately from bookings**: a payment has a
  **payee** (a contact/performer that MAY differ from the booked performer), an **actual amount**, a **check
  number**, and an optional **reason/override note**.
- **FR-006**: A single payment MUST be able to **cover multiple bookings** (aggregation — one check for
  several obligations), and payment amounts MUST be able to **redistribute** across payees.
- **FR-007**: The **booked rate** MUST remain the **expected** figure on the booking and MUST NOT be
  overwritten by the actual disbursement.
- **FR-008**: The **treasurer report** MUST derive its performer-payment lines from the **actual payments**
  (payee, amount, check number) and MUST let the total be reconciled against the sum of booked obligations
  (surfacing any gap).
- **FR-009**: Recording/overriding payments MUST be gated to the **FS** (per series) and the **Treasurer**
  (club-wide), consistent with the existing money boundary.

#### Online membership purchase (B30)

- **FR-010**: The public website MUST present a membership page that **captures the prospective/renewing
  member's info** and offers the club's existing **PayPal hosted button** for dues payment.
- **FR-011**: The system MUST receive **server-side payment notifications** from PayPal (a webhook) and
  **verify their authenticity** (signature/transmission check); a verified notification is matched to a
  captured member by **payer email**. A verified-but-unmatched notification MUST be **parked for manual
  admin linking**, not dropped (Clarifications 2026-07-18).
- **FR-012**: On a verified, matched payment notification, the system MUST **create/renew** the membership
  and recompute status — reusing the same membership-creation path as the door flow (FR-001).
- **FR-013**: Notification handling MUST be **idempotent** — a duplicate/replayed notification MUST NOT create
  a second membership.
- **FR-014**: Financial reconciliation of online dues remains in QBO via the existing PayPal→QBO feed; the
  platform's job is the membership record, not the accounting entry.

#### Cross-cutting

- **FR-015**: All money remains **integer cents**. Membership creation (door and online) MUST go through one
  shared, transactional path so status/audit stay consistent across acquisition channels.
- **FR-016**: The public membership flow MUST expose **only** what a member needs (no staff/finance data);
  captured member info MUST be handled per the platform's existing contact-privacy rules.

### Key Entities *(include if feature involves data)*

- **Membership** (existing): a contact's dues record with an expiry; created/renewed by the door and online
  flows through the shared path. Status is derived from the most recent expiry.
- **Performer payment** (new): a **dedicated `performer_payments` record** — payee (contact, may ≠ booked
  performer), actual amount, check number, override reason — with a **many-to-many link to bookings** (a
  `payment_bookings` join), so one payment can settle several bookings (aggregation). Distinct from the
  booking's *expected* rate, which is unchanged.
- **Booking** (existing): unchanged in shape; its rate is now explicitly the **expected** pay, with actual
  disbursement held on performer payments.
- **Captured member info** (new): website-submitted prospective-member data held server-side awaiting a
  matched PayPal payment notification.
- **Gate sale — membership line** (existing): the named `membership` category now triggers membership
  creation (B31) instead of recording dollars only.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of **named** door membership payments result in a created/renewed membership and an updated
  status, committed atomically with the gate sale; anonymous lines create none.
- **SC-002**: The FS can record a performer payment to a **substitute payee** and a **single aggregated
  check** covering multiple bookings, and the treasurer report shows the actual payments with a reconcilable
  total.
- **SC-003**: A booking's booked rate is never altered by recording a payment (expected vs. actual stay
  distinct).
- **SC-004**: An online dues payment, once its notification is verified and matched, creates/renews a
  membership for the captured member; an unverifiable or unmatched notification creates none.
- **SC-005**: A duplicated payment notification never creates a second membership (idempotent).
- **SC-006**: No public or non-finance viewer can record payments or see finance/member data beyond the
  member's own membership flow.

## Assumptions

- **Shared membership-creation path.** Door (B31) and online (B30) both create/renew memberships through the
  existing `createMembership` path (contact + payer + expiry, atomic status recompute), so all channels share
  one transactional, audited routine.
- **Payer.** A door/online dues payment implies a **payer** (the member or a party paying on their behalf);
  the flow creates/links a payer record as the existing model requires.
- **Aggregation is within one event's settlement** unless clarified otherwise; cross-event aggregation is an
  open edge case.
- **Dues amount vs. term.** The entered/advertised dues **amount** is recorded, but the membership **term**
  comes from the term rule (FR-003) — the next **membership-year-end boundary** — not from the amount paid.
  The boundary date is a **new club configuration** this feature introduces (default to be set operationally).
- **Performer payments are a dedicated table** (`performer_payments` + `payment_bookings` join), not booking
  columns (Clarifications 2026-07-18) — this is what lets one check aggregate several bookings.
- **Online payments auto-match by payer email** (with signature verification); unmatched verified payments
  are parked for admin linking. The precise PayPal event and payload fields are confirmed at implementation.
- **PayPal button is fixed and hosted.** The hosted button (`Z5FUDMVGE6CVQ`) is used as-is; the club's side
  learns of payment only via the webhook, never a button callback. Reconciliation stays in QBO.
- **Reuses existing substrate.** `memberships`/`payers` + `createMembership`/`recomputeContactStatus`
  (feature 001), the gate `membership` line + `contactId` (feature 002), `bookings` + the treasurer
  performer-payment lines (feature 003/004), and the FS/Treasurer money boundary (feature 016).

## Dependencies

- **P3-1 (feature 015)** and **P3-2 (feature 016)** — the FS/Treasurer money scope; B30's public flow ties to
  the identity↔contact model.
- **Membership (feature 001)** — the shared creation/renewal + status path.
- **Gate (feature 002)** — the named `membership` line B31 upgrades.
- **Bookings + treasurer report (features 003/004)** — B28 separates actual payments from booked rates and
  feeds the report.
- **PayPal hosted button** — `docs/paypal_Z5FUDMVGE6CVQ.pdf`; external, webhook-based (no button callback).

## Out of Scope

- Group tickets and advance event-ticket sales (B1 / 007 US2) — B30 is membership-only, one button.
- Automating the PayPal→QBO accounting entry (reconciliation stays in QBO).
- Changing membership **classification/cycle** rules (feature 001) — this feature creates/renews records; it
  does not redefine how status is classified.
- Non-membership online purchases.
