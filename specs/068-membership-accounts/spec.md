# Feature Specification: Membership Accounts

**Feature Branch**: `068-membership-updates`

**Created**: 2026-09-04

**Status**: Draft

**Input**: User description: "membership accounts"

## Overview

The club sells memberships to **households**, not individuals. When dues are paid, an account is opened
in the name of the **payer**; the account carries a **level** (individual / family / supporter / student)
and a validity period derived from the **payment date**. Everyone covered by that account — the payer
included — is a **member** for as long as it is valid.

The database already contains this shape. Of 154 membership rows, 56 have a payer who is *not* the member,
and 31 payers cover more than one person; the Culbert account covers four people at one level with one
expiry. Level and expiry are **perfectly consistent within every payer group** (zero conflicts). What is
wrong is the *representation*: memberships are stored one row per member with the level and expiry copied
across the household, and there is no concept of an account to attach anyone to.

Two consequences fall out of that. Dues can only be recorded per-person, so the Financial Secretary cannot
enter a household payment as the single thing it is; and list membership is inferred from a contact's own
history rather than from being covered by an account, which makes it impossible to segment a mailing by
what a household actually bought.

## Clarifications

### Session 2026-09-04

- Q: Does a further payment renew the payer's existing account, or create a new one per payment? → A: **Durable account, moving expiry.** One account per payer; each payment moves its validity forward and attachments persist. Migration yields ~115 accounts from 154 rows.
- Q: Where is the money recorded for dues received outside the door (a cheque in the post)? → A: **Membership only — no money recorded.** The account is created; the cash is reconciled outside the system, as today. Feature 038's removal of non-event income stands.
- Q: Which level applies when more than one account covers a member? → A: **Level belongs to the payer, status belongs to every member.** The level describes what the payer bought; status applies to all members on the account. **Individual and student admit no members beyond the payer** — only family and supporter may cover others. (Verified against the data: 58 individual and 7 student accounts are all solo; zero violations.)
- Q: How are membership statuses kept true as the year rolls over? → A: **Derive where it matters, plus a one-off backfill.** Status is computed at the point of use (record, export, counts) so it cannot be stale, and a one-time correction fixes the rows stale today. No scheduler is assumed.
- Q: What happens to an account when its payer's contact is deleted? → A: **Refuse the delete.** Owning an account joins the safe-delete blockers, so a payer's contact cannot be removed while their account exists — matching feature 065's stance and 067's `shared_email` blocker. The super-user force path remains.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Record a dues payment as an account (Priority: P1)

The Financial Secretary receives dues — a cheque in the mail, or cash at the door while she reports the
gate. She records **one payment**: who paid, what level it buys, and the date it was paid. The system opens
(or renews) that payer's account and works out the validity period itself, applying the club's year-end
boundary and the two-month early-renewal grace.

She chooses the level **directly**. It is not derived from the amount, because dues tiers change over time
and members frequently round up or add a donation to the same cheque — so the money and the level are
independent facts.

**Why this priority**: Without this the club cannot record the payments it is receiving right now. It is
the minimum viable slice and every other story depends on an account existing.

**Independent Test**: Record a dues payment for a payer at a chosen level with a payment date; confirm an
account exists for that payer at that level, with a validity period matching the club's boundary rules, and
that the payer is a member of it.

**Acceptance Scenarios**:

1. **Given** a contact who has never been a member, **When** the FS records a dues payment naming that
   contact as payer, selecting a level, and giving the payment date, **Then** an account is opened in that
   contact's name at that level, its validity period runs to the next year-end boundary on or after the
   payment date plus the two-month grace, and the payer is a member of it.
2. **Given** an existing account whose validity has lapsed, **When** the FS records a further dues payment
   from the same payer, **Then** the same account is renewed to the new validity period and its existing
   members remain attached — nobody has to be re-attached each year.
3. **Given** the FS is reporting the gate, **When** she enters a membership dues line for a named contact,
   **Then** she selects the level on that line, and the amount recorded for the money reconciliation is
   independent of the level chosen.
4. **Given** a dues payment that already covers the payer to or beyond the resulting boundary, **When** it
   is recorded, **Then** the money is still recorded and the account is not extended twice.

---

### User Story 2 - Attach the household to the account (Priority: P2)

An account covers a household. The FS attaches the other people it covers — a spouse, children — and the
payer is attached automatically as the first member. Being attached is what makes someone a member: it is
the single fact that determines whether they are on the member mailing list, and it persists across
renewals.

**Why this priority**: An account that covers only its payer is a worse version of what exists today. This
story is what makes it a *household* account, and it is the fact the mailing list is built from.

**Independent Test**: Attach a second contact to an existing account; confirm they are a member for as long
as the account is valid, that they appear on the member list, and that detaching them removes that.

**Acceptance Scenarios**:

1. **Given** an account opened for a payer, **When** it is created, **Then** the payer is already attached
   as a member without a separate step.
2. **Given** a valid account, **When** the FS attaches another contact to it, **Then** that contact is a
   member for the account's validity period and appears on the member mailing list.
3. **Given** a contact attached to an account, **When** they are detached, **Then** they are no longer a
   member through that account and drop off the member list, while the account and its other members are
   unaffected.
4. **Given** a contact attached to an account, **When** the account is renewed, **Then** they remain
   attached without any re-attachment step.
5. **Given** Mel opens the record of a contact who is a member, **When** the record is shown, **Then** it
   names **who the payer is** for the account covering them.
6. **Given** the record of a contact who is a payer is open, **When** the record is shown, **Then** it
   lists the **other members** on their account.
7. **Given** a payer's record showing a family or supporter account, **When** the viewer adds a contact as
   a member, **Then** that contact is covered by the account from that moment, provided the account's
   level allows another member.
8. **Given** a payer's record showing an individual or student account, **When** the viewer tries to add a
   member, **Then** it is refused, because that level covers the payer alone.
9. **Given** a payer's record, **When** the viewer changes the account's level, **Then** the new level
   applies to the account; lowering it to individual or student while others are covered is refused,
   naming who would be displaced.

---

### User Story 3 - Segment the member mailing list (Priority: P3)

The club sends different messages to different members: a thank-you to those whose membership is current, a
renewal reminder to those recently lapsed, and a "we miss you" to the long lapsed. The member list must
therefore carry both **what the household bought** (the level) and **where they stand** (current, lapsed,
long lapsed) — and it must keep listing people whose membership has lapsed, because they are exactly who
the reminder is for.

**Why this priority**: This is the payoff. It is P3 because it needs accounts (US1) and attachments (US2)
to exist before there is anything to segment.

**Independent Test**: With accounts at differing levels and validity, produce the member list; confirm each
row carries the level and the status, and that a lapsed member is still listed.

**Acceptance Scenarios**:

1. **Given** members on accounts of differing levels, **When** the member list is exported, **Then** each
   row carries the level of the account covering that member, alongside the status it already carries.
2. **Given** an account whose validity has lapsed, **When** the member list is exported, **Then** its
   members are still listed, marked lapsed — so a reminder can reach them.
3. **Given** a contact who is on no account at all, **When** the member list is exported, **Then** they are
   not listed, regardless of any membership history.
4. **Given** a member whose email is marked do-not-contact, **When** the member list is exported, **Then**
   they are excluded, as today.

---

### User Story 4 - Statuses stay true without anyone touching them (Priority: P4)

Membership status turns over on a fixed date every year. On 1 September 2026 the club's year rolled and
**118 memberships expiring 2026-08-31 became lapsed** — but nothing in the system noticed, because status
is only recalculated when an individual contact happens to be touched. Anyone reading a status today may be
reading a value that was true last month.

**Why this priority**: It is a correctness problem rather than a new capability, and the segmented sends in
US3 are only as good as the statuses behind them. P4 because US1–US3 are usable before it lands, though
US3's value is diminished until it does.

**Independent Test**: With accounts whose validity has passed, confirm that statuses reported anywhere in
the club's tools reflect today's date rather than the last time each contact was edited.

**Acceptance Scenarios**:

1. **Given** accounts that expired before today, **When** membership status is read anywhere it is
   surfaced, **Then** it reflects the account's validity as of today.
2. **Given** the membership year has rolled over, **When** statuses are brought up to date, **Then** every
   affected contact's status changes without anyone editing contacts one by one.
3. **Given** statuses are brought up to date, **When** a status actually changes, **Then** the change is
   recorded for audit, and no record is written for a status that did not change.

---

### Edge Cases

- **A boundary passing with nobody watching.** The membership year rolls on a fixed date; no one is
  required to notice. Because status is derived where it is read, the rollover needs no intervention —
  the failure that left 118 memberships reading `current` after 1 September cannot recur.
- **A household shrinking at renewal.** A family account renewing as individual would displace the members
  it covers. The reduction is refused until they are removed, so nobody silently loses membership at the
  moment of a payment.
- **Renewal before expiry.** A payment in the final two months of the year rolls to the following year-end,
  so an early renewer is not short-changed. This rule already exists and is unchanged.
- **A member covered by more than one account.** A person may be covered by a household account and also
  pay their own dues. Their **status** is the most generous of the accounts covering them; the **level**
  reported is that of the account they pay for, since level is the payer's attribute.
- **Detaching the payer.** The payer is the account's owner; the account cannot be left with no owner —
  neither by detaching them nor by deleting their contact, which is refused (FR-009).
- **The mess repairing itself, then recurring.** Historically a payer's contact link was cleared rather
  than blocked on delete, which is how accounts came to have owners that are names only. FR-021 repairs
  the existing cases and FR-009 stops new ones, so the cleanup is not undone by the same mechanism.
- **A person who was a member years ago and is on no current account.** They are not on the member list;
  their history is preserved but confers no membership.
- **An account with no valid term yet** (recorded in error, or a payment reversed) confers nothing.
- **The two households are not the same set.** A contact's membership household (who is on the account)
  and their email household (who is reached at a shared address, feature 067) are separate groupings that
  will often overlap but need not match. A record may show both, and they must be distinguishable rather
  than blurred into one "family" idea.
- **Money is recorded for door dues, not posted dues.** The same membership outcome arrives through two
  paths with different financial traces: a gate-reported payment records money as it always has, while a
  posted cheque records none. This asymmetry is deliberate and must not be mistaken for a lost payment.
- **A contact-less payer.** Some historical payers exist only as a name and cannot own an account until
  they are a contact.
- **Existing data.** The club's 154 membership rows must become accounts and attachments without losing
  who was covered, at what level, until when.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A membership **account** MUST be identified by its **payer** — a contact — and MUST carry a
  **level** and a **validity period**. The **level describes what the payer bought** and is the payer's
  attribute; the **validity applies to every member** on the account.
- **FR-002**: The system MUST derive an account's validity period from the **payment date**, using the
  club's existing year-end boundary and two-month early-renewal grace. The person recording the payment
  MUST NOT have to calculate it.
- **FR-003**: The **level** MUST be chosen by the person recording the payment, from the club's defined
  levels. It MUST NOT be derived from the amount paid: tiers change and payers add donations to the same
  cheque, so the amount and the level are independent.
- **FR-003a**: The level MUST determine how many people the account may cover. **Individual** and
  **student** admit **no members beyond the payer**; **family** and **supporter** may cover others.
  Attaching a further member to an individual or student account MUST be refused, and lowering an account
  to one of those levels while it still covers others MUST be refused, naming who would be displaced.
- **FR-004**: A payer has **at most one** account, which is **durable**: recording a further dues payment
  MUST move that account's validity forward rather than open a second one, and its existing attachments
  MUST survive unchanged. A contact's membership therefore has a continuous identity across years.
- **FR-005**: The Financial Secretary MUST be able to record a dues payment **while reporting the gate**,
  selecting the level on the dues line, with the money recorded for reconciliation independently of the
  level.
- **FR-006**: The Financial Secretary MUST be able to record a dues payment **outside the door** — for a
  cheque received in the mail — through the same account rules. This records **membership only**: no
  financial record is created, because the club has no non-event income capability (deliberately removed
  in feature 038) and 068 does not reintroduce one. Dues received by post are reconciled outside the
  system, as they are today.
- **FR-007**: The **payer MUST be attached** to their account as a member automatically, with no separate
  step.
- **FR-008**: Users MUST be able to **attach** and **detach** other contacts as members of an account, and
  attachments MUST persist across renewals.
- **FR-009**: An account MUST NOT be left without its payer as owner. Deleting a contact who owns an
  account MUST be **refused**, naming the account as the reason, rather than detaching the owner and
  leaving the account ownerless. The existing unrestricted (super-user) delete path is unaffected.
- **FR-009a**: The refusal MUST name the reference in language the person reading it recognises, as other
  delete refusals do — not an internal table name.
- **FR-010**: A contact's **membership status** MUST be derived from the accounts covering them. Where more
  than one account covers a contact, the **most generous** validity applies.
- **FR-011**: **Being attached to an account is what makes a contact a member of the member mailing list.**
  Membership of that list MUST follow attachment, not a contact's own past membership history.
- **FR-012**: A member whose account has lapsed MUST **remain on the member list**, marked as lapsed, so a
  renewal reminder can reach them.
- **FR-013**: The member list MUST carry, for each member, the **status** of the account covering them and
  the **level** that account was bought at, identifying the level as the **payer's**. Where a contact is
  covered by more than one account, the level reported MUST be that of the account they **pay for**; a
  contact who is only ever a member and never a payer has no level of their own.
- **FR-014**: A member whose email is marked do-not-contact MUST be excluded from the member list, as today.
- **FR-015**: Membership status MUST be **derived at the point of use** — on a contact record, in the
  member list export, and in any count or roster that reports it — so that it always reflects today's date
  and **cannot** be stale. No scheduled job is assumed, because the club runs no scheduler.
- **FR-015a**: A **one-off correction** MUST bring the stored statuses of existing contacts into line with
  today, so records that went stale at the 1 September rollover are right without anyone editing contacts
  individually. It MUST record only the statuses that actually changed.
- **FR-016**: Existing membership data MUST be migrated to accounts and attachments **without loss**: who
  was covered, at what level, until when. Level and expiry are already consistent within every payer group,
  so no conflict resolution is required.
- **FR-017**: Recording dues, and attaching or detaching members, MUST be restricted to the roles that
  already hold membership-writing authority (Financial Secretary, Treasurer, Super-user).
- **FR-022**: From a **payer's contact record**, an authorised user MUST be able to **add and remove
  members** on that account, subject to the level's capacity (FR-003a). The payer's record is the place the
  household is maintained, not a separate screen.
- **FR-023**: From a **payer's contact record**, an authorised user MUST be able to **change the account's
  level**, subject to FR-003a — a reduction that would displace existing members is refused and names them.
- **FR-024**: A **renewal MAY change the level**. Recording a further dues payment MUST allow a level
  different from the one currently on the account, applying the same capacity rule, so a household moving
  from family to individual (or the reverse) is recorded at the level they actually bought this year.
- **FR-018**: A **member's** contact record MUST show **who the payer is** for the account covering them,
  so it is answerable from the record itself who bought that membership.
- **FR-019**: A **payer's** contact record MUST list the **other members** on their account, so the
  household covered by a payment is visible from the payer's record.
- **FR-020**: The membership household shown on a record MUST be distinguishable from the shared-email
  household (feature 067). They are different groupings and MUST NOT be presented as one.
- **FR-021**: Where an existing payer has no contact of their own, migration MUST attempt to **match them
  to an existing contact by name**. Where no match is found, migration MUST **create a contact** for them
  and **flag it for review**, so no account is left without an owner and every created contact is seen by
  a human.

### Key Entities *(include if feature involves data)*

- **Membership account**: What a household buys. Owned by a **payer** (a contact), carrying a **level** —
  the payer's attribute, describing what they bought — and a **validity period** derived from the payment
  date, which applies to every member. The level also caps who may be covered: individual and student
  admit the payer alone. Renewed by a further payment rather than replaced.
- **Attachment**: The link making a contact a **member** of an account. Created for the payer
  automatically, added for the rest of the household, and persisting across renewals. This is the fact the
  member mailing list is built from.
- **Contact**: Gains membership through attachment. Their **status** (current / lapsed / long lapsed /
  never) is derived from the accounts covering them, and their presence on the member list follows their
  attachments. Their record shows the membership household from whichever side they sit on — the payer's
  name if they are a member, the other members if they are the payer.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The Financial Secretary can record a household dues payment as **one** action — payer, level,
  date — without calculating an expiry date or entering a row per person.
- **SC-002**: A household of four is covered by **one** account at **one** level with **one** validity
  period, and its members do not need re-attaching when it renews.
- **SC-003**: The member list can be split into **current**, **lapsed** and **long-lapsed** audiences, and
  by level, from the exported data alone — enough to run the thank-you, reminder and we-miss-you sends
  without further lookup.
- **SC-004**: **100%** of existing membership coverage survives migration — every person covered today is
  covered afterwards, at the same level, to the same date.
- **SC-005**: A membership-year rollover requires **no action at all** for statuses to read correctly —
  every surface that reports status reflects the new year the moment the boundary passes, and the 118
  memberships that lapsed on 1 September 2026 read as lapsed without anyone touching them.
- **SC-006**: From any member's record Mel can name the payer, and from any payer's record she can name
  everyone the account covers, **without leaving the record**.
- **SC-007**: Migration leaves **zero** accounts without a contact as owner, every contact it had to create
  is flagged for review rather than added silently, and **no ordinary action afterwards can recreate an
  ownerless account**.

## Assumptions

- **Renewal extends, it does not duplicate** (confirmed in clarification): one durable account per payer,
  its validity moved forward by each payment. Per-payment history lives with the money record, not by
  duplicating accounts.
- **Levels are the four the club already uses** — individual, family, supporter, student. This feature does
  not add, price, or rank them. No rank order is needed: level is the payer's attribute, so there is never
  a contest between two levels for one contact.
- **The member list is the one that already exists**, not a new one: its definition changes from "has
  membership history" to "is attached to an account", and it gains the level.
- **Status vocabulary is unchanged** — never, current, lapsed, long lapsed, with the club's existing lapse
  window.
- **Authority is unchanged.** Financial Secretary, Treasurer and Super-user already hold membership-writing
  authority; this feature adds no new role or permission.
- **The most generous account wins** when several cover one contact, matching how the club would answer
  "is this person a member?" in the room.
- **Migration source is sound.** Level and expiry are consistent within all 31 multi-member payer groups,
  so accounts can be formed mechanically. The 17 payers holding memberships without a contact of their own
  are resolved by FR-021 (match by name, else create and flag).
- **Names are not gated.** Showing a payer's name on a member's record, or member names on a payer's
  record, discloses only display names — which every volunteer can already read. No address, phone, or
  other protected field is added to a record by FR-018/FR-019.
- **The two-month grace and year-end boundary already exist** and are reused unchanged.

## Dependencies

- **The club's membership-year boundary and early-renewal grace**, already defined and used by the door and
  online enrolment paths.
- **The gate reporting flow**, which already records dues lines against named contacts and is where the
  level selection is added.
- **The member mailing list export**, whose definition and columns this feature changes.
- **The contact record**, which carries the materialised status this feature re-derives.
- **Existing membership and payer data** (154 memberships, 115 payers that own them), which must migrate.

## Out of Scope

- **PayPal / online enrolment.** The receiver exists and is correct, but it has never run: the application
  is not deployed, so PayPal has no address to deliver to. Bringing the online channel to life is a
  **hosting and deployment** matter, deliberately deferred until that is handled. Nothing here should be
  designed around it, and it must not be broken by the model change.
- **Dues pricing.** No price table, tier amounts, or amount-to-level mapping. The level is chosen directly.
- **Recording money for dues received outside an event.** Feature 038 removed the non-dance income
  capability and this feature does not restore it. A posted cheque enrols the member without creating a
  financial record; the money is reconciled outside the system. Gate-reported dues continue to record
  money exactly as they do today.
- **Membership cards, expiry notices, or automated member emails.** This feature makes the segments
  available; sending is done through the mailing provider as today.
- **Changing who may record dues.** Authority is unchanged.
