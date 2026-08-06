# Contract: Named-Person Check-In Gift-Card Option

This feature adds a UI affordance and sends an **already-accepted** field on two paths. The HTTP contract does not
change; the UI contract does.

## HTTP surface (UNCHANGED)

- `POST /api/events/[id]/attendance` — auth `attendance.write`. The request schema (`attendanceSchema`) **already**
  accepts `redeemedGiftCard?: boolean` on every variant (matched / new-contact / unmatched). No new/changed field,
  route, or validation.

Request bodies this feature newly sends from the UI (all already valid today):

```jsonc
// New contact redeeming a gift card
{ "newContact": { "firstName": "Walk", "lastName": "In" }, "redeemedGiftCard": true }

// Returning/matched contact redeeming a gift card (+ comp together, independent)
{ "contactId": "<uuid>", "isComp": true, "redeemedGiftCard": true }
```

## Server behavior (UNCHANGED)

- `recordAttendance` increments `door_records.gift_card_redemption_count` by 1 when `redeemedGiftCard` is true, and
  `comp_count` by 1 when `isComp` is true — independently, on any variant.

## UI contract (NEW — proven by the component test)

- The **new-contact** section renders a **"Gift card"** checkbox next to its existing "Comp" checkbox.
- Each **returning/matched** candidate row (`CandidateRow`) renders a **"Gift card"** checkbox next to its "Comp"
  checkbox.
- Ticking "Gift card" and confirming the check-in includes `redeemedGiftCard: true` in the POST body; leaving it
  unticked omits the field (body unchanged from today).
- "Comp" and "Gift card" are independent — both may be ticked, producing `isComp: true` **and**
  `redeemedGiftCard: true`.

## Data guarantees (test contract — integration)

- New-contact POST with `redeemedGiftCard: true` ⇒ event `giftCardRedemptionCount` increases by 1 (SC-002).
- Matched POST with `redeemedGiftCard: true` ⇒ event `giftCardRedemptionCount` increases by 1 (SC-002).
- POST with both `isComp` and `redeemedGiftCard` true ⇒ `compCount` +1 **and** `giftCardRedemptionCount` +1
  (SC-003).

## Out of scope (contract explicitly does NOT change)

- The anonymous/unmatched path (already has the option).
- Gift-card **sales**; per-card data.
