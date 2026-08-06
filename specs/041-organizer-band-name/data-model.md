# Phase 1 Data Model: Organizer Report Band Name (+ member detail)

Changes the **meaning** of one existing string field; adds no field and **no database change**. All inputs are
existing columns.

## Type: `OrganizerReport` per-dance row (`domain/organizer/reportService.ts`)

### Changed (semantics only — same type)

| Field | Type | Was | Now |
|-------|------|-----|-----|
| `band` | `string` | joined member display-names of lead/musician bookings (or "Open Band"/"") | the booked **band's name** when a named band plays; else joined member names (ad-hoc); else "Open Band"; else "" |

The identical `band` string on each **trend point** changes the same way (it is derived from the same value).

### Unchanged (figure parity — FR-005 / SC-004)

`dancers`, `grossGate`, `merchandise`, `rent`, `performerTotal`, `ongoingExpense`, `miscExpenses`, `danceNet`,
`danceNetNegative`, `avgTicket`, `breakEvenDancers`, `caller`, `fyi`, and the whole quarterly summary + trend
numbers — **identical values**. `performers[]` (`{ name, type, amount }`) is unchanged — it remains the member
roster the detail lists.

## Resolution inputs (read-only)

- **`bands`** — `id`, `name`. Loaded once into a `Map<bandId, name>` per report.
- **`bookings`** — each booking's `band_id` (already on `BookingView`) + `performer_type`
  (lead_musician / musician / open_band_musician / caller) + performer `display_name`.

## Band-identifier derivation (per dance)

```text
leadOrMusician = bookings where type ∈ {lead_musician, musician}
bandIds        = distinct non-null band_id among leadOrMusician
band =
  bandIds.length ≥ 1        → bandIds.map(id → bandName[id]).join(", ")
  else leadOrMusician ≠ ∅   → leadOrMusician member names.join(", ")   (ad-hoc, unchanged)
  else any open_band_musician→ "Open Band"                             (unchanged)
  else                      → ""                                       (unchanged)
```

## Presentation (organizer page)

- **Band column**: renders the per-dance `band` (now the band name). No page logic change — it already renders
  `r.band`.
- **Per-dance detail expansion** (already exists): lists each performer as `name (type, amount)` — the member
  roster (FR-006/FR-007). The page adds the **band name** as a label in the expansion (reusing `r.band`), so the
  drill-in is band-aware.

## Relationships / invariants

- The band name is a **live read** (current `bands.name`), consistent with the bookings/public reports — not
  snapshotted onto the booking.
- Changing the `band` string cannot alter any computed figure — the new read feeds only that one string.
- No FK, index, or table change; nothing is written that was not written before.
