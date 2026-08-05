# Quickstart & Validation: Dance History Page + Series Filter

Proof the history page + filter work. See [contracts/public-listings.md](contracts/public-listings.md) and
[data-model.md](data-model.md).

## Prerequisites

- Node 24 + pnpm; local Postgres for the integration tests. No migration.

## Automated validation (primary)

Written first, per Constitution I:

```bash
# History window + descending + series filter (real Postgres):
pnpm exec vitest run tests/integration/publicHistory.test.ts
# Series filter on the (upcoming) schedule reader:
pnpm exec vitest run tests/integration/publicSchedule.test.ts
# Shared components (jsdom):
pnpm exec vitest run tests/component/seriesFilter.test.tsx tests/component/scheduleList.test.tsx
```

Expected:

- **History** — seeded past/today/future events: `getPublicHistory(db, "<ref-today>")` returns only
  `event_date < ref` in **descending** order; a `seriesKey` argument narrows to that series.
- **Schedule filter** — `getPublicSchedule(db, from, seriesKey)` returns only the given series within its window.
- **`SeriesFilter`** — renders an "All" link + one link per series with `?series=<key>` (and `basePath`); the
  selected series is marked; "All" active when none selected.
- **`ScheduleList`** — renders one row per item linking to `/whats-on/<eventId>`; shows the empty message when
  empty.

Full gate before commit:

```bash
pnpm exec tsc --noEmit && pnpm run lint && pnpm exec vitest run
```

## Manual validation (visual)

```bash
pnpm dev   # http://localhost:3000
```

1. Open `/what-was-on` — only past dances, most recent first; each opens its `/whats-on/<id>` detail.
2. Open `/whats-on` — the series filter appears; recent + upcoming as before (036).
3. On either page, click a series in the filter → URL becomes `?series=<key>` and only that series' dances show;
   click **All** → all return. Reload the filtered URL → same filtered view (shareable).
4. The public menu now includes **What was on** (from feature 034's list) on every page.

## Success-criteria mapping

| Criterion | How validated |
|-----------|---------------|
| SC-001 (history, most recent first) | `publicHistory` integration + step 1 |
| SC-002 (last week in history not home; yesterday in both) | history + `publicSchedule` window tests + steps 1–2 |
| SC-003 (filter narrows; clear restores) | filter integration + `SeriesFilter` component + step 3 |
| SC-004 (filtered view shareable by URL) | step 3 (reload filtered URL) |
| SC-005 (history entry → same detail) | `ScheduleList` component + step 1 |
