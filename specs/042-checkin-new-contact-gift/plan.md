# Implementation Plan: Gift-Card Option When Checking In a Named Contact (new or returning)

**Branch**: `042-checkin-new-contact-gift` | **Date**: 2026-08-06 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/042-checkin-new-contact-gift/spec.md`

## Summary

Add a **gift-card** checkbox to the two named-person door check-in paths — the **new-contact** section and the
**returning/matched-contact** row (`CandidateRow`) — and wire the already-supported `redeemedGiftCard` flag into
their submit bodies, alongside the existing comp option. This is a **client-only** change: the API boundary schema
(`attendanceSchema`) already spreads `countExtras` (`isComp` + `redeemedGiftCard`) into **all three** variants
(matched / new-contact / unmatched), and `recordAttendance` already increments the door record's
`giftCardRedemptionCount` for any check-in carrying the flag. Only the anonymous/unmatched UI exposed it before;
this closes the gap for the two named paths. **No schema, no service, no route, no migration.**

## Technical Context

**Language/Version**: TypeScript 5.7 (strictest flags)

**Primary Dependencies**: Next.js 16 App Router (client component) — the door check-in page
`src/app/(door)/checkin/page.tsx`. Backend already in place: `validation/attendance.ts` (`attendanceSchema`
accepts `redeemedGiftCard` on every variant) + `attendanceService.recordAttendance` (increments
`door_records.gift_card_redemption_count`).

**Storage**: PostgreSQL — **no migration**. The `door_records.gift_card_redemption_count` column already exists
and is already incremented for the anonymous path.

**Testing**: Vitest — component (jsdom, RTL) asserting each named path renders a "Gift card" checkbox and that
ticking it sends `redeemedGiftCard: true` in the attendance POST body; integration asserting the route + service
increment `giftCardRedemptionCount` for a new-contact and a matched-contact body (locking the contract the UI
relies on). Test-first.

**Target Platform**: Web (Next.js App Router) + Postgres

**Project Type**: Single Next.js + Postgres web app

**Performance Goals**: N/A — a UI toggle; no new request or query.

**Constraints**: Comp and gift-card stay **independent** (both/either/neither); the gift-card flag is a
counts-only, never-attributed boolean (per `countExtras` design); no other check-in behavior changes
(FR-004/FR-005). Anonymous path unchanged.

**Scale/Scope**: 1 source file edited (`checkin/page.tsx`) — two checkboxes + two wired submit fields + one type
field on `PersonExtras`; ~2 test files (1 component, 1–2 integration). 0 migrations, 0 new endpoints, 0 backend
changes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Test-First (NON-NEGOTIABLE)** — PASS. RED-first: a component test that fails because the "Gift card"
  checkbox is absent on the new-contact section and the `CandidateRow`, and that (once present) asserts the POST
  body carries `redeemedGiftCard: true`; integration assertions that a `newContact`/`contactId` body with
  `redeemedGiftCard: true` increments `giftCardRedemptionCount` (and comp+gift together bumps both counts).
- **II. Simplicity / YAGNI** — PASS. No backend work — the schema and service already accept and handle the flag;
  the change is two checkboxes and their wiring, mirroring the anonymous path exactly. Nothing added but UI.
- **III. Type Safety** — PASS. `PersonExtras` gains `redeemedGiftCard?: boolean`; the API boundary is already
  validated by `attendanceSchema` (Zod). No escape hatches.
- **IV. Observability** — PASS (unchanged). No endpoint added; the existing attendance audit/logging is untouched.

**Result**: All gates pass. Complexity Tracking empty.

## Project Structure

### Documentation (this feature)

```text
specs/042-checkin-new-contact-gift/
├── plan.md · research.md · data-model.md · quickstart.md
├── contracts/checkin-attendance.md
├── checklists/requirements.md
└── tasks.md            # /speckit-tasks (NOT created here)
```

### Source Code (repository root)

```text
EDIT (one file):
  src/app/(door)/checkin/page.tsx
    - New-contact section: add a `newGift` state + a "Gift card" checkbox next to the existing "Comp" checkbox;
      wire `...(newGift ? { redeemedGiftCard: true } : {})` into the new-contact submit body (checkInNew).
    - CandidateRow (matched/returning path): add `redeemedGiftCard?: boolean` to `PersonExtras`; add a `gift`
      state + a "Gift card" checkbox next to its "Comp" checkbox; wire
      `...(gift ? { redeemedGiftCard: true } : {})` into its `checkIn()`.

TESTS:
  tests/component/checkin.giftCard.test.tsx  (NEW, jsdom)   # both named paths render a "Gift card" checkbox and
                                                            #   send redeemedGiftCard:true in the POST body
  tests/integration/door.attendance-new.test.ts            # newContact + redeemedGiftCard → giftCardRedemption
                                                            #   count +1; comp+gift → both counts +1
  tests/integration/door.attendance-match.test.ts          # contactId + redeemedGiftCard → giftCardRedemption
                                                            #   count +1

NO backend change · NO migration · NO new/changed route or schema (attendanceSchema already accepts the flag on
every variant; recordAttendance already increments the count).
```

**Structure Decision**: Single Next.js + Postgres project. The change lives entirely in the client check-in page.
Two user stories map to the two named paths — **US1** new-contact, **US2** returning/matched — both P1, both
editing the **same file** (`checkin/page.tsx`) and the same component test, so they sequence on that file rather
than running in parallel. The backend is already complete: `attendanceSchema` spreads `countExtras`
(`redeemedGiftCard`) into all three union variants, and `recordAttendance` keys off `"redeemedGiftCard" in input`
to bump `giftCardRedemptionCount` — so the integration tests characterize an already-working contract, while the
component tests cover the genuinely new UI. No computed figure or other path changes (FR-004/FR-005/SC-004).

## Complexity Tracking

> No Constitution Check violations — table intentionally empty.
