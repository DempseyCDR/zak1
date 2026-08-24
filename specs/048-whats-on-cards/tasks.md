# Tasks: `/whats-on` mobile-first event cards (P7-R4)

**Feature dir**: `specs/048-whats-on-cards/` · **Branch**: `048-whats-on-cards`
**Input**: plan.md, research.md, data-model.md, contracts/event-card.md, quickstart.md, spec.md

**Constitution**: Test-First (NON-NEGOTIABLE) — the test task in each area precedes its implementation task.
No migration. Built on 045 tokens (`EVENT_TYPE_COLORS`) + the shared 037 `ScheduleList` / `listPublicEvents`.

## Phase 1: Setup

No setup: no new dependency, no migration, no config. (The branch already exists off `main` with 045–047.)

## Phase 2: Foundational (blocking prerequisites for all stories)

- [X] T001 Extend the public projection: in `src/server/domain/public/publicSchedule.ts` add
  `seriesKey: string` and `venueShortName: string | null` to `PublicScheduleItem`, and select `series.key`
  (as `seriesKey`) + `venues.short_name` (as `venueShortName`) in the shared `listPublicEvents` `SELECT`
  (inner-joined `series`, left-joined `venues` — no migration, no new query). Both `getPublicSchedule` and
  `getPublicHistory` inherit the fields.

## Phase 3: User Story 2 — Series color-coding (P1)

**Goal**: a per-series → R1-color map (single source) that every card consumes.
**Independent test**: the map returns the right `var(--type-*)` per key and the neutral default for an unknown key.

- [X] T002 [P] [US2] Unit test `tests/unit/seriesColor.test.ts`: `seriesColorVar("tnc")` → `var(--type-contra)`,
  `ecd`→english, `community_dance`→special, `general`→assembly; an unknown key → the neutral default
  `var(--band)`. (Test-first — fails until T003.)
- [X] T003 [US2] Implement `src/app/(public)/_components/seriesColor.ts`: `SERIES_COLOR: Record<string, EventType>`
  (`tnc`→contra, `ecd`→english, `community_dance`→special, `general`→assembly) + `seriesColorVar(seriesKey):
  string` resolving via `EVENT_TYPE_COLORS` (from `@/app/tokens`), unmapped → `var(--band)`. `meeting` reserved
  (no dance series maps to it).

## Phase 4: User Story 1 — Scan the next dances as cards (P1)

**Goal**: each event is a whole-card link to detail with prominent date, time, venue short name (fallback),
price, cancelled marker, and the series accent stripe.
**Independent test**: `EventCard` renders the card content/behavior; the shared list renders one card per item.

- [X] T004 [P] [US1] Component test `tests/component/eventCard.test.tsx` (jsdom docblock; stub `next/link`):
  the whole card is a link to `/whats-on/<eventId>`; shows date, start time, venue **short** name — and falls
  back to `venueName` when `venueShortName` is null, omits the venue line when both are null; shows price when
  present and omits it when null; marks a cancelled event; sets the `--card-accent` CSS var from the series map;
  renders **no** `<h1>`.
- [X] T005 [US1] Implement `src/app/(public)/_components/EventCard.tsx` (+ `EventCard.module.css`): a pure
  component taking one `PublicScheduleItem`; a whole-card `<Link href="/whats-on/<eventId>">` with
  `style={{ "--card-accent": seriesColorVar(seriesKey) }}`; left accent stripe
  (`border-left: 4px solid var(--card-accent)`), prominent date block, time, venue short (fallback to full,
  omit if neither), price (omit when null), cancelled marker; ≥44px target; accent never behind text.
- [X] T006 [US1] Rewrite `src/app/(public)/_components/ScheduleList.tsx` to map items → `<EventCard>` (keep the
  `emptyMessage` empty state); trim `ScheduleList.module.css` to the card-stack wrapper (spacing/gap), moving
  the row/link/date/meta styles into `EventCard.module.css`.
- [X] T007 [US1] Update `tests/component/scheduleList.test.tsx`: fixtures gain `seriesKey` + `venueShortName`
  (now required); assertions confirm one whole-card link per item to `/whats-on/<eventId>`, the cancelled
  marker, and the empty state (still green).

## Phase 5: User Story 3 — One consistent card everywhere (P2)

**Goal**: the shared card renders identically on `/whats-on`, `/what-was-on`, and the home strip.
**Independent test**: the three surfaces all use the shared `ScheduleList`/`EventCard` (no per-page card code).

- [X] T008 [US3] Integration test `tests/integration/publicSchedule.cards.test.ts` (real Postgres): seed an
  event with a series + a venue that has a `short_name`; assert `getPublicSchedule` items carry the correct
  `seriesKey` and `venueShortName`; seed a venue with a null `short_name` and assert `venueShortName` is null.
- [X] T009 [US3] Verify no per-page card code exists — `/whats-on`, `/what-was-on`, and the home "Coming up"
  strip all render via the shared `ScheduleList` (already true post-T006); confirm the `?series=` filter,
  cancelled marker, and confirmed-only rule are untouched.

## Phase 6: Polish & validation

- [X] T010 Gate suite: `pnpm exec vitest run tests/unit/seriesColor.test.ts tests/component/eventCard.test.tsx
  tests/component/scheduleList.test.tsx tests/integration/publicSchedule.cards.test.ts`, then
  `pnpm exec tsc --noEmit`, `pnpm run lint`, and `pnpm exec prettier --check` on the changed files. Full
  `pnpm test` green.
- [X] T011 Browser verify (quickstart §2): `/whats-on` at 375px — next dance above the fold, no horizontal
  scroll, whole-card tap → detail, series accent, venue short + price graceful, cancelled marker, ≥44px, one H1,
  `?series=` still filters.

## Dependencies

- T001 (projection) blocks the component/integration tests and the card (they consume the two fields).
- T003 (map) blocks T005 (card uses `seriesColorVar`). T002 precedes T003 (test-first).
- T004 precedes T005; T005 precedes T006; T007 follows T006. T008 follows T001.
- Phase 6 last.

## Parallel opportunities

- T002 and T004 are independent test files ([P]) once T001/T003 land respectively.

## MVP scope

US1 + US2 (the card + its color) delivered together are the MVP; US3 falls out of the shared component.
