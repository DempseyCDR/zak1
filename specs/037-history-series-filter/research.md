# Phase 0 Research: Dance History Page + Series Filter

Spec unknowns were resolved in `/speckit-clarify` (filter = server-rendered `?series=` query param; all series
offered). Remaining decisions are technical, below. No open `NEEDS CLARIFICATION`.

## R1 — History reader + sharing the projection with the schedule reader

- **Decision**: Add an internal `listPublicEvents(db, { from?, before?, seriesKey?, order })` in
  `publicSchedule.ts` that builds the WHERE (`gte(event_date, from)` and/or `lt(event_date, before)` and/or
  `eq(series.key, seriesKey)`) + ORDER, and does the shared select/join/map. `getPublicSchedule` delegates
  (`from` default `homeWindowStart(today())`, asc); new `getPublicHistory(db, before = today(), seriesKey?)`
  delegates (`< before`, desc).
- **Rationale**: The two readers share the **identical** public-safe projection, and R5's `seriesKey` filter
  applies to **both** — so a single parameterized builder keeps the projection and the filter single-source
  (avoids drift). This is required-by-two-stories, not premature (Constitution II). `getPublicSchedule` keeps its
  signature (adds an optional 3rd `seriesKey`), so existing callers/tests are unaffected.
- **Alternatives considered**: a standalone `getPublicHistory` duplicating ~20 lines of projection (drift risk,
  and the filter would be written twice); overloading `getPublicSchedule` with a direction flag (muddies the
  "upcoming" reader).

## R2 — History window: `< today`, descending

- **Decision**: `getPublicHistory` lists `event_date < today` ordered descending. `today` defaults to the
  existing `today()` (UTC calendar date), injectable for tests.
- **Rationale**: FR-001/FR-002. Using the same `today()` keeps the boundary consistent with `/whats-on`'s window
  (036): home is `≥ today − 2`, history is `< today`, so the last two days overlap on both (FR-008, intended).
- **Alternatives considered**: `≤ today` (would double-count today's dances as "past" — wrong); a rolling clock
  (inconsistent with the calendar-date model).

## R3 — Series filter mechanism (server-rendered `?series=<key>`)

- **Decision**: Each listing page reads `searchParams.series` (async in Next 16), passes it as `seriesKey` to
  its reader, and renders a `SeriesFilter` server component: an "All" link plus one link per series, each
  pointing at the page with `?series=<key>` (omitted for "All"), the current selection marked. No client JS.
- **Rationale**: Clarify option A — server-rendered, shareable URL, both pages stay pure server components
  (matching today's `/whats-on`). A dropdown of links needs no client interactivity (YAGNI).
- **Alternatives considered**: a client `<select>` with `router.push` (adds a client bundle for no benefit);
  posting a form (heavier than GET links for a read-only filter).

## R4 — Which series + unknown-key handling

- **Decision**: `listSeries(db)` returns **all** club series as `{ key, name }` (ordered by name). The filter
  offers all of them (FR-009). An unknown/invalid `?series=` value simply matches no rows → the empty state
  (the query is a parameterized `eq(series.key, value)`, so no injection and no error).
- **Rationale**: Clarify option A (all series); small stable set; empty state already required (edge cases).
- **Alternatives considered**: only series with events in the window (per-page query, differing option sets —
  rejected as needless at this scale).

## R5 — Shared list markup (`ScheduleList`) and the nav entry

- **Decision**: Extract the `<ul>` row markup currently inline in `/whats-on/page.tsx` into a `ScheduleList`
  server component (props: `items`, empty message); both pages use it. Add
  `{ href: "/what-was-on", label: "What was on" }` to `PUBLIC_NAV` (034).
- **Rationale**: Both listings render the identical rows — extract once (DRY, and both pages must not drift).
  034's public menu was explicitly designed to grow by hand-maintained entries as pages ship; its data-driven
  `publicNav.test.tsx` stays green when the array grows.
- **Alternatives considered**: duplicating the `<ul>` on both pages (drift risk); a client component (needless).

## R6 — Testing approach

- **Decision**: Integration (real Postgres) for `getPublicHistory` (`< today`, desc) and the `seriesKey` filter
  on both readers, passing explicit `before`/`from` for determinism; jsdom component tests for `SeriesFilter`
  (all series listed, selected marked, `?series=` hrefs incl. `basePath`) and `ScheduleList` (rows + empty). The
  page wiring (`searchParams` → reader → components) is thin and verified in the browser.
- **Rationale**: The DB-window/filter logic belongs in integration; the presentation belongs in component tests;
  neither needs the other. Mirrors 036 + the 034/035 component-test pattern (mock `next/link`).
- **Alternatives considered**: an e2e page render in vitest (awkward for a server page that awaits `searchParams`
  and hits the DB — the domain and component split covers the logic; the browser covers the wiring).
