# Contract: Door Record PATCH — comp count (feature 014)

Extends the existing endpoint; **no new route**.

## `PATCH /api/door-records/{id}`

Request body (JSON) — all fields optional; only the added field is shown in full context here:

```jsonc
{
  "posTransactionCount": 0,
  "grossCash": 0,
  "pcGross": 0,
  "seedFloat": 0,
  "cashPaidOut": 0,
  "cashPaidOutReason": "…",
  "giftCardRedemptionCount": 0,   // UNCHANGED — independent count
  "compCount": 3                  // NEW — people admitted free (int ≥ 0). Absent = unchanged.
}
```

- **`compCount`**: `z.number().int().min(0).optional()` (added to `doorRecordPatchSchema`).
  - Present → sets the door record's `comp_count`.
  - Absent → leaves `comp_count` unchanged (`input.compCount ?? current.compCount`).
- Validation failure (negative or non-integer) → `400` with the standard API error envelope, as for the
  other numeric fields.

Response (`DoorRecordView`) gains:

```jsonc
{
  "...": "existing fields",
  "giftCardRedemptionCount": 0,
  "compCount": 3                  // NEW — echoes the stored value
}
```

The POS fee remains intentionally omitted from the view (feature 002 FR-007). `compCount` does not affect
`deposit` or any money field in the response.

## Organizer report (read side — no endpoint change)

`GET` of the organizer report (existing `assembleOrganizerReport`) now returns, per event, a `dancers`
count and `avgTicket` computed as:

- `dancers = max(0, attendance − distinct performers − 1 − comp_count)`
- `avgTicket = admission ÷ dancers` (0 when `dancers ≤ 0`)

No request/response shape change — only the numeric values of `dancers` and `avgTicket` shift when
`comp_count > 0`.
