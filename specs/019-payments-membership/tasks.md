# Tasks: Performer Payments, Membership Acquisition & Door-Record Fixes

**Input**: Design documents from `specs/019-payments-membership/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: INCLUDED — Constitution I (Test-First) is non-negotiable. Every story phase orders its failing
tests before its implementation; confirm each fails for the right reason before making it pass.

**Organization**: Grouped by user story. US1 is the MVP increment; US2/US4/US5 are independent of each other;
US3 builds on US1's shared path; US4's guardrail references US2's *table* (created in Setup), not its service.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallelizable (different files, no dependency on an incomplete task)
- **[Story]**: US1–US5, story phases only

## Path Conventions

Single Next.js App Router project: `src/app/**` (UI + API routes), `src/server/**` (domain/db/auth/validation),
`tests/{unit,integration}/`. All commands need Node 24 first:
`export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 24 >/dev/null 2>&1`.

---

## Phase 1: Setup (migration + schema)

**Purpose**: Everything that touches the database shape, in one additive migration, so every story builds on
committed schema. Per [data-model.md](data-model.md).

- [x] T001 Snapshot `zak1_dev` before anything else (`set -a; . ./.env; set +a; pg_dump -Fc "$DATABASE_URL" -f ~/zak1_pre_0024.dump`) — migration 0024 contains an intentional backfill (research R7)
- [x] T002 Write `src/server/db/migrations/0024_payments_membership.sql`: tables `performer_payments`, `payment_bookings`, `membership_captures`, `paypal_notifications` (UNIQUE `provider_event_id`); enums `capture_status`, `notification_status`; `ALTER TYPE parameter_category ADD VALUE 'door'` and `parameter_kind ADD VALUE 'seed_float'` (separate statements — added enum values are unusable in the same transaction); `club_settings.membership_year_end` text NOT NULL DEFAULT '08-31'; `memberships.source_gate_sale_id` / `source_notification_id` with partial unique indexes; backfill `performer_payments` + `payment_bookings` from bookings with `pay_cents > 0` (header comment flags the backfill, as 0023's did)
- [x] T003 [P] New Drizzle schema files `src/server/db/schema/performerPayments.ts` (both payment tables), `src/server/db/schema/membershipCaptures.ts`, `src/server/db/schema/paypalNotifications.ts`; export all from `src/server/db/schema/index.ts`
- [x] T004 [P] Extend existing Drizzle schemas to mirror T002: `src/server/db/schema/enums.ts` (two new pgEnums + `parameter_category`/`parameter_kind` values), `src/server/db/schema/clubSettings.ts` (`membershipYearEnd`), `src/server/db/schema/memberships.ts` (two source columns)
- [x] T005 Apply with `pnpm run db:migrate`; verify backfill row counts match `SELECT count(*) FROM bookings WHERE pay_cents > 0`; `pnpm exec tsc --noEmit` green; existing 450-test suite still green

**Checkpoint**: Schema committed to both databases; nothing behavioural has changed yet.

---

## Phase 2: Foundational (shared membership path)

**Purpose**: The two pieces both acquisition channels (US1, US3) stand on. Blocking for US1/US3 only —
US2/US4/US5 do not depend on this phase.

- [x] T006 [P] Failing unit tests in `tests/unit/membershipTerm.test.ts`: next boundary strictly after payment date; payment **on** the boundary returns that date; Dec→Jan year rollover; `02-29` boundary in a non-leap year
- [x] T007 Implement pure `nextMembershipYearEnd(paymentDate, boundaryMMDD)` in `src/server/domain/membership/membershipTerm.ts` (no DB access) — tests from T006 green
- [x] T008 [P] Failing integration test in `tests/integration/membership.tx.test.ts`: `createMembership` called inside a surrounding transaction that then throws leaves NO membership, NO status change, NO audit row (FR-001 scenario 4); duplicate `source_gate_sale_id` insert rejected by the partial unique index
- [x] T009 Refactor `createMembership` in `src/server/domain/membership/membershipService.ts` to accept `DbOrTx` (own transaction only when handed a plain `Db` — pattern of `recomputeContactStatus`) and optional `sourceGateSaleId`/`sourceNotificationId`; extend `src/server/validation/memberships.ts` accordingly — T008 green, existing membership tests untouched

**Checkpoint**: Shared path is transaction-capable; full suite green.

---

## Phase 3: User Story 1 — Door membership enrollment (P1) 🎯 MVP

**Goal**: A **named** gate membership payment creates/renews the membership and recomputes status, atomically
with the gate sale (FR-001..FR-004).

**Independent test**: quickstart US1 — named line → membership with year-end expiry; re-save → still one
membership; anonymous line → money only; forced failure → nothing persists.

- [x] T010 [US1] Failing integration tests in `tests/integration/gate.membership.test.ts`: (a) named membership line → membership + recomputed status in the same transaction; (b) expiry = next `membership_year_end` after event date; (c) **saving identical gate sales twice creates exactly one membership** (research R5 — `putGateSales` is replace-all; this is the trap); (d) anonymous membership line → money only; (e) injected failure after the line insert rolls back sale AND membership; (f) removing a membership line does NOT revoke the membership (R5's deliberate asymmetry); (g) a named contact with **no existing payer record** gets one created in the same transaction (`memberships.payer_id` is NOT NULL — analyze G1)
- [x] T011 [US1] Implement the reconcile in `src/server/domain/door/doorRecordService.ts`: inside `putGateSales`' transaction, after replace-all, ensure one membership per named `membership` line via `createMembership(tx, …, { sourceGateSaleId })` with expiry from `nextMembershipYearEnd` + `club_settings`, **creating-or-reusing a payer for the contact first** (existing `createPayer`; `payer_id` is NOT NULL); skip contacts whose current membership already reaches that boundary (renewal no-op); audit `membership.door_enrollment` via `writeAudit` — T010 green
- [x] T012 [US1] Surface the result on `src/app/(door)/gate/page.tsx`: after save, show which named contacts' memberships were created/renewed (the FS needs to see it worked; no new API — return it from the PUT response)
- [x] T013 [US1] Run quickstart US1 manual validation against `pnpm dev` (preview); confirm `zak1_dev` contact status updates end-to-end

**Checkpoint**: US1 shippable alone — door dues now become memberships.

---

## Phase 4: User Story 2 — Performer payment override (P2)

**Goal**: Payments separate from bookings: substitute payee, one check across bookings, report from actuals
(FR-005..FR-009). Independent of Phases 2–3.

**Independent test**: quickstart US2 — substitute payee; aggregated check; report reconciles; rates untouched.

- [x] T013a [US2] **(done — applied 2026-07-23, ahead of implementation)** Grant the FS `performer.write` (FR-009a): `performer` added to `FS_CAPABILITIES` in `src/server/auth/capabilities.ts` (FS `scoped`, Treasurer `global` via the flattened superset); unit coverage in `tests/unit/authz.can.test.ts` (FS own-series only; Treasurer club-wide); `docs/use-cases.md` matrix row 6 + §5.2.6a updated. This lets the FS create an unknown substitute's performer/contact inline (T022) with no Booker handoff
- [x] T014 [P] [US2] Failing unit tests in `tests/unit/paymentReconcile.test.ts`: expected/actual/delta sums incl. negative delta and empty payment list
- [x] T015 [US2] Implement pure `reconcilePayments(expected, actual)` in `src/server/domain/payments/reconcile.ts` — T014 green
- [x] T016 [P] [US2] Zod schemas in `src/server/validation/payments.ts`: create (eventId, payeePerformerId, amount ≥ 0, checkNumber?, overrideReason?, bookingIds min 1), patch, list views
- [x] T017 [US2] Failing integration tests in `tests/integration/performerPayments.test.ts`: create with payee ≠ booked performer; one payment linking three bookings; `BOOKING_EVENT_MISMATCH` 422 for a booking from another event; **`bookings.pay_cents` byte-identical before/after every operation** (FR-007/SC-003); patch replaces link set; delete cascades join rows only; `assertEventScope` refusal for an out-of-scope FS
- [x] T018 [US2] Implement `src/server/domain/payments/performerPaymentService.ts` (create/patch/delete/listByEvent + reconciliation via T015), layer-2 scope checks per `assertGateScope` pattern, audits — T017 green
- [x] T019 [US2] API routes `src/app/api/performer-payments/route.ts` (POST), `src/app/api/performer-payments/[id]/route.ts` (PATCH/DELETE), `src/app/api/events/[id]/performer-payments/route.ts` (GET, `requires: 'base'`) — all others `requires: 'performer_payment.write'` per [contracts/performer-payments.md](contracts/performer-payments.md)
- [x] T020 [US2] Failing regression test in `tests/integration/treasurer.paymentsCutover.test.ts`: a backfilled historical event's report `performerPayments` block is identical to the pre-cutover shape `{ payee, amount, account, class, checkNumber }`
- [x] T021 [US2] Cut `src/server/domain/treasurer/reportService.ts` performer lines over to `performer_payments` (payee name via `performers`, `account` from settled bookings' types) and add the reconciliation block — T020 green
- [x] T022 [US2] New admin page `src/app/(admin)/payments/page.tsx`: per-event payment entry (payee picker **over performer records**, amount, check, reason, booking checklist), list with reconciliation delta. An unknown substitute is created first via the existing performers surface — the FS reaches it directly now that they hold `performer.write` (T013a; all performers are contacts, so the contact is created there too); the payment-recording step itself never mints performers (Clarifications 2026-07-23)
- [x] T023 [US2] Run quickstart US2 manual validation

**Checkpoint**: US2 shippable — actual disbursements recorded and reported.

---

## Phase 5: User Story 3 — Online membership purchase (P3)

**Goal**: Public capture page + PayPal hosted button + verified, idempotent webhook reusing US1's path
(FR-010..FR-014). Depends on Phase 2 (shared path); benefits from US1 patterns.

**Independent test**: quickstart US3 — capture → simulated verified notification → membership; replay → one
membership; unmatched → parked → admin links.

- [x] T024 [US3] Extend the guard first, failing: `tests/integration/auth.routeInventory.test.ts` asserts every route is `withAuth` OR `withPublic`, and the `withPublic` set is **exactly** `/api/public/membership` + `/api/webhooks/paypal` (research R2 — the allowlist is the architecture; the test is its enforcement)
- [x] T025 [US3] Implement `src/server/auth/withPublic.ts` (wraps `withLogging` exactly as `withAuth` does; declares deliberate publicity) and teach `src/server/lib/routeInventory.ts` to report it as a wrapper — T024 green once both routes exist (T030/T031)
- [x] T026 [P] [US3] Zod schemas: `src/server/validation/membershipPublic.ts` (name, email) and `src/server/validation/paypal.ts` (notification payload: id, event_type, payer email, amount — field paths per contract; confirm against a sandbox capture before freezing)
- [x] T027 [P] [US3] Failing unit test `tests/unit/paypalVerify.test.ts`: the verification seam returns boolean; a `false` outcome halts processing with nothing stored. Implement `src/server/domain/paypal/verify.ts` as the single injectable seam calling PayPal's `verify-webhook-signature` (env: webhook id alongside the Google secrets; never called by tests — Constitution v1.2.0 third-party boundary)
- [x] T028 [US3] Failing integration tests in `tests/integration/paypalCapture.test.ts` (fixture payloads, stubbed verify outcomes, real Postgres): capture→match→membership via shared path; payer-email match is case-insensitive; verified-unmatched → `parked`, still recorded; duplicate `provider_event_id` → **unique-violation path creates exactly one membership** (FR-013); failed verification → both tables empty; steps insert+match are one transaction; capture with no payment stays `awaiting_payment`; **two `awaiting_payment` captures with the same email → the latest wins**, older marked `expired` (analyze U2); matched member with no payer record gets one created in-transaction (analyze G1); a burst of capture POSTs → 429 (analyze G2)
- [x] T029 [US3] Implement `src/server/domain/paypal/captureService.ts`: createCapture; processNotification per the ordered contract in [contracts/paypal-webhook.md](contracts/paypal-webhook.md) (parse → verify → insert-or-duplicate → match/park → 200), membership via `createMembership(tx, …, { sourceNotificationId })` with payer create-or-reuse for the matched member, latest-capture-wins matching, structured logs on reject/park — T028 green
- [x] T030 [US3] Public route `src/app/api/public/membership/route.ts` (POST, `withPublic`): create capture, return only `{ captureId }`, **in-memory per-IP** rate limit → 429 (fine single-tenant; the contract's privacy + abuse notes are requirements, not suggestions)
- [x] T031 [US3] Webhook route `src/app/api/webhooks/paypal/route.ts` (POST, `withPublic`): headers + body to `processNotification`; responses exactly 400/401/200 per contract, bodies uninformative
- [x] T032 [US3] Admin fallback: `src/app/api/membership-captures/parked/route.ts` (GET) + `src/app/api/membership-captures/[id]/link/route.ts` (POST), both `requires: 'membership.write'`; failing integration test first in `tests/integration/parkedPayments.test.ts` proving an admin-linked payment yields a membership identical to an auto-matched one; minimal admin UI section (parked list + contact picker) in `src/app/(admin)/payments/page.tsx`
- [x] T033 [US3] Public page `src/app/(public)/join/page.tsx`: capture form posting to `/api/public/membership`, then the hosted PayPal button `Z5FUDMVGE6CVQ` as-is; copy says membership activates **when payment is confirmed** (the button gives no callback — the page must not claim success); lazily **write** `status = 'expired'` on stale `awaiting_payment` captures when the admin/matching queries encounter them (no cron — YAGNI; the write, not a filter, keeps the state model honest — analyze I2)
- [x] T034 [US3] Run quickstart US3 manual validation (fixture notification against local dev)

**Checkpoint**: US3 shippable — all three acquisition paths live.

---

## Phase 6: User Story 4 — Delete a never-held event (P4)

**Goal**: Empty door record = no history; attendance never blocks but its count must be confirmed
(FR-017..FR-020). Depends only on Phase 1 (the `performer_payments` table must exist for FR-019).

**Independent test**: quickstart US4 — the two real `tnc` 2026-07-16 events delete with a count prompt; an
event with a gate sale refuses, naming the blocker.

- [x] T035 [P] [US4] Failing unit tests in `tests/unit/isEmptyDoorRecord.test.ts`: all-zero → empty; each money field/count non-zero individually → not empty; **non-default seed float alone → still empty** (the crux — R8); one gate sale → not empty
- [x] T036 [US4] Implement pure `isEmptyDoorRecord(row, gateSaleCount)` in `src/server/domain/door/calc.ts` — T035 green
- [x] T037 [US4] Failing integration tests in `tests/integration/eventDelete.guardrail.test.ts`: empty door record → deletes, record cascades; gate sale / non-zero count / booking check number / **performer payment** → 409 `EVENT_HAS_HISTORY` with `detail` naming the blocker; attendance + no confirm → 409 `EVENT_HAS_ATTENDANCE` with `attendeeCount`; with `confirmDiscardAttendance=true` → deletes; **confirm flag does NOT bypass a real blocker** (spec US4 scenario 4 — the failure mode that would destroy financial records)
- [x] T038 [US4] Rewrite the guardrail in `src/server/domain/events/eventService.ts` `deleteEvent` per [contracts/events-delete.md](contracts/events-delete.md); add `EVENT_HAS_ATTENDANCE` + `EVENT_HAS_HISTORY` detail payload to `src/server/lib/apiError.ts`; audit includes discarded attendee count — T037 green
- [x] T039 [US4] Thread `confirmDiscardAttendance` through DELETE in `src/app/api/events/[id]/route.ts`
- [x] T040 [US4] Update `deleteEvent` in `src/app/(admin)/events/page.tsx`: `EVENT_HAS_ATTENDANCE` → confirm prompt showing the count **before** retrying with the flag; `EVENT_HAS_HISTORY` → show the named blocker (replaces the fixed "cancel it instead" string at line 64)
- [x] T041 [US4] Manually delete the two never-held `tnc` 2026-07-16 events in `zak1_dev` via the UI — the real-world verification (then note it; the cleanup itself is operational, spec Out of Scope)

**Checkpoint**: US4 shippable — never-held events deletable, financial history still locked.

---

## Phase 7: User Story 5 — Configurable door seed float (P5)

**Goal**: Seed float as a per-series effective-dated parameter; FS override unchanged (FR-021..FR-026).
Depends only on Phase 1 (enum values).

**Independent test**: quickstart US5 — configured $20 flows to new door records and the gate page; override
stays per-record; old records keep their float; unconfigured series → $15.

- [x] T042 [P] [US5] Failing unit/integration tests in `tests/integration/seedFloatParameter.test.ts`: `resolveParameterCentsOrNull` returns `null` unconfigured / `0` for configured-zero / latest ≤ date otherwise (R4 — the existing resolver's `0` collapse is exactly the bug to avoid); door record created in a configured series gets the configured float; unconfigured → 1500 fallback; configured `$0` → 0, not 1500; changing the parameter leaves existing door records' floats untouched (FR-025); per-record override still per-record (FR-023)
- [x] T043 [US5] Implement `resolveParameterCentsOrNull` in `src/server/domain/parameters/seriesParameterService.ts` (sibling — do NOT change `resolveParameterCents`, its `0` is correct for rates/expenses); resolve in `createDoorRecord`/`ensureDoorRecord` in `src/server/domain/door/doorRecordService.ts` by event date with `CLUB_DEFAULT_SEED_FLOAT_CENTS = 1500` fallback — T042 green
- [x] T044 [US5] Route `src/app/api/door-parameters/route.ts` (POST `parameter.write`, GET `base`) + `createDoorParameter` in `seriesParameterService.ts`, mirroring the rate-parameters sibling per [contracts/seed-float-parameter.md](contracts/seed-float-parameter.md)
- [x] T045 [US5] UI: replace `useState("15")` in `src/app/(door)/gate/page.tsx:42` with initialisation from the fetched `DoorRecordView.seedFloat` (already in the payload — no new fetch); add the seed-float row to the series parameters admin surface alongside rates/expenses
- [x] T046 [US5] Run quickstart US5 manual validation

**Checkpoint**: All five stories shippable.

---

## Phase 8: Polish & Cross-Cutting

- [x] T047 Full gates: `pnpm test` (baseline 450 + all new green), `pnpm exec tsc --noEmit`, `pnpm run lint`, `pnpm exec prettier --check .`, `pnpm build`
- [x] T048 [P] Verify `/dev/routes` (Super-user) lists the new routes, including the two public ones with their `withPublic` wrapper visible
- [x] T049 [P] Update `specs/BACKLOG.md`: B28/B30/B31 → done (019); Project Context §9 items 1–2 → done (019)
- [x] T050 [P] Add feature 019 terms to `docs/zak1_Help_Glossary.md` (performer payment, payment↔booking link, membership capture, parked payment, membership year-end, seed float parameter)
- [x] T051 Walk the full [quickstart.md](quickstart.md) once end-to-end, including the three pre-rollout operational items (real year-end date, sandbox payload confirmation, consent-screen publish) — flag, don't fix

---

## Dependencies

```text
Phase 1 (Setup) ─┬─> Phase 2 (Foundational) ─┬─> Phase 3 US1 ─> Phase 5 US3
                 │                            │   (US3 also needs T024/T025 guard work, internal to Phase 5)
                 ├─────────────────────────────> Phase 4 US2 ──> (T021 report cutover after T020)
                 ├─────────────────────────────> Phase 6 US4   (needs only the performer_payments TABLE)
                 └─────────────────────────────> Phase 7 US5   (needs only the enum values)
Phase 8 after all story phases.
```

- US2, US4, US5 are **independent of each other and of US1/US3** once Phase 1 lands
- US3 requires Phase 2 + ideally US1 (shared-path patterns); it is the deferral candidate if the
  public-route decision (R2) is reconsidered
- Within every story: tests (fail) → implementation (pass) → UI → manual validation

## Parallel Execution Examples

- **After Phase 1**: T006+T008 (Foundational tests) ∥ T014/T016 (US2) ∥ T035 (US4) ∥ T042 (US5)
- **Within US2**: T014, T016 in parallel; T017 after T016
- **Within US3**: T026, T027 in parallel after T024
- **Phase 8**: T048, T049, T050 in parallel after T047

## Implementation Strategy

**MVP = Phase 1 + Phase 2 + US1** (T001–T013): door dues become memberships — the highest-value gap, and it
exercises the shared path US3 later reuses. Then US2 (finance correctness), then US4+US5 (small,
independent, quick), then US3 last — it carries the external dependency (PayPal sandbox payload) and the
architectural decision (public routes), so it lands when everything else is already green. One atomic commit
per project convention; ask before pushing.
