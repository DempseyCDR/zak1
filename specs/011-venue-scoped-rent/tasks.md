# Tasks: Venue-Scoped Rent with Per-Event Override

**Feature**: `011-venue-scoped-rent` | **Plan**: [plan.md](plan.md) | **Spec**: [spec.md](spec.md)

**Stack**: TypeScript / Next.js (App Router) + PostgreSQL 16, Drizzle, Zod, pino, Vitest. Reshapes
feature 009 (rent leaves `series_parameters`), feature 005 (report rent/ongoing sourcing), feature 007
(`venues`, event PATCH). One migration `0016_venue_rent_and_multi_ongoing.sql` (0015 is latest).

**Test-First is NON-NEGOTIABLE** (constitution Principle I): resolvers and the migration freeze are
integration-tested against real `zak1_test` (no mocking). Existing tests that seed rent via
`series_parameters` (`organizer.report`, `seriesParameters.historicalIntegrity`,
`expenseParameters.auditParity`) are updated to the reshaped model, not left incidentally green.

**Conventions**: `[P]` = parallelizable (different files, no incomplete deps). Story labels `[US1]`,
`[US2]`, `[US3]`. Paths repo-relative.

---

## Phase 1: Setup

_No setup tasks — reshape of an existing project. Work begins at Foundational._

---

## Phase 2: Foundational (blocking prerequisites)

The migration, schema, resolvers, and report swap are shared by all three stories and must land first.

- [X] T001 Author migration `0016_venue_rent_and_multi_ongoing.sql` in `src/server/db/migrations/` with a
  header comment: **(1)** `CREATE TABLE venue_rents (id, venue_id NOT NULL FK→venues cascade, series_id
  NULL FK→series cascade, amount_cents, effective_date, created_at)` + index `(venue_id, series_id,
  effective_date DESC)`; **(2)** `CREATE TABLE venue_rent_audit` (venue_id, series_id nullable,
  amount_cents, effective_date, actor, created_at); **(3)** `ALTER TABLE events ADD COLUMN rent_cents
  integer` (nullable); **(4)** freeze backfill — `UPDATE events e SET rent_cents = COALESCE((SELECT
  sp.amount_cents FROM series_parameters sp WHERE sp.category='expense' AND sp.kind='rent' AND
  sp.series_id=e.series_id AND sp.effective_date<=e.event_date ORDER BY sp.effective_date DESC LIMIT 1),
  0)`; **(5)** `DELETE FROM series_parameters WHERE category='expense' AND kind='rent'` (keep the `rent`
  enum value for historical audit rows — research Decision 5) (per [data-model.md](data-model.md))
- [X] T002 [P] New Drizzle schema `src/server/db/schema/venueRents.ts` (`venueRents`, `venueRentAudit`
  tables + `VenueRentRow`/`VenueRentAuditRow` types); add `rentCents: integer("rent_cents")` (nullable)
  to `eventGroups`'s neighbor `events` in `src/server/db/schema/events.ts`; export the new module from
  `src/server/db/schema/index.ts`
- [X] T003 New `src/server/domain/parameters/rentService.ts`: `resolveEventRentCents(db, event)` —
  per-event `rent_cents` ?? latest `venue_rents(venue_id, series_id=event.seriesId)` ≤ date ?? latest
  `venue_rents(venue_id, series_id IS NULL)` ≤ date ?? 0; and `createVenueRent(db, input, actor)` (insert
  `venue_rents` + `venue_rent_audit` + `writeAudit`). Depends on T002.
- [X] T004 [P] Update `src/server/domain/parameters/seriesParameterService.ts`: add
  `resolveOngoingTotalCents(db, seriesId, onDate)` — `SUM` over `DISTINCT ON (label)` latest `ongoing`
  amount ≤ onDate; narrow `createExpenseParameter` to `kind: "ongoing"` only with a required `label`
- [X] T005 Update `src/server/domain/organizer/reportService.ts`: replace the rent
  `resolveParameterCents(...)` call with `resolveEventRentCents(db, ev)` and the ongoing call with
  `resolveOngoingTotalCents(db, ev.seriesId, ev.eventDate)`. Depends on T003 + T004.
- [X] T006 [P] Validation: new `src/server/validation/venueRents.ts`
  (`venueRentCreateSchema`: venueId uuid, seriesKey optional, amount ≥ 0, effectiveDate YYYY-MM-DD);
  `src/server/validation/organizer.ts` — `expenseParameterCreateSchema.kind` → `z.literal("ongoing")`,
  `label` required (`z.string().trim().min(1)`); `src/server/validation/venues.ts` — extend the event
  PATCH schema (`assignVenueSchema`) to also accept `rentCents: z.number().int().min(0).nullable().optional()`
- [X] T007 Apply migration `0016` to dev + test DBs; add `venue_rents, venue_rent_audit` to the
  `TRUNCATE` list in `tests/integration/helpers/db.ts` `resetDb`; update the `seedRent` helper in
  `tests/integration/organizer.report.test.ts` to seed rent via `events.rent_cents` (or `venue_rents`)
  instead of a `series_parameters` expense/rent row. Depends on T001 (+ T002/T004 for the new paths).

**Checkpoint**: reshape compiles; the report resolves rent from `events`/`venue_rents` and ongoing as a
labeled sum; pre-existing behavior (pay, misc, Dance Net) passes again — regression-safety gate.

---

## Phase 3: User Story 1 — Venue-scoped rent with per-event override (Priority: P1) 🎯 MVP

**Goal**: Rent resolves per-event → series-at-venue → venue default → 0, set through a venue-rent admin
and a per-event override on the event.

**Independent test**: Set a venue default and a series-at-venue rent; confirm events resolve them; set a
per-event override and confirm only that event changes; clear it and confirm fallback.

### Tests first (MUST fail before implementation)

- [X] T008 [P] [US1] Integration test — full precedence: with venue default, series-at-venue, and
  per-event rent all set, an event resolves the per-event value; clearing it falls to series-at-venue;
  clearing that falls to venue default; a venue with no rent resolves 0, in
  `tests/integration/venueRent.precedence.test.ts` (FR-001..FR-005, SC-001, SC-002)
- [X] T009 [P] [US1] Integration test — a no-venue event uses a directly-entered per-event rent (else 0),
  and a series-at-venue rate at venue A does not affect that series' events at venue B, in
  `tests/integration/venueRent.scoping.test.ts` (FR-002, FR-004, SC-003)
- [X] T010 [P] [US1] Integration test — `POST /api/venue-rents` writes a `venue_rent_audit` row with
  `actor`, in `tests/integration/venueRent.audit.test.ts` (FR-012, Constitution IV)

### Implementation

- [X] T011 [US1] New route `src/app/api/venue-rents/route.ts`: `GET` (list rows by `?venueId=`) and `POST`
  (create via `venueRentCreateSchema` → `createVenueRent`, 404 on unknown venue/series). Depends on
  T003 + T006.
- [X] T012 [US1] Extend the event PATCH end-to-end: `src/server/domain/venues/venueService.ts` (set/clear
  `events.rent_cents` alongside `venue_id`) and `src/app/api/events/[id]/route.ts` (handle the widened
  schema from T006). Depends on T006.
- [X] T013 [P] [US1] New admin page `src/app/(admin)/venue-rents/page.tsx` — pick a venue, set an
  effective-dated **default** rent and per-**series** rents, list existing rows (calls
  `/api/venue-rents`)
- [X] T014 [P] [US1] Events admin — add an optional per-event **rent override** field (set/clear via
  `PATCH /api/events/[id]` with `rentCents`) in `src/app/(admin)/events/page.tsx`
- [X] T015 [US1] Update the dev route index `src/app/dev/routes/page.tsx` — add the `/venue-rents` UI row
  and the `/api/venue-rents` endpoint (per CLAUDE.md route-index rule)

**Checkpoint**: US1 independently testable — rent varies by venue with per-event override and clean
fallback.

---

## Phase 4: User Story 2 — Existing Dance Net unchanged by the re-scoping (Priority: P1)

**Goal**: The migration freeze preserves every existing event's rent and Dance Net; superseding a rent
layer never rewrites an already-resolved figure.

**Independent test**: An event carrying a frozen `rent_cents` reports that exact rent; adding a later
venue rent does not change it.

### Tests first

- [X] T016 [P] [US2] Integration test — an event's `rent_cents` (the freeze target) is honored by the
  organizer report and subtracted in Dance Net; adding a later-effective `venue_rents` row does not change
  an event that has a per-event rent, in `tests/integration/venueRent.report.test.ts` (FR-006, FR-007,
  SC-004, SC-006)
- [X] T017 [US2] Update `tests/integration/seriesParameters.historicalIntegrity.test.ts` — rent history
  now lives in `venue_rents`/`events`, not `series_parameters`; assert that superseding a venue rent (or
  setting a per-event override) leaves already-resolved past events unchanged (FR-012)

**Checkpoint**: US2 independently testable — freeze holds, history immutable. (The freeze itself is the
Foundational migration T001; this story is the proof + the migrated test updates. The full historical
before/after check runs against real dev data in Polish T022.)

---

## Phase 5: User Story 3 — Multiple concurrent ongoing charges (Priority: P2)

**Goal**: A series can carry several labeled ongoing charges at once; Dance Net sums those in effect;
each ends independently by a $0 entry.

**Independent test**: Set two ongoing charges; confirm their sum in Dance Net; end one with $0 and confirm
only it drops after its date.

### Tests first

- [X] T018 [P] [US3] Integration test — two labeled ongoing charges on a series sum into Dance Net; a $0
  entry for one label drops only that charge for events on/after its date while earlier events keep both
  and the other charge is unaffected, in `tests/integration/ongoing.multiCharge.test.ts` (FR-008, FR-009,
  SC-005)
- [X] T019 [P] [US3] Update `tests/integration/expenseParameters.auditParity.test.ts` — `POST
  /api/expense-parameters` is ongoing-only with a **required** label and writes a `series_parameter_audit`
  row (FR-010); remove the rent case
- [X] T020 [US3] Expense-parameters surface: `src/app/(admin)/expense-parameters/page.tsx` becomes
  ongoing-only (remove rent controls; add/list multiple labeled charges + resolved sum) and
  `src/app/api/expense-parameters/route.ts` GET narrows `kind` to `ongoing` and reports the labeled sum
  (`resolveOngoingTotalCents`). Depends on T004.

**Checkpoint**: US3 independently testable — concurrent ongoing charges sum and end independently.

---

## Phase 6: Polish & Cross-Cutting

- [X] T021 [P] Update `src/server/db/seed.ts` — seed a venue **default** rent and one **series-at-venue**
  rent for the seed venue; keep the "Supplies/insurance" ongoing charge (label required) and add a second
  demo ongoing charge (e.g. "Equipment loan"); stop seeding rent via `series_parameters` expense/rent;
  add `venue_rents`/`venue_rent_audit` to the seed TRUNCATE list
- [X] T022 [P] Verify all [quickstart.md](quickstart.md) scenarios end-to-end, including the **manual
  migration-freeze** check: on real dev data record each event's resolved rent + Dance Net, run `0016`,
  and confirm byte-identical results (FR-007 / SC-004)
- [X] T023 [P] Constitution compliance pass: strict types with no undocumented `any`/`as`, real-Postgres
  integration tests throughout, `no-console` lint clean on changed files; confirm the dev route index was
  updated (T015)

---

## Dependencies & Execution Order

- **Foundational (T001–T007)** before all stories. Within it: T001 (migration) → T007 (apply + test
  seams); T002 (schema) → T003 (rent resolver); T004 (ongoing resolver) [P] with T002/T003; T005
  (report) depends on T003 + T004; T006 (validation) [P].
- **US1 (P1)**: tests T008–T010 → impl T011 (needs T003 + T006), T012 (needs T006); T013/T014 UI [P];
  T015 dev routes.
- **US2 (P1)**: T016 depends on Foundational; T017 updates an existing test.
- **US3 (P2)**: T018 depends on Foundational; T019 updates an existing test; T020 needs T004 + T006.
- **Polish (T021–T023)** after the stories it verifies.

## Parallel Opportunities

- Foundational: T002, T004, T006 are different files and parallelizable; T003/T005/T007 have the deps
  noted above.
- After Foundational, the three stories are independent: US1 (T008–T015), US2 (T016–T017), US3
  (T018–T020) touch mostly different files and can proceed in parallel (US1's T013/T014 and US3's T020
  are different admin pages).
- Polish T021/T022/T023 are independent.

## Implementation Strategy

1. **Foundational is the core of the risk** — the migration freeze (T001/T007) and the two resolvers
   (T003/T004) plus the report swap (T005). Get these green first.
2. **MVP = Foundational + US1** — venue-scoped rent with per-event override, the headline capability.
3. Add **US2** — proves the freeze and history immutability (mostly test coverage over the Foundational
   migration).
4. Add **US3** — multiple concurrent ongoing charges.
5. Polish: seed data, full quickstart incl. the manual freeze check, constitution pass.

## Format validation

All tasks use `- [X] T### [P?] [US#?] description + file path`. Setup/Foundational/Polish carry no story
label; US phases carry `[US1]`/`[US2]`/`[US3]`. 23 tasks total.
