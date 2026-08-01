# Research: Bookings report defaults to descending date (P5-R2)

No open `NEEDS CLARIFICATION` items — the feature is a bounded default flip. The decisions below record the
grounded current state and the chosen approach.

## R1 — Where the default lives (grounded)

**Decision**: Change the default in the **three** places that already branch on `sort`, so they agree.

- `src/app/(admin)/bookings-report/page.tsx:106` — `const [sort, setSort] = useState<"asc" | "desc">("asc")`.
  The page always sends `sort` explicitly (`p.set("sort", sort)`), so this state **is** the visible default.
  → change initial state to `"desc"`.
- `src/server/domain/bookings/reportService.ts` — `.orderBy(filters.sort === "desc" ? desc(...) : asc(...))`.
  With `sort` undefined this defaults ascending. → make the default branch descending
  (`filters.sort === "asc" ? asc(...) : desc(...)`), and fix the field comment (`sort?: … default asc` →
  `default desc`).
- `src/app/api/bookings/report/route.ts` — `sort: p.get("sort") === "desc" ? "desc" : "asc"`. An absent or
  unrecognized `sort` param coerces to ascending. → coerce an absent/unrecognized param to `"desc"`
  (`p.get("sort") === "asc" ? "asc" : "desc"`).

**Rationale**: The page drives the on-screen default; the service default governs a direct un-parameterized
`assembleBookingsReport(db, {})` call (used by tests and any future caller); the route default governs the
HTTP boundary when `sort` is omitted. Flipping all three keeps FR-001 (initial view) and FR-002
(no-sort request) consistent — otherwise a direct `GET /api/bookings/report` with no `sort` would disagree
with the page.

**Alternatives considered**: (a) Change only the page state — rejected: leaves the service/route defaulting
ascending, so FR-002 fails and the surfaces disagree. (b) Add a persisted per-user sort preference — rejected
as YAGNI (spec explicitly keeps sort transient; no request for persistence).

## R2 — Test-first encoding of the new default

**Decision**: Update the existing ordering-default assertions to the new expectation **before** flipping the
code (Red), then flip (Green).

- `tests/integration/bookingsReport.booker.test.ts` currently asserts `assembleBookingsReport(db, {})` →
  ascending. Change the no-arg call to expect **descending**, and add an explicit `{ sort: "asc" }` assertion
  so the ascending path stays covered. This is the FR-002 red test.
- `tests/component/bookingsReport.test.tsx` currently asserts that clicking the toggle re-requests
  `sort=desc`. Since `desc` becomes the default, change it to assert the **initial** request carries
  `sort=desc`, and that one toggle flips to `sort=asc` (FR-001 + FR-003).

**Rationale**: Constitution I (Test-First). The behavior change is a default flip, so the "failing test that
describes the desired behavior" is the updated assertion; it fails against today's ascending default and
passes once the three defaults flip.

**Alternatives considered**: Adding brand-new test files and leaving the old assertions asserting ascending —
rejected: they would then contradict the new default and fail. The old assertions must move to the new truth.

## R3 — Scope containment

**Decision**: Touch only the bookings report (page + its service default + its route). Do **not** change any
other report, the tie-break/secondary ordering, or add a saved preference.

**Rationale**: Spec Assumptions bound scope to a default flip on this one report. The shared event selector
(028) already defaults descending elsewhere; this closes the last ascending-default surface (SC-003) without
touching unrelated code.

**Alternatives considered**: Generalizing a shared "default sort direction" constant across reports — rejected
as YAGNI (only one report has this sort).
