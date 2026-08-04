# Quickstart & Validation: What's On — Home Page Window

How to prove the widened window works. See [contracts/public-schedule.md](contracts/public-schedule.md) and
[data-model.md](data-model.md) for the details.

## Prerequisites

- Node 24 + pnpm; local Postgres for the integration test. No migration for this feature.

## Automated validation (primary)

Written first, per Constitution I:

```bash
# Pure helper — boundary + month/year rollover:
pnpm exec vitest run tests/unit/publicScheduleWindow.test.ts

# Window behavior against real Postgres (seed around a fixed reference date, explicit `from`):
pnpm exec vitest run tests/integration/publicSchedule.test.ts
```

Expected:

- **Unit** — `homeWindowStart("2026-08-04") === "2026-08-02"`; `"2026-03-01" → "2026-02-27"`;
  `"2026-01-01" → "2025-12-30"`.
- **Integration** — with a reference "today" and events seeded at ref−1, ref−2, ref−3, and a future date:
  `getPublicSchedule(db, homeWindowStart(ref))` returns ref−2 (included), ref−1, and the future event, **not**
  ref−3, in ascending date order.

Full gate before commit:

```bash
pnpm exec tsc --noEmit && pnpm run lint && pnpm exec vitest run
```

## Manual validation (visual)

```bash
pnpm dev   # http://localhost:3000/whats-on
```

- The list starts with the most recent past dance (within two days) at the top, then upcoming dances in ascending
  order. A dance from yesterday is present; nothing older than two days appears. (Optionally confirm the
  empty-state wording if that polish was applied.)

## Success-criteria mapping

| Criterion | How validated |
|-----------|---------------|
| SC-001 (yesterday/today visible) | Integration (ref−1 included) + manual |
| SC-002 (2 days ago in, 3 days ago out) | Unit + integration boundary case |
| SC-003 (ascending order) | Integration order assertion + manual |
| SC-004 (all future still visible) | Integration (future event included) |
