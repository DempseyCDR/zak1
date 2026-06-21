# Tasks: Performers & Bookings

**Feature**: `003-performers-bookings` | **Plan**: [plan.md](plan.md) | **Spec**: [spec.md](spec.md)

**Stack**: TypeScript / Next.js (App Router) + PostgreSQL 16, Drizzle, Zod, pino, Vitest. Extends the
existing project; reuses feature 002 `events`/`series`, feature 001 `contacts`, and shared
`money`/`logger`/`audit`/`withLogging`/`parseBody`. Pay is integer cents.

**Test-First is NON-NEGOTIABLE** (constitution Principle I): test tasks are written first and MUST
fail before implementation. Integration tests run against the real `zak1_test` database — no DB mocking.

**Conventions**: `[P]` = parallelizable (different files, no incomplete deps). Story labels `[US1]`,
`[US2]`, `[US3]`. Paths repo-relative.

---

## Phase 1: Setup

- [ ] T001 [P] Add enums (`performer_type`, `rate_kind`) to `src/server/db/schema/enums.ts`

---

## Phase 2: Foundational (blocking prerequisites)

- [ ] T002 Author migration `0005_performers.sql` (performers, rate_parameters, bookings, rate_parameter_audit) in `src/server/db/migrations/`
- [ ] T003 [P] Drizzle schema for `performers` in `src/server/db/schema/performers.ts`
- [ ] T004 [P] Drizzle schema for `rate_parameters` + `rate_parameter_audit` in `src/server/db/schema/rates.ts`
- [ ] T005 [P] Drizzle schema for `bookings` in `src/server/db/schema/bookings.ts`; export all from `src/server/db/schema/index.ts`
- [ ] T006 Apply migration to dev DB and extend `resetDb` to truncate the new tables in `tests/integration/helpers/db.ts`
- [ ] T007 [P] Performer-type rule table (`paid`, `requiresCheck`, `publicDisplay`) in `src/server/domain/performers/performerRules.ts`
- [ ] T008 [P] Effective-dated rate resolver (greatest effective_date ≤ event date for a kind) in `src/server/domain/bookings/resolveRate.ts`
- [ ] T009 [P] Zod schemas for performer, rate-parameter, and booking inputs in `src/server/validation/performers.ts`
- [ ] T010 Performer service (create/get/patch; appearance history + YTD earnings reads) in `src/server/domain/performers/performerService.ts`
- [ ] T011 [P] Route handlers `POST/GET /api/performers`, `GET/PATCH /api/performers/:id` in `src/app/api/performers/`

**Checkpoint**: performers exist; rule table + rate resolver available for bookings.

---

## Phase 3: User Story 1 — Book performers for an event (Priority: P1)

**Goal**: Book each performer type onto an event with correct paid/check/public rules; block Sound
Tech on Community Dance; force Instructor/Open Band to free/no-check; compute per-event performer total.

**Independent test**: Book one of each type to an event and confirm paid/check/public behavior, the
Community-Dance Sound-Tech block, and that performerTotal equals the drill-down sum.

### Tests first (MUST fail before implementation)

- [ ] T012 [P] [US1] Unit test: performer rule table — paid/requiresCheck/publicDisplay per type, and `requires_check = rule.requiresCheck AND pay>0`, in `tests/unit/performer.rules.test.ts` (FR-001/002/003)
- [ ] T013 [P] [US1] Integration test: booking each type sets pay/requiresCheck/public correctly; Instructor & Open Band forced to $0/no-check, in `tests/integration/bookings.types.test.ts` (FR-001/002/003/005)
- [ ] T014 [P] [US1] Integration test: Sound Tech on a `community_dance` event → 422 `SOUND_TECH_NOT_ALLOWED`, in `tests/integration/bookings.sound-tech.test.ts` (FR-004)
- [ ] T015 [P] [US1] Integration test: `GET /api/events/:id/bookings` returns `performerTotal` = Σ booking pays (drill-down), in `tests/integration/bookings.total.test.ts` (FR-009/SC-004)

### Implementation

- [ ] T016 [US1] Booking service (create with type rules, default pay via resolver, sound-tech/CD block, instructor/open-band force, derive requires_check, audit) in `src/server/domain/bookings/bookingService.ts`
- [ ] T017 [US1] Performer-total computation (sum + drill-down) in `src/server/domain/bookings/bookingService.ts`
- [ ] T018 [P] [US1] Route handlers `POST/GET /api/events/:id/bookings` in `src/app/api/events/[id]/bookings/route.ts`
- [ ] T019 [P] [US1] Route handler `PATCH /api/bookings/:id` (re-derive requires_check; honor invariants) in `src/app/api/bookings/[id]/route.ts`
- [ ] T020 [US1] Bookings admin UI (pick event, add performer + type, pay/override, list + total) in `src/app/(admin)/bookings/page.tsx`

**Checkpoint**: US1 independently testable — book performers with enforced rules + per-event total.

---

## Phase 4: User Story 2 — Handle donated ($0) bookings (Priority: P2)

**Goal**: A donated booking is $0, requires no check, counts in appearance history, and is excluded
from YTD earnings.

**Independent test**: Book a Caller with `isDonated:true`; verify $0/no-check, appearance counted,
earnings excluded.

### Tests first (MUST fail before implementation)

- [ ] T021 [P] [US2] Integration test: donated booking → pay 0, requiresCheck false, appears in appearance history, in `tests/integration/bookings.donated.test.ts` (FR-006)
- [ ] T022 [P] [US2] Integration test: `GET /api/performers/:id` returns appearanceCount incl. donated and ytdEarnings excluding donated, in `tests/integration/performers.history.test.ts` (FR-010/SC-002)

### Implementation

- [ ] T023 [US2] Donation handling in booking service (is_donated ⇒ $0/no-check; distinct from unpaid roles) in `src/server/domain/bookings/bookingService.ts`
- [ ] T024 [US2] Appearance-history + YTD-earnings computation (exclude donated and $0) in `src/server/domain/performers/performerService.ts`
- [ ] T025 [P] [US2] Expose appearanceCount + ytdEarnings on `GET /api/performers/:id` in `src/app/api/performers/[id]/route.ts`

**Checkpoint**: US2 independently testable — donations credited as appearances, excluded from earnings.

---

## Phase 5: User Story 3 — Manage standard pay rates over time (Priority: P2)

**Goal**: Maintain effective-dated caller/sound-tech rates; bookings default to the rate in effect on
the event date; per-booking override; rate changes audited.

**Independent test**: Set two effective-dated rates; a booking defaults to the one in effect on the
event date; supplying pay overrides it; rate creation writes an audit entry.

### Tests first (MUST fail before implementation)

- [ ] T026 [P] [US3] Unit test: rate resolver picks greatest effective_date ≤ event date; none → 0, in `tests/unit/resolveRate.test.ts` (FR-007/008)
- [ ] T027 [P] [US3] Integration test: booking defaults to the in-effect rate by event date; supplying `pay` sets `is_overridden`, in `tests/integration/rates.booking-default.test.ts` (FR-008/SC-001)
- [ ] T028 [P] [US3] Integration test: `POST /api/rate-parameters` appends an effective-dated row and writes a rate-parameter audit entry, in `tests/integration/rates.audit.test.ts` (FR-007/011)

### Implementation

- [ ] T029 [US3] Rate-parameter service (append effective-dated row; resolve by kind+date; write audit) in `src/server/domain/bookings/rateParameterService.ts`
- [ ] T030 [P] [US3] Route handlers `POST/GET /api/rate-parameters` in `src/app/api/rate-parameters/route.ts`
- [ ] T031 [US3] Wire booking default pay to the resolver and set `is_overridden` on explicit pay in `src/server/domain/bookings/bookingService.ts`
- [ ] T032 [P] [US3] Rate-parameter admin UI (set caller/sound-tech rate + effective date) in `src/app/(admin)/rate-parameters/page.tsx`

**Checkpoint**: US3 independently testable — effective-dated rates drive booking defaults, audited.

---

## Phase 6: Polish & Cross-Cutting

- [ ] T033 [P] Extend `src/server/db/seed.ts` with sample performers + standard caller/sound-tech rates
- [ ] T034 [P] Verify all [quickstart.md](quickstart.md) scenarios end-to-end
- [ ] T035 [P] Confirm structured logging + audit on booking and rate-parameter writes (Principle IV)
- [ ] T036 [P] Constitution compliance pass: strict types, integer-cents pay, real-Postgres tests, no undocumented `any`/`as`
- [ ] T037 [P] Update README with performers/bookings/rate-parameters routes

---

## Dependencies & Execution Order

- **Setup (T001)** → **Foundational (T002–T011)** → user stories.
- **US1 (P1)** depends on Foundational (performers, rule table, rate resolver, events from 002) → **MVP**.
- **US2 (P2)** depends on US1 (bookings exist) — adds donation semantics + history/YTD reads.
- **US3 (P2)** depends on Foundational (rate tables) and refines US1's default-pay path; can be built
  after US1. US1 works with explicit pay before US3 lands.
- Within a story: tests first (must fail) → services → routes → UI.

## Parallel Opportunities

- Foundational: schema files T003/T004/T005, rule table T007, resolver T008, Zod T009 in parallel.
- Each story's `[P]` test tasks can be authored together before implementation.
- Route handlers marked `[P]` are separate files from their services.

## Implementation Strategy

1. **MVP = US1** (book performers with enforced rules + per-event total) — the core organizer action.
2. Add **US2** (donations) — correctness for appearance credit vs. earnings.
3. Add **US3** (effective-dated rates) — removes manual pay entry; feeds 004/005.
4. Polish + constitution pass.

## Format validation

All tasks use `- [ ] T### [P?] [US#?] description + file path`. Setup/Foundational/Polish carry no
story label; US phases carry `[US1]/[US2]/[US3]`. 37 tasks total.
