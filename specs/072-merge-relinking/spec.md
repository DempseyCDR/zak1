# Feature Specification: Merge relinking

**Feature Branch**: `072-merge-relink-and-unmerge`

**Created**: 2026-09-10

**Status**: Draft

**Input**: User description: "merge relinking, MRG-R1 through MRG-R10 and MRG-R14 through MRG-R16"

Source requirements:
[specs/phase-8-requirements/merge-relink-and-unmerge.md](../phase-8-requirements/merge-relink-and-unmerge.md)
§1–§5, §7, §9. Undo (§6, MRG-R11–MRG-R13) is deliberately excluded and becomes feature 073.

## Clarifications

### Session 2026-09-10

- Q: Is it acceptable to ship a third hold reason while no hold of any kind can be resolved through the
  app? → A: Yes — the in-app route is to remove the conflicting role on the access screen (the same
  `role.assign` authority the hold demands), after which the hold closes itself and the merge succeeds on
  a second attempt. A dedicated resolution screen stays out of scope for all three reasons.
- Q: Should 072 start recording which rows a merge moved, so merges made before 073 ships are recoverable
  later? → A: No. Recording identifiers nothing reads is premature infrastructure (Constitution
  Principle II), and it is not a regression: merges are irreversible today. 073 decides the shape.
- Q: Does the historical repair cover every category a merge should have moved, or only the performer
  links that cause visible breakage? → A: Every category — all nine stranded records. The repair is the
  corrected rule applied to past merges, which is what lets SC-001 be verified by re-running its count.
- Q (manual pass, 2026-09-11): a held merge gave no feedback, and a held item could not be cleared by the
  person who raised it — only by an officer resolving it or by changing someone's access. → A: added
  **FR-017** (withdraw a held merge, on `dedup.write`) and **FR-018** (say so immediately, naming what
  would unblock it).
- Q: Should 072 include a guard that fails when a new reference to a contact is added without being
  classified as moved or left? → A: Yes — a parity guard that breaks the build until someone classifies
  it. The same drift already shipped a live defect once, and the repo has an established pattern for it.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A merge carries the whole person across (Priority: P1)

Mel decides two contact records are one person and merges them. Everything the club knows about that
person — how to reach them, what they have attended, what they have paid, the performer they are booked
as, the seat they hold, the hall they rent to us — belongs to the surviving record afterwards. Today most
of it silently stays behind on the retired record, where nothing can see it.

**Why this priority**: This is the whole feature. It is also the only story that repairs damage already
done: seven performers currently sit on retired contacts, which is why the Booker has no email link for
Zak Spath or Rich Dempsey, why those performers are missing from the performer mailing list, and why the
organizer report can double-subtract them.

**Independent Test**: Merge two contacts that between them carry every kind of attachment, then confirm
the survivor holds all of it and the retired record holds none of it. Separately, confirm the seven
existing stranded records now resolve to their survivors.

**Acceptance Scenarios**:

1. **Given** a contact who is linked to a performer record, **When** that contact is merged into another,
   **Then** the performer is linked to the survivor, and the Booker sees an email link for that performer
   again.
2. **Given** a contact with check-in history and door purchases, **When** they are merged, **Then** that
   history counts as the survivor's.
3. **Given** a contact holding an officer seat or named as a venue's landlord, **When** they are merged,
   **Then** the seat and the landlord link name the survivor.
4. **Given** a merge has completed, **When** the audit trail is read, **Then** it still names the retired
   contact as the actor of everything that contact actually did — the record of who did what is never
   rewritten.
5. **Given** the seven performers already stranded by past merges, **When** this feature ships, **Then**
   each is re-pointed at its survivor.

---

### User Story 2 - Merging cannot quietly hand out authority (Priority: P2)

Mel can merge any two contacts. If merging moved roles without restriction, merging an officer's record
into her own would make her an officer — including the authority to assign roles, which is the authority
that grants every other. A merge that would do this stops and waits for someone who may make that
decision.

**Why this priority**: It is a new privilege path that does not exist today only because roles are not
moved at all. The moment US1 starts moving attachments, this has to be true in the same release.

**Independent Test**: Attempt a merge that would give the survivor role-assigning authority it does not
already hold, and confirm the merge does not complete and nothing is changed.

**Acceptance Scenarios**:

1. **Given** the record being merged holds role-assigning authority and the survivor does not, **When**
   the merge is attempted, **Then** it is held, nothing is changed, and the reason is recorded as its own
   item of work.
2. **Given** the survivor already holds the President's office and the record being merged holds the
   Treasurer's, **When** the merge is attempted, **Then** it is held — even though the record being merged
   carries no role-assigning authority — because one person must not hold both.
3. **Given** the records hold only ordinary working roles, **When** they are merged, **Then** the roles
   move and the merge completes without interruption.
4. **Given** both records hold the same role for the same series, **When** they are merged, **Then** the
   survivor holds it once and the merge completes.
5. **Given** a held merge and a person authorised to resolve it, **When** they choose which of the
   contested roles the survivor should keep, **Then** exactly those move and the merge completes.

---

### User Story 3 - A merged person can still sign in (Priority: P3)

A volunteer whose duplicate record is merged must still be able to sign in, and must land on the surviving
record rather than the retired one. Where both records could sign in, that is one decision — which
sign-in survives — not two.

**Why this priority**: Nobody is affected today (no retired contact holds a sign-in), but US1 moves the
data sign-in depends on, so the behaviour must be settled in the same release rather than discovered
later. It also corrects a decision the system already asks for and then does not act on.

**Independent Test**: Merge a volunteer who signs in, then sign in as them and confirm the session is the
survivor's. Separately, merge two sign-in-capable records and confirm the choice made when resolving it
determines who can actually sign in afterwards — not merely which address is displayed.

**Acceptance Scenarios**:

1. **Given** only the record being merged can sign in, **When** the merge completes, **Then** that ability
   moves to the survivor and the person's next sign-in works without re-enrolling.
2. **Given** both records can sign in — one person with two sign-in accounts — **When** the merge is
   attempted, **Then** it is held, and resolving it settles **which sign-in survives**: the account that
   grants access and the address it is reached at, as a single choice.
3. **Given** such a hold is resolved, **When** the chosen sign-in is used, **Then** it works and lands on
   the survivor; **and** it MUST NOT be possible to have settled only the displayed address while leaving
   who can sign in unchanged.
4. **Given** the person tries the account that did not survive, **When** they sign in, **Then** they are
   refused clearly — not enrolled a second time, and not given a session that then fails on every page.
5. **Given** a Google account still bound to a contact that has since been merged away, **When** it is
   used to sign in, **Then** it is refused at sign-in — not admitted and then rejected on every page.

---

### User Story 4 - Retired records are not offered as live ones (Priority: P4)

A merged or archived contact should never be offered as a destination — not to someone signing in for the
first time, and not to the tool that links performers to contacts in bulk.

**Why this priority**: Two small holes of the same shape, found while tracing US1. Neither is urgent, but
both re-create exactly the stranded links US1 exists to remove.

**Independent Test**: Attempt each path against an archived and a merged contact and confirm neither is
offered or accepted.

**Acceptance Scenarios**:

1. **Given** an archived volunteer, **When** they sign in for the first time, **Then** they are refused —
   rather than appearing to succeed and then being locked out of every page.
2. **Given** the bulk performer-to-contact linker runs, **When** a candidate name belongs to a retired
   contact, **Then** that contact is not offered, and the live contact of the same name is still matched.

### Edge Cases

- A contact is merged twice in succession — the second merge must carry across everything the first one
  brought, not just what the record originally had.
- Both records carry the same attachment (the same household, the same role at the same scope) — the
  survivor holds it once, without the merge failing.
- The record being merged carries nothing at all — the merge completes and reports that nothing moved.
- The displayed sign-in address and the account that actually admits the person have drifted apart (the
  account was renamed after enrolment) — resolving a merge must decide the account, not the stale label.
- A merge is held, and then the reason disappears on its own (the contested role is withdrawn, or either
  contact is archived) — the held item closes without merging anything.
- An attachment is added to the retired record after the merge, by a path that does not check — out of
  scope here, but the reason retired records must stop being offered (US4).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A merge MUST move every substantive record attached to the retired contact onto the
  survivor — how the person is reached, their attendance, their door purchases, their membership
  capture, their performer record, their officer seat, and any venue that names them as landlord.
  (MRG-R4)
- **FR-002**: The rule MUST be expressed as "move everything except the audit trail", so a kind of
  attachment added later is carried by default. A list of things to move is what fell out of date the
  last time this was changed, and the failure must land on the safe side. (MRG-R3)
- **FR-002a**: Every reference to a contact MUST be **classified** as either moved or left, and adding a
  new one without classifying it MUST fail loudly rather than being silently ignored. FR-002 states an
  intention; this is what keeps it true. Unclassified-means-broken is deliberate: the drift it prevents
  is what left the merge relinking retired tables for two releases.
- **FR-003**: A merge MUST NOT rewrite any record of **who did something** — status-change history, the
  merge trail itself, action audit, who rejected a duplicate pair, who attempted a held merge, who
  approved a volunteer, who granted a role. Reassigning those would falsify the historical record.
  (MRG-R5)
- **FR-004**: Everything in this feature MUST treat an **archived** contact exactly as a merged one. Both
  already mean "not an active record" everywhere else. (MRG-R6)
- **FR-005**: Relinking MUST require no authority beyond what merging already requires. (MRG-R1)
- **FR-006**: A merge MUST be **held**, changing nothing, when it would give the survivor role-assigning
  authority it does not already hold. Deciding who may assign roles is not part of tidying duplicates.
  (MRG-R2, MRG-R8)
- **FR-007**: A merge MUST also be held when the roles of the two records taken **together** would leave
  one person holding two mutually exclusive offices. The trigger MUST be evaluated across both records,
  because it can arise from the survivor's side alone. (MRG-R8)
- **FR-008**: Where neither condition applies, roles MUST move; where both records hold the same role for
  the same scope, the survivor MUST end up holding it once rather than the merge failing. (MRG-R9)
- **FR-009**: Resolving a held role conflict MUST require the authority to assign roles, and MUST let the
  resolver name **which** of the contested roles the survivor keeps — including none. (MRG-R10)
- **FR-010**: A held merge MUST be recorded as its own item of outstanding work, discoverable in the same
  place as the merges already held for other reasons.
- **FR-010a**: A held merge MUST close on its own, without merging anything, once the reason it was held
  no longer applies — the contested role withdrawn, or either contact merged away or archived. This is
  what makes a hold recoverable without a dedicated resolution screen: the authorised person removes the
  cause where that decision already lives, and re-running the merge then succeeds.
- **FR-011**: Where only one record carries the ability to sign in, that ability MUST move to the
  survivor, preserving when they last signed in. No decision is required, because there is nothing to
  choose. (MRG-R7)
- **FR-012**: Where **both** records carry it, the merge MUST be held, and resolving the hold MUST settle
  the **surviving sign-in as a single choice** — the account that grants access together with the address
  it is reached at. (MRG-R7)
- **FR-012a**: It MUST NOT be possible to resolve such a hold by settling the **address alone**. The
  address is a label; access follows the account binding, and the two are permitted to disagree by
  design. A resolution that moved only the label would leave the person who resolved it believing they
  had decided who can sign in when they had not. (MRG-R7)
- **FR-012b**: The account that does not survive MUST be refused on use, consistent with the existing rule
  of one sign-in account per person, and MUST NOT enrol a second time. (MRG-R7)
- **FR-013**: A retired contact MUST NOT yield a working session by **either** sign-in route — an account
  already bound to it, or a first-time match on its address. The refusal MUST happen at sign-in, not as a
  session that every subsequent request rejects. (MRG-R14)
- **FR-014**: The bulk performer-to-contact linker MUST NOT offer a retired contact as a match, and MUST
  still match the live contact of the same name. A retired duplicate MUST NOT make a name ambiguous and
  thereby suppress the correct link. (MRG-R15)
- **FR-015**: Records already stranded by past merges MUST be repaired as part of this feature —
  **every** category the corrected rule would move, not only the ones causing visible breakage. Fixing
  the merge does not move records that were left behind before it. Measured at nine: six performer links,
  two attendance rows, one membership attachment predating feature 069. Records left on an **archived**
  contact are excluded, having no survivor to move to; the audit trail is excluded by FR-003. (MRG-R16) (MRG-R16)
- **FR-016**: A held merge MUST leave the data exactly as it found it, so that a hold is never a partly
  completed merge.
- **FR-017**: Anyone who may attempt a merge MUST be able to **withdraw** one that was held, without
  merging and without changing anyone's access. A hold asks a question, and "leave them alone" is a
  legitimate answer; requiring the reason's own authority to decline would leave the person working the
  queue with items they can never clear. Withdrawing MUST NOT be recorded as a judgement that the two are
  different people — that is a separate decision with its own record — and MUST NOT prevent the pair being
  merged later.
- **FR-018**: When a merge is held, the person who attempted it MUST be told **at that moment**, and told
  what would unblock it. Discovering it later by noticing an item in a queue is not sufficient: from where
  they stand the merge simply appeared to do nothing.

### Key Entities

- **Retired contact**: a contact record that is no longer active — either merged into another or
  archived. Distinct from deleted: the record survives and remains readable.
- **Survivor**: the contact a merge keeps, which inherits the retired contact's attachments.
- **Attachment**: anything the club records about a person that is not a statement about who performed an
  action — reach, attendance, purchases, membership, performer identity, office, landlord link, roles,
  sign-in ability.
- **Surviving sign-in**: the pairing of the account that grants access with the address it is reached
  at. A merge resolves them together or not at all, because the address is only a label and the account
  binding is what admits the person.
- **Held merge**: a merge that cannot complete without a decision that the person merging is not entitled
  to make. It changes nothing and waits as its own item of work.
- **Role-assigning authority**: the ability to grant roles to others — the authority that confers every
  other, and therefore the one a merge must never hand over silently.
- **Mutually exclusive offices**: offices that one person must not hold simultaneously, separating
  authority from money.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After a merge, **zero** live records reference the retired contact, excluding the audit
  trail, which continues to name it. Measured today: nine such records across past merges.
- **SC-002**: Every performer whose person has contact details is reachable from the booking screen.
  Measured today: seven are not.
- **SC-003**: The performer mailing list contains every performer with a reachable address. Measured
  today: seven are silently missing.
- **SC-004**: No merge can increase anyone's authority to assign roles, or leave one person holding two
  mutually exclusive offices, without an explicit decision by someone entitled to make it. Target: 100%
  of such merges held rather than completed.
- **SC-005**: A volunteer whose duplicate record has been merged can sign in on the first attempt and
  works as the surviving record.
- **SC-006**: A merge that is held changes nothing: repeating the attempt leaves the same number of
  outstanding items, and no attachment has moved.
- **SC-007**: Attendance counts derived after a merge are unaffected by the merge — a booked performer is
  never also counted as an unpaid guest because of it.
- **SC-008**: Introducing a new kind of record about a person, without saying whether a merge moves it,
  fails immediately and visibly — it cannot reach production unclassified.

## Assumptions

- Merging remains an explicit, confirmed action; nothing merges automatically. This feature changes what a
  merge moves, never when one happens.
- The existing held-merge mechanism is reused for the new reason, so a held merge is discovered the same
  way as those already held. Building the screen on which a hold is *resolved* is **not** part of this
  feature — it is unbuilt for the existing reasons too, and is tracked separately. This is workable
  because of FR-010a: an authorised person removes the cause on the access screen, and the hold then
  closes itself, so no merge is permanently stuck.
- Undoing a merge remains impossible and is out of scope; it becomes feature 073, which owns the decision
  about what a merge must record. 072 deliberately records **nothing extra** — identifiers nothing reads
  would be premature infrastructure — and accepts, knowingly, that merges made before 073 stay
  irreversible, exactly as every merge is today. 072 also **increases** the information a merge discards
  (a duplicate attendance row, a duplicate role grant, on top of the two feature 069 already drops); 073
  is expected to revisit those as part of making merges reversible.
- Contacts that were never linked to a person's record — performers the club books who are not in the
  directory — are a separate, supported situation and are not touched here.
- The historical repair is a one-off correction of records stranded before this feature; it assumes the
  survivor named by each past merge is still the right destination.
