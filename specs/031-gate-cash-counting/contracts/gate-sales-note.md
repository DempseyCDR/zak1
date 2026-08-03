# Contract: `note` on the gate-sales round-trip (new field)

The anonymous-sales comment persists via a new nullable `gate_sales.note`, threaded through the **existing**
put/get endpoints. No new endpoint.

## Write — `PUT /api/door-records/[id]/gate-sales` (`putGateSales`, `gate.write`)

- `gateSalesPutSchema.sales[]` gains an **optional `note: string`**.
- The gate page attaches the **single** anonymous-sales section comment to the anonymous line(s) it writes
  (`category ∈ {merchandise, gift_card, misc_sales}`). Named lines omit `note`.
- `putGateSales` is delete-and-reinsert; `note` re-persists on every save (like the amounts). Empty/omitted →
  stored `null`.

## Read — `GET`/`POST /api/events/[id]/door-record` (`getDoorRecord`)

- The returned `gateSales[]` (`GateSaleView`) now include `note` (automatic via `getTableColumns(gateSales)`).
- On reopen, the gate page reconstitutes the section comment from the **first anonymous line whose `note` is
  non-null**.

## Unchanged

- `payment_method` stays `cash | card` (no `check`); checks fold into `grossCash`.
- Deposit, card totals, seed float, cash-paid-out, comp/gift counts, and the FS-only write boundary are
  unchanged. Only `note` is added to the payload/response.
