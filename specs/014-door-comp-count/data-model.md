# Phase 1 Data Model: Door Comp Count Feeding Paying Dancers

## Changed entity

### `door_records` (existing table — one row per event)

One new column:

| Column       | Type      | Null? | Default | Notes |
|--------------|-----------|-------|---------|-------|
| `comp_count` | `integer` | NOT NULL | `0` | People admitted **free** — "your next dance free" card redemptions and performers' guests, as a single combined count. Distinct from `gift_card_redemption_count`. |

- **Validation**: non-negative integer (`z.number().int().min(0)`), optional on PATCH (absent = unchanged).
- **Unchanged**: `gift_card_redemption_count` and every other door-record column keep their current
  meaning and handling. `comp_count` does **not** enter any money/deposit/admission calculation.
- **Migration**: `0019_door_comp_count.sql` —
  `ALTER TABLE door_records ADD COLUMN IF NOT EXISTS comp_count integer NOT NULL DEFAULT 0;`
  Additive, no backfill; existing rows get `0`.

## Derived read model (no new storage)

### `EventGate` (`src/server/domain/gate/eventMoney.ts`)

Gains `compCount: number` — read from the door row already loaded by `computeEventGate` (0 when the event
has no door record). All other `EventGate` fields are unchanged.

### Organizer report — paying dancers & Avg Ticket

- `payingDancers(attendanceCount, performerCount, compCount = 0)`
  → `max(0, attendanceCount − performerCount − 1 − compCount)`.
  - `− performerCount`: distinct performers (unchanged).
  - `− 1`: the single door attendant (unchanged).
  - `− compCount`: NEW — comps.
  - Floored at 0 (unchanged).
- `avgTicketCents(admissionCents, dancers)` — unchanged; it simply consumes the smaller `dancers`.
- Per-event report row and quarterly row `dancers`/`avgTicket` now reflect comps automatically.

## Invariants

- **INV-1**: `comp_count ≥ 0`.
- **INV-2**: paying dancers ≥ 0 (floored).
- **INV-3**: With `comp_count = 0`, every report figure equals its pre-feature value (no regression).
- **INV-4**: `gift_card_redemption_count` never reduces paying dancers; only `comp_count` does.
- **INV-5**: `comp_count` affects only paying-dancers/Avg-Ticket — admission, merch, gate money, deposit,
  and attendance are byte-for-byte unaffected.
