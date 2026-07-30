# Data Model: Door-attendant check-in experience

**No persistent schema change, no migration.** This feature is a set of **operations** over existing entities.
Every column it needs already exists (feature 017/010).

## Entities used (unchanged)

- **`attendance`** — one admission: `contact_id` (nullable → unmatched), `children_count`, `is_open_band`,
  `event_id`. Amended at runtime by the correction operations (children edit, reassign, open-band toggle,
  delete, move). No new column.
- **`events`** — `attendance_count` (denormalized head count, survives the 90-day attendance purge),
  `group_id`, `start_time`, `label`. Read for ordering/labels and the group boundary; `attendance_count`
  written by every correction to stay exact.
- **`event_groups`** — the group an event belongs to; defines the valid **move** targets (same non-null
  `group_id`).
- **`door_records`** — `comp_count`, `gift_card_redemption_count`, `open_band_count` (counts-only,
  un-attributed). Adjusted by the comp/gift ±1 and by the open-band toggle.

## Operations & the invariants they preserve

| Operation | Row effect | `events.attendance_count` | `door_records` |
|---|---|---|---|
| **Delete** attendance | remove the row | `-= (1 + children)` | — |
| **Edit children** (`old → new`) | set `children_count = new` | `+= (new - old)` | — |
| **Reassign** unmatched → contact | set `contact_id` (dup-guard: refuse if that contact is already on the event) | unchanged | — |
| **Toggle open-band** | flip `is_open_band` (on requires community_dance + not a booked performer) | unchanged | `open_band_count ±1` (floor 0) |
| **Move** to sibling event | set `event_id = target` (must be a same-group sibling; refuse if the dancer is already on the target); if the record is open-band and the target is not community_dance, also clear `is_open_band` | source `-= (1+children)`, target `+= (1+children)` | source `open_band_count -= 1` when an open-band record is moved off a community dance |
| **comp / gift ±1** | — (nothing per-person) | unchanged | `comp_count` or `gift_card_redemption_count` `±1` (floor 0) |

## Invariants preserved

- **Head count never drifts**: after any operation, `events.attendance_count` = Σ over present admissions of
  `(1 + children_count)`. Delete/edit/move each apply the exact offset; reassign and open-band toggle leave the
  count unchanged (still one admission).
- **No count goes negative**: children edits are `min 0`; open-band / comp / gift decrements floor at 0.
- **Move stays in-group**: the target `event_id` is accepted only if it is a real sibling (shared non-null
  `group_id`), re-derived server-side.
- **No duplicate on move**: a move is refused when the dancer is already checked in on the target (the same
  no-duplicate rule as reassign).
- **Open-band stays community-dance-only**: `is_open_band` may be `true` only on a community-dance event; a move
  to a non-community-dance sibling clears it and decrements the source event's `open_band_count`, so the flag is
  never invalid and the open-band count is never stranded on the source door record.
- **Counts-only accounting (decision B)**: comp/gift are event aggregates only — never stored on the
  attendance row; the FS's gate override still supersedes for money.

## Validation surface (Zod, at the boundary)

- **Attendance patch** `{ childrenCount?: int ≥ 0, contactId?: uuid, isOpenBand?: bool, eventId?: uuid }` —
  at least one field; `eventId` is the move (server-validated as a sibling).
- **Door-count adjust** `{ count: 'comp' | 'gift', delta: 1 | -1 }`.
- **Unmatched check-in** now also accepts `childrenCount` (was rejected — FR-015).
