# Contract: Check-in comp & gift-card counts — new endpoint (B29)

`POST /api/events/[id]/checkin-counts` — **NEW endpoint.** Auth: **`attendance.write`** (Door Attendant).
Handler: `recordCheckinCounts`.

This is the relocation of comp capture from `/gate` (feature 014) to `/checkin`, and the capture point for
the previously-orphaned gift-card redemption count (resolves B21). It exists as a distinct capability from
`gate.write` precisely so the Door Attendant never touches money (FR-018/FR-023).

## Request body (Zod `checkinCountsSchema`)

```jsonc
{
  "compCount": 4,                  // optional, int >= 0 — non-open-band free admissions
  "giftCardRedemptionCount": 1     // optional, int >= 0
}
```

Omitted fields leave the door record's current value unchanged. Body carries **no money fields**.

## Behaviour

1. `ensureDoorRecord(db, eventId)` — create the door record if absent (idempotent), else fetch. (Door
   Attendant already may do this via `POST /api/events/[id]/door-record`.)
2. `assertEventScope(actor, "attendance.write", { seriesId, groupId })` — layer-2 scope check (Door
   Attendant is `global`, so it passes for any event; the assertion keeps the pattern uniform).
3. Set `comp_count` and/or `gift_card_redemption_count` on the door record (absolute set of provided
   fields). **Does not touch** money fields, `open_band_count`, or recompute `deposit`/`fee`.
4. Write a `door_record_audit` row (`action: "checkin_counts"`) + `writeAudit`.

## Response

`200` with the door-record view (comp/gift counts reflected). The view already omits the POS fee (FR-007).

## Interaction with `/gate` (FR-015)

- The FS's `PATCH /api/door-records/[id]` (`gate.write`) still edits `comp_count` and
  `gift_card_redemption_count` — the FS confirms/overrides during money reconciliation. Both writers touch
  the same two columns; last write wins, which is the intended confirm-then-adjust flow.
- `open_band_count` is **not** settable here or on `/gate`; it is produced only by open-band check-ins. `/gate`
  displays it read-only as part of the comp picture the FS confirms.
