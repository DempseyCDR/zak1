# Tasks: Email List Export (iContact)

**Feature**: `006-icontact-export` | **Plan**: [plan.md](plan.md) | **Spec**: [spec.md](spec.md)

**Stack**: TypeScript / Next.js (App Router) + PostgreSQL 16, Drizzle, Zod, pino, Vitest. Extends the
existing project; reuses feature 001 (contacts/contact_emails/membership), feature 002
(attendance/events/`listEventAttendance`), and feature 003 (performers). No new external dependency —
CSV serialization is hand-rolled.

**Test-First is NON-NEGOTIABLE** (constitution Principle I): test tasks are written first and MUST
fail before implementation. Pure functions (CSV escaping, name split, through-year derivation) are
unit tests; per-list/per-event qualification and route behavior are integration-tested against the
real `zak1_test` database — no DB mocking.

**Conventions**: `[P]` = parallelizable (different files, no incomplete deps). Story labels `[US1]`,
`[US2]`, `[US3]`. Paths repo-relative.

---

## Phase 1: Setup

- [X] T001 [P] Zod schemas for export route params — `listIdSchema` (enum of the 7 fixed list IDs) and
  `eventIdSchema` (uuid) — in `src/server/validation/exports.ts`

---

## Phase 2: Foundational (blocking prerequisites)

- [X] T002 Author migration `0011_icontact_export.sql` (`mailing_list_id` enum: `contra, english,
  openband, specialevents, janeaustenball, performer, member, contact_tracing`; `mailing_list_exports`
  table — id, list_id, event_id nullable FK→events, row_count, actor, created_at; index (list_id,
  created_at DESC)) in `src/server/db/migrations/`
- [X] T003 [P] Drizzle schema for `mailing_list_exports` (+ `mailing_list_id` enum) in
  `src/server/db/schema/mailingListExports.ts`; export from `src/server/db/schema/index.ts`
- [X] T004 Apply migration to dev DB and extend `resetDb` to truncate `mailing_list_exports` in
  `tests/integration/helpers/db.ts`
- [X] T005 [P] CSV serialization helpers `toCsvField` (quote on comma/quote/newline, double internal
  quotes) and `rowsToCsv` (header row + escaped rows) in `src/server/domain/exports/csv.ts` (research
  Decision 1)
- [X] T006 Export-audit helpers in `src/server/domain/exports/exportAuditService.ts`:
  `recordExportRun(db, { listId, eventId?, rowCount, actor })` (inserts one `mailing_list_exports` row
  + `writeAudit({ kind: "mailing_list.exported", ... })`) and `getLastExports(db)` (latest row per
  `list_id`, for the admin page)

**Checkpoint**: migration/schema, CSV helpers, and audit plumbing ready — both user stories below
build on this.

---

## Phase 3: User Story 1 — Export segmented email lists, one list at a time (Priority: P1) 🎯 MVP

**Goal**: An admin downloads any one of the 7 configured lists independently; each CSV contains only
consented, qualifying contacts with the correct filename and columns.

**Independent test**: Select and download a single list (e.g. contra); confirm its CSV has the exact
filename, correct columns, and correct qualifying rows, without needing to touch the other six.

### Tests first (MUST fail before implementation)

- [X] T007 [P] [US1] Unit test: `toCsvField`/`rowsToCsv` quote fields containing a comma, a quote (with
  internal quotes doubled), or a newline, and leave plain fields unquoted, in
  `tests/unit/exports.csv.test.ts`
- [X] T008 [P] [US1] Unit test: `displayName` → first/last name split (last whitespace boundary =
  last name, remainder = first name; single-word name → last name only) in
  `tests/unit/exports.nameSplit.test.ts` (FR-011)
- [X] T009 [P] [US1] Integration test: topic-list qualification for contra/english/openband/
  specialevents/janeaustenball — active email carrying the list's consent topic is included; an email
  whose only topic is "Do Not Contact" is excluded (implicit, via `effectiveConsentTopics` collapsing);
  `transition`/`inactive` emails are excluded, in `tests/integration/exports.topicLists.test.ts`
  (FR-001a/FR-002/FR-002a/FR-003)
- [X] T010 [P] [US1] Integration test: member-list qualification — a contact with `list_member = true`
  (current/lapsed/long_lapsed) qualifies, `never` does not; an active email explicitly carrying "Do Not
  Contact" is excluded even though `list_member` is true; `membership_status` column present and
  correct; also confirm a transition/inactive email is excluded even when `list_member` is true, in
  `tests/integration/exports.member.test.ts` (FR-002/FR-002a/FR-003/FR-004/SC-004)
- [X] T011 [P] [US1] Integration test: performer-list qualification — any contact referenced by a
  `performers` row qualifies regardless of `performers.contact_id` source; explicit "Do Not Contact"
  exclusion; also confirm a transition/inactive email is excluded even when the contact is a performer,
  in `tests/integration/exports.performer.test.ts` (FR-002/FR-002a/FR-003)
- [X] T012 [P] [US1] Integration test: a contact with two qualifying emails on the same list produces
  two CSV rows, never collapsed to one, in `tests/integration/exports.multiEmail.test.ts` (edge case,
  Decision 5)
- [X] T013 [P] [US1] Integration test: `GET /api/exports/:listId` returns `Content-Disposition:
  attachment; filename="<listId>.csv"` with the correct columns for a valid list, 404s
  `MAILING_LIST_NOT_FOUND` for an unknown one, and inserts one `mailing_list_exports` row on success,
  in `tests/integration/exports.download.test.ts` (FR-001/FR-009/FR-010/SC-002)
- [X] T014 [P] [US1] Integration test: `GET /api/exports` returns all 7 lists with `lastExport: null`
  before any download and populated (`actor, rowCount, createdAt`) after one; `janeaustenball`'s `note`
  reflects the most recent JAB event's year, in `tests/integration/exports.metadata.test.ts`
  (FR-005/FR-009/FR-010, Decision 6)

### Implementation

- [X] T015 [US1] Static list registry (7 entries: id → kind `topic`/`derived`, consent topic where
  applicable) in `src/server/domain/exports/mailingLists.ts`
- [X] T016 [US1] `buildListRows(db, listId)` in `src/server/domain/exports/exportService.ts` — topic-
  list query (active + matching consent topic) and derived-list queries (member: `list_member = true`
  + explicit DNC exclusion + `membership_status`; performer: `EXISTS` join to `performers` + explicit
  DNC exclusion); every row includes `email, first_name, last_name` (FR-011)
- [X] T017 [US1] Jane Austen Ball "most recent year" lookup (latest `events.event_date` whose
  `event_groups.kind = 'jane_austen_ball'`) in `src/server/domain/exports/exportService.ts`
  (Decision 6)
- [X] T018 [US1] Route handler `GET /api/exports` (7-list metadata + `lastExport` via
  `getLastExports` + JAB `note`) in `src/app/api/exports/route.ts`
- [X] T019 [US1] Route handler `GET /api/exports/[listId]` — validate `listId` (`listIdSchema`), build
  rows, stream CSV with the exact filename, call `recordExportRun` — in
  `src/app/api/exports/[listId]/route.ts`; also add `MAILING_LIST_NOT_FOUND` to the `ApiErrorCode`
  union and `errors` object in `src/server/lib/apiError.ts` (new code — `EVENT_NOT_FOUND` already
  exists there for T029)
- [X] T020 [US1] Admin exports page — table of the 7 lists with last-exported info and a per-list
  download link (`<a href="/api/exports/:listId" download>`) in `src/app/(admin)/exports/page.tsx`

**Checkpoint**: US1 independently testable — every list downloadable on its own with correct
qualification, filename, and audit trail.

---

## Phase 4: User Story 2 — Membership "through" year at export time (Priority: P2)

**Goal**: member.csv carries a `membership_through_year` column derived from membership expiry,
computed live and never persisted.

**Independent test**: Run the member export; confirm `membership_through_year` is present and correct
for each row, and that no such column exists anywhere in the database.

### Tests first (MUST fail before implementation)

- [X] T021 [P] [US2] Unit test: through-year derivation returns the calendar year of the given expiry
  date (and `null` when no expiry is given) in `tests/unit/exports.throughYear.test.ts` (FR-007)
- [X] T022 [P] [US2] Integration test: member.csv rows include `membership_through_year` equal to the
  year of `max(memberships.expiry_date)` for that contact; confirm the value differs correctly across
  contacts with different expiry dates, in `tests/integration/exports.throughYear.test.ts`
  (FR-007/SC-003)

### Implementation

- [X] T023 [US2] Through-year pure function (`expiryDate: string | null → number | null`) in
  `src/server/domain/exports/throughYear.ts`
- [X] T024 [US2] Wire `membership_through_year` into the member-list branch of `buildListRows` — join
  `memberships`, take `max(expiry_date)` per contact, apply T023 — in
  `src/server/domain/exports/exportService.ts`

**Checkpoint**: US2 independently testable — member.csv carries the through-year column; nothing new
persisted.

---

## Phase 5: User Story 3 — Contact-tracing export for a specific dance (Priority: P2)

**Goal**: An admin picks a not-yet-purged event from a dropdown and downloads a CSV of that event's
attendees who have a `contact_tracing`-consented email, with a `date` column; a selectable event with
zero recorded attendees shows a count message instead of producing a file.

**Independent test**: Record attendance for an event including one attendee with a
`contact_tracing`-consented email and one with "Do Not Contact"; the export returns only the consented
attendee with the correct `date`. A purged event never appears in the dropdown. A selectable
zero-attendee event returns a count, not a file.

### Tests first (MUST fail before implementation)

- [X] T025 [P] [US3] Integration test: contact-tracing qualification — an attendee with an active email
  carrying `contact_tracing` is included; an attendee whose only email carries "Do Not Contact" is
  excluded (implicit); a transition/inactive attendee email is excluded even when it carries
  `contact_tracing`; an unmatched attendance row and an attendee with no email produce no row; every
  row's `date` equals the event's `event_date`; also confirm `first_name`/`last_name` are present and
  correctly derived on contact-tracing rows (same heuristic as the 7 lists, FR-011), in
  `tests/integration/exports.contactTracing.test.ts` (FR-006/FR-006a/FR-002a/FR-003/FR-011/SC-005)
- [X] T026 [P] [US3] Integration test: `GET /api/events?from=<today − 90 days>` excludes an event whose
  attendance is already purged (created >90 days ago), confirming the existing feature-002 `from`
  filter is sufficient for the purge-aware dropdown (note: the "today − 90 days" cutoff is computed
  client-side in local time when building the dropdown query — acceptable given this app's
  single-club, non-distributed scale; not separately unit-tested), in
  `tests/integration/exports.contactTracingDropdown.test.ts` (FR-006b)
- [X] T027 [P] [US3] Integration test: `GET /api/exports/contact-tracing?eventId=` returns `{ count: 0
  }` (not a CSV) for a selectable event with zero recorded attendance and writes no
  `mailing_list_exports` row; returns 404 `EVENT_NOT_FOUND` for an unknown `eventId`; additionally
  confirm no table anywhere persists the exported rows' email/name/date — only `row_count` is stored
  in `mailing_list_exports`, in `tests/integration/exports.contactTracingZero.test.ts`
  (FR-006c/SC-003)

### Implementation

- [X] T028 [US3] `buildContactTracingRows(db, eventId)` in
  `src/server/domain/exports/contactTracingService.ts` — raw attendance count via
  `listEventAttendance` (feature 002) short-circuits to `{ count: 0 }` before any row-building; else
  joins `attendance` → `contacts` → `contact_emails` (active + `contact_tracing` ∈ consent_topics) and
  attaches the event's `date` to every row
- [X] T029 [US3] Route handler `GET /api/exports/contact-tracing` — validate `eventId`
  (`eventIdSchema`), call T028; if count is 0 return `{ count: 0 }` JSON (no audit write); else stream
  the CSV (`contact_tracing_<event_date>.csv`) and call `recordExportRun` — in
  `src/app/api/exports/contact-tracing/route.ts`
- [X] T030 [US3] Admin exports page — contact-tracing section: event dropdown sourced from
  `GET /api/events?from=<today − 90 days>`, a download action that fetches the export endpoint and
  either triggers a file download (CSV response) or shows "N attendees recorded" (JSON `{count}`
  response), in `src/app/(admin)/exports/page.tsx`

**Checkpoint**: US3 independently testable — contact-tracing export correct, purge-aware, and
zero-count-aware.

---

## Phase 6: Polish & Cross-Cutting

- [X] T031 [P] Update the dev route index `src/app/dev/routes/page.tsx` with the new routes (UI
  `/exports`; API `/api/exports`, `/api/exports/[listId]`, `/api/exports/contact-tracing`) per the
  temporary convention (CLAUDE.md)
- [X] T032 [P] Seed sample contacts/emails covering each consent topic, plus a `jane_austen_ball`
  event group, in `src/server/db/seed.ts` (aids manual testing per quickstart.md)
- [X] T033 [P] Verify all [quickstart.md](quickstart.md) scenarios end-to-end
- [X] T034 [P] Constitution compliance pass: strict types, no undocumented `any`/`as`, structured
  logging (`withLogging`) on all three routes, real-Postgres integration tests throughout

---

## Dependencies & Execution Order

- **Setup (T001)** → **Foundational (T002–T006)** → user stories.
- **US1 (P1)** depends on Foundational (schema, CSV helpers, audit service) → **MVP**.
- **US2 (P2)** extends US1's member-list branch (`buildListRows`) — build after US1.
- **US3 (P2)**: its service/route tasks (T028/T029) are independent of US1/US2's list logic and depend
  only on Foundational. Its UI task (T030) additionally depends on US1's T020, since it extends the
  same `page.tsx` file rather than creating a new one.
- Within a story: tests first (must fail) → domain logic → routes → UI.

## Parallel Opportunities

- Foundational: T003 (schema) and T005 (CSV helpers) touch different files and can proceed together
  once T002 (migration) is authored; T006 depends on T003.
- US1's test tasks T007–T014 are all different files and can be written in parallel before any US1
  implementation task.
- US2 and US3 can be implemented in parallel by different people once US1 and Foundational are done —
  they touch different files except for the shared `page.tsx` (US1 creates it, US3 extends it; US2
  doesn't touch the UI at all).

## Implementation Strategy

1. **MVP = US1** (all 7 lists downloadable, correctly qualified) on top of Foundational.
2. Add **US2** (member.csv through-year column).
3. Add **US3** (contact-tracing export, purge-aware dropdown, zero-count handling).
4. Polish: dev-route index, seed data, quickstart verification, constitution pass.

## Format validation

All tasks use `- [ ] T### [P?] [US#?] description + file path`. Setup/Foundational/Polish carry no
story label; US phases carry `[US1]/[US2]/[US3]`. 34 tasks total.
