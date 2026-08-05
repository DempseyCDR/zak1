# zak1 — Help & Glossary (v1)

**Purpose (dual audience).** This file has two jobs:

1. **For the end user** — define every domain term in plain language so a non-technical
   CDR volunteer can understand what the app is talking about.
2. **For Claude / developers** — index *where each term lives in the code* (schema, domain
   logic, validation, API route, UI page) so a coding session can jump straight to the
   right file instead of re-searching.

Companion docs: [`zak1_Project_Context_v1.4.md`](zak1_Project_Context_v1.4.md) (project state),
`CLAUDE.md` (conventions), `specs/BACKLOG.md` (deferred work). Money is always **integer cents**.

> **How to read the file index.** Paths are relative to the repo root. Conventional locations:
> schema = `src/server/db/schema/`, business logic = `src/server/domain/<area>/`,
> Zod validation = `src/server/validation/`, API = `src/app/api/…/route.ts`,
> UI = `src/app/(group)/…/page.tsx`. The route index UI is
> [`src/app/dev/routes/page.tsx`](src/app/dev/routes/page.tsx).

---

## A. User roles

zak1 today has **two roles that actually exist in the database** and a larger set of **functional
roles** implied by features but not yet enforced by a permission system.

> **Authoritative role model:** the full role model, delegation tree, per-role use cases, and the
> role/permission matrix now live in [`use-cases.md`](use-cases.md). This section covers only the
> DB-level enum; see that document for the complete Phase 3 target model.

### A.1 Formal roles (modeled in the schema)

These are the values of the `volunteer_role` enum, stored as the `volunteer_roles` array on a
contact who is flagged `is_volunteer`.

| Role | Meaning | Where defined |
|---|---|---|
| **`door_attendant`** | A volunteer who works the door: takes admission, records attendance and gate money at an event. | enum: [`schema/enums.ts`](src/server/db/schema/enums.ts) · stored on contact: [`schema/contacts.ts`](src/server/db/schema/contacts.ts) · validated: [`validation/contacts.ts`](src/server/validation/contacts.ts) |
| **`administrator`** | A volunteer with broad management access (events, performers, finance, exports). | same files as above |

- **Storage rule:** `volunteer_roles volunteer_role[] NOT NULL DEFAULT '{}'` with a CHECK that only a
  volunteer may hold roles — [`migrations/0001_init.sql`](src/server/db/migrations/0001_init.sql).
- **Assignment logic:** roles are de-duplicated on write in
  [`domain/contacts/contactService.ts`](src/server/domain/contacts/contactService.ts).
- ⚠️ **Roles are still not a permission gate.** `volunteer_roles` records *who may do what*, but the app
  does **not** yet restrict anything by role — that is authorization, and it is the next feature (P3-2).
- ✅ **`is_volunteer` IS enforced** as of feature 015: it is the gate for signing in at all, re-checked
  live on every request. Authentication ("who is signed in?") exists; authorization ("may they do this?")
  does not.

### A.2 Functional roles (implied by features, not yet access-controlled)

The functional roles — Public visitor, Organizer (authenticated base), Door Attendant, Booker,
Financial Secretary, Treasurer, Vice-President, Webmaster, Mailing List Manager, Secretary, President,
and Super-user — are modeled in full, with scope, delegation, and per-surface write ownership, in
[`use-cases.md`](use-cases.md) §2–§3. That is the single source of truth; it is not duplicated here to
avoid drift. Note the enum value `administrator` (below) now maps to the **Super-user** functional role
(rename pending a schema change).

---

## B. Glossary + file index

Each entry: plain-English definition, then **Files** (the code locations that own the term).

### Contacts, membership & mailing

- **Contact** — A person the club knows (dancer, volunteer, performer, subscriber). Has a required
  `first_name`, optional `last_name`, and a maintained `display_name`.
  **Files:** [`schema/contacts.ts`](src/server/db/schema/contacts.ts) · [`domain/contacts/contactService.ts`](src/server/domain/contacts/contactService.ts) · [`validation/contacts.ts`](src/server/validation/contacts.ts) · API `src/app/api/contacts/route.ts`, `…/[id]/route.ts` · UI `/contacts`.
- **Display name / override** — The effective name shown for a contact: `display_name_override ?? "first last"`.
  Search runs on display name; dedup does **not** (feature 012).
  **Files:** [`domain/contacts/normalize.ts`](src/server/domain/contacts/normalize.ts) · [`schema/contacts.ts`](src/server/db/schema/contacts.ts).
- **Pronouns** — Free-text pronouns on a contact (feature 012). **Files:** [`schema/contacts.ts`](src/server/db/schema/contacts.ts).
- **Contact email / email purpose / status** — A contact may have multiple emails, each with a purpose
  (`personal`, `booking`, `public_profile`, `other`) and status (`active`, `transition`, `inactive`).
  **Files:** enums [`schema/enums.ts`](src/server/db/schema/enums.ts) · [`schema/contactEmails.ts`](src/server/db/schema/contactEmails.ts) · [`domain/contacts/emailService.ts`](src/server/domain/contacts/emailService.ts) · API `src/app/api/contacts/[id]/emails/…`.
- **Membership / membership status** — Whether a contact's club membership is `current`, `lapsed`,
  `long_lapsed`, or `never`; derived from membership records.
  **Files:** enum [`schema/enums.ts`](src/server/db/schema/enums.ts) · [`schema/memberships.ts`](src/server/db/schema/memberships.ts) · classify logic [`domain/membership/classify.ts`](src/server/domain/membership/classify.ts) · [`domain/membership/membershipService.ts`](src/server/domain/membership/membershipService.ts) · API `src/app/api/memberships`, `…/membership-status`.
- **Email consent topic** — What a contact agreed to receive (`contra`, `english`, `openband`,
  `special_events`, `jane_austen_ball`, `contact_tracing`, `do_not_contact`). Drives mailing-list membership.
  **Files:** enum [`schema/enums.ts`](src/server/db/schema/enums.ts).
- **Dedup / merge** — Finding and merging duplicate contacts. Dedup keys on normalized structured
  first+last (`dedup_normalized`), immune to display-name overrides.
  **Files:** [`domain/dedup/suggestionService.ts`](src/server/domain/dedup/suggestionService.ts) · [`domain/dedup/mergeService.ts`](src/server/domain/dedup/mergeService.ts) · [`validation/dedup.ts`](src/server/validation/dedup.ts) · API `src/app/api/dedup/…` · UI `/dedup`.
- **Mailing-list export / iContact** — Standing CSV lists (6 remain after feature 010) plus an
  event-scoped contact-tracing export, formatted for iContact.
  **Files:** [`domain/exports/mailingLists.ts`](src/server/domain/exports/mailingLists.ts) · [`domain/exports/exportService.ts`](src/server/domain/exports/exportService.ts) · [`domain/exports/contactTracingService.ts`](src/server/domain/exports/contactTracingService.ts) · [`domain/exports/csv.ts`](src/server/domain/exports/csv.ts) · API `src/app/api/exports/…` · UI `/exports`.

### Events, door & gate

- **Event / series / event group** — An event is one dance night; it belongs to a *series* (e.g. `ecd`,
  `tnc`) and may belong to an *event group*. Events carry optional `label`, `start_time` (zoneless
  wall-clock), and public `description` (feature 013).
  **Files:** [`schema/events.ts`](src/server/db/schema/events.ts) · [`domain/events/eventService.ts`](src/server/domain/events/eventService.ts) · [`validation/venues.ts`](src/server/validation/venues.ts) (`assignVenueSchema`) · API `src/app/api/events/…`, `src/app/api/series`, `src/app/api/event-groups` · UI `/events`.
- **Wall-clock time** — An event's start time stored/rendered as a literal clock time with **no time
  zone** (pure `formatWallClock`).
  **Files:** [`domain/public/wallClock.ts`](src/server/domain/public/wallClock.ts).
- **Attendance / check-in** — Recording which/how many dancers attended an event; retention analytics
  build on it.
  **Files:** [`schema/attendance.ts`](src/server/db/schema/attendance.ts) · [`domain/attendance/attendanceService.ts`](src/server/domain/attendance/attendanceService.ts) · [`domain/attendance/retentionService.ts`](src/server/domain/attendance/retentionService.ts) · [`validation/attendance.ts`](src/server/validation/attendance.ts) · API `src/app/api/events/[id]/attendance`, `src/app/api/attendance/search` · UI `/checkin`.
- **Door record** — The per-event record of the money box: gross cash, gross card, seed float, gate-sales
  lines, plus counts (`comp_count`, `gift_card_redemption_count`).
  **Files:** [`schema/door.ts`](src/server/db/schema/door.ts) · [`domain/door/doorRecordService.ts`](src/server/domain/door/doorRecordService.ts) · [`domain/door/calc.ts`](src/server/domain/door/calc.ts) · [`validation/door.ts`](src/server/validation/door.ts) · API `src/app/api/door-records/…`, `src/app/api/events/[id]/door-record` · UI `/gate`.
- **Seed float** — The starting cash placed in the box before the door opens; subtracted when deriving
  cash admission. **Files:** [`domain/gate/eventMoney.ts`](src/server/domain/gate/eventMoney.ts).
- **Gate category / gate-sales line** — A non-admission money line at the door: `merchandise`,
  `donation`, `future_event`, `membership`, `gift_card`, `misc_sales` (plus `admission`, which is derived).
  Each line is `cash` or `card`.
  **Files:** enums [`schema/enums.ts`](src/server/db/schema/enums.ts) · [`domain/gate/eventMoney.ts`](src/server/domain/gate/eventMoney.ts) · API `src/app/api/door-records/[id]/gate-sales`.
- **Admission (derived)** — Never stored directly: `cash admission = gross cash − seed float − Σ
  non-admission cash lines`; `card admission = card gross − Σ non-admission card lines`.
  **Files:** [`domain/gate/eventMoney.ts`](src/server/domain/gate/eventMoney.ts).
- **Comp count** — One combined count of people admitted **free** ("next dance free" + performers'
  guests) (feature 014). Subtracted from paying dancers → Avg Ticket rises.
  **Files:** [`schema/door.ts`](src/server/db/schema/door.ts) (`comp_count`) · [`domain/gate/eventMoney.ts`](src/server/domain/gate/eventMoney.ts) (`EventGate.compCount`) · [`domain/organizer/danceResult.ts`](src/server/domain/organizer/danceResult.ts) · UI `/gate`.
- **Gift-card redemption count** — A **dormant** count field (schema + validation since feature 002)
  with no UI writer and no report reader. Backlog **B21** decides its fate in Phase 3. Distinct from the
  `gift_card` gate-*sales* dollar line. **Files:** [`schema/door.ts`](src/server/db/schema/door.ts) · [`validation/door.ts`](src/server/validation/door.ts).

### Performers, bands & bookings

- **Performer / performer type** — Someone paid to perform: `caller`, `lead_musician`, `musician`,
  `open_band_musician`, `sound_tech`, `instructor`.
  **Files:** enum [`schema/enums.ts`](src/server/db/schema/enums.ts) · [`schema/performers.ts`](src/server/db/schema/performers.ts) · [`domain/performers/performerService.ts`](src/server/domain/performers/performerService.ts) · [`domain/performers/performerRules.ts`](src/server/domain/performers/performerRules.ts) · [`validation/performers.ts`](src/server/validation/performers.ts) · API `src/app/api/performers/…` · UI `/performers`.
- **Band / band member / roster** — A reusable named group of performers that can be booked as a unit
  (feature 008). **Files:** [`schema/bands.ts`](src/server/db/schema/bands.ts) · [`domain/bands/bandService.ts`](src/server/domain/bands/bandService.ts) · [`domain/bands/bookBand.ts`](src/server/domain/bands/bookBand.ts) · [`validation/bands.ts`](src/server/validation/bands.ts) · API `src/app/api/bands/…`, `src/app/api/events/[id]/book-band` · UI `/bands`.
- **Booking** — A performer (or band) engaged for an event, with pay.
  **Files:** [`schema/bookings.ts`](src/server/db/schema/bookings.ts) · [`domain/bookings/bookingService.ts`](src/server/domain/bookings/bookingService.ts) · API `src/app/api/events/[id]/bookings`, `src/app/api/bookings/[id]` · UI `/bookings`.
- **Check number (booking payment)** — The paper **cheque number** used to pay a performer for a
  booking, stored as `checkNumber` on the booking. Recorded by the series **Financial Secretary** while
  filling out the door record; the Treasurer later enters it in QBO for bank-statement reconciliation
  (reconciliation itself happens in QBO, outside this project). ⚠️ Not to be confused with door
  **check-in** (attendance) or the door **check** money box.
  **Files:** [`validation/treasurer.ts`](src/server/validation/treasurer.ts) (`checkNumberPatchSchema`) · [`schema/bookings.ts`](src/server/db/schema/bookings.ts) (`checkNumber`) · API `src/app/api/bookings/[id]/check`.
- **Check-in (attendance)** — Recording that a dancer attended an event; the door administrator "checks
  in" each dancer. Distinct from a booking **check number**. **Files:** see *Attendance / check-in* above · UI `/checkin`.

### Financial parameters & venues

- **Series parameters (rate + expense)** — One `series_parameters` table holding standard pay **rates**
  and **expense** amounts, resolved per series (feature 009, ex-B16). A `general` series and `musician`
  rate kind exist. **Files:** [`schema/seriesParameters.ts`](src/server/db/schema/seriesParameters.ts) · [`domain/parameters/seriesParameterService.ts`](src/server/domain/parameters/seriesParameterService.ts) · API `src/app/api/rate-parameters`, `src/app/api/expense-parameters` · UI `/rate-parameters`, `/expense-parameters`.
- **Rate parameter** — A standard pay rate (e.g. musician rate) used to price bookings.
- **Ongoing charge / expense parameter** — A labeled recurring series charge, each ended by a `$0` entry;
  summed as **Ongoing** in the organizer report. **Files:** [`domain/organizer/reportService.ts`](src/server/domain/organizer/reportService.ts) · [`schema/miscExpenses.ts`](src/server/db/schema/miscExpenses.ts) · [`domain/organizer/miscExpenseService.ts`](src/server/domain/organizer/miscExpenseService.ts).
- **Venue** — A physical location; carries a default rent and map info (feature 007).
  **Files:** [`schema/venues.ts`](src/server/db/schema/venues.ts) · [`domain/venues/venueService.ts`](src/server/domain/venues/venueService.ts) · [`domain/public/venueMap.ts`](src/server/domain/public/venueMap.ts) · [`validation/venues.ts`](src/server/validation/venues.ts) · API `src/app/api/venues/…` · UI `/venues`.
- **Rent (resolution order)** — Per-event rent resolves: event override → series-at-venue → venue default
  → 0 (feature 011). **Files:** [`schema/venueRents.ts`](src/server/db/schema/venueRents.ts) · [`domain/parameters/rentService.ts`](src/server/domain/parameters/rentService.ts) (`resolveEventRentCents`) · [`validation/venueRents.ts`](src/server/validation/venueRents.ts) · API `src/app/api/venue-rents` · UI `/venue-rents`.

### Treasurer & organizer reports

- **Treasurer report** — The per-event financial statement handed to bookkeeping.
  **Files:** [`domain/treasurer/reportService.ts`](src/server/domain/treasurer/reportService.ts) · [`domain/treasurer/fees.ts`](src/server/domain/treasurer/fees.ts) · [`validation/treasurer.ts`](src/server/validation/treasurer.ts) · API `src/app/api/events/[id]/treasurer-report` · UI `/treasurer`.
- **QBO mapping** — Mapping of report lines/series to QuickBooks accounts & classes for manual
  copy/paste hand-off (online API is backlog B8).
  **Files:** [`schema/qboMapping.ts`](src/server/db/schema/qboMapping.ts) · [`domain/treasurer/mappingService.ts`](src/server/domain/treasurer/mappingService.ts) · API `src/app/api/qbo-mapping/…` · UI `/qbo-mapping`.
- **Online / processing fee (dormant)** — Fee calculator that stays dormant because online sales
  (007 US2) are deferred. **Files:** [`domain/treasurer/fees.ts`](src/server/domain/treasurer/fees.ts).
- **Organizer report** — Per-event and trend analytics for a series organizer.
  **Files:** [`domain/organizer/reportService.ts`](src/server/domain/organizer/reportService.ts) · [`domain/organizer/danceResult.ts`](src/server/domain/organizer/danceResult.ts) · [`domain/organizer/trend.ts`](src/server/domain/organizer/trend.ts) · [`domain/organizer/quarterly.ts`](src/server/domain/organizer/quarterly.ts) · [`validation/organizer.ts`](src/server/validation/organizer.ts) · API `src/app/api/organizer/[seriesKey]/report` · UI `/organizer/<seriesKey>`.
- **Paying dancers** — `max(0, attendance − performers − 1 − comps)`: attendance minus distinct
  performers, the one door attendant (−1), and comps; floored at 0.
  **Files:** [`domain/organizer/danceResult.ts`](src/server/domain/organizer/danceResult.ts).
- **Average ticket** — `admission ÷ paying dancers` (0 when no dancers).
  **Files:** [`domain/organizer/danceResult.ts`](src/server/domain/organizer/danceResult.ts).
- **Dance Net** — `admission + merch − rent − performerTotal − ongoing − misc`: the bottom-line
  profitability of a dance night. **Files:** [`domain/organizer/danceResult.ts`](src/server/domain/organizer/danceResult.ts).

### Public website

- **What's On / public schedule** — The browse-only public listing of upcoming events with venue and
  performer info (feature 007; online sales deferred). **`/whats-on`** is the home page, showing dances from
  **two days ago** onward, ascending (036, P6-R3). **`/what-was-on`** is the dance **history** — dances `<
  today`, most-recent-first (037, P6-R4); it links to the same `/whats-on/<eventId>` detail. Both listings share
  `ScheduleList` and a server-rendered **series filter** (`?series=<key>`, all series, `SeriesFilter`; 037,
  P6-R5); the last-two-days window overlaps both pages by design. Readers `getPublicSchedule` (asc) /
  `getPublicHistory` (desc) / `listSeries` delegate to one internal `listPublicEvents`.
  **Files:** [`domain/public/publicSchedule.ts`](src/server/domain/public/publicSchedule.ts) · [`domain/public/performerDisplay.ts`](src/server/domain/public/performerDisplay.ts) · [`domain/bands/publicDisplay.ts`](src/server/domain/bands/publicDisplay.ts) · UI `/whats-on`, `/what-was-on`, `/whats-on/<eventId>` · [`app/(public)/_components/`](src/app/(public)/_components/).

### Staff authentication (feature 015)

- **Staff sign-in / Sign in with Google** — how a volunteer authenticates. The club runs Google Workspace,
  but staff are **mixed**: long-term volunteers use `cdrochester.org` accounts, short-term ones use personal
  Google accounts. No password is ever stored — Google verifies identity and owns recovery.
  **Files:** [`auth/google.ts`](src/server/auth/google.ts) (arctic client, PKCE) · [`auth/claims.ts`](src/server/auth/claims.ts) · API `src/app/api/auth/google/route.ts`, `…/callback/route.ts` · UI `/login`.
- **Verified claims / the boundary seam** — the one place an external assertion becomes trusted data:
  `verifyGoogleIdToken(token) → VerifiedClaims`. **`email_verified` must be `true`** — the linchpin, without
  which a token could assert any address. The verifier is injectable, which is how tests use a local key set
  and never call Google (constitution v1.2.0).
  **Files:** [`auth/claims.ts`](src/server/auth/claims.ts) · [`validation/auth.ts`](src/server/validation/auth.ts) · test fixture `tests/integration/helpers/oidc.ts`.
- **Staff identity** — a volunteer contact's ability to sign in; binds a Google account (`google_sub`, the
  durable link) to a **contact**. Created **automatically** on first successful sign-in — no registration
  form, no approval. **One Google account per person.**
  **Files:** [`schema/auth.ts`](src/server/db/schema/auth.ts) · [`auth/signIn.ts`](src/server/auth/signIn.ts) · [`migrations/0020_staff_auth.sql`](src/server/db/migrations/0020_staff_auth.sql).
- **Login email (`is_login`)** — the contact email that is the sign-in identifier. Dormant since feature 001;
  activated by 015. Permitted only on volunteer contacts, and **at most one per contact** (partial unique
  index). **Files:** [`schema/contactEmails.ts`](src/server/db/schema/contactEmails.ts) · [`domain/contacts/emailService.ts`](src/server/domain/contacts/emailService.ts) (`isLoginAllowed`).
- **Staff session** — a **revocable** server-side row, not a stateless token. Only a **hash** of the cookie
  token is stored. Rolling idle window (`SESSION_IDLE_TTL_HOURS`, default 8).
  **Files:** [`auth/session.ts`](src/server/auth/session.ts) · [`schema/auth.ts`](src/server/db/schema/auth.ts).
- **Revocation (the live `is_volunteer` join)** — why sessions are rows: clearing `contacts.is_volunteer`
  locks a person out on their **next request**, with no sweep. A JWT could not do this. ⚠️ Suspending someone's
  *Google* account is **not** the kill-switch (we never re-contact Google) — clearing `is_volunteer` is.
  **Files:** [`auth/session.ts`](src/server/auth/session.ts) (`readSession`).
- **`requireStaff()` / `getCurrentStaff()` — the authorization seam** — answers *"who is signed in?"* and
  never *"may they do this?"*. `CurrentStaff` deliberately carries **no roles**; P3-2 layers
  role × capability × scope around it. **Files:** [`auth/currentStaff.ts`](src/server/auth/currentStaff.ts).
- **`withAuth`** — the API wrapper (mirrors `withLogging`). **`/api/*` is default-deny**: every route uses it
  except `/api/auth/*`. A route-inventory test fails the suite if a new route ever forgets.
  **Files:** [`auth/withAuth.ts`](src/server/auth/withAuth.ts) · guard `tests/integration/auth.routeInventory.test.ts`.
- **Refusal reason codes** — `email_unverified`, `no_match`, `ambiguous_match`, `not_volunteer`,
  `identity_exists`, `sub_email_mismatch`, `token_invalid`. **Server-side only**: the user always sees one
  generic message, since distinguishing them would let anyone probe club membership.
  **Files:** [`validation/auth.ts`](src/server/validation/auth.ts) · [`auth/signIn.ts`](src/server/auth/signIn.ts).
- **Operator bootstrap** — `pnpm run auth:bootstrap -- --email … [--contact-id …] [--role …]`. The cold-start
  path: nothing in the UI sets `is_volunteer`, so without it nobody could sign in. ⚠️ **Not `db:seed`** — it
  only touches the named contact. **Files:** [`db/bootstrapOfficer.ts`](src/server/db/bootstrapOfficer.ts).

### Cross-cutting infrastructure

- **Audit row** — A structured record of a mutating action (`writeAudit`).
  **Files:** [`schema/audit.ts`](src/server/db/schema/audit.ts) · [`schema/treasurerAudit.ts`](src/server/db/schema/treasurerAudit.ts) · `src/server/lib/audit.ts`.
- **Money (cents)** — All money is integer cents; helpers in `src/server/lib/money.ts`.
- **Club settings** — Single-tenant club-wide settings. **Files:** [`schema/clubSettings.ts`](src/server/db/schema/clubSettings.ts).
- **Migrations** — Hand-authored additive SQL, `0001…0019`, run by `src/server/db/migrate.ts`.
  **Files:** `src/server/db/migrations/`.
- **Public navigation menu** — the site's top-level menu (feature 034, P6-R1), rendered on **every** page from
  the root layout (topmost bar; on staff pages the volunteer nav sits beneath). Entries are a hand-maintained
  single-source array (generation deferred, B44); active-section via `usePathname`. **Presentation only — never
  an access control.** Distinct from the role-aware volunteer nav (`Nav.tsx` / `auth/nav.ts`).
  **Files:** [`app/PublicNav.tsx`](src/app/PublicNav.tsx) · [`app/publicNavItems.ts`](src/app/publicNavItems.ts).
- **Volunteer navigation menu** — the role-aware staff menu (feature 016; restructured by 035, P6-R2). As of 035
  it renders from the **root layout** on **every** page when signed in (the second bar, `aria-label="Main"`,
  beneath the public menu; `Nav` returns null for anonymous visitors), no longer from the `(admin)`/`(door)`
  layouts or the home page. Entries are the hand-maintained capability-tagged `NAV` list, filtered by the
  actor's capabilities (`navItemsFor`); **kept complete** by the `auth.navCompleteness` guard, which walks the
  staff page tree and fails on any orphan (documented allowlist for dynamic + outside-group routes). Server
  loader `Nav.tsx` → client presenter `VolunteerNav.tsx` (active-section via `usePathname`). **Courtesy, not a
  control.** **Files:** [`app/Nav.tsx`](src/app/Nav.tsx) · [`app/VolunteerNav.tsx`](src/app/VolunteerNav.tsx) ·
  [`server/auth/nav.ts`](src/server/auth/nav.ts) · guard `tests/integration/auth.navCompleteness.test.ts`.

---

## B2. Feature 019 — payments & membership acquisition

- **Performer payment** — What was **actually disbursed** to a performer, recorded separately from the
  booking (which keeps the *expected* rate). The payee MAY differ from the booked performer (a substitute
  sat in), and one check may settle several bookings (aggregation).
  **Files:** [`schema/performerPayments.ts`](src/server/db/schema/performerPayments.ts) ·
  [`domain/payments/performerPaymentService.ts`](src/server/domain/payments/performerPaymentService.ts) ·
  [`domain/payments/reconcile.ts`](src/server/domain/payments/reconcile.ts) · API
  `src/app/api/performer-payments/**` · UI [`(admin)/payments`](<src/app/(admin)/payments/page.tsx>).
- **Payment ↔ booking link** — The `payment_bookings` join that lets one payment cover several bookings.
  **Files:** `schema/performerPayments.ts` (`paymentBookings`).
- **Membership year-end** — The fixed, club-wide date all memberships expire on; a dues payment extends to
  the next occurrence on/after the payment date. A club setting (`club_settings.membership_year_end`,
  MM-DD), defaulted to a placeholder until set operationally.
  **Files:** [`schema/clubSettings.ts`](src/server/db/schema/clubSettings.ts) ·
  [`domain/membership/membershipTerm.ts`](src/server/domain/membership/membershipTerm.ts).
- **Door membership enrollment** — A **named** `membership` gate line now creates/renews the member's record
  atomically with the gate sale (idempotent across re-saves; anonymous lines record money only).
  **Files:** [`domain/door/doorRecordService.ts`](src/server/domain/door/doorRecordService.ts)
  (`enrollDoorMemberships`).
- **Membership capture / parked payment** — Prospective-member info submitted on the public `/join` page,
  awaiting a verified PayPal notification. A verified-but-unmatched payment is **parked** for an admin to
  link by hand; a duplicate notification is idempotent (unique `provider_event_id`).
  **Files:** [`schema/membershipCaptures.ts`](src/server/db/schema/membershipCaptures.ts) ·
  [`schema/paypalNotifications.ts`](src/server/db/schema/paypalNotifications.ts) ·
  [`domain/paypal/captureService.ts`](src/server/domain/paypal/captureService.ts) ·
  [`domain/paypal/verify.ts`](src/server/domain/paypal/verify.ts) · public route
  `src/app/api/public/membership`, webhook `src/app/api/webhooks/paypal` (both `withPublic`) · UI
  [`(public)/join`](<src/app/(public)/join/page.tsx>).
- **Seed float (configurable)** — The till float before doors open, now a per-series, effective-dated
  parameter (`door`/`seed_float`) rather than a hard-coded $15; the FS still overrides per door record; a
  new door record copies the value at creation (existing records keep theirs).
  **Files:** `schema/seriesParameters.ts` ·
  [`domain/parameters/seriesParameterService.ts`](src/server/domain/parameters/seriesParameterService.ts)
  (`resolveParameterCentsOrNull`, `createDoorParameter`) · API `src/app/api/door-parameters` · UI
  [`(admin)/door-parameters`](<src/app/(admin)/door-parameters/page.tsx>).
- **Empty door record (deletability)** — A door record with no gate sales and every money field and count
  zero (the seed float excluded) counts as "no history", so a never-held event stays deletable. Attendance
  is discarded on confirmation, not blocked; gate sales / check numbers / performer payments still block.
  **Files:** [`domain/door/calc.ts`](src/server/domain/door/calc.ts) (`isEmptyDoorRecord`) ·
  [`domain/events/eventService.ts`](src/server/domain/events/eventService.ts) (`deleteEvent`).

---

## B3. Feature 020 — Booker experience

- **Tentative (booking status)** — a performer's "maybe": a status between `requested` and `confirmed`,
  skippable (`requested → confirmed` still allowed). Internal only — the public site shows confirmed
  bookings.
  **Files:** enum [`schema/enums.ts`](src/server/db/schema/enums.ts) · transitions
  [`domain/bookings/bookingStatus.ts`](src/server/domain/bookings/bookingStatus.ts).
- **Status letter** — the report tags each performer with P/R/T/C/D (proposed/requested/tentative/confirmed/
  declined); the letter carries the meaning, color reinforces (accessibility).
  **Files:** [`(admin)/bookings-report/page.tsx`](<src/app/(admin)/bookings-report/page.tsx>).
- **Venue short name** — a compact label for the report ("German House" → "GH"); defaults to the name's
  initials, editable, non-unique.
  **Files:** `schema/venues.ts` · `venueShortNameDefault` in
  [`domain/venues/venueService.ts`](src/server/domain/venues/venueService.ts).
- **Performer typeahead / add-performer** — the booking modal's payee picker searches performers
  (`searchPerformers`, `GET /api/performers?q=`); an unknown substitute is added by linking an existing
  contact (the first B39 pickers).
  **Files:** [`domain/performers/performerService.ts`](src/server/domain/performers/performerService.ts) ·
  [`(admin)/_modals/BookingModal.tsx`](<src/app/(admin)/_modals/BookingModal.tsx>).
- **mailto (performer email)** — the modal offers a mailto link using the first active email whose purposes
  include booking > personal > public_profile; PII, gated by `contact.pii.read`
  (`GET /api/performers/[id]/mailto`).
  **Files:** [`domain/contacts/mailtoEmail.ts`](src/server/domain/contacts/mailtoEmail.ts).
- **Prior-event defaults** — a new event pre-fills venue + start time from the latest prior event in the
  series (`priorEventDefaults`); recurrence generation is exempt.
  **Files:** `domain/events/eventService.ts` · [`(admin)/_modals/EventModal.tsx`](<src/app/(admin)/_modals/EventModal.tsx>).
- **Rent default (dynamic, Option A)** — the event modal shows the resolved rent default
  (`resolveRentForVenue`) and stores no override when left at it (event tracks the venue/series default);
  a typed value freezes a per-event override.
  **Files:** [`domain/parameters/rentService.ts`](src/server/domain/parameters/rentService.ts).

---

## C. Quick term → file lookup (compressed)

| Term | Owning file(s) |
|---|---|
| Roles (enum) | `schema/enums.ts` · `schema/contacts.ts` · `validation/contacts.ts` |
| Contact / name / pronouns | `schema/contacts.ts` · `domain/contacts/` |
| Membership | `schema/memberships.ts` · `domain/membership/` |
| Dedup | `domain/dedup/` |
| Exports (iContact) | `domain/exports/` |
| Event / series | `schema/events.ts` · `domain/events/eventService.ts` |
| Attendance | `schema/attendance.ts` · `domain/attendance/` |
| Door record / comps | `schema/door.ts` · `domain/door/` |
| Gate money / admission | `domain/gate/eventMoney.ts` |
| Performers / bands / bookings | `schema/{performers,bands,bookings}.ts` · `domain/{performers,bands,bookings}/` |
| Rate/expense/door-float params | `schema/seriesParameters.ts` · `domain/parameters/` |
| Performer payments / reconciliation | `schema/performerPayments.ts` · `domain/payments/` |
| Online membership (capture/webhook) | `schema/{membershipCaptures,paypalNotifications}.ts` · `domain/paypal/` · `src/app/api/{public/membership,webhooks/paypal}` |
| Membership year-end / term | `schema/clubSettings.ts` · `domain/membership/membershipTerm.ts` |
| Public routes (declared) | `src/server/auth/withPublic.ts` (`PUBLIC_API_ROUTES`) |
| Venues / rent | `schema/{venues,venueRents}.ts` · `domain/venues/` · `domain/parameters/rentService.ts` |
| Treasurer / QBO | `domain/treasurer/` · `schema/qboMapping.ts` |
| Organizer / paying dancers / Dance Net | `domain/organizer/danceResult.ts`, `reportService.ts` |
| Public schedule | `domain/public/` |
| Staff auth (sign-in, claims, session) | `src/server/auth/` · `schema/auth.ts` · `validation/auth.ts` |
| Auth routes / login page | `src/app/api/auth/**` · `src/app/login/page.tsx` |
| Operator bootstrap (first officer) | `src/server/db/bootstrapOfficer.ts` |
| Route index (all UI + API) | `src/app/dev/routes/page.tsx` |
