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
- ⚠️ **Not yet a permission gate.** These roles record *who may do what*; the app does **not** yet
  restrict routes by role. Enforcement is Phase 3 work.

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
  **Files:** [`domain/treasurer/reportService.ts`](src/server/domain/treasurer/reportService.ts) · [`domain/treasurer/fees.ts`](src/server/domain/treasurer/fees.ts) · [`domain/treasurer/nonDanceIncomeService.ts`](src/server/domain/treasurer/nonDanceIncomeService.ts) · [`validation/treasurer.ts`](src/server/validation/treasurer.ts) · API `src/app/api/events/[id]/treasurer-report`, `…/non-dance-income` · UI `/treasurer/<eventId>`.
- **QBO mapping** — Mapping of report lines/series to QuickBooks accounts & classes for manual
  copy/paste hand-off (online API is backlog B8).
  **Files:** [`schema/qboMapping.ts`](src/server/db/schema/qboMapping.ts) · [`domain/treasurer/mappingService.ts`](src/server/domain/treasurer/mappingService.ts) · API `src/app/api/qbo-mapping/…` · UI `/qbo-mapping`.
- **Non-dance income** — Income for an event that isn't gate/admission.
  **Files:** [`schema/nonDanceIncome.ts`](src/server/db/schema/nonDanceIncome.ts) · [`domain/treasurer/nonDanceIncomeService.ts`](src/server/domain/treasurer/nonDanceIncomeService.ts) · API `src/app/api/events/[id]/non-dance-income`.
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
  performer info (feature 007; online sales deferred).
  **Files:** [`domain/public/publicSchedule.ts`](src/server/domain/public/publicSchedule.ts) · [`domain/public/performerDisplay.ts`](src/server/domain/public/performerDisplay.ts) · [`domain/bands/publicDisplay.ts`](src/server/domain/bands/publicDisplay.ts) · UI `/whats-on`, `/whats-on/<eventId>`.

### Cross-cutting infrastructure

- **Audit row** — A structured record of a mutating action (`writeAudit`).
  **Files:** [`schema/audit.ts`](src/server/db/schema/audit.ts) · [`schema/treasurerAudit.ts`](src/server/db/schema/treasurerAudit.ts) · `src/server/lib/audit.ts`.
- **Money (cents)** — All money is integer cents; helpers in `src/server/lib/money.ts`.
- **Club settings** — Single-tenant club-wide settings. **Files:** [`schema/clubSettings.ts`](src/server/db/schema/clubSettings.ts).
- **Migrations** — Hand-authored additive SQL, `0001…0019`, run by `src/server/db/migrate.ts`.
  **Files:** `src/server/db/migrations/`.

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
| Rate/expense params | `schema/seriesParameters.ts` · `domain/parameters/` |
| Venues / rent | `schema/{venues,venueRents}.ts` · `domain/venues/` · `domain/parameters/rentService.ts` |
| Treasurer / QBO | `domain/treasurer/` · `schema/qboMapping.ts` |
| Organizer / paying dancers / Dance Net | `domain/organizer/danceResult.ts`, `reportService.ts` |
| Public schedule | `domain/public/` |
| Route index (all UI + API) | `src/app/dev/routes/page.tsx` |
