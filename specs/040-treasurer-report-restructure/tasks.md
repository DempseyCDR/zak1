---

description: "Task list for feature 040 — restructure the treasurer report to mirror QBO data entry (+ comp / gift-card counts)"
---

# Tasks: Restructure the Treasurer Report to Mirror QBO Data Entry (+ comp / gift-card counts)

**Input**: Design documents from `specs/040-treasurer-report-restructure/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/treasurer-report.md, quickstart.md

**Tests**: INCLUDED — the constitution (I. Test-First) is non-negotiable. Each story's new behavior is codified
RED-first (integration on the assembled report, component on the page); the load-bearing invariant is **figure
parity** (no pre-existing money total changes).

**Organization**: Two user stories — **US1 (P1)** the QBO restructure + rent bill, **US2 (P2)** the two
reconciliation counts. No migration, no new endpoint — a report reshape plus three additive fields.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1 / US2 — maps to the spec's user stories
- Every task names an exact file path

## Path Conventions

Single Next.js + Postgres project — `src/server/**`, `src/app/**`, `tests/**` (per plan.md). No
`src/server/db/migrations/` change this feature.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: One shared test-helper extension so a test can seed a deterministic rent + landlord.

- [ ] T001 In `tests/integration/helpers/factories.ts`, extend `makeEvent` to accept optional
  `{ venueId?: string; rentCents?: number }` and pass them through to `createEvent` (so a US1 test can seed an
  event whose `rentCents` is frozen and whose venue carries a landlord). Keep all existing call sites working
  (both new fields optional; behavior unchanged when omitted).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: None — no schema, no shared service change. Both stories extend the same two files
(`reportService.ts`, `treasurer/page.tsx`), so US2 sequences **after** US1 on those files (see Dependencies).
Proceed to US1.

---

## Phase 3: User Story 1 - Report reads in QBO data-entry order (Priority: P1) 🎯 MVP

**Goal**: The report presents an event in QBO order — Sales Receipts (gate/attendance receipt FIRST, then named)
→ Bills (venue rent → landlord, no check line) → Performer Payments → Deposit → Fees — with the rent bill derived
from `resolveEventRentCents` and the venue's landlord; **no computed figure changes**.

**Independent Test**: Generate the report for a seeded event with gate sales, named receipts, a venue with a
landlord + frozen rent, and a performer check; confirm the rent bill amount equals `resolveEventRentCents` with
vendor = the landlord and no check line, the page renders the five sections in order with the gate receipt before
the named receipts, and every pre-existing money total is unchanged. Separately, a **community-dance event with no
venue** confirms the gate receipt is addressed to "Contra Gate" (FR-009), the rent bill shows a $0 line with
vendor `"(no landlord set)"`, and the Print control survives the regroup (FR-011).

### Tests for User Story 1 (write FIRST)

- [ ] T002 [P] [US1] In `tests/integration/treasurer.report.test.ts`, add assertions to the comprehensive
  assembly test (and/or a new `it`): `body.bills` contains the rent bill with `amount ===` the event's
  `resolveEventRentCents` (dollars), `vendor ===` the venue landlord's `displayName`, `class ===` the series
  `qboClass`, and **no** check/payment field. Then add a **second `it`** for a **community-dance event with no
  venue** that asserts, in one case: `body.gateSalesSummary.customer === "Contra Gate"` (FR-009 — the
  community-dance series' gate customer, no special-case code), `bills[0].amount === 0` (the $0 rent line edge —
  no venue ⇒ `resolveEventRentCents` returns 0, and the line is still shown), and
  `bills[0].vendor === "(no landlord set)"` (the missing-landlord vendor). **Leave every existing figure assertion
  unchanged** — their staying green is the FR-010/SC-002 figure-parity proof. Confirm the new assertions FAIL
  against current code. (Covers FR-004, FR-008, FR-009, and the no-venue/$0 edge.)
- [ ] T003 [P] [US1] In `tests/component/treasurer.page.test.tsx`, extend the mock-report fixture with a `bills`
  array (rent → vendor, class, amount) and assert: the page renders sections in order **Sales Receipts → Bills →
  Performer Payments → Deposit → Fees**, the **gate/attendance receipt appears before** the named receipts
  (SC-003), the rent bill row shows vendor + amount with **no** check-number control, and the **Print** control is
  still present after the regroup (FR-011). Confirm it FAILS.

### Implementation for User Story 1

- [ ] T004 [US1] In `src/server/domain/treasurer/reportService.ts`, add `bills: { vendor: string; class: string;
  amount: number }[]` to the `TreasurerReport` type and populate it in `assembleTreasurerReport`: resolve rent via
  `resolveEventRentCents(db, event)` (the `event` row already carries `rentCents/venueId/seriesId/eventDate`),
  resolve the venue's landlord `displayName` (via `events.venueId → venues.landlordContactId → contacts`) with a
  `"(no landlord set)"` fallback, and set `class = qboClass`; **no check/payment line**. Order the returned object
  to QBO shape (Sales Receipts fields, then `bills`, then performer payments, deposit, fees) — cosmetic on the
  JSON; the page controls display. **Touch no existing figure.** Makes T002 pass.
- [ ] T005 [US1] In `src/app/(admin)/treasurer/page.tsx`, add `bills` to the page-local report type and regroup
  the render into QBO order: a **"Sales Receipts"** heading over the existing gate table (FIRST) + named receipts,
  then a new **"Bills"** section listing the rent bill (vendor + class + amount, **no** check control), then
  **"Performer Payments"**, **"Deposit"**, **"Fees"**. Keep the **Print** button. Makes T003 pass.

**Checkpoint**: report reads in QBO order with a derived rent bill; all existing figures unchanged; US1 tests
green. This is a shippable MVP on its own.

---

## Phase 4: User Story 2 - Comp-admission and gift-card-redemption counts (Priority: P2)

**Goal**: The report shows the event's raw comp-admission count and gift-card-redemption count, both always
visible (0 shown), altering no money figure.

**Independent Test**: Generate the report for an event whose door record has non-zero comp + gift-card-redemption
counts; confirm both appear; an event with zero of each shows 0.

### Tests for User Story 2 (write FIRST)

- [ ] T006 [P] [US2] In `tests/integration/treasurer.report.test.ts`, add an `it` that seeds a door record with a
  non-zero `comp_count` and `gift_card_redemption_count` (set directly via a `door_records` update or
  `adjustDoorCount`) and asserts `body.compCount ===` the raw `comp_count` and `body.giftCardRedemptionCount ===`
  the `gift_card_redemption_count`; add a 0/0 case asserting both are `0`. Confirm it FAILS. (Same file as T002 —
  add after it.)
- [ ] T007 [P] [US2] In `tests/component/treasurer.page.test.tsx`, extend the mock-report fixture with the
  `compCount` and `giftCardRedemptionCount` fields and assert both counts render (including a 0 shown, not
  hidden). Confirm it FAILS. (Same file as T003 — add after it.)

### Implementation for User Story 2

- [ ] T008 [US2] In `src/server/domain/treasurer/reportService.ts`, add `compCount: number` and
  `giftCardRedemptionCount: number` to the `TreasurerReport` type and populate them from the already-loaded
  `door` record (`door.compCount` raw — NOT effective comps; `door.giftCardRedemptionCount`). Makes T006 pass.
  (Same file as T004 — sequences after it.)
- [ ] T009 [US2] In `src/app/(admin)/treasurer/page.tsx`, add the two counts to the page-local type and render
  them (a small reconciliation line, e.g. near the gate receipt), both always shown. Makes T007 pass. (Same file
  as T005 — sequences after it.)

**Checkpoint**: both counts surfaced; no money figure changed; US2 tests green.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [ ] T010 Run the full local gate: `pnpm exec tsc --noEmit && pnpm run lint && pnpm exec vitest run` — all green.
  The unchanged existing figure assertions prove **figure parity** (SC-002); `tsc` proves the page/report types
  line up. (Optional manual: sign in as Treasurer, open `/treasurer`, confirm the QBO section order, the rent bill
  to the landlord, the two counts, and that the rent matches the same event's **organizer** report (SC-004); Print
  still works.)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 (factory extension) precedes the US1 integration test that seeds a rent/landlord.
- **US1 (Phase 3)**: after T001. The MVP.
- **US2 (Phase 4)**: after US1 — US2 edits the **same two files** (`reportService.ts`, `treasurer/page.tsx`) and
  the **same two test files**, so it sequences on top of US1's edits (additive fields).
- **Polish (Phase 5)**: after US1 + US2.

### Within / across the stories

- Genuine fail-first: **T002** (rent bill) + **T003** (page order/bill) for US1; **T006** (counts) + **T007**
  (counts render) for US2.
- Same-file sequencing: T004→T008 (`reportService.ts`), T005→T009 (`treasurer/page.tsx`), T002→T006
  (`treasurer.report.test.ts`), T003→T007 (`treasurer.page.test.tsx`).
- The type-driven additions mean `tsc` (T010) flags any page/report mismatch.

### Parallel Opportunities

- **Within US1**: T002 (integration) ‖ T003 (component) — different files.
- **Within US2**: T006 (integration) ‖ T007 (component) — different files (each after its US1 counterpart in the
  same file).
- US1 impl (T004/T005) are different files → can proceed together once their tests are red.

---

## Parallel Example

```bash
# US1 tests together (different files), RED first:
Task: "T002 rent-bill + figure-parity assertions in tests/integration/treasurer.report.test.ts"
Task: "T003 QBO section order + rent-bill render in tests/component/treasurer.page.test.tsx"
```

---

## Implementation Strategy

### MVP (User Story 1)

1. Setup (T001 factory extension).
2. US1 tests RED (T002/T003) → reportService `bills` + landlord/rent (T004) → page QBO regroup + Bills (T005).
   GREEN → shippable.
3. Add US2 (T006/T007 RED → T008/T009) on top of the same files.
4. Polish: full gate (T010) proves figure parity + type alignment; optional manual + organizer-rent cross-check.

---

## Notes

- **No migration, no new endpoint** — reads existing columns (`events.rent_cents/venue_id`, `venue_rents`,
  `venues.landlord_contact_id`, `door_records.comp_count/gift_card_redemption_count`, `series_qbo_map.qbo_class`).
- **Load-bearing invariant**: FR-010 / SC-002 figure parity — every new field is additive; the existing figure
  assertions must stay green **unchanged** (that is the parity proof).
- **Rent = the organizer report's resolver** (`resolveEventRentCents`), so both reports agree (SC-004).
- **Comp count is RAW** (`door.comp_count`), not effective comps — the one confirmable knob (research Decision 4).
- **Out of scope**: defect **D3** (multi-booking check-number capture/edit) and backlog **B42** (reimbursement
  bills). A NULL check number still renders a dash.
- Ships as one atomic commit per repo convention.
