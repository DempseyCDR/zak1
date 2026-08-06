---

description: "Task list for feature 041 — organizer report shows the band name (+ member detail on drill-in)"
---

# Tasks: Organizer Report Shows the Band Name (+ member detail on drill-in)

**Input**: Design documents from `specs/041-organizer-band-name/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/organizer-report.md, quickstart.md

**Tests**: INCLUDED — the constitution (I. Test-First) is non-negotiable. The band-name resolution is codified
RED-first at the report (integration) and the drill-in detail at the page (component); the load-bearing invariant
is **figure parity** (no computed figure changes).

**Organization**: Two user stories — **US1 (P1)** the band name on the report, **US2 (P2)** the member detail on
drill-in. They touch **different files** (US1 = the report service + its integration test; US2 = the page + a new
component test that stubs its own data), so they are **independent** and may proceed in parallel. No migration, no
new endpoint, no new field — the `band` string changes meaning.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1 / US2 — maps to the spec's user stories
- Every task names an exact file path

## Path Conventions

Single Next.js + Postgres project — `src/server/**`, `src/app/**`, `tests/**` (per plan.md). No
`src/server/db/migrations/` change this feature.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: One small test-helper so a test can seed a named band.

- [X] T001 In `tests/integration/helpers/factories.ts`, add a `makeBand(name = "Test Band")` helper that inserts a
  `bands` row and returns it (mirrors `makePerformer`). Used to seed a named band for the US1 report test. (Import
  `bands` from `@/server/db/schema`; the test then books musicians under `band.id` via `createBooking`'s `bandId`
  arg.)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: None — no schema, no shared service change. US1 and US2 touch different files and are independent.
Proceed to either story.

---

## Phase 3: User Story 1 - Band name at a glance on the report (Priority: P1) 🎯 MVP

**Goal**: The organizer report's per-dance `band` shows the booked **band's name** when a named band played
(falling back to joined member names for ad-hoc, "Open Band", or blank — unchanged); no computed figure changes.

**Independent Test**: Seed a dance with two musicians booked under a named band, plus dances for the other cases;
assert the named-band row's `band` equals the band's name, the ad-hoc row shows joined member names, open-band
shows "Open Band", caller-only shows "", multiple bands join names, and every existing figure is unchanged.

### Tests for User Story 1 (write FIRST)

- [X] T002 [P] [US1] In `tests/integration/organizer.report.test.ts`, add an `it` (using `makeBand` from T001):
  seed a dance where two `makePerformer` musicians (types `lead_musician` + `musician`) are booked under **one
  named band** via `createBooking(db, evt.id, { performerId, performerType, pay }, null, band.id)`; assert that
  dance's `perDanceRows[i].band ===` the band's name. Add cases for: **ad-hoc** (two musicians, no `bandId`) →
  `band ===` the joined member names; **open-band only** → `band === "Open Band"`; **caller only / no musicians**
  → `band === ""`; **two different named bands** on one dance → `band ===` the two names joined. **Assert figure
  parity**: the named-band dance's `dancers`, `grossGate`, `performerTotal`, `danceNet`, and `avgTicket` are the
  values they would have with the same bookings today (the `band` change touches nothing else). Confirm the
  band-name assertions FAIL against current code.

### Implementation for User Story 1

- [X] T003 [US1] In `src/server/domain/organizer/reportService.ts`, change the `band` derivation: load a
  `Map<bandId, name>` once (`db.select({ id: bands.id, name: bands.name }).from(bands)`); per dance, collect the
  **distinct non-null `bandId`s** among `lead_musician` + `musician` bookings → join their names; else joined
  member names (ad-hoc, unchanged); else `"Open Band"` if an `open_band_musician` booking exists; else `""`. Set
  the **trend point's** `band` from the same value. Import `bands` from `@/server/db/schema`. **Touch no computed
  figure**; leave `performers[]` unchanged. Makes T002 pass.

**Checkpoint**: the report shows the band name; all existing figures unchanged; US1 tests green. Shippable MVP on
its own (the page's band column already renders `r.band`).

---

## Phase 4: User Story 2 - Member roster when drilling into a dance (Priority: P2)

**Goal**: The per-dance detail expansion lists the band's members by name and role and shows the band name.

**Independent Test**: Render the organizer page with a stubbed report whose row has a band name + a `performers`
list; confirm the band column shows the name, and expanding the row reveals the members by name and role plus the
band name.

### Tests for User Story 2 (write FIRST)

- [X] T004 [P] [US2] Create `tests/component/organizer.page.test.tsx` (jsdom via `// @vitest-environment jsdom`
  docblock; mirror `tests/component/treasurer.page.test.tsx`): stub `fetch` so
  `/api/organizer/<seriesKey>/report?year=…` returns a fixture with one `perDanceRows` entry
  (`band: "The Fiddleheads"`, `performers: [{name,type,amount}×2]`, plus the other row fields the page reads),
  render the page (pass `params={Promise.resolve({ seriesKey: "tnc" })}` — the page reads params via React `use`);
  assert the band column shows "The Fiddleheads", then click the row and assert the detail lists each member by
  **name and role (type)** and shows the **band name**. Confirm it FAILS (band-name label not yet in the detail).

### Implementation for User Story 2

- [X] T005 [US2] In `src/app/(admin)/organizer/[seriesKey]/page.tsx`, in the per-dance detail expansion (the
  `openRow` block that lists `performers`), add the **band name** as a label (reuse `r.band`) above/with the
  existing members list. Members are already rendered as `name (type, amount)`. Makes T004 pass.

**Checkpoint**: the drill-in detail is band-aware and lists members by name and role; US2 tests green.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [X] T006 Run the full local gate: `pnpm exec tsc --noEmit && pnpm run lint && pnpm exec vitest run` — all green.
  The unchanged existing figure assertions prove **figure parity** (SC-004); `tsc` proves the page/report types
  line up. (Optional manual: sign in as an organizer, open `/organizer/tnc`, confirm a named-band dance shows the
  band name in the column and the members + band name on drill-in, and an ad-hoc dance still shows joined names.)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 (makeBand) precedes the US1 report test.
- **US1 (Phase 3)**: after T001. The MVP.
- **US2 (Phase 4)**: **independent of US1** — different files, and its component test stubs its own report data.
  May run in parallel with US1.
- **Polish (Phase 5)**: after US1 + US2.

### Within / across the stories

- Genuine fail-first: **T002** (band name on the report) for US1; **T004** (detail lists members + band name) for
  US2.
- T003 (`reportService.ts`) makes T002 pass. T005 (`page.tsx`) makes T004 pass.
- **No shared files** between US1 and US2 → no cross-story sequencing.

### Parallel Opportunities

- **US1 ‖ US2**: the entire stories are independent (US1 = `reportService.ts` + `organizer.report.test.ts`; US2 =
  `page.tsx` + new `organizer.page.test.tsx`). T002 ‖ T004 (write both tests), then T003 ‖ T005 (both impls).

---

## Parallel Example

```bash
# The two stories are independent — tests first, both files:
Task: "T002 band-name + figure-parity cases in tests/integration/organizer.report.test.ts"
Task: "T004 band column + drill-in member detail in tests/component/organizer.page.test.tsx (new)"
```

---

## Implementation Strategy

### MVP (User Story 1)

1. Setup (T001 makeBand helper).
2. US1 test RED (T002) → reportService band-name derivation (T003). GREEN → shippable (the page already renders
   `r.band`).
3. US2 (T004 RED → T005) — independent; adds the band-name label to the drill-in detail.
4. Polish: full gate (T006) proves figure parity + type alignment; optional manual.

---

## Notes

- **No migration, no new endpoint, no new field** — reads existing columns (`bookings.band_id`, `bands.name`); the
  `band` **string** changes meaning (member names → band name).
- **Load-bearing invariant**: FR-005 / SC-004 figure parity — only the `band` string changes; the existing figure
  assertions must stay green (that is the parity proof).
- **Band name is a live read** (`bands.name` via a `bandId → name` map loaded once), mirroring the bookings/public
  reports — not snapshotted.
- **Fallbacks unchanged**: ad-hoc joined names / "Open Band" / "" are byte-for-byte as today.
- **Out of scope**: the public `/whats-on` band display, the bookings report, and substitution/no-show behavior.
  The "detail pop-up" reuses the existing inline expansion (no new modal).
- Ships as one atomic commit per repo convention.
