# Phase 1 Data Model: Feature 019

**Date**: 2026-07-21 · **Plan**: [plan.md](plan.md) · **Research**: [research.md](research.md)

All changes land in one additive migration, **`0024_payments_membership.sql`**. Money is integer cents
throughout. Drizzle schema files mirror the SQL by hand, per project convention.

---

## New tables

### `performer_payments` (US2 / FR-005)

What was **actually disbursed**, as opposed to what a booking says is owed.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | `defaultRandom()` |
| `event_id` | `uuid` NOT NULL → `events.id` `ON DELETE CASCADE` | Settlement is per event (spec Assumptions); also what makes FR-019's delete check cheap |
| `payee_performer_id` | `uuid` NOT NULL → `performers.id` | **May differ** from any booked performer — this is the substitution FR-005 exists for. An unknown substitute gets a performer record (and its contact — all performers must be contacts) created **first**, via the existing performers surface; the payment flow never mints either (Clarifications 2026-07-23) |
| `amount_cents` | `integer` NOT NULL | Actual disbursement |
| `check_number` | `text` NULL | One check may cover several bookings via the join |
| `override_reason` | `text` NULL | Why actual ≠ expected ("substitute — snowed in") |
| `created_at` / `updated_at` | `timestamptz` NOT NULL | |

**Not** `ON DELETE CASCADE` from performers: a payee is financial history and must not vanish with a
performer record.

### `payment_bookings` (US2 / FR-006)

The many-to-many that lets one check settle several obligations.

| Column | Type | Notes |
|---|---|---|
| `payment_id` | `uuid` NOT NULL → `performer_payments.id` `ON DELETE CASCADE` | |
| `booking_id` | `uuid` NOT NULL → `bookings.id` `ON DELETE CASCADE` | |
| PK | `(payment_id, booking_id)` | Composite; makes double-linking impossible |

A booking may legitimately appear under **zero** payments (unpaid yet) or **one** (settled). Two payments
covering one booking is permitted by the shape and is how a split payment is recorded; the reconciliation
delta is what surfaces any mismatch, rather than a constraint forbidding it.

### `membership_captures` (US3 / FR-010)

Prospective-member info submitted on the public form, held server-side awaiting a matched notification.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `email` | `text` NOT NULL | The **match key** against the webhook's payer email; compared case-insensitively |
| `name` | `text` NOT NULL | |
| `contact_id` | `uuid` NULL → `contacts.id` | Set when matched to an existing contact; null until then |
| `status` | `capture_status` NOT NULL default `'awaiting_payment'` | See state transitions |
| `created_at` | `timestamptz` NOT NULL | Drives expiry of never-paid captures (spec edge case) |

### `paypal_notifications` (US3 / FR-011, FR-013)

Every verified notification, and the parking lot for unmatched ones.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `provider_event_id` | `text` NOT NULL **UNIQUE** | **This unique constraint IS the idempotency guarantee** (FR-013) — a replay hits it and is discarded, rather than relying on application-level checking |
| `event_type` | `text` NOT NULL | e.g. `PAYMENT.CAPTURE.COMPLETED` |
| `payer_email` | `text` NULL | |
| `amount_cents` | `integer` NOT NULL | |
| `capture_id` | `uuid` NULL → `membership_captures.id` | Set when matched |
| `status` | `notification_status` NOT NULL | See state transitions |
| `raw_payload` | `jsonb` NOT NULL | Kept for manual reconciliation of parked payments |
| `received_at` | `timestamptz` NOT NULL | |

Unverifiable notifications are **rejected, not stored** (FR-011 scenario 3) — storing unverified payloads
would make the table an unauthenticated write target.

---

## Modified tables

### `memberships` (US1 / R5)

| Column | Change |
|---|---|
| `source_gate_sale_id` | **NEW** `uuid` NULL → `gate_sales.id` `ON DELETE SET NULL`; UNIQUE where not null |
| `source_notification_id` | **NEW** `uuid` NULL → `paypal_notifications.id`; UNIQUE where not null |

Both nullable — an admin-entered membership has neither. The **partial unique indexes are what make the two
acquisition channels idempotent**: gate-page re-saves (replace-all, R5) and webhook replays (FR-013) both
collide rather than duplicate. `ON DELETE SET NULL` on the gate-sale link is the deliberate asymmetry from
R5: removing a gate line orphans the provenance, it does not revoke the membership.

### `club_settings` (US1/US3 / FR-003a)

| Column | Change |
|---|---|
| `membership_year_end` | **NEW** `text` NOT NULL DEFAULT `'08-31'` — a `MM-DD` month-day |

Year-agnostic by construction (R3). The default is a **placeholder pending the club's operational decision**;
it must be confirmed before rollout.

### `series_parameters` (US5 / FR-021)

No column change — two enum values:

- `parameter_category` gains **`door`**
- `parameter_kind` gains **`seed_float`**

Postgres `ALTER TYPE … ADD VALUE` cannot run inside a transaction block in older versions; the migration must
account for this (Postgres 16 permits it, but the added value is not usable in the same transaction).
**Practical consequence: the enum additions must be a separate statement/migration step from any insert that
uses them.**

### `door_records` (US5 / FR-022, FR-025)

No schema change. The column default `1500` **stays** as the documented club fallback (FR-024); what changes
is that `createDoorRecord`/`ensureDoorRecord` now resolve the series parameter and pass an explicit value,
so the default applies only when nothing is configured. The float remains **copied at creation and never
re-resolved**, which is what gives FR-025 for free.

---

## New enums

| Enum | Values |
|---|---|
| `capture_status` | `awaiting_payment`, `matched`, `expired` |
| `notification_status` | `matched`, `parked`, `resolved` |

---

## State transitions

### Membership capture

```text
awaiting_payment ──(verified notification, payer email matches)──> matched
awaiting_payment ──(no payment within retention window)─────────> expired
awaiting_payment ──(same email submits a newer capture)─────────> expired   (latest capture wins)
```

`expired` is written **lazily** when admin/matching queries encounter a stale or superseded capture — no
cron. When several `awaiting_payment` captures share an email, the **latest** (`created_at`) is the match
target; older ones expire.

### PayPal notification

```text
(unverifiable) ────────> REJECTED — 4xx, never stored (FR-011.3)
(verified, matched) ───> matched  ──> membership created/renewed (FR-012)
(verified, unmatched) ─> parked   ──(admin links to a capture/contact)──> resolved
```

`parked → resolved` is the manual-linking path FR-011 requires. A parked payment is never dropped and never
auto-expires — it represents real money received.

### Booking ↔ payment (no new booking states)

`bookings.status` is untouched by this feature. `bookings.pay_cents` remains the **expected** figure and is
never written by the payment path (FR-007) — the only guard needed is that no payment code path updates it.

---

## Derived values and pure functions

These carry the logic most likely to be subtly wrong, so all four are pure and unit-tested before wiring:

| Function | Location | Contract |
|---|---|---|
| `nextMembershipYearEnd(paymentDate, boundaryMMDD)` | `domain/membership/membershipTerm.ts` | Next occurrence of the boundary on/after the payment date. Must handle a payment **on** the boundary (returns that date), and Feb-29 boundaries. |
| `isEmptyDoorRecord(row, gateSaleCount)` | `domain/door/calc.ts` | True when `gateSaleCount === 0` and every money field and count is zero. **`seed_float_cents` is excluded** — it is a default, not takings (R8). |
| `reconcilePayments(expected[], actual[])` | `domain/payments/reconcile.ts` | Returns `{ expectedCents, actualCents, deltaCents }` for FR-008. Delta ≠ 0 is surfaced, never an error. |
| `resolveParameterCentsOrNull(...)` | `domain/parameters/seriesParameterService.ts` | Sibling of the existing resolver, distinguishing "unconfigured" (`null`) from "configured zero" (`0`) — see R4. |

---

## Data integrity notes

1. **Idempotency is enforced in the database, not the application** — `paypal_notifications.provider_event_id`
   UNIQUE and the two partial unique indexes on `memberships`. Application checks race; constraints do not.
2. **The backfill (R7)** creates one `performer_payments` row + one `payment_bookings` row per existing
   booking with `pay_cents > 0`, carrying over payee, amount, and check number, so the treasurer report does
   not regress at cutover. It is the one intentional non-additive act in migration 0024 and must be called
   out in the migration header, as 0023's was.
3. **`bookings.pay_cents` is never written by this feature.** Worth an explicit test (FR-007 / SC-003) rather
   than trusting review.
