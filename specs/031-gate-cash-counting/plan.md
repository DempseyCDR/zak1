# Implementation Plan: Gate cash counting — denomination helper, direct total, anonymous-sales comment (P5-R4)

**Branch**: `031-gate-cash-counting` (solo-maintainer mode, constitution v1.3.0 — one atomic commit to `main`)
| **Date**: 2026-08-02 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/031-gate-cash-counting/spec.md`

## Summary

Give the gate close-out an **optional, client-side denomination helper** that totals the cash for the FS
(`Σ(bill count × face value) + coins + checks` → the single **gross-cash** figure), while keeping the
**direct-total** entry for the FS who prefers it — the helper and the field drive **one** value. Checks fold
into gross cash (no separate tender). Add a **single free-text comment** to the anonymous-sales section
("3 CDs, 2 shirts"), persisted on the gate-sale record and reloaded like the anon amounts. The **denomination
breakdown is transient** (not stored). The only backend change is **one small additive migration** —
`gate_sales.note` (nullable text), the first Phase 5 migration — plus carrying that field through the existing
`putGateSales` / `getDoorRecord` round-trip. Deposit math, card totals, seed float, comp/gift counts, and the
FS-only write boundary are **unchanged**.

## Technical Context

**Language/Version**: TypeScript 5.7 (strictest) · Node 24 · pnpm

**Primary Dependencies**: Next.js 16.2.10 (App Router, RSC) · React 19.2 · Drizzle ORM · Zod. **No new
dependency.**

**Storage**: PostgreSQL 16 — **one additive migration** `0029_gate_sales_note.sql`: `ALTER TABLE gate_sales
ADD COLUMN note text` (nullable). No data transform, no backfill. No denomination storage, no checks column
(Q8/Q9 YAGNI).

**Testing**: Integration (node, real Postgres) — `putGateSales` persists `note` on an anonymous line and
`getDoorRecord` returns it (round-trip). Component (jsdom) — the denomination helper computes the grand cash
total and fills the single gross-cash field; the direct-total entry still works without the helper; the
anonymous-sales comment is sent on save and reloads on reopen.

**Target Platform**: Web, single tenant, the FS gate close-out surface (`/gate`).

**Project Type**: Next.js App Router monolith; `/gate` is a client page over the door-record + gate-sales API.

**Performance Goals**: Unchanged — the helper is trivial client arithmetic; no new queries.

**Constraints**: The helper is **optional and transient** (no persistence; on reopen only the gross-cash
total reloads, as today). Checks **fold into gross cash** — no separate tender/column. The anon comment is
**one per section**, stored on the anonymous gate-sale line(s) via `gate_sales.note`, reloaded from the
persisted note. Deposit/card/seed-float/comp math and the FS-only write boundary are **unchanged**.

**Scale/Scope**: 1 additive migration + 1 schema column; `putGateSales` + the gate-sales Zod schema carry
`note`; `getDoorRecord`/`GateSaleView` surface it (mostly automatic via `getTableColumns`). Client: the gate
page gains a transient denomination helper and one anon-comment field. ~2 component tests + 1 integration test.

## Constitution Check

*GATE: Must pass before Phase 0. Re-check after Phase 1.* Constitution v1.3.0 (principles I–IV).

| Principle | Verdict |
|---|---|
| **I. Test-First** | **PASS** — the note round-trip gets an integration test (real Postgres: `putGateSales` writes `note`, `getDoorRecord` returns it) and the helper/direct-total/comment get jsdom component tests, all before implementation. |
| **II. YAGNI** | **PASS** — one nullable column; **no** denomination persistence, **no** checks column/tender, **no** per-item line items. The helper is a transient calculator, not a stored entity. |
| **III. Type Safety** | **PASS** — `note` added to the gate-sales Zod schema (optional) and flows as a typed field; the helper's inputs are typed; no `any`. |
| **IV. Observability** | **PASS** — gate money is already audited via the door-record path; no new security-relevant surface (the note is descriptive text on an existing line). |

**Development Workflow**: solo-maintainer mode — one atomic commit to `main`, full local gate as the reviewer.
Complies.

### Post-Design Re-Check

Re-evaluated after Phase 1: **still PASS.** The migration is purely additive (no backfill, no transform); the
deposit/reconciliation math is untouched (checks just land inside the same gross-cash figure); the only new
persisted datum is a nullable descriptive `note`.

## Project Structure

### Documentation (this feature)

```text
specs/031-gate-cash-counting/
├── plan.md              # This file
├── research.md          # R1..R5 (decisions)
├── data-model.md        # the one column + the transient (non-persisted) helper working set
├── quickstart.md        # per-story validation
├── contracts/
│   ├── gate-sales-note.md   # the `note` field on the gate-sales put/get round-trip
│   └── denomination-helper.md  # the client-only helper contract (inputs → grand cash total → gross cash)
├── checklists/requirements.md   # complete (from /speckit-specify)
└── tasks.md             # /speckit-tasks (NOT created here)
```

### Source Code (repository root)

```text
src/server/db/migrations/
└── 0029_gate_sales_note.sql (new)   ALTER TABLE gate_sales ADD COLUMN note text  (nullable; additive)
src/server/db/schema/
└── door.ts                          gate_sales: + note text (nullable)
src/server/validation/
└── door.ts                          gateSalesPutSchema.sales[]: + note?: string (optional)
src/server/domain/door/
└── doorRecordService.ts             putGateSales: carry note into the insert; getDoorRecord/GateSaleView
                                     surface note (automatic via getTableColumns) for reload
src/app/(door)/gate/
└── page.tsx                         + transient denomination helper (bill counts + coins + checks → grand
                                     cash total → fills the existing gross-cash field; optional); + one
                                     anonymous-sales comment field, sent as note on the anon line(s) and
                                     reloaded from the persisted note
tests/
├── integration/gate.note.test.ts (new)      putGateSales writes note; getDoorRecord returns it (round-trip)
└── component/gate.cashCounting.test.tsx (new)  helper totals → gross cash; direct total works; comment save/reload
```

**Structure Decision**: A UI-heavy change (the transient helper is pure client state) over the existing
door-record/gate-sales substrate, plus one additive column threaded through the established
`putGateSales`/`getDoorRecord` round-trip. No change to the deposit computation or the money boundary. The
anonymous-sales comment reuses the existing per-line persistence (it rides on the anon gate-sale line via the
new `note`), consistent with the D2 reload discipline (the anon rebuild now also carries `note`).

## Complexity Tracking

> No constitution deviation. One nuance worth recording: the spec wants **one comment for the anonymous-sales
> section**, but `gate_sales.note` is a **per-row** column. Resolution (see research R3): the page attaches the
> section comment to the anonymous gate-sale line(s) it writes and, on reopen, reads the note back from the
> first anonymous line that carries one. Consequence: a comment persists only when there is at least one
> anonymous sale amount to hang it on — acceptable (the comment describes sales that exist). No extra table or
> a door-record column is introduced (Q10 fixed the store as `gate_sales.note`).
