---

description: "Task list for feature 043 — move substitution to /payments + fix multi-booking check numbers"
---

# Tasks: Move Substitution to Payments + Fix Multi-Booking Check Numbers

**Input**: Design documents from `specs/043-payments-substitute-checkfix/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/substitute-and-payment-patch.md,
quickstart.md

**Tests**: INCLUDED — the constitution (I. Test-First) is non-negotiable. R12's re-gate is codified RED-first by
an authz integration test (FS + Booker succeed; neither refused) and component tests (payments gains substitute,
gate loses it); D3's fixes by a component test (checkless guard + multi-line check-number edit) and an integration
test locking the check-number-only PATCH contract.

**Organization**: Two user stories — **US1 (P1)** R12 substitution move + re-gate, **US2 (P1)** D3 multi-booking
check capture + correction. Both edit `src/app/(admin)/payments/page.tsx`, so those edits sequence there. **No
migration, no schema/Zod change** — the only backend change is the substitute route's gate + the service's scope
assertion.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1 / US2 — maps to the spec's user stories
- Every task names an exact file path

## Path Conventions

Single Next.js + Postgres project — `src/server/**`, `src/app/**`, `tests/**` (per plan.md). No
`src/server/db/migrations/` change this feature.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: None. No new dependency, factory, or migration; existing helpers (`makeActor`, `makeEvent`,
`makePerformer`, `createBooking`, `createPerformerPayment`) and routes suffice.

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: None — the two stories are independent apart from both editing `payments/page.tsx` (US2's edits
sequence after US1's on that file). Proceed to US1.

---

## Phase 3: User Story 1 - Substitute from the payments page (Priority: P1) 🎯 MVP

**Goal**: The FS substitutes a performer from `/payments` without a 403; the Booker keeps the bookings-report
modal substitute; the gate substitute control is removed; 024 semantics unchanged.

**Independent Test**: As the FS (settlement permission), substitute from `/payments` → 201 (no 403); as the Booker
(booking permission) → 201; a volunteer with neither → refused; the gate has no substitute control; unpaid
re-point and live-paid (no-show + fresh booking) outcomes match today.

### Tests for User Story 1 (write FIRST)

- [X] T001 [P] [US1] Create `tests/integration/booking.substituteAuthz.test.ts`: seed an event + a booking; call
  `POST /api/bookings/[id]/substitute` (via the route + `jsonReqAs`) as (a) an FS actor granted
  `performer_payment.write` → **201**; (b) a Booker actor granted `booking.write` for the series → **201**; (c) a
  volunteer with neither grant → refused (`UNAUTHORIZED`). Assert the outcome matches 024 for an **unpaid** booking
  (clean re-point) and a **live-paid** booking (original kept as `declined` no-show + a fresh booking for the sub).
  Confirm cases (a)/(c) FAIL against current code (today the route requires `booking.write`, so the FS 403s and a
  no-capability volunteer's result differs). (Use `makeActor` with grants.)
- [X] T002 [P] [US1] Create `tests/component/payments.substitute.test.tsx` (jsdom; mirror the existing
  `tests/component/payments.*.test.tsx` fetch-stub pattern): stub fetch (events/series/bookings/payments), render
  the payments page, assert a **substitute** control exists (pick a booking + find a substitute performer), drive
  it, and assert it POSTs to `/api/bookings/<id>/substitute` with the chosen performer. Confirm it FAILS (no
  substitute control on `/payments` yet).
- [X] T003 [P] [US1] Create `tests/component/gate.noSubstitute.test.tsx` (jsdom; mirror `gate.reload.test.tsx`):
  render the gate page for a selected event and assert there is **no** "Substitute a performer" control
  (`queryByText(/substitute a performer/i)` is null). Confirm it FAILS (the gate still has it).

### Implementation for User Story 1

- [X] T004 [US1] In `src/server/auth/can.ts`, add `assertEventScopeAny(actor, capabilities: Capability[], event)`:
  if `actor` is undefined → return; if the actor holds **any** listed capability for the event's
  `{seriesId, groupId}` (via `actorCan`) → return; else throw `errors.unauthorized(...)`. (Optionally add a unit
  case in `tests/unit/authz.can.test.ts`.)
- [X] T005 [US1] In `src/server/domain/bookings/bookingService.ts`, in `substitutePerformer`, replace the
  `assertBookingScope(db, authz, bookingId)` call with a load of the booking's event + `assertEventScopeAny(authz,
  ["booking.write", "performer_payment.write"], { seriesId, groupId })`. Leave the substitution body (024
  semantics) unchanged. Makes T001's FS/refusal cases pass. (`assertBookingScope` stays for its other callers.)
- [X] T006 [US1] In `src/app/api/bookings/[id]/substitute/route.ts`, change `withAuth({ requires: "booking.write" })`
  to `withAuth({ requires: "base" })` — layer-1 is now "authenticated"; the real gate is the service assertion
  from T005. (Route-inventory test needs no change: `base` is an accepted declaration.)
- [X] T007 [US1] In `src/app/(door)/gate/page.tsx`, remove the "Substitute a performer" `<section>` **and** its
  supporting state/loader/handler (`subBookings`, `subBookingId`, `subMsg`, the bookings loader `useEffect`, and
  the `substitute` function) — plus any now-unused imports. Makes T003 pass.
- [X] T008 [US1] In `src/app/(admin)/payments/page.tsx`, add a **substitute** control: pick a booking on the event,
  then find a substitute performer (reuse the performer-search pattern already on the page for add-settlement-
  performer) → `POST /api/bookings/<bookingId>/substitute` with `{ newPerformerId }`, then refresh. Makes T002
  pass.

**Checkpoint**: the FS substitutes from `/payments` (no 403); the Booker keeps the modal; the gate has none; 024
semantics unchanged. Shippable on its own.

---

## Phase 4: User Story 2 - Multi-booking check numbers: guarded + editable (Priority: P1)

**Goal**: A positive multi-booking check can't be saved with neither a check number nor a comment; the FS can edit
the check number on a multi-booking payment in place, preserving the per-line allocation.

**Independent Test**: Create a positive multi-booking check with no number → must add a check number or a comment
to save. On an existing multi-line payment, add/correct the check number → the number is set and each line's
amount is unchanged.

### Tests for User Story 2 (write FIRST)

- [X] T009 [P] [US2] Create `tests/integration/payments.multiCheckEdit.test.ts`: create a multi-line payment (one
  payee, two bookings) via `createPerformerPayment`; PATCH `/api/performer-payments/[id]` with
  `{ checkNumber: "1792" }` (**no** `lines`); assert the payment's `checkNumber` is `"1792"` and each
  `payment_bookings.amount_cents` is unchanged. (Characterizes the existing PATCH contract — may PASS immediately;
  that is expected and locks FR-008/FR-009.)
- [X] T010 [P] [US2] Create `tests/component/payments.multiCheckGuard.test.tsx` (jsdom; fetch-stub pattern): (a)
  open the multi-apply popup, enter positive amounts for two bookings and **no** check number, try to save →
  assert it is **blocked** until a comment is entered, then saving POSTs `overrideReason` (and no `checkNumber`);
  entering a check number also lets it save. (b) Render a report state with a **multi-line** payment and assert a
  **check-number edit** control is present (not just Void) and that saving it PATCHes `{ checkNumber }` with **no**
  `lines`. Confirm it FAILS against current code (recordMulti has no guard; Edit is gated to single-line).

### Implementation for User Story 2

- [X] T011 [US2] In `src/app/(admin)/payments/page.tsx`, in `recordMulti`, add the FR-014 guard: when the summed
  multi total is **positive** and there is **no** check number, require a **comment** (`multiNote`) before posting
  — block/prompt if neither a check number nor a comment is present. Never force a check number. Makes T010(a)
  pass. (Same file as T008 — sequences after it.)
- [X] T012 [US2] In `src/app/(admin)/payments/page.tsx`, lift the `st.payment.lines.length === 1` gate so a
  **multi-line** payment offers a **check-number-only** edit: PATCH `/api/performer-payments/[id]` with
  `{ checkNumber: value.trim() || null }` and **no** `lines` (preserving the allocation); keep the existing
  single-line amount+check edit unchanged. Makes T010(b) pass. (Same file as T011 — sequences after it.)

**Checkpoint**: positive multi-booking checks require a number or comment; missing numbers are correctable in
place; allocations unchanged.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [X] T013 Run the full local gate: `pnpm exec tsc --noEmit && pnpm run lint && pnpm exec vitest run` — all green.
  The existing 024 substitute tests (`booking.substituteDiscriminator`, `booking.playedGetsBooking`) staying green
  proves semantics unchanged (SC-005); the route-inventory + authz suites prove the re-gate is well-formed.
  (Optional manual per quickstart: FS substitutes on `/payments`, gate has none, Booker modal still works,
  multi-check guard + in-place check-number fix, treasurer report shows the number.)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup / Foundational (Phases 1–2)**: empty.
- **US1 (Phase 3)**: the MVP (R12).
- **US2 (Phase 4)**: independent of US1 **except** both edit `payments/page.tsx` — US2's edits (T011/T012)
  sequence after US1's payments edit (T008). US2's integration test (T009) and backend are otherwise independent.
- **Polish (Phase 5)**: after US1 + US2.

### Within / across the stories

- Genuine fail-first: **T001** (FS 403 today), **T002** (no payments substitute), **T003** (gate still has it) for
  US1; **T010** (no guard / single-line-only edit) for US2. T009 characterizes the existing PATCH contract (may
  pass immediately).
- Same-file sequencing: T008 → T011 → T012 (`payments/page.tsx`).
- Backend order within US1: T004 (helper) → T005 (service uses it) → T006 (route). T001 goes green once T005+T006
  land.

### Parallel Opportunities

- **US1 tests**: T001 ‖ T002 ‖ T003 (different files).
- **US1 backend ‖ client**: T004/T005/T006 (auth/service/route) are independent of T007 (gate) and T008 (payments)
  by file — though T008 precedes US2's payments edits.
- **US2 tests**: T009 ‖ T010 (different files).

---

## Parallel Example

```bash
# US1 tests together (different files), RED first:
Task: "T001 substitute authz (FS + Booker OK; neither refused) in tests/integration/booking.substituteAuthz.test.ts"
Task: "T002 payments substitute control posts in tests/component/payments.substitute.test.tsx"
Task: "T003 gate has no substitute in tests/component/gate.noSubstitute.test.tsx"
```

---

## Implementation Strategy

### MVP (User Story 1 — R12)

1. US1 tests RED (T001/T002/T003) → helper (T004) → service (T005) → route (T006) → gate remove (T007) → payments
   add substitute (T008). GREEN → shippable.
2. US2 (T009/T010 RED → T011 guard → T012 in-place check-number edit) layered on `payments/page.tsx`.
3. Polish: full gate (T013) proves 024 semantics + auth well-formedness; optional manual.

---

## Notes

- **No migration, no schema/Zod change** — D3's correction rides the existing PATCH contract (`checkNumber`
  optional; `lines` optional and only replaces the allocation when present).
- **Either-capability without touching the auth core**: route → `base` (layer 1) + `assertEventScopeAny` over
  `["booking.write","performer_payment.write"]` in the service (layer 2). Same security outcome; refusals still
  audited at the `withAuth` catch.
- **Load-bearing invariant**: 024 substitution semantics + all payment amounts/allocations unchanged (SC-005).
- **Out of scope**: substitution rules; single-performer capture/edit; the treasurer-report shape; the anonymous
  path.
- Ships as one atomic commit per repo convention.
