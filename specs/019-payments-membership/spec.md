# Feature Specification: Performer Payments, Membership Acquisition & Door-Record Fixes

**Feature Branch**: `019-payments-membership`

**Created**: 2026-07-18

**Status**: Draft

**Input**: User description: "P3-5 — Performer payments & membership acquisition. Completes the FS/Treasurer
finance surface and the three membership-acquisition paths. Bundles B31 (door membership enrollment — a named
gate membership payment creates/renews the membership record), B28 (performer payment override — payment
separable from booking: substitute payee + aggregate one check across bookings), and B30 (online membership
via the club's existing PayPal hosted button + a webhook)."

**Amended 2026-07-20**: two small operational fixes found in real use (Project Context v1.9 §9) are folded in
— **US4** the `deleteEvent` guardrail is too strict (a never-held event is blocked from deletion by an
*empty* door record), and **US5** the door seed float is hard-coded rather than configurable. Both touch the
door/finance surface this feature already opens.

## Clarifications

### Session 2026-07-23

- Q: Is a payment's payee a *contact* (as the 2026-07-18 clarification's shorthand said) or a *performer*
  record (as the design chose)? → A: **A performer record** — supersedes the earlier shorthand. Paying an
  unknown substitute is rare; when it happens, the performer record **is created first** (via the existing
  performer-management surface), and since **all performers must be contacts**, the contact record is created
  too if missing. The payment-recording step itself never mints performers or contacts.
- Q: Who may create that substitute performer — must the FS route through a Booker? → A: **The FS holds
  `performer.write` directly** (scoped to their series; Treasurer club-wide), added in this feature so paying
  a substitute needs no cross-role handoff. The FS and Treasurer must be able to **correct performer
  directory info** generally, not only add substitutes — the capability is directory-wide (it has no
  create-only variant), and the club accepts that widening. Shared with the Booker, not taken from them.
- Q: Can a payment exist with no booking? → A: **No** — every payment references at least one booking; a
  substitute is paid *against the booking they covered* (payee ≠ booked performer is exactly what FR-005
  models). Paying someone with no booking at all (e.g. reimbursing an organizer's expense) is a different
  concept, deliberately out of scope → backlog **B42**.

### Session 2026-07-20

- Q: How far should the event-delete guardrail relax? → A: **The empty door record is the whole test.**
  Deletion is allowed when the event has no financial substance — no gate sales, all door money and counts
  zero. (Relaxing only the door record while attendance still blocked would leave the observed never-held
  events undeletable.)
- Q: An attendance row has no "empty" state to test — every row means someone was checked in. So how does
  attendance factor in? → A: **Attendance never blocks, but the count is surfaced.** Attendance rows cascade
  with the event whatever their number; a deletion that would discard them reports **how many attendees**
  would be lost and requires confirmation. A genuinely attended night leaves a non-empty door record (takings,
  comps, or open-band counts), so this is safe — the confirmation guards the narrow residual case of a
  free night with a real roster and all-zero money.
- Q: What scope should the configurable door seed float have? → A: **Per-series parameter**, joining the
  existing series-parameter pattern (per-series, effective-dated, audited) that already governs rates and
  expenses. The FS's per-door-record override is unchanged.

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
reuses it; the performer-payment story (US2) is independent. **US4 and US5** are two small door-surface fixes
found in real use — an over-strict event-delete guardrail and a hard-coded seed float — bundled here because
they touch the same door/finance surface; both are independent of US1–US3 and of each other.

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

---

### User Story 4 - Delete a never-held event (Priority: P4)

An organizer schedules an event that never happens. Someone opened the check-in or gate page for it — which
alone creates a door record — so the event is now permanently undeletable even though **no money moved and
nobody danced**. The organizer must be able to delete an event that has no real history, while an event with
genuine history stays protected.

**Why this priority**: A small, self-contained correctness fix to an existing guardrail. Independent of the
payment stories; valuable because the clutter is already visible in real data.

**Independent Test**: Open the gate page for a future event (creating a door record), then delete the event —
it succeeds and the empty door record goes with it. Record a single gate sale on another event and confirm
deletion is still refused.

**Acceptance Scenarios**:

1. **Given** an event whose only history is an **empty** door record — no gate sales, all money and counts
   zero — **When** the organizer deletes the event, **Then** the deletion succeeds and the empty door record
   is removed with it.
2. **Given** an event with an empty door record **and** one or more attendance rows, **When** the organizer
   deletes the event, **Then** they are told how many attendees would be discarded and, on confirming, the
   deletion succeeds and those rows are removed with it (Clarifications 2026-07-20).
3. **Given** an event with an empty door record and **no** attendance rows, **When** the organizer deletes it,
   **Then** no attendee warning is shown and the deletion proceeds.
4. **Given** an event whose door record has **any** gate sale or **any** non-zero money or count, **When**
   deletion is attempted, **Then** it is still refused as having history — the attendee confirmation is never
   offered as a way past a non-empty door record.
5. **Given** an event with a booking that carries a **check number**, **When** deletion is attempted, **Then**
   it is still refused (unchanged).
6. **Given** a refused deletion, **When** the organizer sees the response, **Then** the reason names what
   history blocks it, so they know what to clear.

---

### User Story 5 - Configurable door seed float (Priority: P5)

The **seed float** — the cash put in the till before the doors open — is currently fixed at $15.00 in two
places, so a series that runs a different float must be corrected by hand on every door record. The Treasurer
should be able to set the starting float **per series**, the way rates and expenses are already set, while the
FS keeps the ability to override it on the night.

**Why this priority**: Smallest item; a convenience/consistency fix rather than a correctness gap (the FS
override already works). Independent of everything else here.

**Independent Test**: Set a series' seed float to a non-$15 value, open a new door record for an event in that
series, and confirm the door record and the gate page both start at the configured value; then override it on
the gate and confirm the override wins.

**Acceptance Scenarios**:

1. **Given** a series with a configured seed float, **When** a door record is created for one of its events,
   **Then** the record's seed float starts at the configured value, not a fixed $15.00.
2. **Given** the same series, **When** the FS opens the gate page, **Then** the seed-float field is
   pre-filled from the configured value rather than a hard-coded one.
3. **Given** a configured seed float, **When** the FS overrides it on a specific door record, **Then** the
   override applies to that record only and the series configuration is unchanged.
4. **Given** a series with **no** seed float configured, **When** a door record is created, **Then** a
   documented club default applies and nothing breaks.
5. **Given** the value is changed, **When** it is saved, **Then** the change is effective-dated and audited
   like other series parameters, and **already-created** door records keep the float they were opened with.

### Edge Cases

- **Named membership payment for a contact without a payer record** — the system creates the payer link as
  needed (dues can be paid by the member or on their behalf).
- **Membership term** — a dues payment extends expiry to the **next membership-year-end** (a fixed shared
  boundary, FR-003); the boundary date is a club configuration that must be defined.
- **Performer payment with no matching booking** — *resolved (Clarifications 2026-07-23)*: every payment
  references at least one booking; a substitute is paid against the booking they covered. No-booking payouts
  (organizer expense reimbursement) → backlog **B42**.
- **Substitute payee unknown to the system** — the FS creates the performer record (and its contact — all
  performers must be contacts) directly via the existing performer-management surface (`performer.write`,
  which the FS now holds per FR-009a), then records the payment. The payment-recording step itself never
  creates performers or contacts.
- **Aggregated check across events** — is one check allowed to cover bookings from *different* events, or
  only within one event? (Assumed within one event's settlement unless clarified.)
- **Online capture with no matching payment** (member enters info but never pays) — the captured info expires
  / is ignored; no membership is created.
- **Online payment with no prior capture** (paid directly via PayPal without the form) — reconciled manually;
  the webhook cannot create a membership it cannot match (ties to the matching clarification).
- **Money is always integer cents**; the advertised/entered dues amount is recorded but the membership term
  derives from the term rule, not the amount.
- **Door record holding only a non-zero seed float** — the float alone is *not* evidence the event happened
  (it is a default, not takings), so it does not make the record non-empty for deletion purposes.
- **Deleting an event that has a performer payment** — a recorded payment is real financial history and MUST
  block deletion, alongside a booking check number.
- **Seed float configured mid-season** — the new value applies to door records opened afterwards; records
  already open keep theirs, so past nights never re-compute.
- **Seed float and the deposit calculation** — the deposit stays `gross cash − seed float − cash paid out`
  whatever the float's source; making it configurable changes no arithmetic.

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
  **payee** (a **performer record**, which MAY differ from the booked performer — an unknown substitute gets
  a performer record, and its contact, created first via the existing performer-management surface, which
  the FS now reaches directly per FR-009a), an **actual amount**, a **check number**, and an optional
  **reason/override note**. Every payment references **at least one booking** (Clarifications 2026-07-23).
- **FR-006**: A single payment MUST be able to **cover multiple bookings** (aggregation — one check for
  several obligations), and payment amounts MUST be able to **redistribute** across payees.
- **FR-007**: The **booked rate** MUST remain the **expected** figure on the booking and MUST NOT be
  overwritten by the actual disbursement.
- **FR-008**: The **treasurer report** MUST derive its performer-payment lines from the **actual payments**
  (payee, amount, check number) and MUST let the total be reconciled against the sum of booked obligations
  (surfacing any gap).
- **FR-009**: Recording/overriding payments MUST be gated to the **FS** (per series) and the **Treasurer**
  (club-wide), consistent with the existing money boundary.
- **FR-009a**: The **FS** (per series) and **Treasurer** (club-wide) MUST hold **performer-directory write**
  (`performer.write`), so they can correct performer information and add an unknown substitute payee without
  a cross-role handoff. This is directory-wide (no create-only variant) and is **shared with** the Booker,
  not removed from them.

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

#### Event deletion guardrail (§9 fix 1)

- **FR-017**: An event MUST remain deletable when it has **no real history**. A door record that is **empty**
  — no gate sales and every money field and count zero (the seed float alone does not count) — MUST NOT block
  deletion, and MUST be removed together with the event.
- **FR-018**: Attendance rows MUST NOT block deletion on their own, whatever their number, and MUST be removed
  with the event. An attendance row has no "empty" state to test — every row means someone was checked in — so
  the guardrail rests entirely on the door record being empty (FR-017), which a genuinely attended night never
  is (Clarifications 2026-07-20).
- **FR-018a**: Because attendance no longer blocks, a deletion that would discard attendance rows MUST report
  **how many attendees** would be lost and require the organizer to confirm, so a roster is never discarded
  silently (Clarifications 2026-07-20).
- **FR-019**: Deletion MUST still be refused when the event has **any** gate sale, **any** non-zero door money
  or count, a booking with a **check number**, or a recorded **performer payment** (FR-005). The refusal MUST
  state which of these blocks it.
- **FR-020**: Deleting an event MUST remain restricted to those who may already write events, and MUST be
  audited as today.

#### Configurable door seed float (§9 fix 2)

- **FR-021**: The **seed float** MUST be a **per-series configuration** — effective-dated and audited like the
  existing rate/expense parameters — rather than a fixed value baked into the data store and the gate screen
  (Clarifications 2026-07-20).
- **FR-022**: A newly created door record MUST take its starting seed float from the configured value for its
  series, and the gate screen MUST pre-fill from the same source.
- **FR-023**: The FS MUST keep the existing **per-door-record override**; an override applies to that record
  only and never changes the series configuration.
- **FR-024**: When a series has no configured seed float, a **documented club default** MUST apply, so the
  door flow never blocks on missing configuration.
- **FR-025**: Changing the configured value MUST NOT alter door records already created; historical nights
  MUST keep the float they were opened with, and the deposit calculation MUST be unchanged.
- **FR-026**: Setting the seed float MUST be gated to those who may already set series rate/expense
  parameters (Treasurer club-wide, FS per series).

### Key Entities *(include if feature involves data)*

- **Membership** (existing): a contact's dues record with an expiry; created/renewed by the door and online
  flows through the shared path. Status is derived from the most recent expiry.
- **Performer payment** (new): a **dedicated `performer_payments` record** — payee (a **performer record**,
  may ≠ booked performer; created first, with its contact, when a substitute is unknown), actual amount,
  check number, override reason — with a **many-to-many link to bookings** (a `payment_bookings` join), so
  one payment can settle several bookings (aggregation). Distinct from the booking's *expected* rate, which
  is unchanged.
- **Booking** (existing): unchanged in shape; its rate is now explicitly the **expected** pay, with actual
  disbursement held on performer payments.
- **Captured member info** (new): website-submitted prospective-member data held server-side awaiting a
  matched PayPal payment notification.
- **Gate sale — membership line** (existing): the named `membership` category now triggers membership
  creation (B31) instead of recording dollars only.
- **Door record** (existing): gains no new shape, but acquires two behaviours — it can be **empty** (a
  well-defined "no substance" state that no longer counts as event history), and its **seed float** is
  seeded from series configuration rather than a fixed default.
- **Series parameter — seed float** (new value of an existing concept): a per-series, effective-dated,
  audited starting-float amount, alongside the existing rate and expense parameters.

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
- **SC-006**: No **public** viewer sees finance or member data beyond the member's own membership flow, and
  no one outside the FS/Treasurer money boundary can **record** payments. (Authenticated volunteers still
  *read* money per feature 016 — money is open to staff; only PII is gated.)
- **SC-007**: An event that never happened can be deleted even after its check-in or gate page was opened —
  in one action when nobody was checked in, or one confirmation when stray check-ins exist, with the attendee
  count shown before anything is discarded. An event with any takings, check, or payment still cannot be
  deleted at all, and the refusal names the reason.
- **SC-008**: The starting seed float can be set for a series without a code change, new door records start
  at that value on both the record and the gate screen, and door records opened before the change keep their
  original float.

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
- **"Empty" is defined by substance, not existence.** A door record counts as empty when it has no gate sales
  and every money field and count is zero; the seed float is excluded because it is a pre-filled default, not
  evidence of takings. This is what makes a never-held event deletable.
- **Emptiness is a property of the door record only.** Attendance rows have no fields that could be "zero" —
  a row's existence *is* the check-in — so the delete test rests wholly on the door record, with the attendee
  count surfaced for confirmation (FR-018a) rather than used as a gate. The assumption underneath: a night
  that genuinely happened always leaves money, comps, or open-band counts behind, so an empty door record with
  a roster attached means someone opened the check-in page by mistake.
- **Two configuration scopes, deliberately.** The membership-year-end boundary (FR-003a) is **club-wide** —
  one date shared by all members — while the seed float (FR-021) is **per-series**, because different series
  can run different tills and the effective-dated series-parameter pattern already exists for exactly this.
  They are not merged into one settings concept.
- **The seed float default survives as a documented fallback** (FR-024) rather than being removed outright, so
  a series with no configuration set still opens its doors.
- **The year-end boundary is configured operationally** — set via SQL on the existing club-settings
  singleton, like the existing lapse settings; no settings UI ships in this feature (YAGNI).
- **No roll-forward window (open club question).** A dues payment shortly *before* the boundary extends only
  to that boundary — it buys days, not a year. Whether payments within some window should roll to the
  *following* boundary is a club decision, deliberately not assumed; if wanted later it is one parameter in
  the term rule.
- **Organizer expense reimbursement is not a performer payment** — payments require a booking; reimbursements
  are deferred to backlog **B42** (YAGNI, Clarifications 2026-07-23).
- **Small fixes are bundled, not sequenced.** US4 and US5 are independent of US1–US3 and of each other; they
  ride along in this feature because they touch the same door/finance surface, and either could be dropped
  without affecting the payment stories.
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
- **Door record + gate (feature 002) and event management (feature 018)** — US4 relaxes the delete guardrail
  018 introduced; US5 replaces the fixed seed float 002 introduced.
- **Series parameters (feature 009)** — US5 extends that effective-dated, audited per-series pattern.
- **Performer payments (US2 of this feature)** — US4's guardrail must also treat a recorded payment as
  history, so US4 lands after or alongside US2.

## Out of Scope

- Group tickets and advance event-ticket sales (B1 / 007 US2) — B30 is membership-only, one button.
- Automating the PayPal→QBO accounting entry (reconciliation stays in QBO).
- Changing membership **classification/cycle** rules (feature 001) — this feature creates/renews records; it
  does not redefine how status is classified.
- Non-membership online purchases.
- **Organizer expense reimbursement** — paying a non-performer with no booking (an organizer who covered an
  expense). Occasional in practice, but YAGNI here: payments in this feature settle bookings. → backlog
  **B42**.
- A general undo/restore for deleted events — US4 relaxes when deletion is *allowed*, it does not add
  recovery of an event already deleted.
- Making other hard-coded door/gate defaults configurable — US5 covers the **seed float** only.
- Bulk cleanup of the never-held events already sitting in the demo database (an operational task, not a
  feature).
