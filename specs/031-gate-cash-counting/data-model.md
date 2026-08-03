# Data Model: Gate cash counting (P5-R4)

**One additive column; everything else is transient client state.**

## Persistent change

- **`gate_sales.note`** — new **nullable `text`** (migration `0029_gate_sales_note.sql`). Holds the
  anonymous-sales section comment, attached to the anonymous gate-sale line(s). Named-category lines leave it
  null. No other column; no denomination storage, no checks column.
  - Threaded through the existing round-trip: `gateSalesPutSchema.sales[]` gains an optional `note`;
    `putGateSales` writes it on insert; `getDoorRecord` / `GateSaleView` return it (automatic via
    `getTableColumns(gateSales)`).

## Reused / unchanged

- **Door record**: `gross_cash_cents`, `pc_gross_cents`, `pos_transaction_count`, `seed_float_cents`,
  `cash_paid_out_cents`, `cash_paid_out_reason`, comp/gift counts. Unchanged. `deposit = grossCash −
  seedFloat − cashPaidOut` — unchanged. Checks fold **into** `gross_cash_cents`; there is no checks column.
- **Gate sale**: `category`, `payment_method` (`cash | card` — unchanged, no `check` tender), `amount_cents`,
  `contact_id`, **+ `note`**.

## Transient working set (NOT persisted — client-only)

- **Denomination count**: for each bill denomination a **count**, plus a **coins** amount and a **checks**
  amount. Produces the **grand cash total** = `Σ(count × face value) + coins + checks`, which populates the
  single gross-cash figure. On reopen, only the gross-cash total reloads (the breakdown is not stored) —
  consistent with the existing D2 reload.

## Validation rules

- `note` is optional free text; applies only to **anonymous** categories (merchandise / gift_card /
  misc_sales). Named lines (donation / future_event / membership) do not carry the section comment.
- Helper inputs are non-negative counts/amounts; the grand total is derived, never separately stored.
- No new state transitions; no relationships added.
