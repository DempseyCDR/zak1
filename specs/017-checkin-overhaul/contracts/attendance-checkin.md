# Contract: Record attendance (check-in) — extended

`POST /api/events/[id]/attendance` — **existing endpoint, extended request body.** Auth: `attendance.write`
(unchanged). Handler: `recordAttendance`.

## Request body (Zod union `attendanceSchema`)

Existing contact (B35, B36 additions):

```jsonc
{ "contactId": "<uuid>", "childrenCount": 3, "isOpenBand": false }
```

New contact (B34, B35, B36 additions):

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
  "isOpenBand": false                  // NEW (B36): optional, community_dance events only
}
```

Unmatched (unchanged — no new fields):

```jsonc
{ "unmatched": true }
```

## Behaviour

- **B34**: `lastName` and `displayNameOverride` flow into `deriveContactNames`; `display_name_override` is
  persisted; effective `display_name = override ?? "first last"`.
- **B35**: `childrenCount` is stored on the created attendance row; `events.attendance_count` increments by
  `1 + childrenCount`.
- **B36**: `isOpenBand: true` is accepted **only** when the event's series is `community_dance` (else
  `422`/validation-style rejection); when accepted, the row's `is_open_band = true`, `attendance_count`
  increments `+1`, and the event's `door_records.open_band_count` increments `+1` (door record ensured if
  absent). Mutually exclusive with the same person also being counted as a paid performer for the event.
- Duplicate existing-contact check-in still throws `alreadyCheckedIn` (unchanged).

## Response

`201` with the created attendance row (now including `childrenCount`, `isOpenBand`). Backward-compatible.

## Notes

- The Door Attendant holds `attendance.write` globally; no scope change.
- `childrenCount`/`isOpenBand` are rejected on the `unmatched` variant (schema-level).
