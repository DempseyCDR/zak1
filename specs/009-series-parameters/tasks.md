# Tasks: Series-Scoped Rate & Expense Parameters

**Feature**: `009-series-parameters` | **Plan**: [plan.md](plan.md) | **Spec**: [spec.md](spec.md)

**Stack**: TypeScript / Next.js (App Router) + PostgreSQL 16, Drizzle, Zod, pino, Vitest. Consolidates
feature 003 (`rate_parameters`, `rate_parameter_audit`) with feature 005
(`series_expense_parameters`) into one `series_parameters` + `series_parameter_audit` pair; retrofits
`performerRules.ts` with a `musician` rate kind; prerequisite for feature 008.

**Test-First is NON-NEGOTIABLE** (constitution Principle I): the resolver is DB-backed and
integration-tested against real `zak1_test` (no unit tests, matching today's
`resolveRateCents`/`resolveExpenseCents` pattern). Every existing test touching the old
tables/functions is updated in Foundational so regressions are caught immediately, not incidentally.

**Conventions**: `[P]` = parallelizable (different files, no incomplete deps). Story labels `[US1]`,
`[US2]`, `[US3]`, `[US4]`. Paths repo-relative.

---

## Phase 1: Setup

- [X] T001 [P] Extend `rateParameterCreateSchema` — add required `seriesKey: z.string().min(1)` and
  widen `kind` to `z.enum(["caller", "sound_tech", "musician"])` — in
  `src/server/validation/performers.ts`

---

## Phase 2: Foundational (blocking prerequisites)

- [X] T002 Author migration `0012_series_parameters.sql` in `src/server/db/migrations/`:
  `parameter_category` (`rate`|`expense`) and `parameter_kind`
  (`caller`|`sound_tech`|`musician`|`rent`|`ongoing`) enums; `series_parameters` table (id, category,
  kind, series_id NOT NULL FK→series CASCADE, amount_cents, label nullable, effective_date,
  created_at) + index (series_id, category, kind, effective_date DESC); `series_parameter_audit`
  table (id, category, kind, series_id **nullable** FK→series SET NULL, amount_cents, label,
  effective_date, actor, created_at); seed `general` series (`ON CONFLICT (key) DO NOTHING`);
  backfill `rate_parameters` **cross-joined against every series row** into `series_parameters`
  (category='rate'); backfill `series_expense_parameters` 1:1 (category='expense'); backfill
  `rate_parameter_audit` 1:1 into `series_parameter_audit` with `series_id = NULL` (category='rate');
  drop `rate_parameters`, `rate_parameter_audit`, `series_expense_parameters` tables and
  `rate_kind`, `series_expense_kind` enums
- [X] T003 [P] New Drizzle schema `src/server/db/schema/seriesParameters.ts`
  (`parameterCategoryEnum`, `parameterKindEnum`, `seriesParameters` table, `seriesParameterAudit`
  table, `ParameterCategory`/`ParameterKind`/`SeriesParameterRow`/`SeriesParameterAuditRow` types);
  delete `src/server/db/schema/rates.ts` and `src/server/db/schema/seriesExpenseParameters.ts`;
  remove `rateKindEnum`/`RateKind` from `src/server/db/schema/enums.ts`; update
  `src/server/db/schema/index.ts` barrel (swap the two old exports for the new one)
- [X] T004 New shared service `src/server/domain/parameters/seriesParameterService.ts`:
  `resolveParameterCents(db, { category, kind, seriesId, onDate })` (greatest effective_date ≤
  onDate; 0 if none — identical rule for every category/kind); `createRateParameter(db, input,
  actor)` and `createExpenseParameter(db, input, actor)` (both insert into `series_parameters` +
  `series_parameter_audit` + `writeAudit`); delete `src/server/domain/bookings/resolveRate.ts` and
  `src/server/domain/organizer/expenseParameterService.ts`
- [X] T005 Update `src/server/domain/bookings/bookingService.ts` — the
  `else if (rule.rateKind)` branch now calls `resolveParameterCents(db, { category: "rate", kind:
  rule.rateKind, seriesId: event.seriesId, onDate: event.eventDate })` (import from the new service;
  `event.seriesId` is already loaded for the Sound Tech gate check just above)
- [X] T006 Update `src/server/domain/organizer/reportService.ts` — the `rent`/`ongoing` resolution
  calls become `resolveParameterCents(db, { category: "expense", kind: "rent"|"ongoing", seriesId:
  ev.seriesId, onDate: ev.eventDate })` (import from the new service)
- [X] T007 [P] Update `src/server/domain/performers/performerRules.ts` — `lead_musician` and
  `musician` entries gain `rateKind: "musician"` (currently `null` for both); widen the
  `PerformerRule.rateKind` inline type union to include `"musician"`
- [X] T008 Update route handlers: `src/app/api/rate-parameters/route.ts` — POST now requires
  `seriesKey` (schema already enforces it via T001), GET adds `?seriesKey=` and mirrors
  `expense-parameters`'s response shape exactly; `src/app/api/expense-parameters/route.ts` — update
  the import path to the new service (T004), no shape change
- [X] T009 Apply migration `0012` to the dev DB; extend `resetDb` in
  `tests/integration/helpers/db.ts` to `TRUNCATE series_parameters, series_parameter_audit` in place
  of `series_expense_parameters` (and drop the now-nonexistent `rate_parameter_audit`,
  `rate_parameters` names if present in that list)
- [X] T010 [P] Update `tests/integration/rates.resolve.test.ts` — insert into `series_parameters`
  with an explicit `series_id`; call `resolveParameterCents(db, { category: "rate", kind: "caller",
  seriesId, onDate })` instead of the deleted `resolveRateCents`. Depends on T004 + T009.
- [X] T011 [P] Update `tests/integration/rates.audit.test.ts` — `POST /api/rate-parameters` body
  includes `seriesKey`; assert against `series_parameters`/`series_parameter_audit` (with
  `category: "rate"`) instead of the deleted `rate_parameters`/`rate_parameter_audit`. Depends on
  T001 + T004 + T008 + T009 (exercises the route, so needs the schema and route changes, not just
  the service).
- [X] T012 [P] Update `tests/integration/rates.booking-default.test.ts` — insert `series_parameters`
  rows scoped to the booked event's `seriesId` (category='rate') instead of the deleted
  `rate_parameters`. Depends on T004 + T005 + T009 (exercises booking creation, so needs
  `bookingService.ts` wired to the new resolver, not just the service existing).
- [X] T013 [P] Update `tests/integration/organizer.report.test.ts`'s `seedRent` helper — insert into
  `series_parameters` (category='expense') instead of the deleted `seriesExpenseParameters`.
  Depends on T004 + T006 + T009 (exercises report generation, so needs `reportService.ts` wired).

**Checkpoint**: consolidation compiles; every pre-existing behavior (Caller/Sound Tech rate
resolution, Rent/Ongoing resolution, booking defaults, Organizer Report figures) passes again under
the new shared model — this is the regression-safety gate before any new-capability work below.

---

## Phase 3: User Story 1 — Set a standard performer pay rate per series (Priority: P1) 🎯 MVP

**Goal**: A Caller/Sound Tech rate set for one series has no effect on any other series — rates
genuinely vary by series instead of being one uniform figure.

**Independent test**: Set different Caller rates for two series (same effective date); book a Caller
on an event in each and confirm each resolves its own series' rate.

### Tests first (MUST fail before implementation, or already covered by Foundational)

- [X] T014 [P] [US1] Integration test: a Caller rate set for series A does not change series B's
  resolved rate — each resolves independently via `resolveParameterCents`, in
  `tests/integration/seriesParameters.isolation.test.ts` (FR-002/FR-003, SC-001)
- [X] T015 [P] [US1] Integration test: `POST /api/rate-parameters` 404s `SERIES_NOT_FOUND` for an
  unknown `seriesKey`; `GET /api/rate-parameters?seriesKey=&kind=&on=` resolves the right amount for
  the right series, in `tests/integration/rateParameters.seriesScoped.test.ts` (FR-002, contracts)

### Implementation

- [X] T016 [US1] Admin UI — add a series `<select>` to `src/app/(admin)/rate-parameters/page.tsx`
  (populated from `GET /api/series`, mirroring `expense-parameters/page.tsx`'s existing pattern),
  required before submit; add the "currently in effect" resolved-preview section (same pattern as
  `expense-parameters/page.tsx`)

**Checkpoint**: US1 independently testable — rates genuinely vary by series, with UI support.

---

## Phase 4: User Story 2 — Existing series expense parameters keep working (Priority: P1)

**Goal**: Rent/Ongoing behavior and Organizer Report figures are unchanged from the organizer's
perspective; expense parameter changes gain the same durable audit trail rate changes already have;
superseding a parameter never rewrites history already recorded on past bookings/reports.

**Independent test**: Generate an Organizer Report for a series with Rent/Ongoing set; confirm
figures match pre-consolidation values (covered by T013/T006). Create an expense parameter and
confirm it now writes an audit row. Supersede a rate after booking a performer under it and confirm
the existing booking's pay is untouched.

### Tests first

- [X] T017 [P] [US2] Integration test: `POST /api/expense-parameters` writes a
  `series_parameter_audit` row (`category: "expense"`) with `actor` populated — parity with rate
  parameters, which expense never had before — in
  `tests/integration/expenseParameters.auditParity.test.ts` (FR-008, SC-005)
- [X] T018 [P] [US2] Integration test: book a performer under a rate effective on the event date;
  supersede that series/kind's rate with a new entry effective *after* the booking's event date;
  confirm the already-created booking's `payCents` is unchanged. Repeat the same check for an
  Organizer Report's resolved rent/ongoing figures after superseding an expense parameter, in
  `tests/integration/seriesParameters.historicalIntegrity.test.ts` (FR-010)

**Checkpoint**: US2 independently testable — no behavior regression, expense now has audit parity,
and superseding a parameter is proven not to rewrite history. (No implementation tasks: the
audit-writing behavior was already delivered by T004, and historical-integrity is a property of the
existing `bookings`/report model, not new code — this story is regression-safety + audit-parity +
historical-integrity test coverage.)

---

## Phase 5: User Story 3 — Set a standard Musician rate per series (Priority: P2)

**Goal**: Musician and Lead Musician bookings default pay from a series-scoped standard rate when
one exists, closing today's gap where neither role has any standard rate at all.

**Independent test**: With no Musician rate set for a series, a Musician booking defaults to
$0/manual entry. Set a rate for that series; a new Musician (or Lead Musician) booking defaults to
it, overridable.

### Tests first

- [X] T019 [P] [US3] Integration test: booking a Musician and separately a Lead Musician with no
  standard rate set for the series defaults to $0; with a series-scoped Musician rate set, both
  default to that rate and both remain individually overridable, in
  `tests/integration/musicianRate.booking.test.ts` (FR-006, SC-003)

### Implementation

- [X] T020 [US3] Admin UI — add `"Musician"` to the kind `<select>` in
  `src/app/(admin)/rate-parameters/page.tsx` (depends on T016 — same file)

**Checkpoint**: US3 independently testable — Musician rate resolves for both roles; feature 008
unblocked.

---

## Phase 6: User Story 4 — A "general" series covers joint or cross-series events (Priority: P3)

**Goal**: An event that doesn't belong to one specific standing series can still resolve a sensible
rate/expense via the `general` series, with no automatic fallback to or from any other series.

**Independent test**: Assign an event to `general`; set a rate scoped to `general` and confirm that
event resolves it. Confirm a rate set for a standing series does not leak into `general`.

### Tests first

- [X] T021 [P] [US4] Integration test: the `general` series exists after migration (seeded by T002);
  an event assigned to `general` resolves a rate scoped to `general`; a rate set for a different
  series does **not** apply to a `general`-series event (no automatic fallback), in
  `tests/integration/generalSeries.test.ts` (FR-004, edge case)

**Checkpoint**: US4 independently testable — joint events have a home without inventing fallback
semantics. (No implementation tasks: `general` is seeded in Foundational T002; this story is test
coverage proving the no-fallback design holds.)

---

## Phase 7: Polish & Cross-Cutting

- [X] T022 [P] Update `src/server/db/seed.ts` — seed sample Caller/Sound Tech/Musician rates per
  series (mirroring the existing per-series expense-parameter seeding loop already in that file);
  include the `general` series in the seeded series list; update its TRUNCATE list the same way as
  T009
- [X] T023 [P] Verify all [quickstart.md](quickstart.md) scenarios end-to-end, **including the
  manual migration-safety scenario**: record pre-migration resolved Caller/Sound Tech rates per
  series against the real (already-populated) dev DB, run migration `0012`, re-resolve, confirm
  byte-identical results
- [X] T024 [P] Constitution compliance pass: strict types, no undocumented `any`/`as`, real-Postgres
  integration tests throughout, `no-console` lint rule still passes for all new/changed files

---

## Dependencies & Execution Order

- **Setup (T001)** → **Foundational (T002–T013)** → user stories.
- **US1 (P1)** and **US2 (P1)** both depend only on Foundational and can proceed in parallel — the
  MVP is Foundational + both P1 stories.
- **US3 (P2)** depends on Foundational for its test (T019); its UI task (T020) additionally depends
  on **US1's T016** (same file, adds to the series-selector form).
- **US4 (P3)** depends only on Foundational (the `general` series is seeded there, T002).
- Within Foundational: T002 (migration) → T003 (schema mirrors it) → T004 (service depends on
  schema) → T005/T006/T008 (call-site updates depend on T004) and T007 (independent); T009 depends
  on T002 (needs the migration to exist to apply it). T010–T013 all depend on T004 + T009, but not
  uniformly beyond that: T010 needs only those two; T011 additionally depends on T001 + T008 (it
  exercises the route); T012 additionally depends on T005 (it exercises booking creation); T013
  additionally depends on T006 (it exercises report generation).

## Parallel Opportunities

- Foundational: T003 and T007 can proceed in parallel with each other (different files). Among
  T010–T013, T010 can start as soon as T004+T009 land; T011 additionally needs T001+T008; T012
  additionally needs T005; T013 additionally needs T006 — once each task's specific prerequisites are
  met, the four are independent files and can proceed in parallel.
- Once Foundational is done, US1 (T014–T016), US2 (T017–T018), and US4 (T021) can all proceed in
  parallel — they touch different files (US1 also touches `rate-parameters/page.tsx`, which US3
  later extends).
- US3's test (T019) can start in parallel with US1/US2/US4; only its UI task (T020) must wait for
  US1's T016.

## Implementation Strategy

1. **Foundational is the bulk of the real work** here — this feature consolidates two already-shipped
   entities, so most of the risk and effort is in T002–T013, not in the story phases.
2. **MVP = Foundational + US1 + US2** — series-scoped rates work, nothing regresses, and history is
   provably immutable under superseding.
3. Add **US3** (Musician rate) — unblocks feature 008.
4. Add **US4** (`general` series) — smallest, lowest-priority increment.
5. Polish: seed data, full quickstart verification (including the manual dev-DB migration-safety
   check), constitution pass.

## Format validation

All tasks use `- [ ] T### [P?] [US#?] description + file path`. Setup/Foundational/Polish carry no
story label; US phases carry `[US1]/[US2]/[US3]/[US4]`. 24 tasks total.
