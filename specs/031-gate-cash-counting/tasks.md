---
description: "Task list for feature 031 — gate cash counting (P5-R4)"
---

# Tasks: Gate cash counting — denomination helper, direct total, anonymous-sales comment (P5-R4)

**Input**: Design documents from `specs/031-gate-cash-counting/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/
**Tests**: INCLUDED — the constitution (v1.3.0, Principle I) mandates test-first.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallelizable (different files, no dependency on an incomplete task)
- **[Story]**: US1..US3 (from spec.md)
- Exact file paths included.

## Notes

**US1 + US2 are client-only** (a transient denomination helper that fills the existing single gross-cash
field; the direct-total entry is preserved). **US3 carries the one backend change**: the first Phase 5
migration `0029_gate_sales_note.sql` (`gate_sales.note` nullable) threaded through the existing
`putGateSales` / `getDoorRecord` round-trip, plus the anon-sales comment field on the gate page. Checks fold
into gross cash (no tender/column); deposit math unchanged.

⚠️ **Shared file**: `src/app/(door)/gate/page.tsx` is edited by US1 (helper) and US3 (comment) — those two
page tasks are **sequential**. `tests/component/gate.cashCounting.test.tsx` is written in US1 and extended in
US2 (same file → sequential). US3's backend files (migration / schema / validation / service) and its two
test files are distinct → `[P]` where noted.

⚠️ **MVP = US1 + US2** (both P1): the denomination helper + the preserved direct-total entry.

---

## Phase 1: Setup

- [X] T001 Confirm grounding: next migration is `0029_gate_sales_note.sql` (latest is `0028`); the round-trip is `gateSalesPutSchema.sales[]` (`src/server/validation/door.ts`) → `putGateSales` / `getDoorRecord` / `GateSaleView` (`src/server/domain/door/doorRecordService.ts`, `note` surfaces automatically via `getTableColumns(gateSales)`); the money entry lives on `src/app/(door)/gate/page.tsx`; `deposit = grossCash − seedFloat − cashPaidOut` is unchanged; checks fold into gross cash (no `check` tender). Note the anon-comment resolution (research R3): one comment per section → attach to the anon line(s) on save, read back from the first anon line with a note.

---

## Phase 2: User Story 1 — Count cash by denomination (P1) 🥇 MVP

**Goal**: An optional, transient denomination helper totals the cash (`Σ(bill count × face) + coins + checks`)
into the single gross-cash field.

**Independent Test**: Enter counts for a few denominations plus coins and checks → the grand cash total equals
`Σ(count × face) + coins + checks`, and that total fills the gross-cash used for the deposit.

- [X] T002 [P] [US1] Write `tests/component/gate.cashCounting.test.tsx` (jsdom, stubbed fetch): the denomination helper computes a grand cash total = `Σ(bill count × face value) + coins + checks` and populates the gross-cash field; changing a single count recomputes the total; the deposit/save uses that gross-cash value. (Bills $100/$50/$20/$10/$5/$1, a coins amount, a checks amount.)
- [X] T003 [US1] In `src/app/(door)/gate/page.tsx`, add the **transient** denomination helper: a count input per bill denomination + a coins amount + a checks amount; compute the grand total and write it into the existing gross-cash state (`grossCash`); make it optional/collapsible; **do not persist** the breakdown.

**Checkpoint**: the helper totals cash and fills gross cash; T002 green.

---

## Phase 3: User Story 2 — Enter the total directly (P1)

**Goal**: The gross-cash total can be typed directly without the helper; the helper and the field drive one
value.

**Independent Test**: Without touching the helper, type a gross-cash total and save → the deposit is computed
from the typed total exactly as before.

- [X] T004 [US2] Extend `tests/component/gate.cashCounting.test.tsx`: typing the gross-cash total **directly** (without the helper) records that total; using the helper and then hand-editing the gross-cash field records the **edited** value (one value, last-entered wins). (Same file as T002 → sequential.)
- [X] T005 [US2] In `src/app/(door)/gate/page.tsx`, ensure the existing gross-cash input remains directly editable and is the **single source of truth** for the deposit — the helper writes into it, and a manual edit is authoritative (no second "counted cash" value). (Preserve the existing field; likely a no-code confirmation of T003's design plus keeping the input.)

**Checkpoint**: the fast direct path is intact; T004 green.

---

## Phase 4: User Story 3 — Anonymous-sales comment (P2)

**Goal**: A single free-text comment on the anonymous-sales section, persisted (`gate_sales.note`) and reloaded
on reopen.

**Independent Test**: Enter an anonymous-sales comment, save, reopen → the comment reappears verbatim beside
the reloaded anon amounts.

### Tests first (Red)

- [X] T006 [P] [US3] Write `tests/integration/gate.note.test.ts` (node, real Postgres): `putGateSales` persists a `note` on an anonymous gate-sale line; `getDoorRecord` returns the `note` on that line (round-trip).
- [X] T007 [P] [US3] Write `tests/component/gate.anonComment.test.tsx` (jsdom): typing an anonymous-sales comment sends it as `note` on the anon line(s) in the gate-sales PUT on save; reopening the door record reloads the comment from the persisted `note`.

### Implementation (Green)

- [X] T008 [US3] Create `src/server/db/migrations/0029_gate_sales_note.sql`: `ALTER TABLE gate_sales ADD COLUMN IF NOT EXISTS note text;` (nullable, additive — no backfill).
- [X] T009 [US3] In `src/server/db/schema/door.ts`, add `note: text("note")` (nullable) to the `gateSales` table.
- [X] T010 [P] [US3] In `src/server/validation/door.ts`, add an optional `note: z.string().optional()` to each `gateSalesPutSchema.sales[]` entry.
- [X] T011 [US3] In `src/server/domain/door/doorRecordService.ts`, carry `note` into the `putGateSales` insert (`note: s.note ?? null`); confirm `getDoorRecord` / `GateSaleView` surface `note` (automatic via `getTableColumns(gateSales)`). (After T009 — needs the schema column.)
- [X] T012 [US3] In `src/app/(door)/gate/page.tsx`, add the **anonymous-sales comment** field; on save, attach the comment as `note` to the anonymous sale line(s); on reload (the D2 anon rebuild), set the comment from the **first** anonymous line whose `note` is non-null. (Same file as T003 → sequential.)

**Checkpoint**: the comment round-trips; T006/T007 green.

---

## Phase 5: Polish + cross-cutting

- [X] T013 Full gate (solo-maintainer mode): `pnpm run db:migrate` (apply 0029); `pnpm exec tsc --noEmit`; `pnpm exec eslint <changed>`; `pnpm exec prettier --check <changed>`; `pnpm test` (full suite green — `resetDb`/`ensureSchema` applies the new column; FR-007: deposit/card/seed-float/comp math and the FS-only boundary unregressed); `pnpm build`. All green.
- [X] T014 [P] Update `zak1_Phase5_Requirements.md`: mark **P5-R4 SHIPPED as feature 031** (denomination helper + direct total + anon `gate_sales.note` comment; checks fold into gross cash; migration `0029`, the first Phase 5 migration → latest migration is now `0029`).

---

## Dependencies & execution order

- **Setup (T001)** → the story phases.
- **US1 (T002 test → T003 helper)**; **US2 (T004 test → T005 preserve field)** builds on US1's gross-cash
  field; both P1 = the MVP.
- **US3**: tests first (T006/T007, Red) → **T008 migration → T009 schema → T010/T011 validation+service →
  T012 page** (Green). T011 is after T009 (needs the column); the integration test T006 passes once
  T008–T011 land and the DB is migrated.
- **Polish (T013/T014)** last; T013 runs the migration + full gate.
- **Shared files**: `gate/page.tsx` tasks (T003, T005, T012) sequential; `gate.cashCounting.test.tsx` tasks
  (T002, T004) sequential.

### Parallelizable

- **T002** [P] (its own test file, before it's extended). **T006 / T007** [P] (distinct test files).
  **T010** [P] (validation, distinct from the migration/schema files). Docs **T014** [P].
- **Not `[P]`**: `gate/page.tsx` (T003/T005/T012) and `gate.cashCounting.test.tsx` (T002/T004); the migration
  (T008) → schema (T009) → service (T011) chain.

## Implementation strategy

Ship as **one atomic commit** once T013 is green. Build order: US1 helper (test → impl) + US2 direct total
(test → preserve) = the MVP; then US3 — write the note round-trip tests, add the additive migration, schema,
validation, and service, then the page comment field + reload. The only risk is the anon-comment "one per
section over a per-row column" mapping (research R3), pinned by the integration round-trip + the component
save/reload test.

## Summary

- **Total tasks**: 14 (Setup 1 · US1 2 · US2 2 · US3 7 · Polish 2)
- **Per user story**: US1 = 2 (T002–T003) · US2 = 2 (T004–T005) · US3 = 7 (T006–T012)
- **Test tasks**: T002, T004 (component, cash entry) · T006 (integration, note round-trip) · T007 (component,
  comment save/reload)
- **Parallel opportunities**: T002; T006/T007; T010; docs T014
- **MVP scope**: **US1 + US2** — the denomination helper plus the preserved direct-total entry (the everyday
  close-out). US3 adds the anonymous-sales comment and the one small migration.
