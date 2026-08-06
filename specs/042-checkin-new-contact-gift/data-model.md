# Phase 1 Data Model: Gift-Card Option on Named-Person Check-In

**No database change.** No new entity, column, index, or migration. The relevant data already exists and is
already written for the anonymous path.

## Existing data (unchanged, now reachable from two more UI paths)

| Entity / field | Where | Role |
|----------------|-------|------|
| `door_records.gift_card_redemption_count` | schema `door.ts` | Per-event count of gift cards redeemed for admission. Already incremented by `recordAttendance` when a check-in carries `redeemedGiftCard`. This feature lets the two named paths set that flag. |
| `door_records.comp_count` | schema `door.ts` | Per-event comp (free admission) count. Unchanged; the comp checkbox already sets it on all paths. |

## API-boundary contract (unchanged)

`attendanceSchema` (`validation/attendance.ts`) already accepts `redeemedGiftCard?: boolean` on **all three**
variants via the shared `countExtras`:

- `{ contactId, …personExtras, …countExtras }` — matched/returning
- `{ newContact: {…}, …personExtras, …countExtras }` — new contact
- `{ unmatched: true, childrenCount?, …countExtras }` — anonymous

`countExtras = { isComp?, redeemedGiftCard? }` are **counts-only, never attributed** — booleans that materialize
into door-record counts and are never stored on the attendance row.

## Client type change (the only type touched)

- `PersonExtras` (local to `checkin/page.tsx`, used by `CandidateRow`): add `redeemedGiftCard?: boolean` (was
  `{ childrenCount?, isComp?, isOpenBand? }`). The new-contact section builds its POST body inline, so it needs
  only a new `newGift` boolean state, no type change.

## Behavior (per FR)

- New-contact submit body gains `...(newGift ? { redeemedGiftCard: true } : {})` (FR-001/FR-002).
- `CandidateRow.checkIn()` gains `...(gift ? { redeemedGiftCard: true } : {})` (FR-001/FR-002).
- Comp and gift are independent (FR-003); neither selected ⇒ unchanged body (FR-004); no other field/behavior
  changes (FR-005).

## Invariants

- One gift-card redemption per named check-in marked gift-card ⇒ `giftCardRedemptionCount += 1` (SC-002).
- Comp + gift together ⇒ `compCount += 1` **and** `giftCardRedemptionCount += 1` (SC-003).
- The anonymous path and all computed figures are untouched (SC-004).
