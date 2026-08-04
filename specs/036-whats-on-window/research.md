# Phase 0 Research: What's On — Home Page Window

The spec is unambiguous (fixed 2-day lookback, ascending, overlap-with-history deliberate). No open
`NEEDS CLARIFICATION`. The remaining decisions are technical, resolved below.

## R1 — Where the two-day lookback lives

- **Decision**: A named constant + pure helper in `src/server/domain/public/publicSchedule.ts`:
  `HOME_WINDOW_LOOKBACK_DAYS = 2` and `homeWindowStart(today: string): string` returning `today − 2 days`.
  `getPublicSchedule`'s default becomes `from = homeWindowStart(today())`.
- **Rationale**: FR-003 wants the lookback expressed as one clear, testable value. A pure helper is unit-testable
  without a clock or a DB, and the one constant is the single edit point. The service keeps its injectable
  `from`, so nothing else changes.
- **Alternatives considered**: inline `today() - 2` at the query (not independently testable); a configurable
  window (YAGNI — the decision is a fixed 2 days).

## R2 — Date arithmetic (calendar-date, UTC)

- **Decision**: `homeWindowStart` parses `today` as a UTC date (`new Date(`${today}T00:00:00Z`)`), subtracts
  days via `setUTCDate`, and formats back with `toISOString().slice(0, 10)`.
- **Rationale**: The existing `today()` already derives the current date from `toISOString().slice(0,10)` (UTC),
  and `event_date` is a DATE column compared as a calendar date. Staying in UTC keeps the new lower bound
  consistent with the existing upper-open query and avoids DST/local-offset drift. `setUTCDate` handles
  month/year rollover correctly (e.g. `2026-03-01 − 2 = 2026-02-27`).
- **Alternatives considered**: local-time `Date` math (offset/DST drift vs. the UTC `today()`); string math
  (error-prone across month boundaries).

## R3 — Testing approach (deterministic, no clock mocking)

- **Decision**: (1) a **unit** test of `homeWindowStart` for the boundary and month/year rollover; (2) an
  **integration** test that seeds events around a fixed reference date and calls
  `getPublicSchedule(db, homeWindowStart("<ref>"))`, asserting 2-days-ago is included, 3-days-ago excluded,
  future included, and ascending order.
- **Rationale**: The pure helper is tested directly; the query window is tested by passing an explicit `from`
  (the pattern the existing `publicSchedule.test.ts` already uses). The trivial glue (`default =
  homeWindowStart(today())`) stays untested against the real clock — consistent with the existing untested
  `today()` default — avoiding a flaky clock-dependent test.
- **Alternatives considered**: mocking the system clock to test the real default (flaky, heavier); an e2e page
  test (out of proportion — the domain test is the right level).

## R4 — Empty-state wording (optional polish)

- **Decision**: Optionally reword the page's empty state from "No upcoming dances scheduled" to a phrasing that
  fits recent + upcoming (e.g. "No dances to show"). Treated as optional polish, not a behavioral requirement.
- **Rationale**: With the widened window the message is mildly inaccurate; a one-line copy tweak keeps it honest.
  Kept optional so the core change (the window) stands alone.
- **Alternatives considered**: leaving the wording (acceptable — purely cosmetic).
