# Quickstart / Validation: Single-source admission pricing (P7-R10)

Assumes the dev DB is migrated (`0037`) and the dev server runs.

## 0. Setup

```bash
pnpm run db:migrate      # applies 0037_admission_pricing.sql
pnpm dev
```

## 1. Gate suite (fast, no browser)

```bash
pnpm exec vitest run \
  tests/unit/publicPricing.test.ts \
  tests/integration/admissionPricing.test.ts \
  tests/integration/admissionPricing.authz.test.ts \
  tests/component/pricingBlock.test.tsx
pnpm exec tsc --noEmit
pnpm run lint
```

Expected: effective-dated tiers resolve by event date; the per-event flat override wins; no pricing → `null`;
`setAdmissionPricing` audits; a base actor is refused the write; `pricingSummary` derives the card label.

## 2. Single source across surfaces (US1, FR-004) — browser

1. As a `parameter.write` actor at `/admission-pricing`, set the `tnc` (contra) series' tiers effective a past
   date: Supporter $15, Dancer $12, Student $5.
2. Load, for a Thursday contra event: the **home** strip, its **/whats-on card**, its **event detail**, and
   the **contra landing** (`/dances/contra`). Every surface shows the same pricing sourced from the one record
   — card shows the summary `$5–$15`; detail and landing show the three tiers (SC-001). No hand-typed `$` on
   any of those surfaces.

## 3. Effective dating & history (US2, FR-002/SC-003) — browser or test

- Add a later revision (Dancer $13 effective next month). An event **before** the change still shows $12; an
  event **on/after** shows $13. Past pricing is preserved.

## 4. Special-event override (US3, FR-003/SC-004) — browser

- Give one event a flat `advertised_price_cents` (e.g. a $25 special). That event shows **$25** everywhere; its
  sibling events still show the series tiers. Remove it → the event reverts to the series default.

## 5. No pricing (FR-006/SC-005)

- A series with no configured pricing and an event with no override shows **no price** on any surface — never
  `$0` or a blank amount.

## 6. Standing-schedule sentence (US4, FR-010)

- Set the `ecd` series' schedule sentence (including the DST note, e.g. "English, 2nd & 4th Sundays, 7:00 —
  7:30 during Standard Time"). It renders on `/dances/english` exactly as authored.

## 7. Authorization & audit (FR-007/FR-008/SC-006)

- A base volunteer cannot open/POST admission pricing (403). Every pricing change and schedule-sentence edit
  writes an `audit_events` row.

## Success criteria mapping

| Criterion | Validated by |
|-----------|--------------|
| SC-001 surfaces agree | §2 |
| SC-002 edit once → everywhere | §2 (one edit updates all) |
| SC-003 effective-dated history | §3 |
| SC-004 override on one event only | §4 |
| SC-005 none → no price | §5 |
| SC-006 audited + gated | §7, §1 |
