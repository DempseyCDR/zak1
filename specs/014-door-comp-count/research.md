# Phase 0 Research: Door Comp Count Feeding Paying Dancers

The spec arrived fully settled (P2-5 in `specs/PHASE2_REQUIREMENTS.md`); there were no
`NEEDS CLARIFICATION` markers. This file records the design decisions that ground the plan.

## Decision 1 — One combined `comp_count`, not split by kind

- **Decision**: A single integer count on `door_records` covering "your next dance free" redemptions
  **and** performers' guests together.
- **Rationale**: P2-5 explicitly specifies one count ("its own separate count, covering … together").
  Splitting by kind would add columns and UI with no consumer — the report only needs the total to
  subtract. YAGNI.
- **Alternatives considered**: Two columns (free-card vs. guest) — rejected; no requirement distinguishes
  them and nothing downstream reads them separately.

## Decision 2 — Thread comps through the existing `EventGate` read model

- **Decision**: Add `compCount` to the `EventGate` type produced by `computeEventGate`
  (`src/server/domain/gate/eventMoney.ts`), sourced from the door row it already loads; the organizer
  report reads `gate.compCount`.
- **Rationale**: `computeEventGate` already fetches the event's door record (for admission/deposit), so
  exposing `compCount` there costs **no extra query** and keeps the report loop unchanged in shape.
- **Alternatives considered**: A separate door-record fetch inside `reportService` — rejected as a
  redundant query and a second door-record read path.

## Decision 3 — `payingDancers` gains a defaulted `compCount` parameter

- **Decision**: `payingDancers(attendanceCount, performerCount, compCount = 0)` returns
  `Math.max(0, attendanceCount − performerCount − 1 − compCount)`.
- **Rationale**: A defaulted third parameter keeps the function a pure, single-responsibility calculator
  and means any caller that does not pass comps (and existing tests) behaves exactly as today —
  satisfying the no-regression requirement (FR-006) by construction. The floor at 0 already exists.
- **Alternatives considered**: A new wrapper function — rejected (needless indirection; one calculator is
  clearer). Subtracting comps at the call site before calling `payingDancers` — rejected; it would move
  the floor logic outside the function and risk a negative intermediate.

## Decision 4 — Reuse the door-record PATCH endpoint & UI

- **Decision**: Capture comps by extending `doorRecordPatchSchema`
  (`compCount: z.number().int().min(0).optional()`) and adding a comp-count input to the existing gate
  page (`src/app/(door)/gate/page.tsx`) reconciliation section; no new route or endpoint.
- **Rationale**: The gate page already PATCHes `/api/door-records/[id]` with reconciliation fields; comps
  are one more optional field on the same door record. No new route means the dev route index
  (`src/app/dev/routes/page.tsx`) needs no change.
- **Alternatives considered**: A dedicated comps endpoint — rejected (YAGNI; the door record is the right
  home and is already patched here).

## Decision 5 — `gift_card_redemption_count` is untouched

- **Decision**: Leave the existing gift-card redemption count and all its handling exactly as-is; comps
  are an independent count and only comps reduce paying dancers.
- **Rationale**: Gift-card redeemers already paid at purchase, so they remain paying dancers (FR-005).
  The two counts do different jobs (reconciliation vs. paying-dancer derivation).
- **Alternatives considered**: Folding comps into the gift-card count — rejected; it would wrongly reduce
  paying dancers for gift-card redeemers and conflate two distinct concepts.

## Migration

- Next migration number on disk is `0019` (0018 is latest). One additive statement:
  `ALTER TABLE door_records ADD COLUMN IF NOT EXISTS comp_count integer NOT NULL DEFAULT 0;`
  Existing door records default to 0 → no report changes for historical events (no backfill needed).
