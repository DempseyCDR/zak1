# Implementation Plan: Restructure the Treasurer Report to Mirror QBO Data Entry (+ comp / gift-card counts)

**Branch**: `040-treasurer-report-restructure` | **Date**: 2026-08-05 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/040-treasurer-report-restructure/spec.md`

## Summary

Reshape the treasurer report so it reads in QBO data-entry order — **Sales Receipts** (gate/attendance receipt
first, then named receipts) → **Bills** (venue rent → landlord, no check line) → **Performer Payments** (one
section) → **Deposit** → **Fees** — and surface two reconciliation counts (comp admissions, gift-card
redemptions). Technically this is a **report reshape plus two additive data points**, no schema change: the
assembly gains a derived **rent bill** (amount via the organizer report's own `resolveEventRentCents(db, event)`;
vendor = the venue's landlord contact) and the two door-record counts (`comp_count`,
`gift_card_redemption_count`), and the treasurer page regroups its existing sections under the five QBO headings
in order. **No computed money figure changes** — gate, named, performer, reconciliation, deposit, and fee amounts
are untouched; the reshape only reorders/relabels/groups and adds the rent bill + counts.

## Technical Context

**Language/Version**: TypeScript 5.7 (strictest flags)

**Primary Dependencies**: Next.js 16 App Router (RSC) · Drizzle · the treasurer domain (`reportService.ts`) + the
`/treasurer` page; reuses `resolveEventRentCents` (parameters/rentService, feature 020 dynamic rent), the venue
`landlordContactId` (feature 018), and `door_records.comp_count` / `gift_card_redemption_count`.

**Storage**: PostgreSQL — **no migration**. Reads existing columns only (`events.rent_cents`/`venue_id`,
`venue_rents`, `venues.landlord_contact_id`, `door_records.comp_count`/`gift_card_redemption_count`).

**Testing**: Vitest against real Postgres — integration on `assembleTreasurerReport` (rent bill amount +
landlord vendor, the two counts, and a **figure-parity** guard that every existing money total is unchanged);
component (jsdom) on the page (section order, rent bill, counts). Test-first.

**Target Platform**: Web (Next.js App Router) + Postgres

**Project Type**: Single Next.js + Postgres web app

**Performance Goals**: N/A — the report gains one venue/landlord lookup and one rent resolution per event
(bounded, same as the organizer report).

**Constraints**: Money stays integer cents; **no computed figure may change** (FR-010 / SC-002); comp count is
**raw** `comp_count` (Assumptions / resolved in research); scope is P6-R8 + P6-R9 only — **defect D3**
(multi-booking check-number capture/edit) and **B42** (reimbursement bills) are out of scope.

**Scale/Scope**: ~2 source edits (reportService, treasurer page), ~2 test edits (+ a small `makeEvent` factory
extension for `venueId`/`rentCents`), 0 migrations, 0 new endpoints.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Test-First (NON-NEGOTIABLE)** — PASS. New behavior is codified RED-first: an integration assertion that the
  report exposes a rent bill whose amount equals `resolveEventRentCents` for the event and whose vendor is the
  venue's landlord (and "(no landlord set)" when absent), plus `compCount` / `giftCardRedemptionCount`
  assertions, plus a **parity** assertion that the pre-existing figures (gate totals, deposit, fees, performer
  amounts, reconciliation) are unchanged. A component test asserts the page renders the five sections in QBO
  order with the gate receipt before named receipts, the rent bill, and the two counts.
- **II. Simplicity / YAGNI** — PASS. No schema, no new endpoint, no new service — the rent value comes from the
  **existing** `resolveEventRentCents` (the same resolver the organizer report uses), the landlord from the
  existing `venues.landlord_contact_id`, and the counts from the existing door record. The reshape is grouping +
  ordering on the page and three added fields on the report type.
- **III. Type Safety** — PASS. `TreasurerReport` gains `bills`, `compCount`, `giftCardRedemptionCount` (typed);
  the GET route has no request body, so no new Zod boundary. `tsc` covers the page's local report type.
- **IV. Observability** — PASS (unchanged). The report-generation audit (`treasurer_report.generated`) still
  fires; no endpoint added or removed.

**Result**: All gates pass. Complexity Tracking empty.

## Project Structure

### Documentation (this feature)

```text
specs/040-treasurer-report-restructure/
├── plan.md · research.md · data-model.md · quickstart.md
├── contracts/treasurer-report.md
├── checklists/requirements.md
└── tasks.md            # /speckit-tasks (NOT created here)
```

### Source Code (repository root)

```text
EDIT:
  src/server/domain/treasurer/reportService.ts   # add `bills` (rent → landlord vendor, class, amount via
                                                 #   resolveEventRentCents(db, event)), `compCount` (raw
                                                 #   door.comp_count), `giftCardRedemptionCount` to the
                                                 #   TreasurerReport type + assembly; resolve the venue's
                                                 #   landlord display name; NO change to existing figures
  src/app/(admin)/treasurer/page.tsx             # regroup into QBO order: "Sales Receipts" (gate receipt FIRST,
                                                 #   then named) → "Bills" (rent) → "Performer Payments" →
                                                 #   "Deposit" → "Fees"; render the rent bill + the two counts;
                                                 #   keep the Print button; extend the page-local report type

TESTS:
  tests/integration/treasurer.report.test.ts     # rent bill (amount == resolveEventRentCents, vendor ==
                                                 #   landlord; "(no landlord set)" edge), compCount +
                                                 #   giftCardRedemptionCount, and a figure-parity guard
  tests/component/treasurer.page.test.tsx        # section order (gate before named; five sections), rent bill,
                                                 #   counts; extend the mock-report fixture with bills + counts
  tests/integration/helpers/factories.ts         # extend makeEvent with optional { venueId, rentCents } so a
                                                 #   test can seed a deterministic rent + landlord

NO migration · NO new route (GET /api/events/[id]/treasurer-report already returns the assembled report).
```

**Structure Decision**: Single Next.js + Postgres project. The report **data** shape grows by three fields
(`bills`, `compCount`, `giftCardRedemptionCount`); the **QBO ordering** (Sales Receipts → Bills → Performer
Payments → Deposit → Fees) is realized on the treasurer **page** (the handoff artifact), with the gate receipt and
named receipts kept as the two existing fields rendered in that order under a shared "Sales Receipts" heading — no
churn to the existing field names (and therefore none to the existing integration assertions on
`gateSalesSummary` / `namedCustomerReceipts`, beyond the additive ones). Community-dance gate-to-Contra-Gate
(FR-009) needs **no code** — it falls out of per-event assembly (the series' `gate_customer` is already "Contra
Gate"). Figure parity (FR-010 / SC-002) is the load-bearing invariant: the new fields are purely additive.

## Complexity Tracking

> No Constitution Check violations — table intentionally empty.
