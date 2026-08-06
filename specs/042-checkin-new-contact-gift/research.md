# Phase 0 Research: Gift-Card Option on Named-Person Check-In

No NEEDS CLARIFICATION remained in Technical Context. This records the design decisions and the code they are
grounded in.

## Decision 1: Client-only change — the backend already supports the flag on every path

- **Decision**: Add the gift-card checkbox + wiring to the two named-person paths in
  `src/app/(door)/checkin/page.tsx`; change nothing on the backend.
- **Rationale**: `src/server/validation/attendance.ts` defines `countExtras = { isComp?, redeemedGiftCard? }` and
  spreads it into **all three** union variants of `attendanceSchema` — `{ contactId, … }` (matched),
  `{ newContact, … }` (new), and `{ unmatched, … }`. `attendanceService.recordAttendance` reads
  `"redeemedGiftCard" in input` generically and increments `door_records.gift_card_redemption_count`. So the API
  boundary and the service already accept and act on the flag for the named paths — only the **UI** withheld the
  option (the new-contact section and `CandidateRow` render a Comp checkbox but no Gift-card one; the unmatched
  section renders both).
- **Alternatives considered**: A schema/service change — rejected as unnecessary (already implemented). Snapshotting
  the redemption on the attendance row — rejected; per the `countExtras` design, comp/gift are **counts-only,
  never attributed** to the person.

## Decision 2: Two independent checkboxes, mirroring the anonymous path

- **Decision**: Each named path gets a "Gift card" checkbox rendered next to its existing "Comp" checkbox; the two
  toggles are independent (both/either/neither), and each submit spreads
  `...(gift ? { redeemedGiftCard: true } : {})` exactly as the unmatched path already spreads `unmatchedGift`.
- **Rationale**: FR-003 — comp and gift-card are independent counts. Mirroring the anonymous path keeps the UX and
  the code shape consistent (`unmatchedComp` + `unmatchedGift` → `newComp` + `newGift`, and `comp` + `gift` on
  `CandidateRow`).
- **Alternatives considered**: A single tri-state control (none / comp / gift) — rejected; it can't express
  "both", and it diverges from the established two-checkbox pattern.

## Decision 3: `CandidateRow` gains a typed `redeemedGiftCard` extra

- **Decision**: Add `redeemedGiftCard?: boolean` to the local `PersonExtras` type and a `gift` state to
  `CandidateRow`; the new-contact section adds a `newGift` state (no shared type — it builds its body inline).
- **Rationale**: `CandidateRow` calls `onCheckIn(extras: PersonExtras)`, so the new field must be on that type for
  `tsc` to accept it in the built body. The new-contact submit builds its object inline, so it just spreads the
  flag. Type Safety is preserved and the API boundary re-validates via `attendanceSchema`.

## Decision 4: Tests — component for the new UI, integration to lock the contract

- **Decision**: A new jsdom component test proves the "Gift card" checkbox exists on both named paths and that
  ticking it puts `redeemedGiftCard: true` in the attendance POST body. Integration tests add cases to
  `door.attendance-new` and `door.attendance-match` asserting the route + service increment
  `giftCardRedemptionCount` (and that comp+gift bumps both counts).
- **Rationale**: The genuinely new behavior is the UI, so the component test is the primary RED→GREEN proof. The
  integration cases characterize the already-working backend contract the UI depends on (SC-002/SC-003 at the data
  layer), and are cheap given the existing test harness (`jsonReq` + the attendance route).
- **Alternatives considered**: Only component tests — rejected; the integration cases guard against a future schema
  change silently dropping the flag on a named path. Only integration — rejected; it wouldn't cover the checkbox
  (the actual gap).

## Out of scope (recorded)

- The **anonymous/unmatched** path already has the gift-card option — unchanged.
- Gift-card **sales** (buying a gift card) — a gate sale, not a door check-in.
- Per-card data (number/value) — never captured; redemptions are a count.
