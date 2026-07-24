# Implementation Plan: Performer Payments, Membership Acquisition & Door-Record Fixes

**Branch**: `main` (no feature branch; one atomic commit per feature per project convention) | **Date**:
2026-07-21 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/019-payments-membership/spec.md`

## Summary

Feature 019 (P3-5) closes the FS/Treasurer finance surface and the three membership-acquisition paths, and
folds in two small door-surface fixes found in real use.

The technical spine is **one shared, transaction-capable membership-creation path**. `createMembership`
currently takes `Db` and opens its own transaction; it becomes `DbOrTx` so the door flow (US1) can commit a
membership atomically with the gate sale, and the online flow (US3) can reuse the identical routine. Expiry
comes from a new club-wide membership-year-end boundary stored on the **existing** `club_settings` singleton.

Performer payments (US2) become two new tables — `performer_payments` + a `payment_bookings` join — leaving
`bookings.pay_cents` as the untouched *expected* figure. The treasurer report switches its performer lines
from bookings to actual payments, with a reconciliation delta.

The online path (US3) needs the project's **first unauthenticated `/api/*` routes**, which requires
deliberately widening the default-deny guard that today exempts only `/api/auth/*`. This is the single
biggest architectural decision in the feature and is treated as such (research R2).

US4 relaxes the event-delete guardrail to a single testable predicate — *is the door record empty* — with an
attendee-count confirmation. US5 moves the seed float onto the existing effective-dated series-parameter
mechanism.

**Correction to an earlier note**: during specification I flagged that the feature would introduce "two
configuration mechanisms." It does not. `club_settings` (singleton, id=1) already exists and already holds
`long_lapse_cycles` / `cycle_definition`; the membership-year-end boundary is one more column on it. The seed
float uses the equally-existing `series_parameters`. Both configuration homes are pre-existing — the feature
adds no new configuration mechanism at all.

## Technical Context

**Language/Version**: TypeScript 5.7, strictest flags · Node 24 (`.nvmrc`), pnpm

**Primary Dependencies**: Next.js 16.2.10 (App Router, RSC, Turbopack) · React 19.2 · Drizzle ORM · Zod ·
`arctic` + `jose` (existing auth). **No new runtime dependency** — PayPal webhook verification is an HTTPS
call plus Zod parsing, not an SDK (research R1).

**Storage**: PostgreSQL 16. Hand-authored additive SQL: **`0024_payments_membership.sql`** (next after 0023),
including one intentional backfill of `performer_payments` from existing paid bookings (research R7).

**Testing**: Vitest against real local Postgres (`zak1_test`, `resetDb()` TRUNCATEs). PayPal is exercised at
its boundary per Constitution §Technology Standards — signed-payload fixtures, never production endpoints.

**Target Platform**: Web (staff admin/door surfaces + public site), single tenant, self-hosted.

**Project Type**: Web application — Next.js App Router monolith, server domain services under `src/server/`.

**Performance Goals**: No new hot path. Webhook handling must be idempotent and respond promptly enough that
PayPal does not retry-storm; everything else is existing admin-scale traffic (a few hundred contacts, tens of
events).

**Constraints**: Money always integer cents. `/api/*` is default-deny — the two new public endpoints are an
explicit, enumerated, test-guarded exemption (R2). Existing 450-test suite must stay green; the treasurer
report's current output must not regress (R7 backfill).

**Scale/Scope**: ~1335 contacts, one club. 5 user stories, 26 functional requirements, 2 new tables, 1 new
enum value set, 2 new public endpoints, 1 migration.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitution v1.2.0 — evaluated per principle.

| Principle | Gate | Verdict |
|---|---|---|
| **I. Test-First** | Every new behaviour has a failing test first; Red-Green-Refactor | **PASS** — tasks will be ordered test-first. The two pure predicates (`isEmptyDoorRecord`, membership-year-end resolution) are unit-testable in isolation before any wiring. |
| **II. YAGNI** | No speculative abstraction | **PASS with one tracked item** — `performer_payments` + `payment_bookings` is two tables where one would do *today*. Recorded in Complexity Tracking; it is the clarified requirement (one check settling several bookings) and a join is the only shape that expresses it. |
| **III. Type Safety** | Strictest flags; Zod at every external boundary | **PASS** — the PayPal webhook payload is the sharpest new boundary and is Zod-parsed into a typed domain object before any use. No `any`. The public capture form is likewise Zod-validated. |
| **IV. Observability** | Structured logging, audit, no ad-hoc prints | **PASS** — every new mutation writes an audit row through `writeAudit`/`recordAudit` (payment recorded, membership created by channel, webhook verified/rejected/parked, event deleted with attendee count). The webhook path especially: a rejected signature must be logged with enough context to investigate. |

**Testing standard** (§Technology Standards): the DB is never mocked — all integration tests hit real local
Postgres. PayPal falls squarely under the third-party exception added in v1.2.0 for exactly this shape of
dependency; the precedent is feature 015's Google boundary. All of *our* logic behind that seam — signature
verification wiring, payer-email matching, parking, idempotency, membership creation — is integration-tested
against real infrastructure.

**Development Workflow**: constitution v1.3.0 (amended 2026-07-23, prompted by this feature's
`/speckit-analyze` finding C1) recognizes **solo-maintainer mode**: one atomic commit per feature direct to
`main`, with the full local gate suite standing in for review. This plan complies as written. The amendment
pre-commits **multi-contributor mode** — feature branches + mandatory review, no self-merge — which activates
permanently the moment a second contributor (e.g. Zak) lands work.

### Post-Design Re-Check (after Phase 1)

Re-evaluated against the generated data model and contracts: **all four principles still PASS.** The design
added no escape hatches, no unlogged mutation, and no third table. The one thing design *changed* versus the
initial read is that `resolveParameterCents` cannot serve US5 unmodified (it collapses "unconfigured" and
"configured zero" to the same `0`) — handled by adding a sibling resolver rather than by loosening types, so
Principle III is unaffected. See research R4.

## Project Structure

### Documentation (this feature)

```text
specs/019-payments-membership/
├── plan.md              # This file
├── research.md          # Phase 0 output — R1..R8 decisions
├── data-model.md        # Phase 1 output — tables, columns, predicates
├── quickstart.md        # Phase 1 output — how to validate the feature
├── contracts/           # Phase 1 output — API contracts
│   ├── performer-payments.md
│   ├── membership-public.md
│   ├── paypal-webhook.md
│   ├── events-delete.md
│   └── seed-float-parameter.md
├── checklists/
│   └── requirements.md  # spec quality checklist (complete)
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── (admin)/
│   │   ├── events/page.tsx              US4: delete confirm showing attendee count
│   │   ├── payments/page.tsx            US2 NEW: record/override performer payments
│   │   └── parameters/…                 US5: seed-float parameter row
│   ├── (door)/gate/page.tsx             US1: named membership line; US5: seed float pre-fill
│   ├── (public)/join/page.tsx           US3 NEW: membership capture + PayPal hosted button
│   └── api/
│       ├── performer-payments/route.ts          US2 (withAuth: performer_payment.write)
│       ├── performer-payments/[id]/route.ts     US2
│       ├── events/[id]/route.ts                 US4: DELETE gains confirm param
│       ├── public/membership/route.ts           US3 NEW — UNAUTHENTICATED (R2)
│       └── webhooks/paypal/route.ts             US3 NEW — UNAUTHENTICATED (R2)
├── server/
│   ├── auth/
│   │   ├── capabilities.ts              no new capability — all five already exist
│   │   └── withPublic.ts                NEW: explicit public-route wrapper (R2)
│   ├── domain/
│   │   ├── membership/
│   │   │   ├── membershipService.ts     createMembership → DbOrTx (R6)
│   │   │   └── membershipTerm.ts        NEW: pure next-year-end resolution (R3)
│   │   ├── payments/                    NEW
│   │   │   ├── performerPaymentService.ts
│   │   │   └── reconcile.ts             pure expected-vs-actual delta
│   │   ├── door/
│   │   │   ├── doorRecordService.ts     US1 reconcile; US5 seeded float
│   │   │   └── calc.ts                  NEW: isEmptyDoorRecord predicate (pure)
│   │   ├── events/eventService.ts       US4 guardrail rewrite
│   │   ├── parameters/seriesParameterService.ts  US5 resolver returning null
│   │   ├── treasurer/reportService.ts   US2: performer lines from payments
│   │   └── paypal/                      NEW
│   │       ├── verify.ts                signature verification at the boundary
│   │       └── captureService.ts        capture, match, park
│   ├── db/
│   │   ├── schema/{performerPayments,membershipCaptures}.ts  NEW
│   │   ├── schema/{clubSettings,seriesParameters,enums}.ts   extended
│   │   └── migrations/0024_payments_membership.sql           NEW
│   └── validation/{payments,membershipPublic,paypal}.ts      NEW Zod schemas
└── tests/
    ├── unit/            pure: membershipTerm, isEmptyDoorRecord, reconcile, paypal verify
    └── integration/     real Postgres: all five stories end-to-end
```

**Structure Decision**: No structural change. This is the established Next.js App Router monolith —
route groups `(admin)`/`(door)`/`(public)` for UI, `src/app/api/**/route.ts` for endpoints, domain logic in
`src/server/domain/<area>/`, Zod schemas in `src/server/validation/`, hand-authored SQL in
`src/server/db/migrations/`. The feature adds two domain areas (`payments/`, `paypal/`) alongside the
existing dozen, matching their conventions exactly.

## Complexity Tracking

> Filled because two design choices warrant justification against Principle II (YAGNI).

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| Two tables (`performer_payments` + `payment_bookings`) for one concept | The clarified requirement is one check settling **several** bookings, and a booking possibly covered by a payment to a **different** payee. That is a many-to-many by definition. | Columns on `bookings` (today's shape) cannot express aggregation — one check number across three rows is already what the FS fakes by hand, and it makes the report unreconcilable. A single payment table with one `booking_id` handles substitution but still not aggregation. |
| Widening `/api/*` default-deny with an enumerated public allowlist | US3 requires a public capture form and a PayPal webhook. Neither can carry a staff session; PayPal will never authenticate as a volunteer. | Putting the webhook behind `withAuth` is impossible. A shared secret in the URL was rejected: it is a credential in a query string, it does not survive rotation, and it is strictly weaker than the signature verification FR-011 already mandates. The allowlist stays explicit, enumerated in code, and asserted by the existing route-inventory test so a *third* public route cannot appear unnoticed. |
