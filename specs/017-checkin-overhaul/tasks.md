---
description: "Task list for feature 017 — Check-in Overhaul"
---

# Tasks: Check-in Overhaul

**Input**: Design documents from `specs/017-checkin-overhaul/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts)

**Tests**: REQUIRED. Constitution principle I (Test-First, NON-NEGOTIABLE) — every new behaviour lands
test-first (Red → Green → Refactor). Test tasks precede their implementation within each story.

**Organization**: Grouped by user story (spec priorities P1–P5), in the spec's internal order
(**B34 → B33; B29 before B36**), which is also the file-dependency order (see note below).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1–US5 (setup/foundational/polish tasks carry no story label)

## ⚠️ Shared-file note (why the stories are sequential, not parallel)

US1, US2, US3, US5 all edit the same three files —
`src/server/domain/attendance/attendanceService.ts`, `src/server/validation/attendance.ts`, and
`src/app/(door)/checkin/page.tsx`. So the **implementation** tasks across stories are NOT file-parallel and
MUST be done in priority order. `[P]` therefore appears mostly on **test files** and the two **schema
files**, which are genuinely independent. This ordering also honours the spec's required internal order.

---

## Phase 1: Setup

**Purpose**: Confirm a clean baseline before touching anything.

- [x] T001 Confirm baseline green on `main`: `pnpm test`, `pnpm exec tsc --noEmit`, `pnpm run lint` all pass
  (run with Node 24: `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 24`).
- [x] T002 (Optional) Snapshot `zak1_dev` before the migration: source env, then
  `pg_dump -Fc "$DATABASE_URL" -f ~/zak1_pre_0022.dump`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Additive schema — the three new columns from [data-model.md](data-model.md). Blocks US3
(`children_count`) and US5 (`is_open_band`, `open_band_count`); harmless for US1/US2. Migration `0022` is
additive (contrast 016's destructive `0021`).

**⚠️ CRITICAL**: Complete before US3 and US5.

- [x] T003 Create migration `src/server/db/migrations/0022_checkin_overhaul.sql` adding, idempotently,
  `attendance.children_count int NOT NULL DEFAULT 0`, `attendance.is_open_band boolean NOT NULL DEFAULT
  false`, and `door_records.open_band_count int NOT NULL DEFAULT 0`.
- [x] T004 [P] Extend Drizzle schema `src/server/db/schema/attendance.ts`: add `childrenCount`
  (`children_count`) and `isOpenBand` (`is_open_band`) columns matching the migration.
- [x] T005 [P] Extend Drizzle schema `src/server/db/schema/door.ts`: add `openBandCount`
  (`open_band_count`) column matching the migration.
- [x] T006 Apply and verify: `pnpm run db:migrate` (zak1_dev) and confirm `zak1_test` auto-migrates on the
  next test run; `pnpm exec tsc --noEmit` clean with the new columns.

**Checkpoint**: Schema ready — all stories can proceed in priority order.

---

## Phase 3: User Story 1 — New contact: first + last + editable display name (Priority: P1) 🎯 MVP

**Goal (B34)**: A new contact added at check-in captures first name, last name, and an editable display name
(override), reusing feature-012's `deriveContactNames`.

**Independent Test**: Add a new attendee with first + last; accept or edit the proposed display name; confirm
the contact persists first/last + chosen display name and is checked in.

### Tests for User Story 1 ⚠️ (write first, confirm they FAIL)

- [x] T007 [P] [US1] Extend `tests/integration/door.attendance-new.test.ts`: a `newContact` with `lastName`
  persists `first_name`/`last_name`; a `displayNameOverride` sets `display_name` (override wins) while
  first/last are preserved; omitted override → `display_name = "first last"`; contact is checked in.
- [x] T008 [P] [US1] Add unit test `tests/unit/contacts.deriveNames.test.ts` for `deriveContactNames` at the
  door: override wins for `displayName`/`nameNormalized`; `dedupNormalized` ignores the override; blank last
  name → first-name-only display.

### Implementation for User Story 1

- [x] T009 [US1] Extend `src/server/validation/attendance.ts` `newContact` variant: add `lastName`
  (schema-optional, UI-required) and `displayNameOverride?` (trimmed, min 1 when present).
- [x] T010 [US1] Update `recordAttendance` in `src/server/domain/attendance/attendanceService.ts`: pass
  `lastName` + `displayNameOverride` into `deriveContactNames` and persist `display_name_override` on the
  created contact.
- [x] T011 [US1] Update `src/app/(door)/checkin/page.tsx` new-contact form: add a required **Last name** field
  and an editable **Display name** field pre-filled with "First Last"; include `lastName`/`displayNameOverride`
  in the `newContact` body.

**Checkpoint**: New door contacts carry full name + editable display name.

---

## Phase 4: User Story 2 — Checked-in roster, sortable by first/last (Priority: P2)

**Goal (B33)**: `/checkin` shows a roster of already-checked-in attendees, re-sortable by first or last name,
using structured names.

**Independent Test**: Check in several attendees; open the roster; toggle first ↔ last sort and confirm the
ordering.

### Tests for User Story 2 ⚠️ (write first, confirm they FAIL)

- [x] T012 [P] [US2] Extend `tests/integration/attendance.list.test.ts`: the response now carries
  `firstName`/`lastName` (plus `childrenCount`/`isOpenBand`); `?sort=first` and `?sort=last` order by the
  chosen field with the other as tiebreak and unmatched placeholders last.

### Implementation for User Story 2

- [x] T013 [US2] Update `listEventAttendance` in `src/server/domain/attendance/attendanceService.ts`: select
  `first_name`/`last_name`/`children_count`/`is_open_band`; accept a `sort: "first" | "last"` argument and
  order in SQL (tiebreak on the other name; nulls last). Keep `count`/`displayName` (contact-tracing consumer
  unaffected).
- [x] T014 [US2] Update `GET` in `src/app/api/events/[id]/attendance/route.ts`: parse `?sort=first|last`
  (default `last`) and pass to the service.
- [x] T015 [US2] Add a roster panel to `src/app/(door)/checkin/page.tsx`: fetch `GET …/attendance`, render
  the list with a first/last sort toggle, and show a family "(+N)" badge and an open-band marker per row.

**Checkpoint**: Roster visible and sortable; US1 + US2 both work.

---

## Phase 5: User Story 3 — Family check-in, children count as paying (Priority: P3)

**Goal (B35)**: Check in one parent contact + a children count (all series); children raise attendance and
paying dancers. Formula unchanged — children ride inside `events.attendance_count` (see research R3).

**Independent Test**: Check in a parent with N children; confirm `events.attendance_count` and the derived
paying-dancer count each rise by `1 + N`.

### Tests for User Story 3 ⚠️ (write first, confirm they FAIL)

- [x] T016 [P] [US3] New `tests/integration/checkin.family.test.ts`: a check-in with `childrenCount: N` stores
  `children_count = N` on the parent's attendance row and increments `events.attendance_count` by `1 + N`;
  `childrenCount` is rejected on the `unmatched` variant.
- [x] T017 [P] [US3] Extend an organizer test (`tests/unit/organizer.metrics.test.ts` or the relevant
  integration test) proving paying dancers rise by `1 + N` for a family (children counted as paying, not
  comped) with the `payingDancers` formula unchanged.

### Implementation for User Story 3

- [x] T018 [US3] Extend `src/server/validation/attendance.ts`: add `childrenCount?` (int ≥ 0, default 0) to
  the existing-contact (`{ contactId }`) and `newContact` variants only (NOT `unmatched`).
- [x] T019 [US3] Update `recordAttendance` in `src/server/domain/attendance/attendanceService.ts`: store
  `children_count` on the attendance row and increment `events.attendance_count` by `1 + childrenCount`.
- [x] T020 [US3] Update `src/app/(door)/checkin/page.tsx`: add a **children count** input on the
  existing-contact and new-contact check-in paths; include it in the request body.

**Checkpoint**: Families check in as one row + count; paying-dancer math correct.

---

## Phase 6: User Story 4 — Comp & gift-card counts captured at check-in (Priority: P4)

**Goal (B29, resolves B21)**: The Door Attendant records comp and gift-card redemption counts at check-in
(materialized on the door record) via an `attendance.write` path — never `/gate`. The FS confirms/edits on
`/gate` (`gate.write`). See [contracts/checkin-counts.md](contracts/checkin-counts.md) and research R4.

**Independent Test**: Post comp/gift counts at check-in as a Door Attendant; confirm they land on the door
record and are visible/editable to the FS on `/gate`; comp still reduces paying dancers as in feature 014.

### Tests for User Story 4 ⚠️ (write first, confirm they FAIL)

- [x] T021 [P] [US4] New `tests/integration/checkin.counts.test.ts`: `POST /api/events/[id]/checkin-counts`
  ensures the door record and sets `comp_count` + `gift_card_redemption_count` (money fields and
  `open_band_count` untouched); the FS then reads them via `/gate` and can edit them; paying dancers drop by
  the comp count.
- [x] T022 [P] [US4] Boundary test (new `tests/integration/checkin.counts.boundary.test.ts` or extend
  `tests/integration/authz.boundaries.test.ts`): a Door Attendant is refused every `gate.write` path
  (`PATCH /api/door-records/[id]`, `PUT …/gate-sales`) with `403` and an audited refusal, while
  `POST …/checkin-counts` is allowed under `attendance.write`.

### Implementation for User Story 4

- [x] T023 [US4] Add `checkinCountsSchema` to `src/server/validation/door.ts`: `compCount?`,
  `giftCardRedemptionCount?` (int ≥ 0), no money fields.
- [x] T024 [US4] Add `recordCheckinCounts(db, eventId, input, actor, authz)` to
  `src/server/domain/door/doorRecordService.ts`: `ensureDoorRecord`, `assertEventScope(actor,
  "attendance.write", { seriesId, groupId })`, set only `comp_count`/`gift_card_redemption_count`, write a
  `door_record_audit` row (`action: "checkin_counts"`) + `writeAudit`. Do NOT touch money, `open_band_count`,
  or recompute deposit/fee.
- [x] T025 [US4] Add route `src/app/api/events/[id]/checkin-counts/route.ts`: `POST` with
  `withAuth({ requires: "attendance.write" })`, parse `checkinCountsSchema`, call `recordCheckinCounts` with
  `ctx.actor`.
- [x] T026 [US4] Update `src/app/(door)/checkin/page.tsx`: add **comp** and **gift-card redemption** count
  inputs that POST to `…/checkin-counts`; keep the page free of any money field.
- [x] T027 [US4] Update `src/app/(door)/gate/page.tsx`: show the materialized `comp_count` **and add a
  gift-card-redemption-count input** (the page has none today — only a comp input and a gift-card *sales*
  dollar line). Wire the redemption count into the existing `gate.write` PATCH body so the FS can
  edit/override it per FR-015 (`doorRecordPatchSchema`/`updateDoorRecord` already accept
  `giftCardRedemptionCount`).

**Checkpoint**: Comp/gift counts captured at the door, confirmed by the FS; Door Attendant still excluded
from money.

---

## Phase 7: User Story 5 — Open-band musician comped group-wide (Priority: P5)

**Goal (B36)**: At a `community_dance` event, the Door Attendant flags a checked-in attendee as an open-band
musician (manual, not from bookings). They count as attending (`attendance_count +1`) and add a comp
(`open_band_count +1`); the report uses `effectiveComps = comp_count + open_band_count`. No cross-event
counter (research R1/R2).

**Independent Test**: Flag an open-band musician at a community dance → `is_open_band` set,
`attendance_count +1`, `open_band_count +1`, and they net non-paying via `effectiveComps`; the flag is
rejected on a non-`community_dance` event.

### Tests for User Story 5 ⚠️ (write first, confirm they FAIL)

- [x] T028 [P] [US5] New `tests/integration/checkin.openBand.test.ts`: an open-band check-in at a
  `community_dance` event sets `is_open_band = true`, increments `events.attendance_count` by 1 and
  `door_records.open_band_count` by 1 (door record ensured); the flag is rejected on a non-`community_dance`
  event (FR-022); it is accepted on existing-contact and new-contact paths, not `unmatched`; **and it is
  rejected when the contact is a booked performer for that event (FR-022a)**.
- [x] T029 [P] [US5] Extend an organizer test proving `effectiveComps = comp_count + open_band_count` feeds
  `payingDancers`, so an open-band musician counts as attending but not paying, and totals stay correct.

### Implementation for User Story 5

- [x] T030 [US5] Extend `src/server/validation/attendance.ts`: add `isOpenBand?` (boolean) to the
  existing-contact and `newContact` variants (not `unmatched`).
- [x] T031 [US5] Update `recordAttendance` in `src/server/domain/attendance/attendanceService.ts`: when
  `isOpenBand`, verify the event's series `key === "community_dance"` (else reject) **and verify the contact
  is not a booked performer for that event (else reject — FR-022a)**; within one transaction set
  `is_open_band` on the row, increment `attendance_count` by 1, `ensureDoorRecord`, and increment
  `open_band_count` by 1.
- [x] T032 [US5] Update the paying-dancer computation in `src/server/domain/organizer/reportService.ts`
  (the **only** caller of `payingDancers`, at line ~54): pass `effectiveComps = comp_count + open_band_count`
  as the `compCount` arg (`src/server/domain/organizer/danceResult.ts` signature unchanged). Also carry
  `open_band_count` into `src/server/domain/gate/eventMoney.ts`'s view **only if** the `/gate` page displays
  paying dancers from it — `eventMoney` currently just exposes `compCount` as a field and does not call
  `payingDancers`, so this is a display-consistency change, not a correctness one. Verify before editing.
- [x] T033 [US5] Update `src/app/(door)/gate/page.tsx`: show `open_band_count` read-only alongside comp/gift
  so the FS sees the full comp picture.
- [x] T034 [US5] Update `src/app/(door)/checkin/page.tsx`: offer the **open-band** flag only when the selected
  event is in the `community_dance` series; include it in the check-in body.

**Checkpoint**: All five stories functional and independently tested.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [x] T035 Run `tests/integration/auth.routeInventory.test.ts` — confirm the new `checkin-counts` route is
  auto-discovered with its declared `attendance.write` requirement (self-maintaining; no hand edit — CLAUDE.md
  convention).
- [x] T036 [P] Update `specs/BACKLOG.md`: mark **B34, B33, B35, B36, B29** done → feature 017 and note **B21**
  resolved via B29 (per the file's "when a backlog item is picked up" rule).
- [x] T037 [P] Review `docs/use-cases.md`: confirm the Door Attendant's comp/gift capture and open-band flag,
  and the FS's `/gate` confirmation, are consistent with the matrix (update wording only if needed).
- [x] T038 [P] (Optional) Update `src/server/db/seed.ts` to exercise the new fields for the demo (a family
  check-in with children; an open-band musician at a community dance) so `zak1_dev` shows the behaviour.
- [x] T039 Full gate green: `pnpm test`, `pnpm exec tsc --noEmit`, `pnpm run lint`, `pnpm exec prettier
  --check .`.
- [x] T040 Run the [quickstart.md](quickstart.md) walkthrough via `preview_start {name:"dev"}` — verify the
  Door Attendant flow end-to-end and the `/gate` exclusion, capture a screenshot as proof.
- [x] T041 Author the next project-context snapshot (e.g. `zak1_Project_Context_v1.7.md`) recording P3-3
  shipped, and update the auto-memory status file; commit the feature as one atomic commit on `main` with the
  `Co-Authored-By` trailer (ask before pushing).

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (P1)**: no dependencies.
- **Foundational (P2)**: after Setup. Blocks **US3** and **US5** (their columns). US1/US2 do not need it but
  it is harmless to land first.
- **User stories (P3–P7)**: in priority order. They share three files (see the shared-file note), so they are
  **sequential**, which also satisfies the spec's internal order (B34 → B33; B29 before B36).
- **Polish (P8)**: after the desired stories are complete.

### Within each story

- Test tasks first; confirm RED before implementing (constitution I).
- Validation schema → service → route → UI.
- `effectiveComps` (US5 T032) must land with the open-band write (T031) or paying-dancer math is wrong.

### Parallel opportunities

- T004 / T005 (two different schema files) are `[P]`.
- Each story's test tasks are `[P]` with each other (different test files).
- Polish T036 / T037 / T038 are `[P]` (different files).
- Cross-story implementation tasks are **not** parallel (shared `attendanceService.ts`,
  `validation/attendance.ts`, `checkin/page.tsx`).

---

## Parallel Example: schema (Phase 2)

```bash
# After T003 (migration), the two schema files are independent:
Task: "T004 Extend src/server/db/schema/attendance.ts (children_count, is_open_band)"
Task: "T005 Extend src/server/db/schema/door.ts (open_band_count)"
```

## Parallel Example: User Story 4 tests

```bash
Task: "T021 New tests/integration/checkin.counts.test.ts"
Task: "T022 Boundary test — Door Attendant refused gate.write, allowed checkin-counts"
```

---

## Implementation Strategy

### MVP (User Story 1)

1. Phase 1 Setup → Phase 2 Foundational → Phase 3 (US1/B34).
2. **STOP and validate**: new door contacts carry full name + editable display name.

### Incremental delivery (this feature ships as one atomic commit)

Land stories in order — US1 → US2 → US3 → US4 → US5 — validating each checkpoint. Because the repo commits one
atomic commit per feature to `main`, the "increments" are validation gates, not separate deploys. Finish with
Phase 8 (full gate + quickstart + context/memory + commit).

## Notes

- `[P]` = different files, no dependency on an incomplete task.
- Migration `0022` is additive and idempotent; safe on the persistent `zak1_dev`.
- No formula change for paying dancers in US3 (children ride inside `attendance_count`); US5 changes only the
  **inputs** to `payingDancers` (the `effectiveComps` sum), not its signature.
- Open-band detection is **manual** at check-in — never sourced from `bookings`/`performers` (spec FR-019).
