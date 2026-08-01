# Quickstart / Validation: Bookings report defaults to descending date (P5-R2)

Bash runs Node 24 (no prefix). Prereqs: `pnpm install` done; local Postgres up (`zak1_dev`/`zak1_test`).

## Automated validation (the gate)

```bash
pnpm exec vitest run tests/integration/bookingsReport.booker.test.ts tests/component/bookingsReport.test.tsx
pnpm exec tsc --noEmit
pnpm exec eslint src/app/(admin)/bookings-report/page.tsx src/app/api/bookings/report/route.ts src/server/domain/bookings/reportService.ts
pnpm exec prettier --check <changed files>
pnpm test          # full suite green
pnpm build         # production build clean
```

### Expected assertions (the behavior this feature delivers)

- **US1 / FR-001 (component)**: on first render the report page requests `/api/bookings/report?...sort=desc`
  with no interaction; rows render newest-first.
- **FR-002 (integration/service)**: `assembleBookingsReport(db, {})` returns rows ordered by date
  **descending**; `assembleBookingsReport(db, { sort: "asc" })` returns them ascending.
- **FR-003 (component)**: activating the sort toggle once flips the request to `sort=asc`; activating it
  again returns to `sort=desc`. Both directions still reachable.
- **FR-004 (full suite)**: every other bookings-report assertion (venue short name, status letters, filters,
  band re-point, modals) stays green — nothing but the default direction changed.

## Manual smoke (optional)

1. `pnpm dev`, sign in as staff, open `/bookings-report`.
2. Confirm the topmost row is the newest-relevant event and rows descend by date, before touching anything.
3. Click **Sort: date ↓** once → order flips to ascending (↑); click again → back to descending (↓).
