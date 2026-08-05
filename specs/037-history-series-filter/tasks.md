---

description: "Task list for feature 037 — Dance history page + series filter"
---

# Tasks: Dance History Page + Series Filter

**Input**: Design documents from `specs/037-history-series-filter/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/public-listings.md, quickstart.md

**Tests**: INCLUDED — the constitution (I. Test-First) is non-negotiable. Domain readers get integration tests
and the shared components get jsdom tests, all written first.

**Organization**: US1 (history page, P1) → US2 (series filter, P2). A shared internal query underpins both and
lands in Foundational.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1 / US2 — maps to the spec's user stories
- Every task names an exact file path

## Path Conventions

Single Next.js App Router project — `src/server/**`, `src/app/**`, `tests/**` at repo root (per plan.md).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm tooling — no install.

- [x] T001 Confirm the real-Postgres integration env (`tests/integration/publicSchedule.test.ts`) and the jsdom
  component harness (`tests/setup.dom.ts`, RTL, mock `next/link` per `tests/component/publicNav.test.tsx`) are
  available. No dependency install.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared query builder both readers (US1 history, US2 filter) delegate to.

**⚠️ CRITICAL**: `getPublicHistory` (US1) and the `seriesKey` filter (US2) both build on this — do it first.

- [x] T002 In `src/server/domain/public/publicSchedule.ts`, extract an internal
  `listPublicEvents(db, { from?, before?, seriesKey?, order })` that builds the WHERE (`gte(event_date, from)`,
  `lt(event_date, before)`, `eq(series.key, seriesKey)` as present) + ORDER and does the existing select/join/map
  (the current `PublicScheduleItem` projection). Refactor `getPublicSchedule` to delegate (`from` default
  `homeWindowStart(today())`, order asc) — **no behavior change**, so `tests/integration/publicSchedule.test.ts`
  stays green (run it to confirm).

**Checkpoint**: shared builder in place; existing schedule behavior unchanged.

---

## Phase 3: User Story 1 - A visitor browses past dances (Priority: P1) 🎯 MVP

**Goal**: A `/what-was-on` page lists past dances (`< today`), most-recent-first, each linking to its
`/whats-on/<eventId>` detail; it's reachable from the public menu.

**Independent Test**: With events seeded across past/today/future, `getPublicHistory(db, ref)` returns only
`event_date < ref` descending; `/what-was-on` renders them linking to the detail page; the menu lists "What was
on".

### Tests for User Story 1 (write FIRST — must FAIL before T007/T008)

- [x] T003 [P] [US1] Create `tests/integration/publicHistory.test.ts`: seed events at `ref−1`, `ref−2`, `ref`
  (today), and a future date; assert `getPublicHistory(db, ref)` returns only the two before `ref`, **descending**
  (`ref−1` before `ref−2`), and excludes `ref`/future. **Also assert the deliberate overlap (FR-008/SC-002):** an
  event at `ref−1` is returned by **both** `getPublicHistory(db, ref)` **and** `getPublicSchedule(db,
  homeWindowStart(ref))` — the last-two-days home window overlaps the history window (no de-dup). Confirm it FAILS
  (function missing).
- [x] T004 [P] [US1] Create `tests/component/scheduleList.test.tsx` (jsdom, mock `next/link`): given a couple of
  `PublicScheduleItem`s, `ScheduleList` renders one row per item linking to `/whats-on/<eventId>` (with
  date/activity), and shows the empty message when `items` is empty. Confirm it FAILS.

### Implementation for User Story 1

- [x] T005 [US1] In `src/server/domain/public/publicSchedule.ts`, add
  `export async function getPublicHistory(db, before: string = today(), seriesKey?): Promise<PublicScheduleItem[]>`
  delegating to `listPublicEvents({ before, seriesKey, order: "desc" })`. Makes T003 pass.
- [x] T006 [US1] Create `src/app/(public)/_components/ScheduleList.tsx` (server component) rendering the shared
  `<ul>` of rows (lift the markup from `whats-on/page.tsx`: date · start · activity · label · venue · price ·
  cancelled, each linking to `/whats-on/<eventId>`), props `{ items; emptyMessage? }`. Makes T004 pass.
- [x] T007 [US1] Create `src/app/(public)/what-was-on/page.tsx` (server component): `getPublicHistory(db)` →
  `<ScheduleList items={…} emptyMessage="No past dances to show." />` under a heading. (Filter wiring is US2.)
- [x] T008 [US1] Edit `src/app/(public)/whats-on/page.tsx` to render `<ScheduleList>` instead of its inline
  `<ul>` (adopt the extracted component; behavior unchanged).
- [x] T009 [US1] Add `{ href: "/what-was-on", label: "What was on" }` to `PUBLIC_NAV` in
  `src/app/publicNavItems.ts` (feature 034). The data-driven `tests/component/publicNav.test.tsx` stays green
  (it maps over `PUBLIC_NAV`); run it to confirm.

**Checkpoint**: `/what-was-on` shows past dances desc, linked to detail, reachable from the menu — MVP.

---

## Phase 4: User Story 2 - A visitor filters a listing by series (Priority: P2)

**Goal**: Both `/whats-on` and `/what-was-on` filter by series via `?series=<key>` (server-rendered, shareable),
offering all club series.

**Independent Test**: On each page, `?series=<key>` shows only that series' dances (within the page's window);
no param shows all; the filter lists all series and marks the selected one; a filtered URL reloads the same view.

### Tests for User Story 2 (write FIRST — must FAIL before T012/T014)

- [x] T010 [P] [US2] Add `seriesKey`-filter cases: in `tests/integration/publicHistory.test.ts` and
  `tests/integration/publicSchedule.test.ts`, seed events of two series and assert each reader, given a
  `seriesKey`, returns only that series' dances (within its window/order). Confirm they FAIL.
- [x] T011 [P] [US2] Create `tests/component/seriesFilter.test.tsx` (jsdom, mock `next/link`): given a series
  list and a `basePath`, `SeriesFilter` renders an "All" link + one `?series=<key>` link per series (href built
  from `basePath`), marks the `selected` one with `aria-current="page"`, and marks "All" active when none is
  selected. Confirm it FAILS.

### Implementation for User Story 2

- [x] T012 [US2] In `src/server/domain/public/publicSchedule.ts`, thread the optional `seriesKey` through
  `listPublicEvents` (add `eq(series.key, seriesKey)` when present) and add the optional `seriesKey` param to
  `getPublicSchedule` (3rd positional) and `getPublicHistory`. Makes T010 pass.
- [x] T013 [US2] In `src/server/domain/public/publicSchedule.ts`, add
  `export async function listSeries(db): Promise<{ key: string; name: string }[]>` returning all series ordered
  by name (the filter options, FR-009).
- [x] T014 [US2] Create `src/app/(public)/_components/SeriesFilter.tsx` (server component), props
  `{ series: {key,name}[]; selected?: string; basePath: string }`: render an "All" link (`basePath`) + one link
  per series (`basePath?series=<key>`), marking the selected/`All` with `aria-current="page"`. Makes T011 pass.
- [x] T015 [US2] Edit both `src/app/(public)/whats-on/page.tsx` and `src/app/(public)/what-was-on/page.tsx`:
  `await searchParams` → `series`; pass it to the reader (`getPublicSchedule(db, undefined, series)` /
  `getPublicHistory(db, undefined, series)`); render `<SeriesFilter series={await listSeries(db)} selected={series}
  basePath="/whats-on" | "/what-was-on" />` above the list.

**Checkpoint**: series filter works on both pages, shareable via URL, all series offered; US1 still passes.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [x] T016 [P] Update `docs/zak1_Help_Glossary.md` with a short entry for the public listings (`/whats-on`
  window + `/what-was-on` history + `?series=` filter → `publicSchedule.ts` readers + the two `_components`).
- [x] T017 Run the full local gate: `pnpm exec tsc --noEmit && pnpm run lint && pnpm exec vitest run` — all green
  (scope prettier/lint to changed files if run separately).
- [x] T018 Run the manual quickstart validation (`specs/037-history-series-filter/quickstart.md`) via the dev
  server / browser: `/what-was-on` (past desc, links to detail), the series filter on both pages (`?series=`
  narrows, "All" restores, reload keeps the filtered view), and "What was on" in the public menu; screenshot.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: after Setup — the shared `listPublicEvents` blocks both stories.
- **US1 (Phase 3)**: after Foundational. Delivers the history page (MVP).
- **US2 (Phase 4)**: after US1 (it extends both readers and both pages, which US1 establishes/creates).
- **Polish (Phase 5)**: after the desired stories.

### Within Each User Story

- Test tasks (T003/T004, T010/T011) are written and made to FAIL before their implementation.
- T002 (shared builder) before T005 (history delegates to it) and T012 (filter extends it).
- T006 (`ScheduleList`) before T007/T008 (pages use it); T013 (`listSeries`) + T014 (`SeriesFilter`) before T015
  (pages render the filter).

### Parallel Opportunities

- **T003 / T004** (US1) and **T010 / T011** (US2) are different files → the tests can be drafted in parallel.
- **T016** (glossary) is `[P]`.
- Sequential: `publicSchedule.ts` (T002/T005/T012/T013), the two pages (T007/T008/T015), and any shared file.

---

## Parallel Example

```bash
# US1 tests together (different files):
Task: "T003 integration test tests/integration/publicHistory.test.ts"
Task: "T004 component test tests/component/scheduleList.test.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Setup (T001) → Foundational (T002 shared builder).
2. US1: T003 + T004 (RED) → T005 (`getPublicHistory`) → T006 (`ScheduleList`) → T007 (`/what-was-on`) → T008
   (whats-on adopts it) → T009 (nav entry).
3. **STOP and VALIDATE**: `/what-was-on` shows past dances, reachable from the menu. Demoable MVP.

### Incremental Delivery

1. Setup + Foundational → shared builder.
2. US1 → history page (MVP).
3. US2 → series filter on both listings (shareable URL).
4. Polish → glossary, gate, browser.

---

## Notes

- No database, migration, or API route — server components read the domain directly; the filter is a URL query
  param (no client bundle). The per-dance detail page is untouched.
- The shared `listPublicEvents` is justified by two stories (both readers filter over one projection), not a
  speculative abstraction (Constitution II).
- Ships as one atomic commit per repo convention.
