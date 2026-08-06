---

description: "Task list for feature 042 — gift-card option on the named-person check-in paths (new + returning)"
---

# Tasks: Gift-Card Option When Checking In a Named Contact (new or returning)

**Input**: Design documents from `specs/042-checkin-new-contact-gift/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/checkin-attendance.md, quickstart.md

**Tests**: INCLUDED — the constitution (I. Test-First) is non-negotiable. The new UI (a "Gift card" checkbox on
each named path) is codified RED-first by a component test asserting the checkbox exists and puts
`redeemedGiftCard: true` in the POST body; integration cases lock the already-supported data contract (the count
increments).

**Organization**: Two user stories — **US1 (P1)** new-contact path, **US2 (P1)** returning/matched-contact path.
Both edit the **same file** (`checkin/page.tsx`) and the same component test, so they sequence there. This is a
**client-only** feature — the API schema + service + route already accept and act on `redeemedGiftCard` on every
variant; no backend change, no migration.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1 / US2 — maps to the spec's user stories
- Every task names an exact file path

## Path Conventions

Single Next.js + Postgres project — the change lives in `src/app/(door)/checkin/page.tsx`; tests in `tests/**`.
No `src/server/**` change, no `src/server/db/migrations/` change.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: None. No new dependency, factory, or migration — existing helpers (`makeEvent`, the contacts +
attendance routes) and the existing `door_records.gift_card_redemption_count` column suffice.

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: None — the backend already accepts `redeemedGiftCard` on all attendance variants and increments the
count. Proceed to US1.

---

## Phase 3: User Story 1 - Gift-card on the new-contact path (Priority: P1) 🎯 MVP

**Goal**: When checking in a **new** contact, the attendant can mark a gift-card redemption (independent of comp);
the event's gift-card-redemption count goes up by one.

**Independent Test**: Check in a new contact with the gift-card option selected → the attendee is recorded and the
event's gift-card-redemption count is 1; comp+gift together bumps both counts.

### Tests for User Story 1 (write FIRST)

- [ ] T001 [P] [US1] In `tests/integration/door.attendance-new.test.ts`, add an `it`: POST
  `{ newContact: { firstName: … }, redeemedGiftCard: true }` to `/api/events/[id]/attendance`, then read the
  event's door record and assert `giftCardRedemptionCount === 1`. Add a second `it`: `{ newContact, isComp: true,
  redeemedGiftCard: true }` → `compCount === 1` **and** `giftCardRedemptionCount === 1`. (These characterize the
  already-supported contract — they may PASS immediately since the backend accepts the flag; that is expected and
  still locks SC-002/SC-003.)
- [ ] T002 [P] [US1] Create `tests/component/checkin.giftCard.test.tsx` (jsdom via `// @vitest-environment jsdom`
  docblock; mirror `tests/component/checkin.inlineRow.test.tsx` — stub `fetch`, capture POST `{url, init}` calls,
  render `CheckinPage`). For the **new-contact** section: assert a **"Gift card"** checkbox is present; fill the
  new-contact name, tick Gift card, confirm the check-in, and assert the captured `/api/events/…/attendance` POST
  body parses to include `redeemedGiftCard: true`. Add a comp+gift case asserting the body has both `isComp: true`
  and `redeemedGiftCard: true`. Confirm the checkbox assertion FAILS against current code.

### Implementation for User Story 1

- [ ] T003 [US1] In `src/app/(door)/checkin/page.tsx`, add a `newGift` state (`useState(false)`) and a **"Gift
  card"** checkbox in the new-contact section next to the existing "Comp" checkbox (mirror `newComp`); wire
  `...(newGift ? { redeemedGiftCard: true } : {})` into the new-contact submit body (the `recordNewContact()`
  handler, alongside `...(newComp ? { isComp: true } : {})`). Reset `newGift` on the same path the section resets
  other new-contact fields. Makes T002 pass (T001 already green).

**Checkpoint**: new-contact check-in can record a gift-card redemption; US1 tests green. Shippable MVP on its own.

---

## Phase 4: User Story 2 - Gift-card on the returning/matched-contact path (Priority: P1)

**Goal**: When checking in a **returning** contact from the search results, the attendant can mark a gift-card
redemption (independent of comp); the count goes up by one.

**Independent Test**: Check in an existing contact with the gift-card option selected → recorded and the event's
gift-card-redemption count is 1.

### Tests for User Story 2 (write FIRST)

- [ ] T004 [P] [US2] In `tests/integration/door.attendance-match.test.ts`, add an `it`: create a contact (via the
  contacts route, as the file already does), POST `{ contactId, redeemedGiftCard: true }` to the attendance route,
  then assert the event's door record `giftCardRedemptionCount === 1`. (Characterizes the supported contract; may
  PASS immediately — expected.)
- [ ] T005 [US2] In `tests/component/checkin.giftCard.test.tsx` (from T002), add a case for a **matched candidate
  row** (`CandidateRow`): assert its row renders a **"Gift card"** checkbox; tick it, confirm the row's check-in,
  and assert the captured attendance POST body includes `redeemedGiftCard: true`. Confirm it FAILS against current
  code. (Same file as T002 — add after it.)

### Implementation for User Story 2

- [ ] T006 [US2] In `src/app/(door)/checkin/page.tsx`, add `redeemedGiftCard?: boolean` to the local
  `PersonExtras` type; in `CandidateRow` add a `gift` state (`useState(false)`) and a **"Gift card"** checkbox next
  to its "Comp" checkbox (mirror the `comp` control, with `aria-label="Gift card"`); wire
  `...(gift ? { redeemedGiftCard: true } : {})` into its `checkIn()` body. Makes T005 pass. (Same file as T003 —
  sequences after it.)

**Checkpoint**: both named paths can record a gift-card redemption; US2 tests green.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [ ] T007 Run the full local gate: `pnpm exec tsc --noEmit && pnpm run lint && pnpm exec vitest run` — all green.
  `tsc` proves the `PersonExtras` field lines up; the full suite proves no other check-in behavior changed
  (SC-004). (Optional manual: sign in as a Door Attendant, open `/checkin`, confirm both a new contact and a
  returning contact show a Gift-card checkbox and that ticking it records a redemption; the anonymous path is
  unchanged.)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup / Foundational (Phases 1–2)**: empty — nothing blocks the stories.
- **US1 (Phase 3)**: the MVP.
- **US2 (Phase 4)**: edits the **same file** (`checkin/page.tsx`) and the **same component test**
  (`checkin.giftCard.test.tsx`) as US1, so it sequences on those; its **integration** test is a different file
  (`door.attendance-match.test.ts`) and is independent.
- **Polish (Phase 5)**: after US1 + US2.

### Within / across the stories

- Genuine fail-first: **T002** (new-contact checkbox) for US1; **T005** (matched-row checkbox) for US2. The
  integration cases (T001/T004) lock the data contract and may pass immediately (the backend already supports the
  flag).
- Same-file sequencing: T003 → T006 (`checkin/page.tsx`); T002 → T005 (`checkin.giftCard.test.tsx`).
- Different-file parallel: T001 ‖ T002 (US1); T004 is independent of the US2 component work.

### Parallel Opportunities

- **US1**: T001 (integration) ‖ T002 (component) — different files.
- **US2**: T004 (integration) is independent; T005/T006 sequence after their US1 counterparts (shared files).

---

## Parallel Example

```bash
# US1 tests together (different files), RED/characterization first:
Task: "T001 newContact + gift count assertions in tests/integration/door.attendance-new.test.ts"
Task: "T002 new-contact Gift-card checkbox + POST body in tests/component/checkin.giftCard.test.tsx (new)"
```

---

## Implementation Strategy

### MVP (User Story 1)

1. US1 tests (T001 integration, T002 component RED) → new-contact checkbox + wiring (T003). GREEN → shippable.
2. US2 (T004 integration, T005 component RED → T006 CandidateRow checkbox + wiring) on the same file.
3. Polish: full gate (T007) proves type alignment + no other behavior changed; optional manual.

---

## Notes

- **Client-only, no migration, no backend change** — `attendanceSchema` already spreads `countExtras`
  (`isComp` + `redeemedGiftCard`) into all three variants, and `recordAttendance` already increments
  `door_records.gift_card_redemption_count`. This feature only exposes/wires the checkbox on the two named paths.
- **Independent toggles**: comp and gift-card are separate (both/either/neither), mirroring the anonymous path.
- **Load-bearing invariant**: FR-004/FR-005/SC-004 — no other check-in behavior changes; the anonymous path is
  untouched.
- **Out of scope**: gift-card *sales*, per-card data, and any change to the anonymous path.
- Ships as one atomic commit per repo convention.
