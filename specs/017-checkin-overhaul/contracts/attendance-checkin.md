# Contract: Record attendance (check-in) — extended

`POST /api/events/[id]/attendance` — **existing endpoint, extended request body.** Auth: `attendance.write`
(unchanged). Handler: `recordAttendance`.

## Request body (Zod union `attendanceSchema`)

Existing contact (B35, B36, B29 additions):

```jsonc
{
  "contactId": "<uuid>",
  "childrenCount": 3,   // B35: optional, int >= 0
  "isOpenBand": false,  // B36: optional, community_dance only
  "isComp": false,      // B29: optional boolean — increments door_records.comp_count
  "redeemedGiftCard": false // B29: optional boolean — increments gift_card_redemption_count
}
```

New contact (B34, B35, B36, B29 additions):

```jsonc
{
  "newContact": {
    "firstName": "Jane",
    "lastName": "Smith",              // NEW (B34): schema-optional, UI-required
    "displayNameOverride": "DJ Jane", // NEW (B34): optional; when omitted, display = "Jane Smith"
    "email": "jane@example.org",      // optional (unchanged)
    "phone": "555-0100"               // optional (unchanged)
  },
  "childrenCount": 2,                  // NEW (B35): optional, int >= 0, default 0
  "isOpenBand": false,                 // NEW (B36): optional, community_dance events only
  "isComp": false,                     // NEW (B29): optional boolean
  "redeemedGiftCard": false            // NEW (B29): optional boolean
}
```

Unmatched — the comp/gift booleans are allowed (an anonymous free admission); person-extras
(`childrenCount`/`isOpenBand`) are rejected (`.strict()`):

```jsonc
{ "unmatched": true, "isComp": true }
```

## Behaviour

- **B34**: `lastName` and `displayNameOverride` flow into `deriveContactNames`; `display_name_override` is
  persisted; effective `display_name = override ?? "first last"`.
- **B35**: `childrenCount` is stored on the created attendance row; `events.attendance_count` increments by
  `1 + childrenCount`.
- **B36**: `isOpenBand: true` is accepted **only** when the event's series is `community_dance` (else
  `422`) and **not** when the contact is a booked performer for that event (FR-022a, else `422`); when
  accepted, the row's `is_open_band = true`, `attendance_count` increments `+1`, and the event's
  `door_records.open_band_count` increments `+1` (door record ensured if absent).
- **B29**: `isComp: true` and/or `redeemedGiftCard: true` **increment** the event's `door_records.comp_count`
  / `gift_card_redemption_count` (door record ensured if absent). Counts-only — **never stored on the
  attendance row** (no attribution). Allowed on every path including `unmatched`. The FS overrides on `/gate`.
- Duplicate existing-contact check-in still throws `alreadyCheckedIn` (unchanged).

## Response

`201` with the created attendance row (`childrenCount`, `isOpenBand`). Comp/gift are not on the row (they
only incremented door-record counts). Backward-compatible.

## Notes

- The Door Attendant holds `attendance.write` globally; no scope change. Capturing comp/gift here needs no
  `/gate` access — this replaced the earlier standalone `checkin-counts` endpoint (removed).
- `childrenCount`/`isOpenBand` are rejected on the `unmatched` variant (`.strict()`); `isComp`/
  `redeemedGiftCard` are allowed there.
