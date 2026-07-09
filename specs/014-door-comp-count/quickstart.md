# Quickstart / Validation: Door Comp Count Feeding Paying Dancers

Prerequisites: Node 24 + pnpm; local Postgres running (`brew services list` → `postgresql@16 started`).
Shell prefix for every node/pnpm command:
`export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 24 >/dev/null 2>&1`

## 1. Migrate

```bash
pnpm run db:migrate       # applies 0019_door_comp_count.sql to zak1_dev
```

`zak1_test` is auto-migrated by the test harness (`ensureSchema`).

## 2. Automated tests (the source of truth)

```bash
pnpm test                 # full suite must stay green
```

Feature-specific expectations:

- **Unit** (`tests/unit/organizer.metrics.test.ts`, extended):
  - `payingDancers(30, 4, 0) === 25` (unchanged: 30 − 4 − 1).
  - `payingDancers(30, 4, 3) === 22` (comps subtract).
  - `payingDancers(5, 4, 10) === 0` (floored, never negative).
- **Integration** (`tests/integration/doorCompCount.test.ts`, new — real Postgres):
  - Create an event with a known attendance + a door record; assemble the report → capture baseline
    `dancers`/`avgTicket`.
  - PATCH the door record with `compCount: 3` → report `dancers` drops by 3 and `avgTicket` rises
    (SC-001).
  - PATCH `giftCardRedemptionCount: 2` with `compCount: 0` → `dancers` unchanged vs. baseline (SC-002,
    FR-005).
  - Event whose door record has `comp_count = 0` (or none) → `dancers`/`avgTicket` equal baseline
    (SC-003, FR-006).
  - Comps ≥ remaining dancers → `dancers === 0` (SC-004).

## 3. Manual UI check (dev)

```bash
pnpm dev
```

1. Go to `/gate`, select an event (opens/creates its door record).
2. In **Cash & card reconciliation**, enter a **Comps** count (e.g. `3`) and Save.
3. Open the organizer report for that event's series/year → the event's **paying-dancer count is 3 lower**
   and **Avg Ticket is higher** than before.
4. Confirm a **gift-card redemption** entered without comps does **not** change the paying-dancer count.
5. Confirm an event with no comps shows the **same** figures as before this feature.

## 4. No-regression guard

An event created and reconciled **without** touching comps must appear in the organizer report exactly as
it did before feature 014 (comp_count defaults to 0). This is asserted by the SC-003 integration case and
by the unchanged `payingDancers(_, _, 0)` unit case.

See [data-model.md](data-model.md) for the column + invariants and
[contracts/door-record-patch.md](contracts/door-record-patch.md) for the extended PATCH shape.
