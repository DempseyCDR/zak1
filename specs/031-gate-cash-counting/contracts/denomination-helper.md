# Contract: Denomination helper (client-only)

A transient, optional calculator on the gate page. **No API, no persistence.**

## Inputs (transient component state)

- **Bill counts**: a non-negative integer count for each denomination — $100, $50, $20, $10, $5, $1.
- **Coins**: a single non-negative dollar amount (subtotal; no per-coin-denomination entry).
- **Checks**: a single non-negative dollar amount (rare).

## Output

- **Grand cash total** = `Σ(bill count × face value) + coins + checks`.
- The grand total **populates the single gross-cash field** used for the deposit. There is exactly one
  gross-cash value; the helper writes it, and the FS may also type/edit it directly (last value entered
  wins).

## Behavior

- **Optional**: the helper may be ignored entirely — a direct gross-cash entry always exists (FR-002).
- **Reactive**: changing any count/amount recomputes the grand total immediately (FR-001).
- **Transient**: nothing is persisted. On reopening a door record, only the gross-cash total reloads (the
  existing behavior); the per-denomination counts do not (FR-004).
- **Checks fold in**: the checks amount is part of the grand cash total → part of gross cash; there is no
  separate checks figure (FR-003).

## Out of scope

Per-coin-denomination counting; persisting the breakdown; a separate "counted cash" value distinct from gross
cash.
