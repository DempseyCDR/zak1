# Research: Gate cash counting (P5-R4)

No open `NEEDS CLARIFICATION` items — P5-R4 pre-resolved the major decisions (Q8 no denomination persistence;
Q9 checks fold into gross cash; Q10 one free-text comment stored on `gate_sales.note`). Decisions below record
the grounded approach.

## R1 — Denomination helper is transient client state (no persistence, no backend)

**Decision**: The helper lives entirely in the gate page as component state: a **count per bill denomination**
(e.g. $100/$50/$20/$10/$5/$1), a **coins** amount, and a **checks** amount. It computes `Σ(count × face) +
coins + checks` and writes the result into the **existing** gross-cash field. No new API, no new column, no
persisted breakdown.

**Rationale**: Q8 (YAGNI) — the breakdown is a counting aid, not a record. The existing D2 reload already
restores the gross-cash total; only that round-trips. Keeps the change UI-only for US1/US2.

**Alternatives considered**: Persist the breakdown — rejected (Q8; a table/columns nobody reads back).
Per-coin-denomination counting — rejected (a single coins subtotal suffices at a dance door).

## R2 — One gross-cash value; the helper fills it, the direct entry keeps working

**Decision**: The helper's grand total **populates the same** `grossCash` state the FS can also type directly.
There is exactly one value. If the FS hand-edits gross cash after using the helper, the edited value wins
(the helper is an aid, not a lock).

**Rationale**: FR-002 — the direct path (Pat) must always exist and there must never be two competing figures.
Reusing the one field guarantees a single source of truth for the deposit.

**Alternatives considered**: A separate "counted cash" field distinct from gross cash — rejected (two
figures, reconciliation ambiguity).

## R3 — The anonymous-sales comment rides on `gate_sales.note` (one per section)

**Decision**: Add nullable `gate_sales.note` (migration `0029`). The page collects **one** comment for the
anonymous-sales section and, on save, attaches it to the anonymous gate-sale line(s) it writes (via the new
`note` on each anon `sales[]` entry). On reopen, the page reads the comment back from the **first anonymous
line that carries a note**. Named categories (donation/future_event/membership) never carry this comment.

**Rationale**: Q10 fixed the store as `gate_sales.note`. `putGateSales` is delete-and-reinsert, so the note
must be part of the `sales[]` payload (it re-persists on every save, like the amounts — D2 discipline).
Reading the first anon note reconstitutes the single section comment.

**Consequence / edge**: a comment persists only if there is **at least one anonymous sale amount** to hang it
on (no anon line ⇒ nowhere to store it). Accepted — the comment describes anonymous sales that exist; the spec
allows a blank comment when there are no anon sales.

**Alternatives considered**: A comment column on `door_records` — rejected (Q10 chose `gate_sales.note`; and
it belongs with the anon sales it describes). A separate note-only gate-sale row — rejected (a `$0` phantom
line to carry text is worse than the "needs an anon line" consequence).

## R4 — Checks fold into gross cash (no new tender/column)

**Decision**: The helper's **checks** amount is added into the grand cash total that becomes gross cash. No
`checksCents` column, no `check` value on `payment_method` (which stays `cash | card`).

**Rationale**: Q9 — checks deposit physically with the cash and are rare; the treasurer sees them inside gross
cash. Avoids a schema change and a reconciliation branch.

**Alternatives considered**: A separate checks figure/column — rejected (Q9 YAGNI).

## R5 — The migration is additive; deposit math unchanged

**Decision**: `0029_gate_sales_note.sql` is a single `ALTER TABLE gate_sales ADD COLUMN note text` (nullable,
`IF NOT EXISTS`). No backfill, no data transform. `deposit = grossCash − seedFloat − cashPaidOut` is
untouched; `getDoorRecord` returns the new column automatically (`getTableColumns(gateSales)`).

**Rationale**: The first Phase 5 migration, and the simplest kind (additive nullable). No history to
reconcile (unlike 021/027).

**Alternatives considered**: none needed.
