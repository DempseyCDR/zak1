# Implementation Plan: Dance History Page + Series Filter

**Branch**: `037-history-series-filter` | **Date**: 2026-08-04 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/037-history-series-filter/spec.md`

## Summary

Add a public **history** page `/what-was-on` (dances `< today`, most-recent-first, linking to the existing
`/whats-on/[eventId]` detail) and a **series filter** applied to **both** listings via a URL query parameter
(`?series=<key>`), offering all club series. Realized by: a shared internal query in `publicSchedule.ts` that
both `getPublicSchedule` (asc, `≥ from`) and a new `getPublicHistory` (desc, `< before`) delegate to — both
gaining an optional `seriesKey`; a `listSeries` helper; two small shared server components (`ScheduleList`,
`SeriesFilter`); the new page; `searchParams.series` threaded through both pages; and a `/what-was-on` entry
added to feature 034's hand-maintained `PUBLIC_NAV`. Public, read-only; no API route, schema, or migration.

## Technical Context

**Language/Version**: TypeScript 5.7 (strictest flags)

**Primary Dependencies**: existing `src/server/domain/public/publicSchedule.ts` (Drizzle over `events`/`series`);
Next.js 16 App Router server pages (`searchParams` is async in Next 16)

**Storage**: reads existing `events` + `series` — **no** schema change, **no** migration

**Testing**: Vitest — **integration** (real Postgres) for `getPublicHistory` + the `seriesKey` filter on both
readers; **jsdom component** tests for the two shared server components (`SeriesFilter`, `ScheduleList`)

**Target Platform**: Web — public server-rendered pages (no client bundle; filter is server-side via the URL)

**Project Type**: Web application (single Next.js App Router project)

**Performance Goals**: Negligible — one indexed query per page; the filter adds an equality predicate

**Constraints**: Public, read-only; server-rendered filter via `?series=` (FR-006); all series offered (FR-009);
calendar-date comparison (UTC), consistent with 036's `today()`/`homeWindowStart`

**Scale/Scope**: 1 new page + 2 shared components + 1 new reader + a shared internal query + a nav entry; ~3
club series

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Test-First (NON-NEGOTIABLE)** — PASS. Integration tests (real Postgres) for `getPublicHistory` (`< today`,
  desc) and the `seriesKey` filter on both readers, and jsdom component tests for `SeriesFilter` (all series,
  selected marker, `?series=` links) and `ScheduleList` — all written first.
- **II. Simplicity / YAGNI** — PASS. The shared internal query is **justified**, not premature: R5 filters
  **both** readers, and both share the identical projection — one parameterized builder keeps the projection and
  the filter single-source. `ScheduleList`/`SeriesFilter` are extracted because **both** pages render them (not
  a speculative abstraction). No client bundle, no new endpoint.
- **III. Type Safety** — PASS. `seriesKey?: string` is a parameterized filter value (unknown key → empty
  result, no injection); `searchParams.series` is read as `string | undefined`. It is **not** decoded into a
  domain object, so no Zod schema is warranted (Zod governs boundaries converted to typed domain objects).
- **IV. Observability** — PASS (N/A). Public read-only pages; no mutation, no external call, nothing new to log.

**Result**: All gates pass. Complexity Tracking empty.

## Project Structure

### Documentation (this feature)

```text
specs/037-history-series-filter/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── public-listings.md  # Phase 1 output — reader + page + component contracts
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks (NOT created here)
```

### Source Code (repository root)

```text
src/server/domain/public/
└── publicSchedule.ts          # EDIT — shared internal listPublicEvents({from?,before?,seriesKey?,order});
                               #        getPublicSchedule delegates (+ optional seriesKey); NEW getPublicHistory
                               #        (< before, desc, optional seriesKey); NEW listSeries -> {key,name}[]
src/app/(public)/
├── _components/ScheduleList.tsx   # NEW — server component: renders the shared <ul> of PublicScheduleItem + empty msg
├── _components/SeriesFilter.tsx   # NEW — server component: All + one ?series=<key> link per series, marks selected
├── whats-on/page.tsx              # EDIT — read searchParams.series; getPublicSchedule(db, undefined, series);
                                   #        render <SeriesFilter basePath="/whats-on"> + <ScheduleList>
└── what-was-on/page.tsx           # NEW — read searchParams.series; getPublicHistory(db, undefined, series);
                                   #        render <SeriesFilter basePath="/what-was-on"> + <ScheduleList>
src/app/
└── publicNavItems.ts          # EDIT — add { href: "/what-was-on", label: "What was on" } to PUBLIC_NAV (034)

tests/
├── integration/publicHistory.test.ts   # NEW — getPublicHistory window + desc + seriesKey filter (FIRST)
├── integration/publicSchedule.test.ts  # EDIT — add a seriesKey-filter case for getPublicSchedule (FIRST)
├── component/seriesFilter.test.tsx      # NEW — all series, selected marker, ?series= links (FIRST)
└── component/scheduleList.test.tsx      # NEW — renders items + empty message (FIRST)
```

**Structure Decision**: Single Next.js App Router project, all server-rendered (no client bundle — the filter is
a URL query param read on the server). `publicSchedule.ts` gains one internal `listPublicEvents` that both public
readers delegate to, so the projection and the `seriesKey` filter live once; `getPublicSchedule` keeps its
signature (adds an optional 3rd `seriesKey`). The two listing pages share `ScheduleList` (the row markup lifted
out of today's `/whats-on`) and `SeriesFilter`. `/what-was-on` also becomes a hand-maintained `PUBLIC_NAV` entry
(the 034 menu was designed to grow this way; its data-driven test stays green).

## Complexity Tracking

> No Constitution Check violations — table intentionally empty.
