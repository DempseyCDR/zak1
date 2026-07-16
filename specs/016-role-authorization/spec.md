# Feature Specification: Authorization — Role × Capability × Scope

**Feature Branch**: `016-role-authorization`

**Created**: 2026-07-15

**Status**: Draft

**Input**: Phase 3 package **P3-2** (`specs/PHASE3_REQUIREMENTS.md` §P3-2), derived from the authoritative
role model in [`docs/use-cases.md`](../../docs/use-cases.md). Feature 015 delivered authentication only.

## Overview & Scope

Feature 015 established **who you are**. This feature establishes **what you may do**.

Today every signed-in volunteer is equally powerful: any authenticated person can reach any protected page
and write anything. The club's actual governance is far more structured — four elected officers, their
delegates, per-series responsibility, and one hard boundary (the Door Attendant must not touch gate money).
None of that is expressed anywhere in the product.

This feature turns the permission matrix in `docs/use-cases.md` (rows 1–22) into enforced behavior:

- **Roles** — the Organizer base plus ten additive grants.
- **Capabilities** — what a grant lets you do, per resource, at the page **and field** level.
- **Scope** — the club-wide / per-series / per-event-group filter each grant carries.
- **Assignment** — real screens for designating volunteers and granting scoped roles, replacing the
  operator CLI as the only path.

### Two rules that shape everything

1. **Read is one rule, and it is about PII — not money.** Every authenticated volunteer reads
   **everything except contact email addresses and phone numbers**. That deliberately includes **all**
   money: gate cash, the treasurer report, and **individual performer pay**. The club holds that keeping
   pay private is what **enables performers to be exploited**, so transparency here is a *value*, not an
   oversight. This is the inverse of the usual assumption and must not be "fixed".
2. **Writes are the matrix.** Everything in the grid is about who may *change* a thing. The Door
   Attendant's famous exclusion from the gate is a **write** boundary: the Financial Secretary owns the
   money record. Reading it is open, like all money.

### In scope

- Modeling and storing role grants with scope, and evaluating them on every protected read and write.
- Enforcing the matrix over the capabilities that **exist today** (events, venues, performers, bands,
  bookings, parameters, check-in/attendance, gate, treasurer report, organizer report, contacts,
  memberships, exports, dedup).
- **Field-level read filtering** for contact PII, and field-level write rules where the matrix splits
  ownership of one record.
- The assignment authority (President + VP), the Super-user global-write role, and the **annual
  Presidential approval** of the volunteer list.
- Renaming the `administrator` role to **Super-user** semantics.
- Role-aware navigation, and retiring the `/dev/routes` **upkeep convention** (the page survives, generated).

### Out of scope

- Capabilities whose underlying features are not built yet (booking status lifecycle, event cancel/delete,
  recurring generation, venue landlord, advertised price, performer payment override, door/online
  membership enrollment). Those arrive with **P3-3/P3-4/P3-5** and plug into this framework.
- Changing authentication, sign-in, or session handling (feature 015 owns those).
- Non-volunteer / member-facing login (**B2**, deferred).
- Self-service login-email change (**B38**).

## Clarifications

### Session 2026-07-15

- Q: Row 17 — does the VP / Mailing List Manager own the whole contacts directory, or only the mailing
  side? → A: **Mailing side only.** VP + MLM own emails, consent topics, exports, and dedup/merge. Contact
  **records** are created by the Door Attendant at check-in (already shipped) and edited on the membership
  side by FS/Treasurer.
- Q: How far does the Organizer base **read** reach? (The matrix is a write-owner grid and stated read
  authority for almost nothing.) → A: **Everything except contact PII.** Email addresses and phone numbers
  require a grant. **All money is open, including individual performer pay** — *the club believes keeping
  pay private enables exploitation of performers.*
- Q: If reading emails needs a grant, how does the Door Attendant tell two John Smiths apart at check-in?
  → A: **PII on lookup, names in bulk.** When *matching* a person the Door Attendant sees that person's
  PII; when *reviewing the checked-in roster* they see names only. This discourages rather than prevents a
  bulk harvest — **accepted residual risk**.
- Q: Can the Treasurer assign their own Financial Secretary? → A: **No — President + VP only.**
  **VP ⊇ President**: the VP may do anything the President may do. The "Delegated by" column describes who
  **nominates** a delegate, not who holds authority to grant it.
- Q: Does the annual review of the volunteer list gate access? → A: **Advisory.** The President reviews and
  approves the volunteer list at least once a year; the approval is recorded and the overdue state
  surfaced, but **access never lapses automatically**.
- Q: Is the Door Attendant grant enforced per event/shift? → A: **No — club-wide.** Any attendant may work
  any door. Consequently **per-event (◍) scope is dropped entirely**: its only candidate user is now
  club-wide and short-term volunteers are per-event-group, leaving ◍ with no users. **Three
  granularities**, not four.
- Q: Does the lookup-not-bulk PII rule break dedup review, which is inherently a bulk comparison? → A:
  **Yes — dedup is an explicit exception.** The **VP and Mailing List Manager must view all PII while
  reviewing dedup suggestions**: judging whether two records are the same person requires comparing their
  emails and phones side by side, across many candidate pairs at once. Dedup is a **sanctioned bulk PII
  view**, not a violation of FR-017.
- Q: Which roles carry the PII-read capability — and is it separately grantable? → A: **Implicit,
  needs-based** (FR-016a). It rides on every grant whose use cases require it (Door Attendant on match;
  VP/MLM/Secretary for exports and dedup; Booker for performer contact; Treasurer/FS for membership) and is
  **not** separately assignable. Only the bare Organizer base is excluded — which is exactly the lapsed
  short-term volunteer the rule targets.
- Q: Are successful PII **reads** audited, and at what granularity? → A: **Yes — per request, not per
  contact** (FR-017b). One record per disclosing request with actor, surface, and a **count**. Per-contact
  auditing is untenable because check-in search fires per keystroke over up to 20 contacts. This makes the
  accepted bulk-harvest risk **detectable** rather than merely discouraged.
- Q: Can the Super-user role be granted through the UI? → A: **No — CLI-only** (FR-030a). Not by the
  President, the VP, or another Super-user. It is a technical break-glass role, not a club office, and the
  operator command line (which must exist regardless, FR-033) is its only source.
- Q: What does an authenticated but unauthorized user see? → A: **An explicit refusal naming the
  capability** (FR-026) — not a 404 and not a silent redirect. Because the base reads nearly everything, a
  refusal conceals nothing the actor could not already see. **Contact PII is the one exception**
  (FR-026a).
- Q: After `/dev/routes` retires, what does a Super-user see — everything? → A: **Every page, but that is
  not everything the index showed.** Nav is derived from capabilities, so a Super-user sees every *page* —
  but `/dev/routes` also enumerates **~44 API endpoints**, which have no nav home and would simply be lost.
  **Decided: keep the page, generated from the filesystem** (FR-040a), Super-user only (FR-040b). Retires
  the manual upkeep — the actual defect — rather than the tool. Its natural successor for correctness is
  the route-inventory test, which already walks the same tree; the page and the test now share one walker.
- Q: ⚠️ *Discovered during implementation, not asked:* the spec assumed one contact held `administrator`.
  Live data says **zero contacts hold any role** — the bootstrap CLI's `--role` is optional and was never
  used. So who holds Super-user after the migration? → A: **Nobody, by design.** The migration stays
  data-driven (it migrates the empty set — correctly a no-op) and **must not hardcode a person**; the first
  Super-user is bootstrapped via `auth:bootstrap --role super_user` as a separate, audited step. FR-013 was
  rewritten around the real cold start rather than left vacuously true.
- Q: When the President clears a volunteer's designation, what happens to their grants? → A: **Cascade —
  but report them first** (FR-028a/b). Every grant that will be revoked is listed for confirmation, then
  all are revoked and individually audited. Grants never survive dormantly; a returning volunteer is
  re-granted deliberately, never silently restored. Preserves the intent of feature 001's
  `roles_require_volunteer` constraint.
- Q: May one person hold more than one of President / VP / Treasurer? → A: **No — mutually exclusive**
  (FR-005a), enforced as a hard refusal at assignment. This is **separation of duties**: role-assignment
  authority and money authority must not combine. **The Secretary is exempt** (FR-005b) and may double up —
  so the rule is *not* "one elected office per person".
- Q: May a President or VP hold Financial Secretary? (Treasurer ⊇ FS, so FS-of-every-series reaches most of
  the same money authority, and FS is not an elected office.) → A: **Yes, but flag it** (FR-029a/b): warn
  at assignment and surface the concentration on the annual review. **It is acceptable by design, not a
  tolerated hole**: everything the FS does is **reported to the Treasurer**, and FR-005a guarantees the
  Treasurer is a *different person*. Oversight is the control.
- Q: May two people hold the same office at once (e.g. two Presidents)? → A: **Yes — unlikely, but
  permitted** (FR-005c). **No uniqueness constraint** on any role. Orthogonal to FR-005a, which constrains
  one person holding two roles, not a role's holder count.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Grants are enforced, with scope (Priority: P1)

A volunteer signs in and finds the product shaped to their actual job. The Booker for the English country
dance series can create and edit ecd events, bookings, and performers — and is refused the same actions on
the Thursday night contra series, which belongs to a different Booker. The Financial Secretary for tnc can
record cash, card, and deposit figures for tnc events, and is refused for ecd. A Door Attendant can check
dancers in and can *look* at the gate figures like anyone else, but cannot change them. A short-term
volunteer recruited for "Thanksgiving 2026" can act on every event in that group, including events in a
series they hold no series-level authority over. The Super-user may write anything. And every one of them —
including the short-term volunteer years later — can still read the club's reports and its money.

**Why this priority**: This is the feature. Everything else administers or reveals it. Without enforcement
the role model is documentation. It is independently testable with grants seeded directly, so it stands
alone as the MVP.

**Independent Test**: Seed contacts holding known grants at known scopes, then exercise each protected
capability as each grant-holder and assert allow/deny. No assignment UI is required.

**Acceptance Scenarios**:

1. **Given** a contact holding Booker scoped to the ecd series, **When** they create or edit an event in
   the ecd series, **Then** the action succeeds.
2. **Given** that same Booker-of-ecd, **When** they attempt the identical action on a tnc event, **Then**
   the action is refused and no data changes.
3. **Given** a contact holding only the Door Attendant grant, **When** they **read** the gate figures for
   any event, **Then** they succeed; **When** they attempt to **write** any of them, **Then** they are
   refused.
4. **Given** a contact holding Financial Secretary scoped to tnc, **When** they write the money figures for
   a tnc event, **Then** it succeeds; **When** they write them for an ecd event, **Then** it is refused
   (though they may still read them).
5. **Given** a contact holding Treasurer, **When** they perform any Financial Secretary write on **any**
   series, **Then** it succeeds (Treasurer ⊇ FS).
6. **Given** a contact holding Vice-President, **When** they perform any action the President may perform,
   **Then** it succeeds (VP ⊇ President).
7. **Given** an event group "Thanksgiving 2026" containing both tnc and ecd events, and a contact holding a
   group-scoped grant on it, **When** they act on the ecd event in that group while holding no ecd series
   grant, **Then** the action succeeds.
8. **Given** that same group-scoped holder, **When** they act on an ecd event **outside** that group,
   **Then** the action is refused.
9. **Given** a contact holding Super-user, **When** they write any resource in the matrix, **Then** it
   succeeds.
10. **Given** any authenticated volunteer holding **no** grants beyond the Organizer base, **When** they
    open the organizer report, the treasurer report, or an individual performer's pay for any series,
    **Then** each is readable; **When** they attempt any write, **Then** it is refused.
11. **Given** that same base-only volunteer, **When** they attempt to read any contact's email address or
    phone number, **Then** it is refused.
12. **Given** a contact holding Mailing List Manager scoped to one series, **When** they export mailing
    lists, **Then** **all** series' lists are available (the per-capability scope exception); **When** they
    manage a mailing list, **Then** only their own series' list is writable.
13. **Given** a contact whose volunteer designation has been cleared, **When** they make any request,
    **Then** every grant evaluates to denied.

---

### User Story 2 - The President or VP assigns volunteers and roles (Priority: P2)

The President — or the VP, who may do everything the President can — opens an access-control screen, finds
a contact, designates them a volunteer, and grants them a role at a chosen scope: "Booker of ecd",
"Financial Secretary of tnc", "Door Attendant", or a group-scoped grant on "Thanksgiving 2026". They can
see every current grant-holder at a glance and revoke a grant when someone steps down. Once a year they
work down the volunteer list and approve it; the screen tells them who has not been reviewed in over a
year, but nobody is locked out for it.

**Why this priority**: The role substrate has existed since feature 001 and **no screen has ever written
it** — zero of ~1335 contacts are volunteers, and the only write paths are a generic contact edit and the
operator CLI. Without this, every grant in User Story 1 must be issued from a terminal, which is not an
operating model. It ranks below US1 only because US1 can be tested with seeded grants.

**Independent Test**: Sign in as the President, designate a volunteer, grant a scoped role, confirm it
takes effect on the grantee's next request, then revoke it and confirm access ends.

**Acceptance Scenarios**:

1. **Given** the President and a contact who is not a volunteer, **When** they designate that contact a
   volunteer, **Then** the contact becomes eligible to sign in.
2. **Given** the President, **When** they grant "Booker of ecd" to a volunteer, **Then** that volunteer can
   act on ecd events on their next request and is still refused on tnc.
3. **Given** the **VP**, **When** they designate a volunteer or grant a role, **Then** it succeeds exactly
   as it would for the President.
4. **Given** the **Treasurer**, **When** they attempt to grant Financial Secretary to a volunteer, **Then**
   it is refused — assignment is President + VP only.
5. **Given** a volunteer already holding Treasurer, **When** the President attempts to grant them
   Vice-President (or President), **Then** it is **refused** — the three are mutually exclusive.
6. **Given** a volunteer holding Secretary, **When** the President grants them Treasurer, **Then** it
   **succeeds** — the Secretary is exempt from the exclusivity rule.
7. **Given** a sitting President, **When** they are granted Financial Secretary, **Then** it **succeeds**
   with a warning that authority and money now sit with one person, and that concentration appears on the
   annual review.
8. **Given** the President, **When** they revoke a grant, **Then** the grantee loses that authority on
   their next request while retaining their Organizer base read.
9. **Given** the President, **When** they view the access-control screen, **Then** every volunteer and each
   of their grants and scopes is listed.
10. **Given** a volunteer holding no assignment authority, **When** they attempt to reach the
    access-control screen or grant a role, **Then** they are refused.
11. **Given** the President and a volunteer last approved more than a year ago, **When** the President
    views the volunteer list, **Then** that volunteer is flagged as overdue for review; **When** the
    President approves them, **Then** the approval and its date are recorded.
12. **Given** a volunteer overdue for annual review, **When** they make a request, **Then** their access is
    **unaffected** — the review is advisory.
13. **Given** a volunteer holding three grants, **When** the President moves to clear their volunteer
    designation because they left the club, **Then** all three grants are listed for confirmation before
    anything changes.
14. **Given** that confirmation, **When** the President proceeds, **Then** every grant is revoked and
    separately audited, and the person's access ends.
15. **Given** that same person rejoining a year later, **When** the President designates them a volunteer
    again, **Then** they hold **no** grants until re-granted explicitly.

---

### User Story 3 - Field-level authority inside a shared record (Priority: P3)

Some records are written by several roles for different reasons, and the split runs **through the record**,
not around it. The Webmaster edits an event's public-facing description while the Booker owns its date and
venue — each is refused the other's fields. The Door Attendant's check-in feeds a door record's comp and
gift counts while the Financial Secretary owns its money figures. And a contact's record carries email and
phone that most volunteers may not see at all, even while its name is freely readable.

**Why this priority**: Without it, enforcement collapses to whole-page granularity and matrix rows 2, 12,
and 17/17a/17b cannot be expressed — a Webmaster given an event page could move the dance, and PII could
not be hidden inside a record whose name field everyone reads. It ranks below US2 because the page-level
boundary in US1 already prevents the largest violations.

**Independent Test**: As each role, submit a change containing both permitted and forbidden fields of one
record and assert permitted fields persist and forbidden ones are refused; and read one record as each role
and assert PII is present or absent as the rule requires.

**Acceptance Scenarios**:

1. **Given** a contact holding Webmaster, **When** they edit an event's public description, **Then** it
   succeeds; **When** they edit that event's date or venue, **Then** it is refused.
2. **Given** a contact holding Booker of that event's series, **When** they edit its date or venue, **Then**
   it succeeds.
3. **Given** a contact holding only Door Attendant, **When** their check-in records comp and gift counts,
   **Then** those counts persist; **When** they attempt to write the door record's cash, card, or deposit
   figures, **Then** it is refused.
4. **Given** a contact holding Vice-President or Mailing List Manager, **When** they edit a contact's email
   addresses or consent topics, **Then** it succeeds; **When** they edit that contact's membership record,
   **Then** it is refused.
5. **Given** a contact holding only Door Attendant, **When** they create a contact record at check-in,
   **Then** it succeeds (row 17).
6. **Given** a submission mixing permitted and forbidden fields, **When** it is processed, **Then** the
   forbidden fields cause the write to be **refused** rather than silently dropped.
7. **Given** a volunteer holding only the Organizer base, **When** they read a contact record, **Then** the
   name is present and the email addresses and phone number are absent.

---

### User Story 4 - PII on lookup, names in bulk (Priority: P3)

A Door Attendant searching for the dancer standing in front of them sees enough to tell two John Smiths
apart — that person's email and phone. The checked-in roster, which lists everybody, shows names only. The
distinction is not who is asking but **how many people they are asking about**: identifying one person is
the job; enumerating the membership is not.

**Why this priority**: Equal to US3 — it is the other half of making the PII rule real, and it is what
keeps check-in working. Separated from US3 because it is a distinct rule (bulk vs. lookup, not
role vs. field) and independently testable.

**Independent Test**: As a Door Attendant, search for a named dancer and assert PII is returned; list the
checked-in roster and assert no PII appears in any row.

**Acceptance Scenarios**:

1. **Given** a Door Attendant checking someone in, **When** they search the directory for that person,
   **Then** the matches include enough PII to identify the right one.
2. **Given** a Door Attendant, **When** they view the roster of dancers already checked in, **Then** it
   contains names and no email addresses or phone numbers.
3. **Given** a volunteer holding only the Organizer base, **When** they search the directory, **Then** no
   PII is returned in any result.

---

### User Story 5 - You see only what you may use (Priority: P4)

A signed-in volunteer sees navigation reflecting their grants: a Door Attendant is not invited into the
treasurer's editing screens. Nobody is offered a page that will refuse them. The provisional `/dev/routes`
index — a flat list of every page and endpoint in the product — retires with this story.

**Why this priority**: Pure usability and cleanup on top of enforcement, and deliberately last: hiding a
link is not a security control, and US1/US3 already deny the underlying action. Retiring `/dev/routes`
depends on real role-aware navigation existing to replace it.

**Independent Test**: Sign in as each of several grant-holders and assert navigation offers exactly the
destinations their grants permit — and that a hidden destination is still refused if requested directly.

**Acceptance Scenarios**:

1. **Given** a contact holding only Door Attendant, **When** they sign in, **Then** navigation offers
   check-in and the reports, and does not offer role assignment or club settings.
2. **Given** a contact holding Treasurer, **When** they sign in, **Then** navigation offers the gate and
   treasurer screens as writable destinations.
3. **Given** a destination hidden from a user's navigation, **When** they request it directly, **Then**
   they are still refused (hiding is presentation, not enforcement).
4. **Given** a Super-user, **When** they open `/dev/routes`, **Then** it lists every UI page and API
   endpoint **generated from the source tree**, each endpoint showing its declared requirement.
5. **Given** any volunteer who is not a Super-user, **When** they request `/dev/routes` directly, **Then**
   they are refused.
6. **Given** a newly added route, **When** the index is opened, **Then** it appears there with **no edit
   to any hand-written list** — and the `CLAUDE.md` upkeep convention is gone.

---

### Edge Cases

- **A person holds several grants.** Grants are **additive** — authority is the union. An FS who also holds
  Door Attendant keeps their gate **write**; the Door Attendant boundary means that grant *does not confer*
  the write, not that it subtracts one granted elsewhere.
- **The same role at several scopes.** A Booker of both ecd and tnc holds two grants and acts on both.
- **An officer changes seats.** A sitting Treasurer elected President cannot simply be granted President —
  FR-005a refuses it. Their Treasurer grant must be revoked first. This is the intended friction, but the
  assignment screen should make the required order obvious rather than showing a bare refusal.
- **An exclusive role is granted by the CLI.** The exclusivity holds there too (FR-033); it is a property
  of the data, not of one screen.
- **A President is also the Financial Secretary.** Permitted, warned, and surfaced on the annual review
  (FR-029a/b) — never blocked. The club's volunteer pool is small enough that this sometimes has to happen.
- **A group-scoped grant reaches a series the holder has no authority over.** Intended, not a leak — event
  groups deliberately span series.
- **An event belongs to no group.** Group-scoped grants simply do not match it; no error.
- **A group's events are all in the past.** The grant is inert in effect without being revoked — the
  intended lifecycle for short-term volunteers. It is not deleted.
- **A grant names a series or group that is later deleted.** Currently **unreachable** — the product has no
  delete path for either (only bookings and bands have one), and series are four fixed rows. The rule
  stands regardless: such a grant must never silently widen into club-wide authority. Treated as a
  referential-integrity decision for `/speckit-plan`, not a behavior to build.
- **A volunteer leaves and later returns.** Their grants were revoked on departure (FR-028b) and are not
  restored by re-designating them a volunteer; the officer re-grants deliberately.
- **The last President's grant is revoked.** The VP can still assign roles (VP ⊇ President); the Super-user
  and the operator CLI remain beyond that. This is a reason the VP superset matters.
- **A volunteer holds a grant but their volunteer designation is cleared.** Eligibility is evaluated live —
  grants evaluate to denied without needing revocation (mirroring feature 015's session behavior).
- **Someone edits their own grants.** Self-elevation must be refused for anyone lacking assignment
  authority.
- **A capability's underlying resource has no series** (club settings, exports, QBO mapping). Scope filters
  that cannot apply are treated as club-wide.
- **PII reached by an indirect path.** Exports, dedup suggestions, contact-tracing, and performer records
  all surface contact emails; each must honor the PII rule rather than only the contact screens. **Dedup
  review is the one sanctioned bulk view** (FR-017a) — and it is held by the VP/MLM, who already own
  exports, so it grants them nothing they lacked.
- **Bulk harvest by repeated lookup.** A determined Door Attendant could search repeatedly to accumulate
  PII. **Accepted**: the rule discourages rather than prevents, and the club judges that sufficient. It is
  no longer *invisible*, though — FR-017b audits each disclosing request with a count, so the pattern is
  detectable afterwards even though it is not blocked.
- **Search discloses more than the one person being matched.** Check-in search returns up to 20 candidates
  with PII per keystroke, which sits closer to "bulk" than the "matching a dancer" case FR-017 sanctions.
  Accepted for the same reason and covered by the same audit; narrowing it (PII only once a candidate is
  selected) would be a tightening available later, not a requirement here.
- **The cold start is real, and it is now.** ⚠️ **Nobody holds any role** (verified 2026-07-15). The one
  volunteer is `is_volunteer = true` with an **empty** `volunteer_roles`. So the moment enforcement lands,
  *every* volunteer holds only the Organizer base: read everything, write nothing, assign nothing. The club
  bootstraps its first Super-user from the command line (FR-013, FR-033) — that is not a fallback, it is
  the path.

## Requirements *(mandatory)*

### Functional Requirements

#### The model

- **FR-001**: The system MUST treat **Organizer as the base**, held implicitly by every authenticated
  volunteer, conferring broad **read** and **no write authority of its own**.
- **FR-002**: The Organizer base MUST be **unscoped** (club-wide read). Scope filtering applies to grants
  and writes only.
- **FR-003**: The system MUST model these grants in addition to the base: **Door Attendant**, **Booker**,
  **Financial Secretary**, **Treasurer**, **Vice-President**, **Webmaster**, **Mailing List Manager**,
  **Secretary**, **President**, and **Super-user**.
- **FR-004**: Grants MUST be **additive**: a contact's authority is the union of their base and every grant
  they hold. Holding a grant MUST NOT reduce authority conferred by another.
- **FR-005**: A contact MUST be able to hold the same role at multiple scopes, and multiple roles at
  differing scopes, simultaneously — except as constrained by FR-005a.
- **FR-005a**: **President, Vice-President, and Treasurer are mutually exclusive.** A contact MUST NOT hold
  more than one of the three. Granting one to a contact already holding another MUST be **refused** — this
  is a hard constraint, not a warning. It is **separation of duties**: role-assignment authority (President
  / VP, rows 20–22) and money authority (Treasurer, rows 12–15) must not combine in one person.
- **FR-005b**: The **Secretary is deliberately exempt** from FR-005a and MAY be held alongside any of the
  three. The rule is not "one elected office per person" — the Secretary's duties (notices, backup
  exports) conflict with no one's.
- **FR-005c**: The system MUST **NOT** constrain how many contacts hold a given role. Two people may hold
  President simultaneously. This is unlikely in practice but explicitly permitted — **no uniqueness
  constraint may be added** to any role. FR-005a constrains *one person holding two roles*; it is not a
  statement about a role's holder count, and the two must not be conflated.
- **FR-006**: Each grant MUST carry a scope at one of **three** granularities: **club-wide**,
  **per-series**, or **per-event-group**. Per-event scope MUST NOT be implemented — it has no users.
- **FR-007**: Scope MUST be evaluated as a **set of filters (series OR group)** and MUST NOT be evaluated
  as a hierarchy or tree walk. Per-event-group is **orthogonal** to per-series: a group-scoped grant MUST
  reach every event in its group, including events whose series the holder has no series-scoped grant for.
- **FR-008**: Scope MUST be resolvable **per capability**, not fixed per role. Specifically, the Mailing
  List Manager MUST manage only their own series' mailing list while reading and exporting **all** series'
  lists.
- **FR-009**: The **Treasurer** MUST hold every Financial Secretary capability across **all** series
  (Treasurer ⊇ FS).
- **FR-010**: The **Vice-President** MUST hold every President capability (VP ⊇ President), including role
  assignment and club settings.
- **FR-011**: The **Super-user** MUST be permitted to write every resource in the matrix. It is an
  application role, not a bylaws officer.
- **FR-012**: FR-009, FR-010, and FR-011 MUST be the **only** superset relationships; no other role implies
  another.
- **FR-013**: The stored `administrator` role MUST be **retired** and replaced by **Super-user** semantics.
  **No contact holds it** — verified against live data 2026-07-15: zero contacts hold *any*
  `volunteer_role`, because the bootstrap CLI's `--role` flag is optional and was not used. There is
  therefore no access to preserve. What the requirement actually is: after the migration the club MUST have
  a working path to its **first Super-user**, and per FR-030a that path is the operator command line
  (FR-033). The migration MUST NOT hardcode a person.
- **FR-014**: Authority MUST be evaluated **live** against the holder's current volunteer eligibility and
  grants, so that clearing eligibility or revoking a grant takes effect on the holder's next request
  without requiring them to sign out.

#### Read authority

- **FR-015**: Every authenticated volunteer MUST be able to read all club data **except contact email
  addresses and phone numbers**, with no grant required. This MUST include the schedule, events, bookings,
  performers, venues, parameters, the organizer report, **the treasurer report, gate money figures, and
  individual performer pay**.
- **FR-016**: Contact **email addresses and phone numbers** MUST require a grant to read. A volunteer
  holding only the Organizer base MUST NOT receive them from any path — contact screens, search, exports,
  dedup suggestions, contact-tracing, or performer records.
- **FR-016a**: PII-read MUST ride **implicitly** on the grants whose use cases require it, and MUST NOT be
  a separately assignable capability: **Door Attendant** (matching a dancer), **Vice-President**,
  **Mailing List Manager** and **Secretary** (exports and dedup review), **Booker** (performer contact
  details, per `use-cases.md` §5.1.5), and **Treasurer** / **Financial Secretary** (membership). Holding
  any of these MUST confer PII-read; holding **only** the Organizer base MUST NOT.
- **FR-017**: PII read MUST be permitted **on lookup** and denied **in bulk**: a Door Attendant matching an
  individual dancer MUST see that dancer's PII, while the checked-in roster MUST return names only.
- **FR-017a**: **Dedup review is a sanctioned bulk PII view.** The Vice-President and Mailing List Manager
  MUST see **all** PII — emails and phone numbers — on every candidate pair while reviewing dedup
  suggestions, because deciding whether two records are the same person requires comparing exactly those
  fields. This is an explicit exception to FR-017, not a violation of it, and applies to the dedup review
  surface only.
- **FR-017b**: Every request that **discloses contact PII** MUST be audited at **request granularity** —
  one record capturing the actor, the surface, **how many** contacts' PII was disclosed, and the timestamp.
  It MUST NOT be audited per disclosed contact: check-in search fires per keystroke and returns up to 20
  contacts, so per-contact auditing would be unbounded. This makes a bulk harvest **detectable after the
  fact**, which is the counterweight to a rule that only discourages it (FR-017).
- **FR-018**: The public site MUST remain readable without authentication.

#### Enforcement

- **FR-019**: Every protected capability MUST be denied unless a held grant permits it at a scope matching
  the target. Default-deny MUST be the posture, consistent with feature 015's treatment of endpoints.
- **FR-020**: A **Door Attendant MUST be refused every write to the gate money record** at every scope. The
  Financial Secretary and Treasurer MUST be permitted those writes within their scope. Reading the record
  MUST be permitted to all under FR-015.
- **FR-021**: The system MUST enforce authority at **field level** within a single record where the matrix
  splits ownership, covering at minimum: an event's public description/price (Webmaster + Booker) versus
  its date/venue (Booker); a door record's money figures (FS + Treasurer) versus its comp/gift counts fed
  by check-in; and a contact's emails/consent topics (VP + Mailing List Manager) versus its record and
  membership side.
- **FR-022**: A write containing any field the actor may not write MUST be **refused**, not partially
  applied with forbidden fields silently discarded.
- **FR-023**: Contact **records** MUST remain creatable by the Door Attendant at check-in and editable on
  the membership side by the Financial Secretary and Treasurer. The Vice-President and Mailing List Manager
  MUST own contact **emails, consent topics, exports, and dedup/merge**, and MUST NOT own contact records
  as such.
- **FR-024**: Mailing-list exports MUST be permitted to the Vice-President, the Mailing List Manager, and
  the Secretary (as backup).
- **FR-025**: The treasurer report and QBO mapping MUST be **writable** only by the Treasurer.
- **FR-026**: A refusal MUST be **explicit**: it MUST tell the actor that they lack authority and name the
  capability refused, rather than hiding the record or redirecting silently. Because the Organizer base
  reads nearly everything (FR-015), a refusal reveals nothing the actor could not already see — the
  non-disclosure posture usual for authorization failures buys nothing here and costs clarity.
- **FR-026a**: The sole exception to FR-026 is **contact PII**, the one category the base cannot read: a
  refusal MUST NOT echo, hint at, or partially render an email address or phone number.
- **FR-026b**: Every refusal MUST be logged server-side with the actor, capability, target, and decision.
- **FR-027**: The system MUST prevent a contact from granting or scoping roles to themselves or others
  unless they hold assignment authority.

#### Assignment

- **FR-028**: The **President and the Vice-President** MUST be able to designate a contact as a volunteer
  and to clear that designation when a volunteer leaves.
- **FR-028a**: Clearing a volunteer's designation MUST **first report every grant that will be revoked** —
  each role and its scope — and require confirmation before proceeding. The officer must see what
  authority they are destroying, not infer it.
- **FR-028b**: On confirmation, clearing the designation MUST **revoke all of that volunteer's grants**,
  auditing each revocation individually (FR-032). Grants MUST NOT survive dormantly: a returning volunteer
  MUST be re-granted deliberately, never silently restored to their former authority.
- **FR-029**: The **President and the Vice-President** MUST be able to grant, re-scope, and revoke roles
  through the product's own screens — not solely through the operator command line.
- **FR-029a**: Granting **Financial Secretary** to a sitting President or Vice-President MUST **warn** the
  assigning officer that it concentrates authority, and MUST **not** block the grant. The combination is
  **acceptable by design**, for two reasons that depend on each other: **everything the FS does is reported
  to the Treasurer**, and FR-005a guarantees the Treasurer is a **different person** from the President or
  VP. So a President-as-FS is still overseen by someone else — and under FR-015 their gate figures are
  readable by *every* volunteer, not just the Treasurer. **Oversight, not prevention, is the control here**
  — remove either half and the reasoning collapses.
- **FR-029b**: Any contact holding President or Vice-President **and** Financial Secretary MUST be
  surfaced as a standing concentration on the annual review (FR-036), not only warned about once at
  assignment time.
- **FR-030**: Role assignment and club settings MUST be refused to every role except President,
  Vice-President, and Super-user. The **Treasurer MUST NOT** assign the Financial Secretary, and the
  Vice-President's authority over the Webmaster and Mailing List Manager MUST derive from FR-010, not from
  a separate delegation power.
- **FR-030a**: The **Super-user role MUST NOT be grantable through any screen** — not by the President, the
  Vice-President, or another Super-user. The operator command line MUST be its only source. Super-user is a
  technical break-glass role, not a club office (`use-cases.md` §5.8), and must not sit one click from the
  routine officer work the assignment screen exists for. *(Hardening is real but partial. FR-005a bars a
  President from granting themselves **Treasurer**, so the shortest escalation path is closed. What remains
  is **FS-of-every-series**, which reaches most of the same money authority — permitted, warned, and
  surfaced (FR-029a/b) rather than blocked. This is a governance boundary with teeth, not a containment
  guarantee.)*
- **FR-031**: A screen MUST list current volunteers with each of their grants and scopes.
- **FR-032**: Granting and revoking MUST be recorded in the audit trail with actor, subject, role, scope,
  and timestamp.
- **FR-033**: The operator command line MUST remain available as a cold-start and recovery path, and is the
  **sole** path by which a Super-user may be created (FR-030a). It MUST enforce FR-005a like any other
  path: the exclusivity of President / VP / Treasurer is a property of the data, not of one screen.

#### Annual approval

- **FR-034**: The system MUST record, per volunteer, when they were last approved and by whom.
- **FR-035**: The President or Vice-President MUST be able to approve a volunteer, recording the approval
  and its date.
- **FR-036**: The volunteer list MUST surface anyone whose last approval is more than a year old as
  **overdue for review**, and MUST surface any President/VP who also holds Financial Secretary as a
  standing **concentration of duties** (FR-029b), regardless of approval age.
- **FR-037**: An overdue review MUST NOT affect access in any way. The annual approval is **advisory**: no
  grant and no eligibility may lapse automatically.

#### Grant scope of specific roles

- **FR-038**: The **Door Attendant** grant MUST be **club-wide**: any Door Attendant may check dancers in
  at any event. It MUST permit check-in and attendance capture, including comp and gift-card counts.

#### Navigation

- **FR-039**: Navigation MUST present only the destinations a signed-in user's grants permit; hidden
  destinations MUST still be refused when requested directly.
- **FR-040**: The `/dev/routes` index's **hand-maintenance convention** MUST be withdrawn from the project
  instructions. The page itself MUST be **retained and regenerated from the filesystem** rather than
  deleted: role-aware navigation (FR-039) replaces it for *pages* but not for **API endpoints**, which have
  no navigation home — and enumerating those is the index's actual job (*"lists every UI page **and API
  endpoint** so reviewers can navigate"*). Deleting it would remove a working developer tool to solve a
  problem that was only ever its manual upkeep.
- **FR-040a**: The regenerated index MUST derive its contents by **walking the source tree**, never from a
  hand-written list — the list going stale is the entire defect being fixed. It MUST show each endpoint's
  **declared requirement** (FR-019), making the enforced matrix directly inspectable.
- **FR-040b**: The index MUST be restricted to the **Super-user**, via a capability like any other
  destination. It MUST NOT be gated by an inline role check (`role === 'super_user'`): that would be a
  second authorization mechanism beside the catalog, which is the coupling this feature exists to remove.

### Key Entities *(include if feature involves data)*

- **Role**: A named body of authority — the Organizer base plus the ten grants in FR-003. Roles are not
  ranked; authority is the union of grants, plus exactly three superset relationships (FR-012).
- **Scope**: A filter attached to a grant, at one of three granularities (club-wide, series, event group).
  Group and series are **orthogonal axes**, not levels of one tree.
- **Grant**: The assignment of one role at one scope to one volunteer contact. The unit the President or VP
  issues and revokes; a contact may hold many.
- **Capability**: A distinct thing a person may do to a resource (write an event's date, read a contact's
  phone number, export mailing lists). Capabilities — not pages — are what grants confer, which is what
  makes both the field-level splits and the PII rule expressible.
- **Volunteer eligibility**: The existing per-contact designation gating whether a person may sign in at
  all. Grants hang off it; clearing it denies everything.
- **Volunteer approval**: A dated, attributed record that an officer reviewed and approved a volunteer.
  Advisory — it informs the President, and never gates a request.
- **Permission decision**: The evaluated outcome of (actor, capability, target) → allow or deny, resolved
  live and recorded when it denies.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For every capability in the matrix (rows 1–22) that has a built resource, a grant-holder
  entitled to it succeeds and a volunteer holding only the Organizer base is refused — 100% of cases.
- **SC-002**: A per-series grant-holder succeeds on their own series and is refused on every other series
  in 100% of attempts.
- **SC-003**: A Door Attendant is refused **every** gate-money write in 100% of attempts and by every route
  of access, while successfully reading the same figures.
- **SC-004**: A volunteer holding only the Organizer base can read the treasurer report, gate figures, and
  individual performer pay for every series, and receives **zero** contact email addresses or phone numbers
  from any path.
- **SC-005**: A group-scoped grant reaches every event in its group — including events in a series the
  holder has no series grant for — and no event outside it.
- **SC-006**: Revoking a grant or clearing volunteer eligibility removes the corresponding authority on the
  holder's **next request**, with no sign-out required.
- **SC-007**: The President or VP can take a person from "not a volunteer" to "holding a scoped role that
  works" entirely through product screens, with no command-line step.
- **SC-008**: Zero contacts hold authority they were not explicitly granted: every allow decision traces to
  a specific grant or to the documented Organizer base.
- **SC-009**: A write mixing permitted and forbidden fields is refused in 100% of cases, with no partial
  application.
- **SC-010**: A Door Attendant identifying a dancer receives that dancer's PII, while the checked-in roster
  returns PII for 0% of rows.
- **SC-011**: A volunteer overdue for annual review experiences no change in access, and appears as overdue
  on the volunteer list in 100% of cases.
- **SC-012**: Every denied decision is recorded server-side with actor, capability, and target, and every
  refusal shown to a user names the capability refused. No refusal renders contact PII.
- **SC-014**: 100% of PII-disclosing requests produce exactly one audit record carrying a disclosure count,
  and zero produce per-contact records. Given an audit trail, "which volunteer saw the most contacts' PII
  last month, and how many" is answerable without scanning application logs.
- **SC-015**: Clearing a volunteer's designation lists 100% of the grants to be revoked before any change
  is made, and revokes 100% of them on confirmation, each with its own audit record. A re-designated
  volunteer holds zero grants until re-granted.
- **SC-016**: No contact ever holds more than one of President / VP / Treasurer — 100% of attempts to
  create that combination are refused, by every path including the operator CLI. A President or VP who
  also holds Financial Secretary is permitted, warned at assignment, and appears as a concentration on the
  annual review in 100% of cases.
- **SC-013**: The product ships with **no hand-maintained route list and no convention requiring one**. The
  `/dev/routes` index still resolves, is generated from the source tree, shows each endpoint's declared
  requirement, and is reachable **only** by a Super-user. Adding a route makes it appear with no edit to
  any list.

## Assumptions

- **Additive union, allow-wins.** "Door Attendant ✗ gate" means the Door Attendant grant does not *confer*
  the gate write, not that holding it subtracts one granted elsewhere. Deny-overrides would strip the gate
  from an FS who also works the door, which `use-cases.md` §5.2.8 expects to be routine.
- **Who holds the PII-read capability** — *resolved 2026-07-15, now FR-016a.* It rides implicitly on the
  grants whose use cases need it; only the bare Organizer base is excluded.
- **Annual approval is per volunteer, not per list.** "Approves the list" is read as approving each
  volunteer on it, since a single list-level date could not distinguish a member added last week from one
  unreviewed for three years.
- **The Organizer base is unscoped** and a volunteer retains read access indefinitely after their grants go
  inert (accepted 2026-07-14). The annual approval (FR-034–037) is the club's practical counterweight.
- **Enforcement targets built resources only.** Matrix rows describing unbuilt features (booking status,
  cancel/delete, recurring generation, landlord, advertised price, payment override, membership enrollment)
  are modeled as capabilities where cheap but not enforced against resources that do not exist. Those
  packages plug in later, per the constitution's YAGNI principle.
- **Enforcement stays close to the data**, consistent with feature 015's decision to gate at the layout and
  handler level rather than at the request edge — a decision made for both a technical reason and a durable
  security one, and explicitly not to be revisited on framework upgrade.
- **Grants attach to contacts**, reusing the feature-001 volunteer substrate. There is no separate user
  record; the person *is* a contact, as established by feature 015.
- **Two different constraints, both now decided.** FR-005a bars *one person from holding two of*
  President/VP/Treasurer. FR-005c says *two people may both hold President* — unlikely, but permitted, and
  **no uniqueness constraint may be added**. These are orthogonal and easy to conflate; the schema must
  implement the first and not quietly implement the second.
- **Series and event groups already exist** as first-class records with stable identifiers, and event
  groups carry no series reference — the orthogonality in FR-007 is already true of the data model.
- **Existing live data is one volunteer holding *no* roles** — ⚠️ *corrected 2026-07-15 against the live
  database; the earlier assumption that they held `administrator` was wrong and had propagated into the
  plan, research, data model, quickstart, and tasks.* Zero contacts hold any `volunteer_role`; the enum's
  two values (`door_attendant`, `administrator`) have never had a holder. Nothing is migrated into
  `role_grants`, and the first Super-user is bootstrapped from the command line.
- **Event groups are named per instance** and carry the year, which is what makes group-scoped grants
  self-expire in effect.

## Dependencies

- **Feature 015 (P3-1)** — authentication, sessions, volunteer eligibility, and the default-deny endpoint
  posture this feature evaluates grants within.
- **Feature 001** — the dormant volunteer substrate (`is_volunteer`, `volunteer_roles`) and the constraint
  that only a volunteer contact may hold roles.
- **`docs/use-cases.md`** — the authoritative role model and permission matrix this feature implements.
- **B33 (P3-3)** — the checked-in roster whose names-only rule is specified here (FR-017); this feature
  states the rule, P3-3 builds the roster.
- **Blocks P3-3, P3-4, P3-5** — each gates its UI by role and plugs into this framework.
