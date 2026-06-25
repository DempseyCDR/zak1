# API Contracts: Door Attendance & Gate Capture

Internal HTTP API (Next.js route handlers). JSON; Zod-validated; uniform error shape
`{ error: { code, message } }`. Money fields are **dollar decimals** at the API boundary and stored as
integer cents internally. **No door-facing response ever includes the POS fee.**

## Event groups

### POST /api/event-groups
Body: `{ name: string, kind: EventGroupKind }`.
- 201 → `EventGroup`. (Grouping only; group-ticket purchase is deferred.)

## Events

### POST /api/events
Body: `{ seriesKey: string, eventDate: string (YYYY-MM-DD), chargesAdmission?: boolean, groupId?: string }`.
- 201 → `Event` (`chargesAdmission` defaults true; `groupId` optional). 404 `SERIES_NOT_FOUND`;
  404 `EVENT_GROUP_NOT_FOUND` for an unknown `groupId`.

### GET /api/events?from=&to=
- 200 → `{ items: Event[] }` (with series info).

## Door records

### POST /api/door-records
Body: `{ eventId: string }`.
- 201 → `DoorRecord` (created with defaults; seed float $15). 409 `DOOR_RECORD_EXISTS` if one exists.
- Permitted for any event, including free ones (`chargesAdmission = false`): free-event door records
  carry attendance and optional donations but no paid admission.

### PATCH /api/door-records/:id
Body (all optional): `{ posTransactionCount, posGross, grossCash, seedFloat, cashPaidOut,
cashPaidOutReason, giftCardRedemptionCount }` (money as dollars).
- Recomputes `posFee` (stored, **not returned**) and `deposit` (returned).
- 422 `CASH_PAYOUT_REASON_REQUIRED` if cashPaidOut > 0 without a reason.
- 200 → `DoorRecord` view (no fee field).

### PUT /api/door-records/:id/gate-sales
Body: `{ sales: { category: GateCategory, paymentMethod: "cash"|"card", amount: number }[] }`.
- Upserts the gate-sale rows for this door record (replace-set semantics).
- 200 → `{ sales: GateSale[] }`. 422 `VALIDATION_ERROR` for unknown category/method.

### GET /api/door-records/:id
- 200 → `DoorRecord` view + `gateSales` (fee omitted).

## Attendance / check-in

### GET /api/attendance/search?q=
- Proxies feature 001 fuzzy contact search; ranked candidates within 300 ms.
- 200 → `{ items: { id, displayName, membershipStatus, emails: string[] }[] }` (email shown to
  disambiguate).

### POST /api/events/:id/attendance
Attendance attaches to the event (no door record required). Body is one of:
- `{ contactId: string }` — record an existing contact (FR-001)
- `{ newContact: { displayName, email } }` — create a contact flagged `needs_review`, then record (FR-003)
- `{ unmatched: true }` — record an unmatched attendance (declined) (FR-004)
- 201 → `Attendance`. 409 `ALREADY_CHECKED_IN` if the contact is already recorded for this event.

### GET /api/events/:id/attendance
- 200 → `{ count: number, attendees: { id, contactId, displayName | null, createdAt }[] }`.
  `attendees` is the contact-tracing list within the retention window (matched contacts have a
  `displayName`; unmatched placeholders have `contactId: null, displayName: null`). After the 90-day
  purge `attendees` is empty and only the count (rolled into quarterly aggregates) remains. (FR-001b)

## Enums

- `GateCategory`: `today_admission | merchandise | donation | future_event | membership | gift_card | misc_sales`
- `PaymentMethod`: `cash | card`
- `EventGroupKind`: `double_dance | weekend | jane_austen_ball | other`

## Internal job contract

`src/jobs/attendance-purge.ts` (daily): in one transaction, for attendance rows older than 90 days it
adds their counts (matched + unmatched, grouped by series/year/quarter of the linked event's date)
into `quarterly_attendance_counts`, then deletes those same rows. Idempotent by construction: only rows
still present and >90 days old are counted, and they are deleted in the same transaction, so a re-run
finds nothing to count. Writes an audit entry with rolled-up and purged totals.
